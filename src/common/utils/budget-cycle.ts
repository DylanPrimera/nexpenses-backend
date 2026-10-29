import {
  getLocalDateParts,
  localDaysBetween,
  localMidnight,
  startOfLocalDay,
} from './date-range.js';

/** After this many days without a new budget the cycle is considered stale (payday likely passed). */
export const STALE_CYCLE_DAYS = 35;
/** Furthest back a new cycle may start. */
export const MAX_CYCLE_START_PAST_DAYS = 366;
/** Furthest ahead a new cycle may start (absorbs client clock/time-zone skew). */
export const MAX_CYCLE_START_FUTURE_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isCycleStartWithinWindow(start: Date, now = new Date()): boolean {
  const time = start.getTime();
  if (Number.isNaN(time)) return false;
  const today = startOfLocalDay(now).getTime();
  return (
    time >= today - MAX_CYCLE_START_PAST_DAYS * DAY_MS &&
    time < today + (MAX_CYCLE_START_FUTURE_DAYS + 1) * DAY_MS
  );
}

/**
 * Expected end of a cycle: one calendar month after its start (Bogotá), minus 1 ms.
 * The real end is whenever the next budget is registered; this only drives `daysLeft`.
 */
export function expectedCycleEnd(cycleStartedAt: Date): Date {
  const { year, month, day } = getLocalDateParts(cycleStartedAt);
  const lastDayNextMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const timeOfDay =
    cycleStartedAt.getTime() - startOfLocalDay(cycleStartedAt).getTime();
  const nextStart =
    localMidnight(year, month, Math.min(day, lastDayNextMonth)).getTime() +
    timeOfDay;
  return new Date(nextStart - 1);
}

export function getCycleProgress(cycleStartedAt: Date, now = new Date()) {
  const cycleEnd = expectedCycleEnd(cycleStartedAt);
  const daysElapsed = Math.max(0, localDaysBetween(cycleStartedAt, now));
  return {
    cycleStart: cycleStartedAt,
    cycleEnd,
    daysElapsed,
    daysLeft: Math.max(0, localDaysBetween(now, cycleEnd)),
    isStale: daysElapsed >= STALE_CYCLE_DAYS,
  };
}
