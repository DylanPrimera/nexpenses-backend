import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { num } from '../credits/domain/money.js';
import { ExpensesService } from './expenses.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

type AnyRow = Record<string, any>;

function applyPatch(row: AnyRow, data: AnyRow) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'increment' in value) {
      row[key] = (row[key] ?? 0) + value.increment;
    } else {
      row[key] = value;
    }
  }
}

function memoryPrisma() {
  const categories = new Map<string, AnyRow>();
  const credits = new Map<string, AnyRow>();
  const expenses = new Map<string, AnyRow>();
  const recurring = new Map<string, AnyRow>();
  let seq = 0;

  categories.set('cat-1', {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Comida',
    usageCount: 0,
  });
  credits.set('credit-1', {
    id: 'credit-1',
    userId: 'user-1',
    kind: 'CONSUMO',
    displayName: 'Lulo',
    remainingBalance: new Prisma.Decimal('100.50'),
    installmentCurrent: 5,
    installmentTotal: 9,
  });

  const tx = {
    category: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        [...categories.values()].find(
          (row) => row.id === where.id && row.userId === where.userId,
        ) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: AnyRow;
      }) => {
        const row = categories.get(where.id);
        if (!row) throw new Error('missing category');
        applyPatch(row, data);
        return row;
      },
    },
    credit: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        [...credits.values()].find(
          (row) => row.id === where.id && row.userId === where.userId,
        ) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: AnyRow;
      }) => {
        const row = credits.get(where.id);
        if (!row) throw new Error('missing credit');
        applyPatch(row, data);
        return row;
      },
    },
    expense: {
      create: async ({ data }: { data: AnyRow }) => {
        const row = { ...data, id: `exp-${++seq}` };
        expenses.set(row.id, row);
        return row;
      },
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        [...expenses.values()].find(
          (row) => row.id === where.id && row.userId === where.userId,
        ) ?? null,
      findMany: async ({ where }: { where: AnyRow }) =>
        [...expenses.values()].filter((row) => {
          if (where.userId && row.userId !== where.userId) return false;
          if (typeof where.creditId === 'string' && row.creditId !== where.creditId) {
            return false;
          }
          if (where.creditId?.not === null && row.creditId == null) return false;
          if (where.id?.not && row.id === where.id.not) return false;
          if (where.creditDueBefore?.not === null && row.creditDueBefore == null) {
            return false;
          }
          return true;
        }),
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: AnyRow;
      }) => {
        const row = expenses.get(where.id);
        if (!row) throw new Error('missing expense');
        applyPatch(row, data);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const row = expenses.get(where.id);
        expenses.delete(where.id);
        return row;
      },
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        let count = 0;
        for (const [id, row] of expenses) {
          if (row.userId === where.userId) {
            expenses.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    },
    recurringExpense: {
      create: async ({ data }: { data: AnyRow }) => {
        const row = { ...data, id: `rec-${++seq}` };
        recurring.set(row.id, row);
        return row;
      },
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        [...recurring.values()].find(
          (row) => row.id === where.id && row.userId === where.userId,
        ) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        const row = recurring.get(where.id);
        recurring.delete(where.id);
        return row;
      },
    },
  };

  const prisma = {
    ...tx,
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  };

  return {
    prisma: prisma as unknown as PrismaService,
    credits,
    expenses,
    categories,
    recurring,
  };
}

