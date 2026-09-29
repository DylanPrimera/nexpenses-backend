import { NotFoundException } from '@nestjs/common';
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
      findMany: async ({
        where,
      }: {
        where: { userId: string; creditId?: { not: null } };
      }) =>
        [...expenses.values()].filter((row) => {
          if (row.userId !== where.userId) return false;
          if (where.creditId && row.creditId == null) return false;
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
});
