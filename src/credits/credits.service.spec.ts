import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { CreditsService } from './credits.service.js';
import { num } from './domain/money.js';
import { eaToMv } from './domain/rates.js';
import { periodInterest } from './domain/rates.js';
import type { StatementFileService } from './statement-file.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const lulo = [
  'Lulo bank',
  '10000000001 5 de 9 Septiembre 21 - 2026',
  'Límite de pago: Oct. 01, 2026',
  'Valor a pagar cuota $121,844.50',
  'Intereses corrientes $11,491.32',
  'Seguro $1,042.89',
  'Saldo total a la fecha $586,663.96',
  'Monto solicitado $1,000,000.00',
  'Tasa de interés efectiva anual 22.5%',
  'Tipo de cuota Cuota fija',
].join('\n');

type Row = Record<string, unknown> & { id: string; userId: string };

function memoryPrisma() {
  const rows: Row[] = [];
  const api = {
    credit: {
      count: async ({ where }: { where: { userId: string } }) =>
        rows.filter((row) => row.userId === where.userId).length,
      create: async ({ data }: { data: Row }) => {
        const row: Row = {
          ...data,
          id: `credit-${rows.length + 1}`,
          createdAt: new Date('2026-09-28T00:00:00.000Z'),
          updatedAt: new Date('2026-09-28T00:00:00.000Z'),
        };
        rows.push(row);
        return row;
      },
      findMany: async ({
        where,
      }: {
        where: { userId: string; kind?: string };
      }) =>
        rows.filter(
          (row) =>
            row.userId === where.userId &&
            (where.kind == null || row.kind === where.kind),
        ),
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        rows.find(
          (row) => row.id === where.id && row.userId === where.userId,
        ) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row) throw new Error('missing');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = rows.findIndex((row) => row.id === where.id);
        const [row] = rows.splice(index, 1);
        return row;
      },
    },
  };
  return { prisma: api as unknown as PrismaService, rows };
}

describe('CreditsService', () => {
  const now = new Date('2026-09-28T12:00:00.000Z');

  it('stores a statement without a PDF url and lets form rates override the PDF', async () => {
    const { prisma, rows } = memoryPrisma();
    const files = {
      consume: async () => lulo,
    } as unknown as StatementFileService;
    const service = new CreditsService(prisma, files);

    const created = await service.createFromStatement(
      'user-1',
      { kind: 'CONSUMO', displayName: 'Lulo ejemplo', rateEa: 10 },
      { buffer: Buffer.from('%PDF') },
      now,
    );

    expect(created.provider).toBe('LULO');
    expect(created.displayName).toBe('Lulo ejemplo');
    expect(created.remainingBalance).toBe(586663.96);
    expect(created.rateEa).toBe(10);
    expect(created.rateMv).toBe(eaToMv(10));
    expect(created.periodInterest).toBe(periodInterest(586663.96, eaToMv(10)));
    expect(created.status).toBe('proximo');
    expect(created.installmentAmount).toBe(121844.5);
    const stored = JSON.stringify(rows[0]?.rawExtract);
    expect(stored).not.toMatch(/https?:\/\//);
    expect(stored).not.toMatch(/cloudinary|statement\.pdf/i);
    expect(rows[0]?.rawExtract).toMatchObject({ source: 'statement' });
  });

  it('rejects the 11th credit', async () => {
    const { prisma } = memoryPrisma();
    const files = {
      consume: async () => {
        throw new Error('should not parse');
      },
    } as unknown as StatementFileService;
    const service = new CreditsService(prisma, files);
    for (let i = 0; i < 10; i += 1) {
      await service.create(
        'user-1',
        {
          kind: 'TC',
          provider: 'GENERIC',
          bankName: 'Banco',
          displayName: `Tarjeta ${i}`,
          nextPaymentDate: '2026-10-20',
          remainingBalance: 1000,
          minPayment: 100,
        },
        now,
      );
    }
    await expect(
      service.createFromStatement(
        'user-1',
        { kind: 'TC' },
        { buffer: Buffer.from('%PDF') },
        now,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a credit manually without provider', async () => {
    const { prisma, rows } = memoryPrisma();
    const service = new CreditsService(prisma, {
      consume: async () => {
        throw new Error('should not parse');
      },
    } as unknown as StatementFileService);
    const created = await service.create(
      'user-1',
      {
        kind: 'TC',
        displayName: 'Visa Manual',
        bankName: 'Bancolombia',
        nextPaymentDate: '2026-10-20',
        remainingBalance: 500000,
        minPayment: 50000,
        rateEa: 28.5,
      },
      now,
    );
    expect(created.displayName).toBe('Visa Manual');
    expect(created.bankName).toBe('Bancolombia');
    expect(created.provider).toBe('GENERIC');
    expect(created.remainingBalance).toBe(500000);
    expect(created.minPayment).toBe(50000);
    expect(rows[0]?.rawExtract).toMatchObject({ source: 'manual' });
  });

  it('recalculates a consumer projection when rates are patched', async () => {
    const { prisma, rows } = memoryPrisma();
    const service = new CreditsService(prisma, {
      consume: async () => '',
    } as unknown as StatementFileService);
    const created = await service.create(
      'user-1',
      {
        kind: 'CONSUMO',
        provider: 'GENERIC',
        bankName: 'Banco',
        displayName: 'Libre',
        nextPaymentDate: '2026-10-20',
        remainingBalance: 999,
        installmentAmount: 100,
        originalAmount: 1000,
        termMonths: 2,
        installmentCurrent: 1,
        insuranceOrOtherCharges: 0,
      },
      now,
    );

    const updated = await service.update(
      'user-1',
      created.id,
      { rateMv: 1 },
      now,
    );
    expect(updated.remainingBalance).toBe(1000);
    expect(updated.periodInterest).toBe(10);
    expect(updated.rateEa).not.toBeNull();
    expect(num(rows[0]?.remainingBalance)).toBe(1000);
    expect(JSON.stringify(rows[0]?.rawExtract)).toContain('rateProjection');
    expect(updated.remainingBalance).not.toBeInstanceOf(Prisma.Decimal);
  });

  it('allows remainingBalance patch on TC', async () => {
    const { prisma, rows } = memoryPrisma();
    const service = new CreditsService(prisma, {
      consume: async () => '',
    } as unknown as StatementFileService);
    const created = await service.create(
      'user-1',
      {
        kind: 'TC',
        provider: 'GENERIC',
        bankName: 'Banco',
        displayName: 'Visa',
        nextPaymentDate: '2026-10-20',
        remainingBalance: 500_000,
        minPayment: 50_000,
      },
      now,
    );

    const updated = await service.update(
      'user-1',
      created.id,
      { remainingBalance: 420_000.5 },
      now,
    );
    expect(updated.remainingBalance).toBe(420000.5);
    expect(num(rows[0]?.remainingBalance)).toBe(420000.5);
  });

  it('rejects remainingBalance patch on CONSUMO', async () => {
    const { prisma } = memoryPrisma();
    const service = new CreditsService(prisma, {
      consume: async () => '',
    } as unknown as StatementFileService);
    const created = await service.create(
      'user-1',
      {
        kind: 'CONSUMO',
        provider: 'GENERIC',
        bankName: 'Banco',
        displayName: 'Libre',
        nextPaymentDate: '2026-10-20',
        remainingBalance: 999,
        installmentAmount: 100,
      },
      now,
    );

    await expect(
      service.update('user-1', created.id, { remainingBalance: 100 }, now),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
