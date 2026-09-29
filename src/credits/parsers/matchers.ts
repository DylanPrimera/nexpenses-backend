import { parseDateToken } from '../domain/dates.js';
import { parseMoney, parseRate } from '../domain/money.js';

export function matchMoney(text: string, pattern: RegExp): number | null {
  const token = text.match(pattern)?.[1];
  if (!token) return null;
  return parseMoney(token);
}

export function matchRate(text: string, pattern: RegExp): number | null {
  const token = text.match(pattern)?.[1];
  if (!token) return null;
  return parseRate(token);
}

export function matchDate(text: string, pattern: RegExp): string | null {
  const token = text.match(pattern)?.[1];
  if (!token) return null;
  return parseDateToken(token);
}

export function clip(
  value: string | null | undefined,
  max: number,
): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Most common percentage in (min, max], first-seen wins ties. */
export function modePercent(
  text: string,
  minExclusive: number,
  maxInclusive: number,
): number | null {
  const counts = new Map<number, { count: number; order: number }>();
  let order = 0;
  for (const match of text.matchAll(/(\d{1,2}[.,]\d{1,2})\s*%/g)) {
    const rate = parseRate(match[1] ?? '');
    if (rate == null || rate <= minExclusive || rate > maxInclusive) continue;
    const prev = counts.get(rate);
    if (prev) prev.count += 1;
    else counts.set(rate, { count: 1, order: order++ });
  }
  let best: { rate: number; count: number; order: number } | null = null;
  for (const [rate, meta] of counts) {
    if (
      !best ||
      meta.count > best.count ||
      (meta.count === best.count && meta.order < best.order)
    ) {
      best = { rate, count: meta.count, order: meta.order };
    }
  }
  return best?.rate ?? null;
}
