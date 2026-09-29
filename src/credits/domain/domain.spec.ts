import { describe, expect, it } from 'vitest';
import { utcDayDiff, parseDateToken } from './dates.js';
import { chargeBalance, parseMoney, restoreBalance } from './money.js';
import { projectFromRates } from './projection.js';
import { amortPayment, amortRemaining, eaToMv, mvToEa } from './rates.js';
import { creditBadge } from './status.js';

describe('parseMoney', () => {
  it('reads Colombian and US statement amounts', () => {
    expect(parseMoney('$3.350.000,00')).toBe(3350000);
    expect(parseMoney('$2.485.328,72')).toBe(2485328.72);
    expect(parseMoney('$586,663.96')).toBe(586663.96);
    expect(parseMoney('$1,000,000.00')).toBe(1000000);
    expect(parseMoney('$121,844.50')).toBe(121844.5);
    expect(parseMoney('$0,00')).toBe(0);
    expect(parseMoney('$514.080,00')).toBe(514080);
    expect(parseMoney('$1,800')).toBe(1800);
    expect(parseMoney('4,822.00')).toBe(4822);
  });
});

describe('parseDateToken', () => {
  it('reads the date shapes used on the sample statements', () => {
    expect(parseDateToken('07 OCT 2026')).toBe('2026-10-07');
    expect(parseDateToken('Oct. 01, 2026')).toBe('2026-10-01');
    expect(parseDateToken('Septiembre 21 - 2026')).toBe('2026-09-21');
    expect(parseDateToken('01/10/2026')).toBe('2026-10-01');
    expect(parseDateToken('05-10-26')).toBe('2026-10-05');
  });
});

describe('creditBadge', () => {
  const now = new Date('2026-09-28T15:00:00.000Z');

  it('marks overdue, within 7 days, and current', () => {
    expect(utcDayDiff(new Date('2026-10-01T00:00:00.000Z'), now)).toBe(3);
    expect(
      creditBadge({ daysPastDue: 0, nextPaymentDate: '2026-10-01' }, now),
    ).toBe('proximo');
    expect(
      creditBadge({ daysPastDue: 0, nextPaymentDate: '2026-10-07' }, now),
    ).toBe('al_dia');
    expect(
      creditBadge({ daysPastDue: 2, nextPaymentDate: '2026-10-20' }, now),
    ).toBe('atrasado');
    expect(
      creditBadge({ daysPastDue: 0, nextPaymentDate: '2026-09-20' }, now),
    ).toBe('atrasado');
  });
});

describe('projectFromRates', () => {
  it('recomputes a consumer balance with French amortization', () => {
    const projected = projectFromRates(
      {
        kind: 'CONSUMO',
        remainingBalance: 999,
        originalAmount: 1000,
        termMonths: 2,
        installmentTotal: 2,
        installmentCurrent: 1,
        installmentAmount: null,
        insuranceOrOtherCharges: 0,
        rateEa: null,
        rateMv: null,
      },
      { rateMv: 1 },
      { recomputeBalance: true },
    );
    expect(projected.rateMv).toBe(1);
    expect(projected.rateEa).toBe(mvToEa(1));
    expect(projected.remainingBalance).toBe(amortRemaining(1000, 0.01, 2, 0));
    expect(projected.installmentAmount).toBe(amortPayment(1000, 0.01, 2));
    expect(projected.periodInterest).toBe(10);
  });

  it('keeps the statement balance when only refreshing interest', () => {
    const projected = projectFromRates(
      {
        kind: 'TC',
        remainingBalance: 200000,
        originalAmount: null,
        termMonths: null,
        installmentTotal: null,
        installmentCurrent: null,
        installmentAmount: null,
        insuranceOrOtherCharges: null,
        rateEa: 22.5,
        rateMv: null,
      },
      { rateEa: 10 },
      { recomputeBalance: false },
    );
    expect(projected.remainingBalance).toBe(200000);
    expect(projected.rateMv).toBe(eaToMv(10));
    expect(projected.periodInterest).not.toBeNull();
  });
});

describe('chargeBalance', () => {
  it('floors at zero and restores the applied amount', () => {
    const charged = chargeBalance(100.5, 500);
    expect(charged).toEqual({ remainingBalance: 0, applied: 100.5 });
    expect(restoreBalance(charged.remainingBalance, charged.applied)).toBe(
      100.5,
    );
  });
});
