import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  getLocalDateParts,
  getLocalDateRange,
  getLocalNowParts,
} from '../common/utils/index.js';
import { YearlyHistoryQueryDto } from './dto/yearly-history-query.dto.js';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getYearly(userId: string, query: YearlyHistoryQueryDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const { year: currentYear } = getLocalNowParts();
    const year = query.year ?? currentYear;
    const budgetMonthly = user.budget;
    const { start, end } = getLocalDateRange(year);

    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: start, lt: end },
      },
      select: { amount: true, date: true },
    });

    const buckets = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      spent: 0,
      expenseCount: 0,
    }));

    for (const e of expenses) {
      const m = getLocalDateParts(e.date).month - 1;
      buckets[m].spent += e.amount;
      buckets[m].expenseCount += 1;
    }

    const months = buckets.map((b) => ({
      ...b,
      isOverBudget: b.spent > budgetMonthly,
    }));

    const totalSpent = months.reduce((sum, m) => sum + m.spent, 0);

    return {
      year,
      budgetMonthly,
      totalSpent,
      months,
    };
  }
}
