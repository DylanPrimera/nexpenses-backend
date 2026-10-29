import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SummaryService } from './summary.service.js';

type Expense = { amount: number; date: Date; categoryId: string; paymentType: string };

function matchesDate(date: Date, filter: { gte?: Date; lt?: Date }) {
  return (!filter.gte || date >= filter.gte) && (!filter.lt || date < filter.lt);
}

function prismaWith(user: { budget: number; cycleStartedAt: Date }, expenses: Expense[]) {
  const select = (where: { date: { gte?: Date; lt?: Date } }) =>
    expenses.filter((e) => matchesDate(e.date, where.date));
  const group = (rows: Expense[], key: 'categoryId' | 'paymentType') => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      const entry = map.get(row[key]) ?? { sum: 0, count: 0 };
      entry.sum += row.amount;
      entry.count += 1;
      map.set(row[key], entry);
    }
    return [...map].map(([value, { sum, count }]) => ({
      [key]: value,
      _sum: { amount: sum },
      _count: { _all: count },
    }));
  };
  return {
    user: { findUnique: async () => ({ id: 'user-1', ...user }) },
    category: { findMany: async () => [{ id: 'cat-1', name: 'comida', color: '#000' }] },
    expense: {
      aggregate: async ({ where }: any) => ({
        _sum: { amount: select(where).reduce((s, e) => s + e.amount, 0) },
      }),
      count: async ({ where }: any) => select(where).length,
      groupBy: async ({ where, by }: any) => group(select(where), by[0]),
    },
  } as unknown as PrismaService;
}

describe('SummaryService current cycle', () => {
  const now = new Date('2026-11-03T15:00:00.000Z');
  const cycleStartedAt = new Date('2026-10-15T05:00:00.000Z');
  const expenses: Expense[] = [
    { amount: 50_000, date: new Date('2026-10-14T20:00:00.000Z'), categoryId: 'cat-1', paymentType: 'CASH' },
    { amount: 100_000, date: new Date('2026-10-20T20:00:00.000Z'), categoryId: 'cat-1', paymentType: 'CASH' },
    { amount: 30_000, date: new Date('2026-11-01T01:30:00.000Z'), categoryId: 'cat-1', paymentType: 'CARD' },
    { amount: 20_000, date: new Date('2026-11-02T12:00:00.000Z'), categoryId: 'cat-1', paymentType: 'CARD' },
  ];

  it('defaults to the cycle since cycleStartedAt, crossing the month boundary', async () => {
    const service = new SummaryService(prismaWith({ budget: 1_000_000, cycleStartedAt }, expenses));
    const summary = await service.getSummary('user-1', {}, now);
    expect(summary.scope).toEqual({ cycle: true, year: null, month: null });
    expect(summary.spent).toBe(150_000);
    expect(summary.remaining).toBe(850_000);
    expect(summary.percentage).toBe(15);
    expect(summary.expenseCount).toBe(3);
    expect(summary.cycleStart).toBe('2026-10-15T05:00:00.000Z');
    expect(summary.daysLeft).toBe(11);
  });

  it('keeps monthly scope on Bogotá calendar months', async () => {
    const service = new SummaryService(prismaWith({ budget: 1_000_000, cycleStartedAt }, expenses));
    const october = await service.getSummary('user-1', { year: 2026, month: 10 }, now);
    expect(october.spent).toBe(180_000);
    const november = await service.getSummary('user-1', { year: 2026, month: 11 }, now);
    expect(november.spent).toBe(20_000);
  });

  it('never returns NaN when the budget is 0', async () => {
    const service = new SummaryService(prismaWith({ budget: 0, cycleStartedAt }, []));
    const summary = await service.getSummary('user-1', {}, now);
    expect(summary.percentage).toBe(0);
  });
});
