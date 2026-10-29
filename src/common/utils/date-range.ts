/**
 * Calendar math for the app's time zone. Colombia (America/Bogota) is UTC-5
 * all year with no DST, so a fixed offset is exact and avoids Intl lookups.
 */
export const APP_TIME_ZONE = 'America/Bogota';
const APP_UTC_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type LocalDateParts = { year: number; month: number; day: number };

/** Instant of local (Bogotá) midnight for the given calendar day. `monthIndex` is 0-based and may overflow. */
export function localMidnight(year: number, monthIndex: number, day = 1): Date {
  return new Date(Date.UTC(year, monthIndex, day) - APP_UTC_OFFSET_MS);
}

/** Calendar parts (month 1–12) of an instant, as seen in Bogotá. */
export function getLocalDateParts(date: Date): LocalDateParts {
  const shifted = new Date(date.getTime() + APP_UTC_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function getLocalNowParts(now = new Date()): LocalDateParts {
  return getLocalDateParts(now);
}

/** Half-open [start, end) range of a Bogotá calendar month, or of the whole year when `month` is omitted. */
export function getLocalDateRange(
  year: number,
  month?: number,
): { start: Date; end: Date } {
  if (month != null) {
    return {
      start: localMidnight(year, month - 1),
      end: localMidnight(year, month),
    };
  }
  return {
    start: localMidnight(year, 0),
    end: localMidnight(year + 1, 0),
  };
}

export function startOfLocalDay(date: Date): Date {
  const { year, month, day } = getLocalDateParts(date);
  return localMidnight(year, month - 1, day);
}

export function startOfLocalMonth(date: Date): Date {
  const { year, month } = getLocalDateParts(date);
  return localMidnight(year, month - 1);
}

/** Parses `YYYY-MM-DD` as Bogotá midnight; any other ISO string as the instant it names. */
export function parseLocalDateOrInstant(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return localMidnight(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
  }
  return new Date(value);
}

/** Whole Bogotá calendar days from `from` to `to` (0 when same day). */
export function localDaysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / DAY_MS,
  );
}

export function daysLeftInMonth(
  year: number,
  month: number,
  now = new Date(),
): number | null {
  const { year: cy, month: cm, day } = getLocalNowParts(now);
  if (year !== cy || month !== cm) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return lastDay - day;
}
