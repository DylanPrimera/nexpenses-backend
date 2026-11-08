import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BusinessExpense, Prisma } from '@prisma/client';
import { ExpensesService } from '../expenses/expenses.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  isUniqueViolation,
  requireBusiness,
  requireUser,
  resolveBankName,
} from './business-access.js';
import { ensureBusinessCategory } from './business-category.js';
import {
  parseMonthRange,
  parseSpentOn,
  personalExpenseDate,
  toDayKey,
} from './business-dates.js';
import { toPersonalPaymentType } from './business-payment.js';
import {
  BusinessIncomesQueryDto,
  CreateBusinessExpenseDto,
  UpdateBusinessExpenseDto,
} from './dto/index.js';

type PersonalExpense = Awaited<ReturnType<ExpensesService['findOne']>>;

export type BusinessExpenseView = {
  id: string;
  title: string;
  amount: number;
  spentOn: string;
  paymentMethod: BusinessExpense['paymentMethod'];
  bankName: string | null;
  personalExpenseId: string | null;
  discountedFromPersonal: boolean;
  createdAt: string;
};

export type PersonalSync = {
  upserted: PersonalExpense | null;
  removedExpenseId: string | null;
};

export type BusinessExpenseResult = {
  expense: BusinessExpenseView;
  personalSync: PersonalSync;
};

function expenseNotFound(): NotFoundException {
  return new NotFoundException({
    message: 'Gasto del negocio no encontrado',
    code: 'BUSINESS_EXPENSE_NOT_FOUND',
  });
}

