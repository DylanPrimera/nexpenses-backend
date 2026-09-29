import { utcDayDiff } from './dates.js';

export type CreditBadge = 'atrasado' | 'proximo' | 'al_dia';

export function creditBadge(
  credit: {
    daysPastDue?: number | null;
    nextPaymentDate?: Date | string | null;
  },
  now = new Date(),
): CreditBadge {
  if ((credit.daysPastDue ?? 0) > 0) return 'atrasado';
  if (!credit.nextPaymentDate) return 'al_dia';
  const due =
    credit.nextPaymentDate instanceof Date
      ? credit.nextPaymentDate
      : new Date(credit.nextPaymentDate);
  if (Number.isNaN(due.getTime())) return 'al_dia';
  const days = utcDayDiff(due, now);
  if (days < 0) return 'atrasado';
  if (days <= 7) return 'proximo';
  return 'al_dia';
}
