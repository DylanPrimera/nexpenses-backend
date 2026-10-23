import { describe, expect, it } from 'vitest';
import { utcDayDiff, parseDateToken } from './dates.js';
import { chargeBalance, parseMoney, restoreBalance } from './money.js';
import { projectFromRates } from './projection.js';
import { amortPayment, amortRemaining, eaToMv, mvToEa } from './rates.js';
import {
  applyCuotaPayment,
  revertCuotaPayment,
  type CuotaSchedule,
  type CuotaShift,
} from './schedule.js';
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

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function iso(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function cuota(overrides: Partial<CuotaSchedule> = {}): CuotaSchedule {
  return {
    kind: 'CONSUMO',
    installmentCurrent: 5,
    installmentTotal: 12,
    nextPaymentDate: utc('2026-10-05'),
    daysPastDue: 4,
    paymentDay: null,
    ...overrides,
  };
}

describe('applyCuotaPayment', () => {
  it('shifts the due date on day 0 and day 5, and leaves day 6 and a late payment', () => {
    const onDue = applyCuotaPayment(cuota(), {
      advanceInstallment: true,
      paidOn: utc('2026-10-05'),
    });
    expect(iso(onDue.nextPaymentDate)).toBe('2026-11-05');
    expect(onDue.dueBefore && iso(onDue.dueBefore)).toBe('2026-10-05');
    expect(onDue.daysPastDueBefore).toBe(4);
    expect(onDue.daysPastDue).toBe(0);
    expect(onDue.installmentCurrent).toBe(6);
    expect(onDue.paymentDay).toBe(5);

    const fiveEarly = applyCuotaPayment(cuota(), {
      advanceInstallment: true,
      paidOn: utc('2026-09-30'),
    });
    expect(iso(fiveEarly.nextPaymentDate)).toBe('2026-11-05');
    expect(fiveEarly.daysPastDue).toBe(0);

    const sixEarly = applyCuotaPayment(
      cuota({ nextPaymentDate: utc('2026-10-06') }),
      { advanceInstallment: true, paidOn: utc('2026-09-30') },
    );
    expect(iso(sixEarly.nextPaymentDate)).toBe('2026-10-06');
    expect(sixEarly.dueBefore).toBeNull();
    expect(sixEarly.daysPastDueBefore).toBeNull();
    expect(sixEarly.daysPastDue).toBe(4);
    expect(sixEarly.installmentCurrent).toBe(6);

    const late = applyCuotaPayment(cuota(), {
      advanceInstallment: true,
      paidOn: utc('2026-10-06'),
    });
    expect(iso(late.nextPaymentDate)).toBe('2026-10-05');
    expect(late.dueBefore).toBeNull();
    expect(late.daysPastDue).toBe(4);
    expect(late.installmentCurrent).toBe(6);
  });

  it('keeps the contractual day across a short month', () => {
    const january = applyCuotaPayment(
      cuota({ nextPaymentDate: utc('2026-01-31'), daysPastDue: 2 }),
      { advanceInstallment: true, paidOn: utc('2026-01-31') },
    );
    expect(iso(january.nextPaymentDate)).toBe('2026-02-28');
    expect(january.paymentDay).toBe(31);

    const february = applyCuotaPayment(
      cuota({
        installmentCurrent: january.installmentCurrent,
        nextPaymentDate: january.nextPaymentDate,
        daysPastDue: january.daysPastDue,
        paymentDay: january.paymentDay,
      }),
      { advanceInstallment: true, paidOn: utc('2026-02-28') },
    );
    expect(iso(february.nextPaymentDate)).toBe('2026-03-31');
    expect(february.paymentDay).toBe(31);
    expect(february.dueBefore && iso(february.dueBefore)).toBe('2026-02-28');
  });
});

describe('revertCuotaPayment', () => {
  it('restores the due date and mora from the stored effect', () => {
    const applied = applyCuotaPayment(cuota(), {
      advanceInstallment: true,
      paidOn: utc('2026-09-30'),
    });
    const reverted = revertCuotaPayment(
      {
        installmentCurrent: applied.installmentCurrent,
        nextPaymentDate: applied.nextPaymentDate,
        daysPastDue: applied.daysPastDue,
        paymentDay: applied.paymentDay,
      },
      applied,
    );
    expect(iso(reverted.nextPaymentDate)).toBe('2026-10-05');
    expect(reverted.daysPastDue).toBe(4);
    expect(reverted.installmentCurrent).toBe(5);
    expect(reverted.rewritten).toBeNull();
  });

  it('does not rewind a payment that never moved the due date', () => {
    const applied = applyCuotaPayment(
      cuota({ nextPaymentDate: utc('2026-11-05') }),
      { advanceInstallment: true, paidOn: utc('2026-10-05') },
    );
    expect(applied.dueBefore).toBeNull();
    const reverted = revertCuotaPayment(
      {
        installmentCurrent: applied.installmentCurrent,
        nextPaymentDate: applied.nextPaymentDate,
        daysPastDue: applied.daysPastDue,
        paymentDay: applied.paymentDay,
      },
      applied,
    );
    expect(iso(reverted.nextPaymentDate)).toBe('2026-11-05');
    expect(reverted.daysPastDue).toBe(4);
    expect(reverted.installmentCurrent).toBe(5);
  });

  it('restores 31 January after the February clamp', () => {
    const applied = applyCuotaPayment(
      cuota({ nextPaymentDate: utc('2026-01-31'), daysPastDue: 2 }),
      { advanceInstallment: true, paidOn: utc('2026-01-26') },
    );
    expect(iso(applied.nextPaymentDate)).toBe('2026-02-28');
    const reverted = revertCuotaPayment(
      {
        installmentCurrent: applied.installmentCurrent,
        nextPaymentDate: applied.nextPaymentDate,
        daysPastDue: applied.daysPastDue,
        paymentDay: applied.paymentDay,
      },
      applied,
    );
    expect(iso(reverted.nextPaymentDate)).toBe('2026-01-31');
    expect(reverted.daysPastDue).toBe(2);
  });

  it('rewinds two stacked shifts in either order', () => {
    const start = cuota();
    const first = applyCuotaPayment(start, {
      advanceInstallment: true,
      paidOn: utc('2026-09-30'),
    });
    const second = applyCuotaPayment(
      cuota({
        installmentCurrent: first.installmentCurrent,
        nextPaymentDate: first.nextPaymentDate,
        daysPastDue: first.daysPastDue,
        paymentDay: first.paymentDay,
      }),
      { advanceInstallment: true, paidOn: utc('2026-10-31') },
    );
    const shifts: CuotaShift[] = [
      {
        id: 'a',
        dueBefore: first.dueBefore!,
        daysPastDueBefore: first.daysPastDueBefore!,
      },
      {
        id: 'b',
        dueBefore: second.dueBefore!,
        daysPastDueBefore: second.daysPastDueBefore!,
      },
    ];
    const live = {
      installmentCurrent: second.installmentCurrent,
      nextPaymentDate: second.nextPaymentDate,
      daysPastDue: second.daysPastDue,
      paymentDay: second.paymentDay,
    };

    for (const order of [
      ['a', 'b'],
      ['b', 'a'],
    ]) {
      let schedule = { ...live };
      let pending = shifts.map((shift) => ({ ...shift }));
      for (const id of order) {
        const current = pending.find((shift) => shift.id === id)!;
        const reverted = revertCuotaPayment(
          schedule,
          { advanced: true, ...current },
          pending.filter((shift) => shift.id !== id),
        );
        schedule = {
          installmentCurrent: reverted.installmentCurrent,
          nextPaymentDate: reverted.nextPaymentDate,
          daysPastDue: reverted.daysPastDue,
          paymentDay: schedule.paymentDay,
        };
        pending = pending.filter((shift) => shift.id !== id);
        if (reverted.rewritten) {
          pending = pending.map((shift) =>
            shift.id === reverted.rewritten!.id ? reverted.rewritten! : shift,
          );
        }
      }
      expect(iso(schedule.nextPaymentDate)).toBe('2026-10-05');
      expect(schedule.daysPastDue).toBe(4);
      expect(schedule.installmentCurrent).toBe(5);
    }
  });

  it('leaves a due date that was edited after the payment', () => {
    const applied = applyCuotaPayment(cuota(), {
      advanceInstallment: true,
      paidOn: utc('2026-09-30'),
    });
    const reverted = revertCuotaPayment(
      {
        installmentCurrent: applied.installmentCurrent,
        nextPaymentDate: utc('2026-11-04'),
        daysPastDue: 0,
        paymentDay: 4,
      },
      applied,
    );
    expect(iso(reverted.nextPaymentDate)).toBe('2026-11-04');
    expect(reverted.daysPastDue).toBe(0);
    expect(reverted.installmentCurrent).toBe(5);
  });
});
