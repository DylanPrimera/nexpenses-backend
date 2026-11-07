import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentType, Prisma } from '@prisma/client';
import { chargeBalance, num, restoreBalance } from '../credits/domain/money.js';
import {
  applyCuotaPayment,
  revertCuotaPayment,
  type CuotaShift,
} from '../credits/domain/schedule.js';
import { moneyDec } from '../credits/serialize.js';
import { getLocalNowParts, getLocalDateRange } from '../common/utils/index.js';
import { PaginationDto } from '../common/dtos/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { FilterExpensesDto } from './dto/filter-expenses.dto.js';
import { UpdateExpenseDto } from './dto/update-expense.dto.js';

const expenseInclude = {
  category: true,
  credit: { select: { id: true, displayName: true, kind: true } },
} satisfies Prisma.ExpenseInclude;

type ExpenseRow = {
  id: string;
  creditBalanceApplied: unknown;
  creditId: string | null;
  amount: number;
  creditInstallmentAdvanced: boolean;
  creditDueBefore: Date | null;
  creditDaysPastDueBefore: number | null;
  date: Date;
  userId: string;
};

type CreditCharge = {
  applied: number;
  advanced: boolean;
  dueBefore: Date | null;
  daysPastDueBefore: number | null;
};

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCategoryOwned(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      throw new NotFoundException('Category not found for this user');
    }
    return category;
  }

  private serialize<
    T extends {
      creditBalanceApplied: unknown;
      creditDueBefore?: Date | null;
      creditDaysPastDueBefore?: number | null;
    },
  >(expense: T) {
    const {
      creditDueBefore: _creditDueBefore,
      creditDaysPastDueBefore: _creditDaysPastDueBefore,
      ...rest
    } = expense;
    return {
      ...rest,
      creditBalanceApplied: num(expense.creditBalanceApplied) ?? 0,
    };
  }

  private async findIdempotentExpense(userId: string, id: string) {
    const existing = await this.prisma.expense.findUnique({
      where: { id },
      include: expenseInclude,
    });
    if (!existing) return null;
    if (existing.userId !== userId)
      throw new ConflictException(
        'No se pudo registrar el gasto con ese identificador',
      );
    return this.serialize(existing);
  }

  async create(userId: string, dto: CreateExpenseDto) {
    if (dto.id) {
      const existing = await this.findIdempotentExpense(userId, dto.id);
      if (existing) return existing;
    }
    try {
      await this.assertCategoryOwned(userId, dto.categoryId);
      if (dto.saveAsRecurring && dto.creditId) {
        throw new BadRequestException(
          'A credit installment cannot be saved as a recurring payment',
        );
      }

      const expense = await this.prisma.$transaction(async (tx) => {
        if (dto.id) {
          const existing = await tx.expense.findUnique({
            where: { id: dto.id },
            include: expenseInclude,
          });
          if (existing) {
            if (existing.userId !== userId)
              throw new ConflictException(
                'No se pudo registrar el gasto con ese identificador',
              );
            return existing;
          }
        }
        const paidOn = dto.date ? new Date(dto.date) : new Date();
        const charge: CreditCharge = dto.creditId
          ? await this.chargeCredit(tx, userId, dto.creditId, dto.amount, {
              advanceInstallment: dto.advanceInstallment === true,
              paidOn,
            })
          : {
              applied: 0,
              advanced: false,
              dueBefore: null,
              daysPastDueBefore: null,
            };

        const created = await tx.expense.create({
          data: {
            ...(dto.id ? { id: dto.id } : {}),
            amount: dto.amount,
            categoryId: dto.categoryId,
            title: dto.title.trim(),
            description: dto.description.trim(),
            paymentType: dto.paymentType ?? PaymentType.debit_card,
            date: paidOn,
            userId,
            creditId: dto.creditId ?? null,
            creditBalanceApplied: moneyDec(charge.applied)!,
            creditInstallmentAdvanced: charge.advanced,
            creditDueBefore: charge.dueBefore,
            creditDaysPastDueBefore: charge.daysPastDueBefore,
          },
          include: expenseInclude,
        });

        if (dto.saveAsRecurring) {
          await tx.recurringExpense.create({
            data: {
              amount: dto.amount,
              categoryId: dto.categoryId,
              title: dto.title.trim(),
              description: dto.description.trim(),
              paymentType: dto.paymentType ?? PaymentType.debit_card,
              userId,
            },
          });
        }

        await tx.category.update({
          where: { id: dto.categoryId },
          data: { usageCount: { increment: 1 } },
        });

        return created;
      });

      return this.serialize(expense);
    } catch (error) {
      if (
        dto.id &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.findIdempotentExpense(userId, dto.id);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async findAll(userId: string, filters: FilterExpensesDto) {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const where: Prisma.ExpenseWhereInput = { userId };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.paymentType) where.paymentType = filters.paymentType;
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (filters.year != null || filters.month != null) {
      const { year: currentYear } = getLocalNowParts();
      const year = filters.year ?? currentYear;
      const { start, end } = getLocalDateRange(year, filters.month);
      where.date = { gte: start, lt: end };
    }

    const [data, total, amount] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      items: data.map((expense) => this.serialize(expense)),
      total,
      totalAmount: amount._sum.amount ?? 0,
      limit,
      offset,
    };
  }

  async listRecurring(userId: string, pagination: PaginationDto) {
    const limit = pagination.limit ?? 50;
    const offset = pagination.offset ?? 0;
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.recurringExpense.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          amount: true,
          categoryId: true,
          title: true,
          description: true,
          paymentType: true,
          createdAt: true,
          category: { select: { id: true, name: true, color: true } },
        },
      }),
      this.prisma.recurringExpense.count({ where }),
    ]);
    return { items, total, limit, offset };
  }

  async removeRecurring(userId: string, id: string) {
    const existing = await this.prisma.recurringExpense.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Recurring payment not found');
    await this.prisma.recurringExpense.delete({ where: { id } });
    return { deleted: true, id };
  }

  async findOne(userId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, userId },
      include: expenseInclude,
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return this.serialize(expense);
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Expense not found');
    if (dto.categoryId) {
      await this.assertCategoryOwned(userId, dto.categoryId);
    }

    const nextAmount = dto.amount ?? existing.amount;
    const nextCreditId =
      dto.creditId === undefined ? existing.creditId : dto.creditId;
    const creditTouched =
      nextCreditId !== existing.creditId ||
      (nextCreditId != null && nextAmount !== existing.amount) ||
      (existing.creditId != null && nextAmount !== existing.amount);

    const expense = await this.prisma.$transaction(async (tx) => {
      let creditBalanceApplied = existing.creditBalanceApplied;
      let schedulePatch: Prisma.ExpenseUncheckedUpdateInput = {};

      if (creditTouched) {
        const synced = await this.syncCreditLink(tx, userId, existing, {
          creditId: nextCreditId,
          amount: nextAmount,
          advanceInstallment: dto.advanceInstallment === true,
          paidOn: dto.date ? new Date(dto.date) : existing.date,
        });
        creditBalanceApplied = moneyDec(synced.applied)!;
        if (!synced.preserveSchedule) {
          schedulePatch = {
            creditInstallmentAdvanced: synced.advanced,
            creditDueBefore: synced.dueBefore,
            creditDaysPastDueBefore: synced.daysPastDueBefore,
          };
        }
      }

      return tx.expense.update({
        where: { id },
        data: {
          ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
          ...(dto.categoryId !== undefined
            ? { categoryId: dto.categoryId }
            : {}),
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(dto.paymentType !== undefined
            ? { paymentType: dto.paymentType }
            : {}),
          ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
          ...(dto.creditId !== undefined ? { creditId: dto.creditId } : {}),
          ...(creditTouched ? { creditBalanceApplied, ...schedulePatch } : {}),
        },
        include: expenseInclude,
      });
    });

    return this.serialize(expense);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Expense not found');

    await this.prisma.$transaction(async (tx) => {
      if (existing.creditId) {
        await this.restoreCredit(tx, userId, existing, true);
      }
      await tx.expense.delete({ where: { id } });
    });
    return { deleted: true, id };
  }

  async wipeAll(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.expense.findMany({
        where: { userId, creditId: { not: null } },
      });
      for (const expense of linked) {
        const fresh = await tx.expense.findFirst({
          where: { id: expense.id, userId },
        });
        if (!fresh?.creditId) continue;
        await this.restoreCredit(tx, userId, fresh, true);
        await tx.expense.update({
          where: { id: fresh.id },
          data: {
            creditDueBefore: null,
            creditDaysPastDueBefore: null,
            creditInstallmentAdvanced: false,
          },
        });
      }
      const result = await tx.expense.deleteMany({ where: { userId } });
      return { deleted: result.count };
    });
  }

  private async chargeCredit(
    tx: Prisma.TransactionClient,
    userId: string,
    creditId: string,
    amount: number,
    options: { advanceInstallment: boolean; paidOn: Date },
  ): Promise<CreditCharge> {
    const credit = await tx.credit.findFirst({
      where: { id: creditId, userId },
    });
    if (!credit) throw new NotFoundException('Crédito no encontrado');

    const balance = num(credit.remainingBalance) ?? 0;
    const charged = chargeBalance(balance, amount);
    const effect = applyCuotaPayment(
      {
        kind: credit.kind,
        installmentCurrent: credit.installmentCurrent,
        installmentTotal: credit.installmentTotal,
        nextPaymentDate: credit.nextPaymentDate,
        daysPastDue: credit.daysPastDue ?? 0,
        paymentDay: credit.paymentDay ?? null,
      },
      options,
    );

    await tx.credit.update({
      where: { id: credit.id },
      data: {
        remainingBalance: moneyDec(charged.remainingBalance)!,
        installmentCurrent: effect.installmentCurrent,
        nextPaymentDate: effect.nextPaymentDate,
        daysPastDue: effect.daysPastDue,
        paymentDay: effect.paymentDay,
      },
    });

    return {
      applied: charged.applied,
      advanced: effect.advanced,
      dueBefore: effect.dueBefore,
      daysPastDueBefore: effect.daysPastDueBefore,
    };
  }

  private async applyCreditBalance(
    tx: Prisma.TransactionClient,
    userId: string,
    creditId: string,
    amount: number,
  ): Promise<number> {
    const credit = await tx.credit.findFirst({
      where: { id: creditId, userId },
    });
    if (!credit) throw new NotFoundException('Crédito no encontrado');
    const charged = chargeBalance(num(credit.remainingBalance) ?? 0, amount);
    await tx.credit.update({
      where: { id: credit.id },
      data: { remainingBalance: moneyDec(charged.remainingBalance)! },
    });
    return charged.applied;
  }

  private async restoreCredit(
    tx: Prisma.TransactionClient,
    userId: string,
    expense: ExpenseRow,
    revertInstallment: boolean,
  ) {
    if (!expense.creditId) return;
    const credit = await tx.credit.findFirst({
      where: { id: expense.creditId, userId },
    });
    if (!credit) return;

    const applied = num(expense.creditBalanceApplied) ?? 0;
    const data: Prisma.CreditUpdateInput = {
      remainingBalance: moneyDec(
        restoreBalance(num(credit.remainingBalance) ?? 0, applied),
      )!,
    };
    if (revertInstallment && expense.creditInstallmentAdvanced) {
      const others = await this.storedShifts(tx, userId, expense);
      const reverted = revertCuotaPayment(
        {
          installmentCurrent: credit.installmentCurrent,
          nextPaymentDate: credit.nextPaymentDate,
          daysPastDue: credit.daysPastDue,
          paymentDay: credit.paymentDay,
        },
        {
          advanced: true,
          dueBefore: expense.creditDueBefore,
          daysPastDueBefore: expense.creditDaysPastDueBefore,
        },
        others,
      );
      data.installmentCurrent = reverted.installmentCurrent;
      data.nextPaymentDate = reverted.nextPaymentDate;
      data.daysPastDue = reverted.daysPastDue;
      if (reverted.rewritten) {
        await tx.expense.update({
          where: { id: reverted.rewritten.id },
          data: {
            creditDueBefore: reverted.rewritten.dueBefore,
            creditDaysPastDueBefore: reverted.rewritten.daysPastDueBefore,
          },
        });
      }
    }
    await tx.credit.update({ where: { id: credit.id }, data });
  }

  private async storedShifts(
    tx: Prisma.TransactionClient,
    userId: string,
    expense: ExpenseRow,
  ): Promise<CuotaShift[]> {
    if (!expense.creditId) return [];
    const rows = await tx.expense.findMany({
      where: {
        userId,
        creditId: expense.creditId,
        id: { not: expense.id },
        creditDueBefore: { not: null },
      },
    });
    return rows.flatMap((row) =>
      row.creditDueBefore
        ? [
            {
              id: row.id,
              dueBefore: row.creditDueBefore,
              daysPastDueBefore: row.creditDaysPastDueBefore ?? 0,
            },
          ]
        : [],
    );
  }

  private async syncCreditLink(
    tx: Prisma.TransactionClient,
    userId: string,
    existing: ExpenseRow,
    next: {
      creditId: string | null;
      amount: number;
      advanceInstallment: boolean;
      paidOn: Date;
    },
  ): Promise<CreditCharge & { preserveSchedule: boolean }> {
    const sameCredit = existing.creditId === next.creditId;
    if (existing.creditId) {
      await this.restoreCredit(tx, userId, existing, !sameCredit);
    }
    if (!next.creditId) {
      return {
        applied: 0,
        advanced: false,
        dueBefore: null,
        daysPastDueBefore: null,
        preserveSchedule: false,
      };
    }
    if (sameCredit) {
      const applied = await this.applyCreditBalance(
        tx,
        userId,
        next.creditId,
        next.amount,
      );
      return {
        applied,
        advanced: existing.creditInstallmentAdvanced,
        dueBefore: existing.creditDueBefore,
        daysPastDueBefore: existing.creditDaysPastDueBefore,
        preserveSchedule: true,
      };
    }
    const charged = await this.chargeCredit(
      tx,
      userId,
      next.creditId,
      next.amount,
      {
        advanceInstallment: next.advanceInstallment,
        paidOn: next.paidOn,
      },
    );
    return { ...charged, preserveSchedule: false };
  }
}
