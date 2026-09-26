import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  daysLeftInMonth,
  getLocalNowParts,
  getUtcDateRange,
} from '../common/utils/index.js';
import { SummaryQueryDto } from './dto/summary-query.dto.js';

@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string, query: SummaryQueryDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const { year: currentYear } = getLocalNowParts();
    const year = query.year ?? currentYear;
    const month = query.month;
    const isMonthly = month != null;

    const { start, end } = getUtcDateRange(year, month);
    const where: Prisma.ExpenseWhereInput = {
      userId,
      date: { gte: start, lt: end },
    };

    const [agg, expenseCount, byCategoryRaw, byPaymentRaw] = await Promise.all([
      this.prisma.expense.aggregate({
        where,
        _sum: { amount: true },
      }),
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

    const spent = agg._sum.amount ?? 0;
    const budgetMonthly = user.budget;
    const projectedAnnualBudget = budgetMonthly * 12;

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

    const cycleStart = start.toISOString();
    const cycleEnd = new Date(end.getTime() - 1).toISOString();

    if (isMonthly) {
      const remaining = budgetMonthly - spent;
      const percentage =
        budgetMonthly > 0
          ? Math.round((spent / budgetMonthly) * 100)
          : spent > 0
            ? 100
            : 0;
      return {
        userId,
        budget: budgetMonthly,
        budgetMonthly,
        scope: { year, month },
        spent,
        remaining,
        percentage,
        isOverBudget: spent > budgetMonthly,
        expenseCount,
        byCategory,
        byPaymentType,
        cycleStart,
        cycleEnd,
        daysLeft: daysLeftInMonth(year, month!),
      };
    }

    const remaining = projectedAnnualBudget - spent;
    const percentage =
      projectedAnnualBudget > 0
        ? Math.round((spent / projectedAnnualBudget) * 100)
        : spent > 0
          ? 100
          : 0;

    return {
      userId,
      budget: budgetMonthly,
      budgetMonthly,
      projectedAnnualBudget,
      scope: { year, month: null },
      spent,
      remaining,
      percentage,
      isOverBudget: spent > projectedAnnualBudget,
      expenseCount,
      byCategory,
      byPaymentType,
      cycleStart,
      cycleEnd,
      daysLeft: null,
    };
  }
}
