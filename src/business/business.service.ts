import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessPaymentMethod, Prisma } from '@prisma/client';
import type { BusinessIncome, User } from '@prisma/client';
import { getBusinessSupplement } from '../common/utils/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseCollectedOn, parseMonthRange, toDayKey } from './business-dates.js';
import {
  BusinessIncomesQueryDto,
  CreateBusinessIncomeDto,
  UpdateBusinessIncomeDto,
} from './dto/index.js';

type Db = PrismaService | Prisma.TransactionClient;

function businessNotFound(): NotFoundException {
  return new NotFoundException({
    message: 'Aún no tienes un negocio',
    code: 'BUSINESS_NOT_FOUND',
  });
}

function incomeNotFound(): NotFoundException {
  return new NotFoundException({
    message: 'Ingreso no encontrado',
    code: 'INCOME_NOT_FOUND',
  });
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return value.length === 0 ? null : value;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getBusiness(userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { userId },
      select: { id: true, name: true },
    });
    return { business };
  }

  async createBusiness(userId: string, name: string) {
    const existing = await this.prisma.business.findUnique({ where: { userId } });
    if (existing) throw this.businessExists();
    try {
      return await this.prisma.business.create({
        data: { userId, name },
        select: { id: true, name: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw this.businessExists();
      throw error;
    }
  }

  async renameBusiness(userId: string, name: string) {
    const existing = await this.prisma.business.findUnique({ where: { userId } });
    if (!existing) throw businessNotFound();
    return this.prisma.business.update({
      where: { userId },
      data: { name },
      select: { id: true, name: true },
    });
  }

  async deleteBusiness(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Business" WHERE "userId" = ${userId} FOR UPDATE`;
      const business = await tx.business.findUnique({ where: { userId } });
      if (!business) throw businessNotFound();
      const user = await this.requireUser(tx, userId);
      const added = await tx.businessIncome.aggregate({
        where: {
          businessId: business.id,
          addedToCycleStartedAt: user.cycleStartedAt,
        },
        _sum: { amount: true },
      });
      const keptInPersonal = added._sum.amount ?? 0;
      if (keptInPersonal > 0) {
        const sameCycle =
          user.keptBusinessCycleStartedAt?.getTime() ===
          user.cycleStartedAt.getTime();
        await tx.user.update({
          where: { id: userId },
          data: sameCycle
            ? { keptBusinessAmount: { increment: keptInPersonal } }
            : {
                keptBusinessAmount: keptInPersonal,
                keptBusinessCycleStartedAt: user.cycleStartedAt,
              },
        });
      }
      const incomes = await tx.businessIncome.deleteMany({
        where: { businessId: business.id },
      });
      await tx.business.delete({ where: { id: business.id } });
      return { deleted: true, counts: { incomes: incomes.count }, keptInPersonal };
    });
  }

  async listIncomes(userId: string, query: BusinessIncomesQueryDto) {
    const collectedOn = parseMonthRange(query.month);
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const business = await this.requireBusiness(this.prisma, userId);
    const user = await this.requireUser(this.prisma, userId);
    const where: Prisma.BusinessIncomeWhereInput = {
      businessId: business.id,
      collectedOn,
    };
    const [rows, total] = await Promise.all([
      this.prisma.businessIncome.findMany({
        where,
        orderBy: [{ collectedOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.businessIncome.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.toIncomeView(row, user)),
      total,
      limit,
      offset,
    };
  }

  async getSummary(userId: string, month: string) {
    const collectedOn = parseMonthRange(month);
    const business = await this.requireBusiness(this.prisma, userId);
    const where = { businessId: business.id, collectedOn };
    const [collected, added] = await Promise.all([
      this.prisma.businessIncome.aggregate({ where, _sum: { amount: true } }),
      this.prisma.businessIncome.aggregate({
        where: { ...where, addedToCycleStartedAt: { not: null } },
        _sum: { amount: true },
      }),
    ]);
    return {
      month,
      collected: collected._sum.amount ?? 0,
      addedToPersonal: added._sum.amount ?? 0,
    };
  }

  async createIncome(userId: string, dto: CreateBusinessIncomeDto) {
    const existing = await this.findIdempotentIncome(userId, dto.id);
    if (existing) return existing;
    const collectedOn = parseCollectedOn(dto.collectedOn);
    const bankName = this.bankFor(dto.paymentMethod, dto.bankName);
    const business = await this.requireBusiness(this.prisma, userId);
    const user = await this.requireUser(this.prisma, userId);
    if (dto.addToPersonal) this.assertPersonalBudget(user);
    try {
      await this.prisma.businessIncome.create({
        data: {
          id: dto.id,
          businessId: business.id,
          title: dto.title,
          description: emptyToNull(dto.description),
          clientName: emptyToNull(dto.clientName),
          amount: dto.amount,
          collectedOn,
          paymentMethod: dto.paymentMethod,
          bankName,
          addedToCycleStartedAt: dto.addToPersonal ? user.cycleStartedAt : null,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.findIdempotentIncome(userId, dto.id);
        if (raced) return raced;
      }
      throw error;
    }
    return this.incomeResult(userId, dto.id);
  }

  async updateIncome(userId: string, id: string, dto: UpdateBusinessIncomeDto) {
    const income = await this.requireIncome(userId, id);
    const user = await this.requireUser(this.prisma, userId);
    const data: Prisma.BusinessIncomeUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = emptyToNull(dto.description);
    if (dto.clientName !== undefined) data.clientName = emptyToNull(dto.clientName);
    if (dto.addToPersonal === true && income.addedToCycleStartedAt === null) {
      this.assertPersonalBudget(user);
      data.addedToCycleStartedAt = user.cycleStartedAt;
    }
    if (dto.addToPersonal === false && income.addedToCycleStartedAt !== null) {
      if (income.addedToCycleStartedAt.getTime() !== user.cycleStartedAt.getTime()) {
        throw new ConflictException({
          message: 'Este ingreso se sumó en un ciclo anterior',
          code: 'ADDED_IN_PAST_CYCLE',
        });
      }
      data.addedToCycleStartedAt = null;
    }
    await this.prisma.businessIncome.update({ where: { id }, data });
    return this.incomeResult(userId, id);
  }

  async deleteIncome(userId: string, id: string) {
    await this.requireIncome(userId, id);
    await this.prisma.businessIncome.delete({ where: { id } });
    const user = await this.requireUser(this.prisma, userId);
    return { deleted: true, id, personal: await this.personalFor(this.prisma, user) };
  }

  private businessExists(): ConflictException {
    return new ConflictException({
      message: 'Ya tienes un negocio',
      code: 'BUSINESS_EXISTS',
    });
  }

  private bankFor(
    paymentMethod: BusinessPaymentMethod,
    bankName: string | undefined,
  ): string | null {
    const value = emptyToNull(bankName);
    if (value !== null && paymentMethod !== BusinessPaymentMethod.transfer) {
      throw new BadRequestException({
        message: 'El banco solo aplica a transferencias',
        code: 'BANK_REQUIRES_TRANSFER',
      });
    }
    return value;
  }

  private assertPersonalBudget(user: User): void {
    if (user.budget <= 0) {
      throw new ConflictException({
        message: 'Configura tu presupuesto personal para sumar ingresos',
        code: 'PERSONAL_BUDGET_REQUIRED',
      });
    }
  }

  private async requireUser(db: Db, userId: string): Promise<User> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async requireBusiness(db: Db, userId: string) {
    const business = await db.business.findUnique({ where: { userId } });
    if (!business) throw businessNotFound();
    return business;
  }

  private async requireIncome(userId: string, id: string) {
    const income = await this.prisma.businessIncome.findFirst({
      where: { id, business: { userId } },
    });
    if (!income) throw incomeNotFound();
    return income;
  }

  private async findIdempotentIncome(userId: string, id: string) {
    const existing = await this.prisma.businessIncome.findUnique({
      where: { id },
      include: { business: { select: { userId: true } } },
    });
    if (!existing) return null;
    if (existing.business.userId !== userId) {
      throw new ConflictException({
        message: 'No se pudo registrar el ingreso con ese identificador',
        code: 'ID_CONFLICT',
      });
    }
    return this.incomeResult(userId, id);
  }

  private async incomeResult(userId: string, id: string) {
    const [income, user] = await Promise.all([
      this.prisma.businessIncome.findUniqueOrThrow({ where: { id } }),
      this.requireUser(this.prisma, userId),
    ]);
    return {
      income: this.toIncomeView(income, user),
      personal: await this.personalFor(this.prisma, user),
    };
  }

  private async personalFor(db: Db, user: User) {
    const supplement = await getBusinessSupplement(db, user);
    return { base: user.budget, supplement };
  }

  private toIncomeView(income: BusinessIncome, user: User) {
    return {
      id: income.id,
      title: income.title,
      description: income.description,
      clientName: income.clientName,
      amount: income.amount,
      collectedOn: toDayKey(income.collectedOn),
      paymentMethod: income.paymentMethod,
      bankName: income.bankName,
      addedToPersonal: income.addedToCycleStartedAt !== null,
      addedToCurrentCycle:
        income.addedToCycleStartedAt !== null &&
        income.addedToCycleStartedAt.getTime() === user.cycleStartedAt.getTime(),
      createdAt: income.createdAt.toISOString(),
    };
  }
}
