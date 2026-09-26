
export function getUtcDateRange(
  year: number,
  month?: number,
): { start: Date; end: Date } {
  if (month != null) {
    return {
      start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    };
  }
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)),
  };
}

export function getLocalNowParts(now = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

export function daysLeftInMonth(
  year: number,
  month: number,
  now = new Date(),
): number | null {
  const { year: cy, month: cm, day } = getLocalNowParts(now);
  if (year !== cy || month !== cm) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return lastDay - day;
}
