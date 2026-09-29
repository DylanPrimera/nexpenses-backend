import { Prisma } from '@prisma/client';
import type { CreditProviderCode } from './parsers/colombian-banks.js';
import { round2, round4, num } from './domain/money.js';
import { creditBadge, type CreditBadge } from './domain/status.js';

export function moneyDec(
  value: number | null | undefined,
): Prisma.Decimal | null {
  if (value == null) return null;
  return new Prisma.Decimal(round2(value).toFixed(2));
}

export function rateDec(
  value: number | null | undefined,
): Prisma.Decimal | null {
  if (value == null) return null;
  return new Prisma.Decimal(round4(value).toFixed(4));
}

export function isoToDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

export function asJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

type CreditRow = {
  id: string;
  userId: string;
  kind: 'TC' | 'CONSUMO';
  provider: CreditProviderCode;
  bankName: string;
  displayName: string;
  productRef: string | null;
  cutoffDate: Date | null;
  nextPaymentDate: Date | null;
  daysPastDue: number;
  remainingBalance: unknown;
  periodInterest: unknown;
  insuranceOrOtherCharges: unknown;
  rateEa: unknown;
  rateMv: unknown;
  creditLimit: unknown;
  availableCredit: unknown;
  usedAmount: unknown;
  minPayment: unknown;
  amountDueThisPeriod: unknown;
  installmentAmount: unknown;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  originalAmount: unknown;
  termMonths: number | null;
  installmentType: string | null;
  stage: string | null;
  rawExtract: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type CreditView = Omit<
  CreditRow,
  | 'remainingBalance'
  | 'periodInterest'
  | 'insuranceOrOtherCharges'
  | 'rateEa'
  | 'rateMv'
  | 'creditLimit'
  | 'availableCredit'
  | 'usedAmount'
  | 'minPayment'
  | 'amountDueThisPeriod'
  | 'installmentAmount'
  | 'originalAmount'
> & {
  remainingBalance: number;
  periodInterest: number | null;
  insuranceOrOtherCharges: number | null;
  rateEa: number | null;
  rateMv: number | null;
  creditLimit: number | null;
  availableCredit: number | null;
  usedAmount: number | null;
  minPayment: number | null;
  amountDueThisPeriod: number | null;
  installmentAmount: number | null;
  originalAmount: number | null;
  status: CreditBadge;
};

export function serializeCredit(
  credit: CreditRow,
  now = new Date(),
): CreditView {
  return {
    id: credit.id,
    userId: credit.userId,
    kind: credit.kind,
    provider: credit.provider,
    bankName: credit.bankName,
    displayName: credit.displayName,
    productRef: credit.productRef,
    cutoffDate: credit.cutoffDate,
    nextPaymentDate: credit.nextPaymentDate,
    daysPastDue: credit.daysPastDue,
    remainingBalance: num(credit.remainingBalance) ?? 0,
    periodInterest: num(credit.periodInterest),
    insuranceOrOtherCharges: num(credit.insuranceOrOtherCharges),
    rateEa: num(credit.rateEa),
    rateMv: num(credit.rateMv),
    creditLimit: num(credit.creditLimit),
    availableCredit: num(credit.availableCredit),
    usedAmount: num(credit.usedAmount),
    minPayment: num(credit.minPayment),
    amountDueThisPeriod: num(credit.amountDueThisPeriod),
    installmentAmount: num(credit.installmentAmount),
    installmentCurrent: credit.installmentCurrent,
    installmentTotal: credit.installmentTotal,
    originalAmount: num(credit.originalAmount),
    termMonths: credit.termMonths,
    installmentType: credit.installmentType,
    stage: credit.stage,
    rawExtract: credit.rawExtract,
    createdAt: credit.createdAt,
    updatedAt: credit.updatedAt,
    status: creditBadge(credit, now),
  };
}
