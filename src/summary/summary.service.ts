import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  daysLeftInMonth,
  getBusinessSupplement,
  getCycleProgress,
  getLocalDateRange,
  getLocalNowParts,
} from '../common/utils/index.js';
import { SummaryQueryDto } from './dto/summary-query.dto.js';

function percentageOf(spent: number, budget: number): number {
  if (budget > 0) return Math.round((spent / budget) * 100);
  return spent > 0 ? 100 : 0;
}

@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string, query: SummaryQueryDto, now = new Date()) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const budgetMonthly = user.budget;

    if (query.year == null && query.month == null) {
      const cycle = getCycleProgress(user.cycleStartedAt, now);
      const [totals, businessSupplement] = await Promise.all([
        this.aggregate(userId, { gte: user.cycleStartedAt }),
        getBusinessSupplement(this.prisma, user),
      ]);
      const effectiveBudget = budgetMonthly + businessSupplement;
      return {
        userId,
        budget: budgetMonthly,
        budgetMonthly,
        scope: { cycle: true, year: null, month: null },
        ...totals,
        remaining: budgetMonthly - totals.spent,
        percentage: percentageOf(totals.spent, budgetMonthly),
        isOverBudget: totals.spent > budgetMonthly,
        cycleStartedAt: user.cycleStartedAt.toISOString(),
        cycleStart: cycle.cycleStart.toISOString(),
        cycleEnd: cycle.cycleEnd.toISOString(),
        daysLeft: cycle.daysLeft,
        daysElapsed: cycle.daysElapsed,
        isCycleStale: cycle.isStale,
        businessSupplement,
        effectiveBudget,
        effectiveRemaining: effectiveBudget - totals.spent,
        effectivePercentage: percentageOf(totals.spent, effectiveBudget),
        effectiveIsOverBudget: totals.spent > effectiveBudget,
      };
    }

    const year = query.year ?? getLocalNowParts(now).year;
    const month = query.month;
    const { start, end } = getLocalDateRange(year, month);
    const totals = await this.aggregate(userId, { gte: start, lt: end });
    const cycleStart = start.toISOString();
    const cycleEnd = new Date(end.getTime() - 1).toISOString();

    if (month != null) {
      return {
        userId,
        budget: budgetMonthly,
        budgetMonthly,
        scope: { cycle: false, year, month },
        ...totals,
        remaining: budgetMonthly - totals.spent,
        percentage: percentageOf(totals.spent, budgetMonthly),
        isOverBudget: totals.spent > budgetMonthly,
        cycleStartedAt: user.cycleStartedAt.toISOString(),
        cycleStart,
        cycleEnd,
        daysLeft: daysLeftInMonth(year, month, now),
      };
    }

    const projectedAnnualBudget = budgetMonthly * 12;
    return {
      userId,
      budget: budgetMonthly,
      budgetMonthly,
      projectedAnnualBudget,
      scope: { cycle: false, year, month: null },
      ...totals,
      remaining: projectedAnnualBudget - totals.spent,
      percentage: percentageOf(totals.spent, projectedAnnualBudget),
      isOverBudget: totals.spent > projectedAnnualBudget,
      cycleStartedAt: user.cycleStartedAt.toISOString(),
      cycleStart,
      cycleEnd,
      daysLeft: null,
    };
  }

  private async aggregate(userId: string, date: Prisma.DateTimeFilter) {
    const where: Prisma.ExpenseWhereInput = { userId, date };

    const [agg, expenseCount, byCategoryRaw, byPaymentRaw] = await Promise.all([
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.expense.groupBy({
        by: ['paymentType'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const categoryIds = byCategoryRaw.map((r) => r.categoryId);
    const categories =
      categoryIds.length === 0
        ? []
        : await this.prisma.category.findMany({
            where: { id: { in: categoryIds }, userId },
          });
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const byCategory = byCategoryRaw
      .map((r) => {
        const cat = categoryMap.get(r.categoryId);
        return {
          categoryId: r.categoryId,
          name: cat?.name ?? 'unknown',
          color: cat?.color ?? '#64748b',
          spent: r._sum.amount ?? 0,
          count: r._count._all,
        };
      })
      .sort((a, b) => b.spent - a.spent);

    const byPaymentType = byPaymentRaw
      .map((r) => ({
        paymentType: r.paymentType,
        spent: r._sum.amount ?? 0,
        count: r._count._all,
      }))
      .sort((a, b) => b.spent - a.spent);

    return {
      spent: agg._sum.amount ?? 0,
      expenseCount,
      byCategory,
      byPaymentType,
    };
  }
}
