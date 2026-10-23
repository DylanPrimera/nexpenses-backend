import { utcDayDiff } from './dates.js';

export const UPCOMING_CUOTA_DAYS = 5;

export type CuotaSchedule = {
  kind: string;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  nextPaymentDate: Date | null;
  daysPastDue: number;
  paymentDay: number | null;
};

export type CuotaShift = {
  id: string;
  dueBefore: Date;
  daysPastDueBefore: number;
};

export type CuotaEffect = {
  advanced: boolean;
  dueBefore: Date | null;
  daysPastDueBefore: number | null;
  installmentCurrent: number | null;
  nextPaymentDate: Date | null;
  daysPastDue: number;
  paymentDay: number | null;
};

export type RevertedCuota = {
  installmentCurrent: number | null;
  nextPaymentDate: Date | null;
  daysPastDue: number;
  rewritten: CuotaShift | null;
};

export function paymentDayOf(date: Date | null | undefined): number | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.getUTCDate();
}

export function addUtcMonths(
  date: Date,
  delta: number,
  anchorDay: number,
): Date {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth() + delta;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(anchorDay, lastDay)));
}

function sameUtcDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function isUpcomingCuota(paidOn: Date, nextPaymentDate: Date): boolean {
  const daysBefore = utcDayDiff(nextPaymentDate, paidOn);
  return daysBefore >= 0 && daysBefore <= UPCOMING_CUOTA_DAYS;
}

export function applyCuotaPayment(
  schedule: CuotaSchedule,
  input: { advanceInstallment: boolean; paidOn: Date },
): CuotaEffect {
  const effect: CuotaEffect = {
    advanced: false,
    dueBefore: null,
    daysPastDueBefore: null,
    installmentCurrent: schedule.installmentCurrent,
    nextPaymentDate: schedule.nextPaymentDate,
    daysPastDue: schedule.daysPastDue,
    paymentDay: schedule.paymentDay,
  };

  const canAdvance =
    input.advanceInstallment &&
    schedule.kind === 'CONSUMO' &&
    schedule.installmentCurrent != null &&
    (schedule.installmentTotal == null ||
      schedule.installmentCurrent < schedule.installmentTotal);

  if (!canAdvance || schedule.installmentCurrent == null) return effect;

  effect.advanced = true;
  effect.installmentCurrent = schedule.installmentCurrent + 1;

  const due = schedule.nextPaymentDate;
  if (due == null || !isUpcomingCuota(input.paidOn, due)) return effect;

  const anchor = schedule.paymentDay ?? due.getUTCDate();
  effect.dueBefore = due;
  effect.daysPastDueBefore = schedule.daysPastDue;
  effect.nextPaymentDate = addUtcMonths(due, 1, anchor);
  effect.daysPastDue = 0;
  effect.paymentDay = anchor;
  return effect;
}

function chainBaseline(shifts: CuotaShift[], anchor: number): CuotaShift | null {
  const bases = shifts.filter(
    (shift) =>
      !shifts.some(
        (other) =>
          other !== shift &&
          sameUtcDay(shift.dueBefore, addUtcMonths(other.dueBefore, 1, anchor)),
      ),
  );
  return bases.length === 1 ? (bases[0] ?? null) : null;
}

export function revertCuotaPayment(
  schedule: Pick<
    CuotaSchedule,
    'installmentCurrent' | 'nextPaymentDate' | 'daysPastDue' | 'paymentDay'
  >,
  effect: {
    advanced: boolean;
    dueBefore: Date | null;
    daysPastDueBefore: number | null;
  },
  others: CuotaShift[] = [],
): RevertedCuota {
  const installmentCurrent =
    effect.advanced && schedule.installmentCurrent != null
      ? Math.max(0, schedule.installmentCurrent - 1)
      : schedule.installmentCurrent;
  const unchanged: RevertedCuota = {
    installmentCurrent,
    nextPaymentDate: schedule.nextPaymentDate,
    daysPastDue: schedule.daysPastDue,
    rewritten: null,
  };
  if (effect.dueBefore == null || effect.daysPastDueBefore == null) {
    return unchanged;
  }

  const removing: CuotaShift = {
    id: '',
    dueBefore: effect.dueBefore,
    daysPastDueBefore: effect.daysPastDueBefore,
  };
  const shifts = [...others, removing];
  const anchor = schedule.paymentDay ?? removing.dueBefore.getUTCDate();
  const baseline = chainBaseline(shifts, anchor);
  if (!baseline || schedule.nextPaymentDate == null) return unchanged;
  if (
    schedule.paymentDay != null &&
    baseline.dueBefore.getUTCDate() !== schedule.paymentDay
  ) {
    return unchanged;
  }

  const expected = addUtcMonths(baseline.dueBefore, shifts.length, anchor);
  if (!sameUtcDay(schedule.nextPaymentDate, expected)) return unchanged;

  const remaining = shifts.length - 1;
  const successor = others.find((shift) =>
    sameUtcDay(shift.dueBefore, addUtcMonths(removing.dueBefore, 1, anchor)),
  );

  return {
    installmentCurrent,
    nextPaymentDate:
      remaining === 0
        ? baseline.dueBefore
        : addUtcMonths(baseline.dueBefore, remaining, anchor),
    daysPastDue:
      remaining === 0 ? baseline.daysPastDueBefore : schedule.daysPastDue,
    rewritten:
      remaining > 0 && baseline === removing && successor
        ? {
            id: successor.id,
            dueBefore: baseline.dueBefore,
            daysPastDueBefore: baseline.daysPastDueBefore,
          }
        : null,
  };
}