describe('ExpensesService credit balance', () => {
  it('decreases remaining balance, floors at zero, and restores on delete', async () => {
    const { prisma, credits } = memoryPrisma();
    const service = new ExpensesService(prisma);

    const expense = await service.create('user-1', {
      amount: 500,
      categoryId: 'cat-1',
      title: 'Cuota',
      description: 'Pago',
      creditId: 'credit-1',
      advanceInstallment: true,
    });

    expect(num(credits.get('credit-1')?.remainingBalance)).toBe(0);
    expect(credits.get('credit-1')?.installmentCurrent).toBe(6);
    expect(expense.creditBalanceApplied).toBe(100.5);
    expect(expense.creditInstallmentAdvanced).toBe(true);

    await service.remove('user-1', expense.id);
    expect(num(credits.get('credit-1')?.remainingBalance)).toBe(100.5);
    expect(credits.get('credit-1')?.installmentCurrent).toBe(5);
  });

  function utcDay(value: unknown): string {
    const date = value instanceof Date ? value : new Date(String(value));
    return date.toISOString().slice(0, 10);
  }

  it('treats a cuota paid up to 5 calendar days early as the upcoming payment', async () => {
    const { prisma, credits } = memoryPrisma();
    const credit = credits.get('credit-1')!;
    credit.daysPastDue = 4;
    const service = new ExpensesService(prisma);

    const cases = [
      { due: '2026-10-01', next: '2026-11-01' },
      { due: '2026-10-05', next: '2026-11-05' },
    ];
    for (const item of cases) {
      credit.nextPaymentDate = new Date(`${item.due}T00:00:00.000Z`);
      credit.paymentDay = null;
      credit.daysPastDue = 4;
      credit.installmentCurrent = 5;
      credit.remainingBalance = new Prisma.Decimal('100.50');
      const expense = await service.create('user-1', {
        amount: 10,
        categoryId: 'cat-1',
        title: 'Cuota',
        description: 'Pago',
        creditId: 'credit-1',
        advanceInstallment: true,
        date: '2026-09-30T00:00:00.000Z',
      });
      expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe(item.next);
      expect(credits.get('credit-1')?.daysPastDue).toBe(0);
      await service.remove('user-1', expense.id);
      expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe(item.due);
      expect(credits.get('credit-1')?.daysPastDue).toBe(4);
      expect(credits.get('credit-1')?.installmentCurrent).toBe(5);
    }
  });

  it('does not move nextPaymentDate when the cuota is paid 6 days early', async () => {
    const { prisma, credits } = memoryPrisma();
    const credit = credits.get('credit-1')!;
    credit.nextPaymentDate = new Date('2026-10-06T00:00:00.000Z');
    credit.daysPastDue = 4;
    const service = new ExpensesService(prisma);

    const expense = await service.create('user-1', {
      amount: 10,
      categoryId: 'cat-1',
      title: 'Cuota',
      description: 'Pago',
      creditId: 'credit-1',
      advanceInstallment: true,
      date: '2026-09-30T00:00:00.000Z',
    });

    expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-10-06');
    expect(credits.get('credit-1')?.daysPastDue).toBe(4);
    expect(credits.get('credit-1')?.installmentCurrent).toBe(6);

    await service.remove('user-1', expense.id);
    expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-10-06');
    expect(credits.get('credit-1')?.daysPastDue).toBe(4);
    expect(credits.get('credit-1')?.installmentCurrent).toBe(5);
  });

  it('does not rewind a cuota paid 31 days early', async () => {
    const { prisma, credits } = memoryPrisma();
    const credit = credits.get('credit-1')!;
    credit.nextPaymentDate = new Date('2026-11-05T00:00:00.000Z');
    credit.daysPastDue = 4;
    const service = new ExpensesService(prisma);

    const expense = await service.create('user-1', {
      amount: 10,
      categoryId: 'cat-1',
      title: 'Cuota',
      description: 'Pago',
      creditId: 'credit-1',
      advanceInstallment: true,
      date: '2026-10-05T00:00:00.000Z',
    });

    expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-11-05');
    expect(credits.get('credit-1')?.installmentCurrent).toBe(6);
    await service.remove('user-1', expense.id);
    expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-11-05');
    expect(credits.get('credit-1')?.daysPastDue).toBe(4);
    expect(credits.get('credit-1')?.installmentCurrent).toBe(5);
  });

  it('restores 31 January and the contractual day after February', async () => {
    const { prisma, credits } = memoryPrisma();
    const credit = credits.get('credit-1')!;
    credit.nextPaymentDate = new Date('2026-01-31T00:00:00.000Z');
    credit.daysPastDue = 2;
    credit.remainingBalance = new Prisma.Decimal('100.50');
    const service = new ExpensesService(prisma);
    const paid = {
      amount: 10,
      categoryId: 'cat-1',
      title: 'Cuota',
      description: 'Pago',
      creditId: 'credit-1',
      advanceInstallment: true,
    };

    const january = await service.create('user-1', {
      ...paid,
      date: '2026-01-31T00:00:00.000Z',
    });
    expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-02-28');
    expect(credits.get('credit-1')?.paymentDay).toBe(31);
    expect(credits.get('credit-1')?.daysPastDue).toBe(0);

    const february = await service.create('user-1', {
      ...paid,
      date: '2026-02-28T00:00:00.000Z',
    });
    expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-03-31');

    await service.remove('user-1', january.id);
    await service.remove('user-1', february.id);
    expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-01-31');
    expect(credits.get('credit-1')?.daysPastDue).toBe(2);
    expect(credits.get('credit-1')?.installmentCurrent).toBe(5);
  });

  it('restores stacked early cuotas in either delete order and on wipe', async () => {
    const paid = {
      amount: 10,
      categoryId: 'cat-1',
      title: 'Cuota',
      description: 'Pago',
      creditId: 'credit-1',
      advanceInstallment: true,
    };

    for (const order of ['oldest', 'newest'] as const) {
      const { prisma, credits } = memoryPrisma();
      const credit = credits.get('credit-1')!;
      credit.nextPaymentDate = new Date('2026-10-05T00:00:00.000Z');
      credit.daysPastDue = 4;
      credit.remainingBalance = new Prisma.Decimal('100.50');
      const service = new ExpensesService(prisma);
      const first = await service.create('user-1', {
        ...paid,
        date: '2026-09-30T00:00:00.000Z',
      });
      const second = await service.create('user-1', {
        ...paid,
        date: '2026-10-31T00:00:00.000Z',
      });
      expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-12-05');

      const ids = order === 'oldest' ? [first.id, second.id] : [second.id, first.id];
      for (const id of ids) await service.remove('user-1', id);

      expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-10-05');
      expect(credits.get('credit-1')?.daysPastDue).toBe(4);
      expect(credits.get('credit-1')?.installmentCurrent).toBe(5);
    }

    const { prisma, credits } = memoryPrisma();
    const credit = credits.get('credit-1')!;
    credit.nextPaymentDate = new Date('2026-10-05T00:00:00.000Z');
    credit.daysPastDue = 4;
    credit.remainingBalance = new Prisma.Decimal('100.50');
    const service = new ExpensesService(prisma);
    await service.create('user-1', { ...paid, date: '2026-09-30T00:00:00.000Z' });
    await service.create('user-1', { ...paid, date: '2026-10-31T00:00:00.000Z' });
    await service.wipeAll('user-1');
    expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-10-05');
    expect(credits.get('credit-1')?.daysPastDue).toBe(4);
    expect(credits.get('credit-1')?.installmentCurrent).toBe(5);
  });

  it('restores the stored due date after a date-only edit', async () => {
    const { prisma, credits } = memoryPrisma();
    const credit = credits.get('credit-1')!;
    credit.nextPaymentDate = new Date('2026-10-05T00:00:00.000Z');
    credit.daysPastDue = 4;
    const service = new ExpensesService(prisma);
    const expense = await service.create('user-1', {
      amount: 10,
      categoryId: 'cat-1',
      title: 'Cuota',
      description: 'Pago',
      creditId: 'credit-1',
      advanceInstallment: true,
      date: '2026-09-30T00:00:00.000Z',
    });

    await service.update('user-1', expense.id, {
      date: '2026-09-01T00:00:00.000Z',
    });
    expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-11-05');

    await service.remove('user-1', expense.id);
    expect(utcDay(credits.get('credit-1')?.nextPaymentDate)).toBe('2026-10-05');
    expect(credits.get('credit-1')?.daysPastDue).toBe(4);
    expect(credits.get('credit-1')?.installmentCurrent).toBe(5);
  });

  it('does not restore a balance when the credit was already deleted', async () => {
    const { prisma, credits } = memoryPrisma();
    const service = new ExpensesService(prisma);
    const expense = await service.create('user-1', {
      amount: 40,
      categoryId: 'cat-1',
      title: 'Abono',
      description: 'Pago',
      creditId: 'credit-1',
    });
    expect(num(credits.get('credit-1')?.remainingBalance)).toBe(60.5);
    credits.delete('credit-1');
    await expect(service.remove('user-1', expense.id)).resolves.toEqual({
      deleted: true,
      id: expense.id,
    });
  });

  it('rejects an unknown credit', async () => {
    const { prisma } = memoryPrisma();
    const service = new ExpensesService(prisma);
    await expect(
      service.create('user-1', {
        amount: 10,
        categoryId: 'cat-1',
        title: 'X',
        description: 'Y',
        creditId: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restores every linked credit when wiping expenses', async () => {
    const { prisma, credits, expenses } = memoryPrisma();
    const service = new ExpensesService(prisma);
    await service.create('user-1', {
      amount: 20,
      categoryId: 'cat-1',
      title: 'Uno',
      description: 'Pago',
      creditId: 'credit-1',
      advanceInstallment: true,
    });
    await service.create('user-1', {
      amount: 30,
      categoryId: 'cat-1',
      title: 'Dos',
      description: 'Pago',
      creditId: 'credit-1',
    });
    expect(num(credits.get('credit-1')?.remainingBalance)).toBe(50.5);
    expect(credits.get('credit-1')?.installmentCurrent).toBe(6);

    const wiped = await service.wipeAll('user-1');
    expect(wiped.deleted).toBe(2);
    expect(expenses.size).toBe(0);
    expect(num(credits.get('credit-1')?.remainingBalance)).toBe(100.5);
    expect(credits.get('credit-1')?.installmentCurrent).toBe(5);
  });

  it('saves a recurring template and rejects one tied to a credit', async () => {
    const { prisma, recurring } = memoryPrisma();
    const service = new ExpensesService(prisma);

    await service.create('user-1', {
      amount: 600000,
      categoryId: 'cat-1',
      title: 'Mamá',
      description: 'Mensual',
      saveAsRecurring: true,
    });

    expect(recurring.size).toBe(1);
    expect([...recurring.values()][0]).toMatchObject({
      amount: 600000,
      categoryId: 'cat-1',
      title: 'Mamá',
      description: 'Mensual',
      paymentType: 'debit_card',
      userId: 'user-1',
    });

    await expect(
      service.create('user-1', {
        amount: 10,
        categoryId: 'cat-1',
        title: 'Cuota',
        description: 'Pago',
        creditId: 'credit-1',
        saveAsRecurring: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(recurring.size).toBe(1);
  });

  it('deletes a recurring template only for its owner', async () => {
    const { prisma, recurring } = memoryPrisma();
    const service = new ExpensesService(prisma);
    await service.create('user-1', {
      amount: 600000,
      categoryId: 'cat-1',
      title: 'Mamá',
      description: 'Mensual',
      saveAsRecurring: true,
    });
    const id = [...recurring.keys()][0];

    await expect(service.removeRecurring('user-2', id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(recurring.size).toBe(1);

    await expect(service.removeRecurring('user-1', id)).resolves.toEqual({
      deleted: true,
      id,
    });
    expect(recurring.size).toBe(0);
  });
});
