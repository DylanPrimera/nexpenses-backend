export function parseMoney(raw: string): number | null {
  const compact = raw.trim().replace(/\s/g, '').replace(/\$/g, '');
  if (!compact || !/\d/.test(compact)) return null;

  const negative = compact.startsWith('-') || compact.startsWith('−');
  const s = compact.replace(/^[−+-]/, '');
  if (!/^\d+(?:[.,]\d+)*$/.test(s)) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  let normalized: string;

  if (hasComma && hasDot) {
    normalized =
      s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
  } else if (hasComma) {
    const parts = s.split(',');
    const last = parts[parts.length - 1] ?? '';
    normalized =
      parts.length > 2 || last.length === 3
        ? s.replace(/,/g, '')
        : s.replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    const last = parts[parts.length - 1] ?? '';
    normalized =
      parts.length > 2 || last.length === 3 ? s.replace(/\./g, '') : s;
  } else {
    normalized = s;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -round2(value) : round2(value);
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function parseRate(raw: string): number | null {
  const s = raw.trim().replace('%', '').replace(/\s/g, '');
  if (!s) return null;
  const normalized =
    s.includes(',') && !s.includes('.')
      ? s.replace(',', '.')
      : s.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function num(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === 'object' && 'toNumber' in value) {
    const rendered = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(rendered) ? rendered : null;
  }
  return null;
}

export function chargeBalance(
  balance: number,
  amount: number,
): { remainingBalance: number; applied: number } {
  const balanceCents = Math.max(0, toCents(balance));
  const amountCents = Math.max(0, toCents(amount));
  const applied = Math.min(balanceCents, amountCents);
  return {
    remainingBalance: (balanceCents - applied) / 100,
    applied: applied / 100,
  };
}

export function restoreBalance(balance: number, applied: number): number {
  return (Math.max(0, toCents(balance)) + Math.max(0, toCents(applied))) / 100;
}
