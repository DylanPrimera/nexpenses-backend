const MONTHS: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function utcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateToken(raw: string): string | null {
  const trimmed = raw.trim();
  const numeric = trimmed.replace(/\s+/g, '');
  const numericMatch = numeric.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numericMatch) {
    const day = Number(numericMatch[1]);
    const month = Number(numericMatch[2]);
    let year = Number(numericMatch[3]);
    if (year < 100) year += 2000;
    const date = utcDate(year, month, day);
    return date ? toIsoDate(date) : null;
  }

  const words = trimmed
    .replace(/\./g, '')
    .replace(/,/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ');

  let match = words.match(/^(\d{1,2})\s+([A-Za-zñ]+)\s+(\d{4})$/i);
  if (match) {
    const month = MONTHS[fold(match[2] ?? '')];
    if (!month) return null;
    const date = utcDate(Number(match[3]), month, Number(match[1]));
    return date ? toIsoDate(date) : null;
  }

  match = words.match(/^([A-Za-zñ]+)\s+(\d{1,2})\s+(\d{4})$/i);
  if (match) {
    const month = MONTHS[fold(match[1] ?? '')];
    if (!month) return null;
    const date = utcDate(Number(match[3]), month, Number(match[2]));
    return date ? toIsoDate(date) : null;
  }

  return null;
}

/** Whole UTC calendar days from `now` until `due` (negative when overdue). */
export function utcDayDiff(due: Date, now: Date): number {
  const dueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );
  const nowDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((dueDay - nowDay) / 86_400_000);
}