export function toExpenseView(row: BusinessExpense): BusinessExpenseView {
  return {
    id: row.id,
    title: row.title,
    amount: row.amount,
    spentOn: toDayKey(row.spentOn),
    paymentMethod: row.paymentMethod,
    bankName: row.bankName,
    personalExpenseId: row.personalExpenseId,
    discountedFromPersonal: row.personalExpenseId !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class BusinessExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expenses: ExpensesService,
  ) {}

  async listExpenses(userId: string, query: BusinessIncomesQueryDto) {
    const spentOn = parseMonthRange(query.month);
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const business = await requireBusiness(this.prisma, userId);
    const where: Prisma.BusinessExpenseWhereInput = {
      businessId: business.id,
      spentOn,
    };
    const [rows, total] = await Promise.all([
      this.prisma.businessExpense.findMany({
        where,
        orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.businessExpense.count({ where }),
    ]);
    return { items: rows.map(toExpenseView), total, limit, offset };
  }

  async createExpense(
    userId: string,
    dto: CreateBusinessExpenseDto,
  ): Promise<BusinessExpenseResult> {
    const replay = await this.findIdempotent(userId, dto.id);
    if (replay) return replay;
    const spentOn = parseSpentOn(dto.spentOn);
    const bankName = resolveBankName(dto.paymentMethod, dto.bankName);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const business = await requireBusiness(tx, userId);
        let upserted: PersonalExpense | null = null;
        let personalCycleStartedAt: Date | null = null;
        if (dto.discountFromPersonal) {
          const user = await requireUser(tx, userId);
          upserted = await this.expenses.createWithin(tx, userId, {
            id: randomUUID(),
            amount: dto.amount,
            categoryId: await ensureBusinessCategory(tx, userId, business),
            title: dto.title,
            description: null,
            paymentType: toPersonalPaymentType(dto.paymentMethod),
            date: personalExpenseDate(
              dto.spentOn,
              user.cycleStartedAt,
            ).toISOString(),
          });
          personalCycleStartedAt = user.cycleStartedAt;
        }
        const created = await tx.businessExpense.create({
          data: {
            id: dto.id,
            businessId: business.id,
            title: dto.title,
            amount: dto.amount,
            spentOn,
            paymentMethod: dto.paymentMethod,
            bankName,
            personalExpenseId: upserted?.id ?? null,
            personalCycleStartedAt,
          },
        });
        return {
          expense: toExpenseView(created),
          personalSync: { upserted, removedExpenseId: null },
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.findIdempotent(userId, dto.id);
        if (raced) return raced;
      }
      throw error;
    }
  }

  async updateExpense(
    userId: string,
    id: string,
    dto: UpdateBusinessExpenseDto,
  ): Promise<BusinessExpenseResult> {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockExpense(tx, userId, id);
      const title = dto.title ?? current.title;
      const amount = dto.amount ?? current.amount;
      const paymentMethod = dto.paymentMethod ?? current.paymentMethod;
      const spentOn =
        dto.spentOn !== undefined ? parseSpentOn(dto.spentOn) : current.spentOn;
      const spentOnKey = toDayKey(spentOn);
      const bankName = resolveBankName(
        paymentMethod,
        dto.bankName,
        current.bankName,
      );
      const wantsPersonal =
        dto.discountFromPersonal ?? current.personalExpenseId !== null;
      const personalFields = (floor: Date) => ({
        amount,
        title,
        paymentType: toPersonalPaymentType(paymentMethod),
        date: personalExpenseDate(spentOnKey, floor).toISOString(),
      });

      let upserted: PersonalExpense | null = null;
      let removedExpenseId: string | null = null;
      let personalExpenseId = current.personalExpenseId;
      let personalCycleStartedAt = current.personalCycleStartedAt;

      if (current.personalExpenseId && wantsPersonal) {
        const floor =
          current.personalCycleStartedAt ??
          (await requireUser(tx, userId)).cycleStartedAt;
        upserted = await this.expenses.updateWithin(
          tx,
          userId,
          current.personalExpenseId,
          personalFields(floor),
        );
        personalCycleStartedAt = floor;
      } else if (current.personalExpenseId && !wantsPersonal) {
        await this.expenses.removeWithin(tx, userId, current.personalExpenseId);
        removedExpenseId = current.personalExpenseId;
        personalExpenseId = null;
        personalCycleStartedAt = null;
      } else if (!current.personalExpenseId && wantsPersonal) {
        const user = await requireUser(tx, userId);
        const business = await requireBusiness(tx, userId);
        upserted = await this.expenses.createWithin(tx, userId, {
          id: randomUUID(),
          categoryId: await ensureBusinessCategory(tx, userId, business),
          description: null,
          ...personalFields(user.cycleStartedAt),
        });
        personalExpenseId = upserted.id;
        personalCycleStartedAt = user.cycleStartedAt;
      }

      const updated = await tx.businessExpense.update({
        where: { id },
        data: {
          title,
          amount,
          spentOn,
          paymentMethod,
          bankName,
          personalExpenseId,
          personalCycleStartedAt,
        },
      });
      return {
        expense: toExpenseView(updated),
        personalSync: { upserted, removedExpenseId },
      };
    });
  }

  async deleteExpense(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockExpense(tx, userId, id);
      if (current.personalExpenseId) {
        await this.expenses.removeWithin(tx, userId, current.personalExpenseId);
      }
      await tx.businessExpense.delete({ where: { id } });
      return {
        deleted: true as const,
        id,
        personalSync: {
          upserted: null,
          removedExpenseId: current.personalExpenseId,
        },
      };
    });
  }

  async getBalance(userId: string, month: string) {
    const range = parseMonthRange(month);
    const business = await requireBusiness(this.prisma, userId);
    const [income, spent] = await Promise.all([
      this.prisma.businessIncome.aggregate({
        where: { businessId: business.id, collectedOn: range },
        _sum: { amount: true },
      }),
      this.prisma.businessExpense.aggregate({
        where: { businessId: business.id, spentOn: range },
        _sum: { amount: true },
      }),
    ]);
    const totalIncome = income._sum.amount ?? 0;
    const totalExpenses = spent._sum.amount ?? 0;
    return {
      month,
      totalIncome,
      totalExpenses,
      result: totalIncome - totalExpenses,
    };
  }

  private async lockExpense(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
  ): Promise<BusinessExpense> {
    await tx.$queryRaw`SELECT id FROM "BusinessExpense" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.businessExpense.findFirst({
      where: { id, business: { userId } },
    });
    if (!current) throw expenseNotFound();
    return current;
  }

  private async findIdempotent(
    userId: string,
    id: string,
  ): Promise<BusinessExpenseResult | null> {
    const existing = await this.prisma.businessExpense.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });
    if (!existing) return null;
    if (existing.business.userId !== userId) {
      throw new ConflictException({
        message: 'No se pudo registrar el gasto con ese identificador',
        code: 'ID_CONFLICT',
      });
    }
    const upserted = existing.personalExpenseId
      ? await this.expenses.findOne(userId, existing.personalExpenseId)
      : null;
    return {
      expense: toExpenseView(existing),
      personalSync: { upserted, removedExpenseId: null },
    };
  }
}
