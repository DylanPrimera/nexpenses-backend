import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentType, Prisma } from '@prisma/client';
import { chargeBalance, num, restoreBalance } from '../credits/domain/money.js';
import { moneyDec } from '../credits/serialize.js';
import { getLocalNowParts, getUtcDateRange } from '../common/utils/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { FilterExpensesDto } from './dto/filter-expenses.dto.js';
import { UpdateExpenseDto } from './dto/update-expense.dto.js';

const expenseInclude = {
  category: true,
  credit: { select: { id: true, displayName: true, kind: true } },
} satisfies Prisma.ExpenseInclude;

type ExpenseRow = {
  creditBalanceApplied: unknown;
  creditId: string | null;
  amount: number;
  creditInstallmentAdvanced: boolean;
  userId: string;
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

  private serialize<T extends { creditBalanceApplied: unknown }>(expense: T) {
    return {
      ...expense,
      creditBalanceApplied: num(expense.creditBalanceApplied) ?? 0,
    };
  }

  async create(userId: string, dto: CreateExpenseDto) {
    await this.assertCategoryOwned(userId, dto.categoryId);

    const expense = await this.prisma.$transaction(async (tx) => {
      const charge = dto.creditId
        ? await this.chargeCredit(tx, userId, dto.creditId, dto.amount, {
            advanceInstallment: dto.advanceInstallment === true,
          })
        : { applied: 0, advanced: false };

      const created = await tx.expense.create({
        data: {
          amount: dto.amount,
          categoryId: dto.categoryId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          paymentType: dto.paymentType ?? PaymentType.debit_card,
          date: dto.date ? new Date(dto.date) : new Date(),
          userId,
          creditId: dto.creditId ?? null,
          creditBalanceApplied: moneyDec(charge.applied)!,
          creditInstallmentAdvanced: charge.advanced,
        },
        include: expenseInclude,
      });

      await tx.category.update({
        where: { id: dto.categoryId },
        data: { usageCount: { increment: 1 } },
      });

      return created;
    });

    return this.serialize(expense);
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
      const { start, end } = getUtcDateRange(year, filters.month);
      where.date = { gte: start, lt: end };
    }

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      items: data.map((expense) => this.serialize(expense)),
      total,
      limit,
      offset,
    };
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
      let creditInstallmentAdvanced = existing.creditInstallmentAdvanced;

      if (creditTouched) {
        const synced = await this.syncCreditLink(tx, userId, existing, {
          creditId: nextCreditId,
          amount: nextAmount,
          advanceInstallment: dto.advanceInstallment === true,
        });
        creditBalanceApplied = moneyDec(synced.applied)!;
        creditInstallmentAdvanced = synced.advanced;
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
          ...(creditTouched
            ? { creditBalanceApplied, creditInstallmentAdvanced }
            : {}),
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
        await this.restoreCredit(tx, userId, expense, true);
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
    options: { advanceInstallment: boolean },
  ): Promise<{ applied: number; advanced: boolean }> {
    const credit = await tx.credit.findFirst({
      where: { id: creditId, userId },
    });
    if (!credit) throw new NotFoundException('Crédito no encontrado');

    const balance = num(credit.remainingBalance) ?? 0;
    const charged = chargeBalance(balance, amount);
    let advanced = false;
    let installmentCurrent = credit.installmentCurrent;
    if (
      options.advanceInstallment &&
      credit.kind === 'CONSUMO' &&
      credit.installmentCurrent != null &&
      (credit.installmentTotal == null ||
        credit.installmentCurrent < credit.installmentTotal)
    ) {
      installmentCurrent = credit.installmentCurrent + 1;
      advanced = true;
    }

    await tx.credit.update({
      where: { id: credit.id },
      data: {
        remainingBalance: moneyDec(charged.remainingBalance)!,
        ...(advanced ? { installmentCurrent } : {}),
      },
    });

    return { applied: charged.applied, advanced };
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
    if (
      revertInstallment &&
      expense.creditInstallmentAdvanced &&
      credit.installmentCurrent != null
    ) {
      data.installmentCurrent = Math.max(0, credit.installmentCurrent - 1);
    }
    await tx.credit.update({ where: { id: credit.id }, data });
  }

  private async syncCreditLink(
    tx: Prisma.TransactionClient,
    userId: string,
    existing: ExpenseRow,
    next: {
      creditId: string | null;
      amount: number;
      advanceInstallment: boolean;
    },
  ): Promise<{ applied: number; advanced: boolean }> {
    const sameCredit = existing.creditId === next.creditId;
    if (existing.creditId) {
      await this.restoreCredit(tx, userId, existing, !sameCredit);
    }
    if (!next.creditId) return { applied: 0, advanced: false };
    if (sameCredit) {
      const charged = await this.chargeCredit(
        tx,
        userId,
        next.creditId,
        next.amount,
        { advanceInstallment: false },
      );
      return {
        applied: charged.applied,
        advanced: existing.creditInstallmentAdvanced,
      };
    }
    return this.chargeCredit(tx, userId, next.creditId, next.amount, {
      advanceInstallment: next.advanceInstallment,
    });
  }
}
