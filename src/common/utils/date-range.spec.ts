import { describe, expect, it } from 'vitest';
import {
  expectedCycleEnd,
  getCycleProgress,
  isCycleStartWithinWindow,
} from './budget-cycle.js';
import {
  daysLeftInMonth,
  getLocalDateParts,
  getLocalDateRange,
  getLocalNowParts,
  parseLocalDateOrInstant,
  startOfLocalDay,
  startOfLocalMonth,
} from './date-range.js';

const inRange = (date: Date, range: { start: Date; end: Date }) =>
  date >= range.start && date < range.end;

describe('date-range (America/Bogota)', () => {
  it('counts 31 Oct 20:30 Bogotá (2026-11-01T01:30Z) in October', () => {
    const expense = new Date('2026-11-01T01:30:00.000Z');
    expect(getLocalDateParts(expense)).toEqual({ year: 2026, month: 10, day: 31 });
    expect(inRange(expense, getLocalDateRange(2026, 10))).toBe(true);
    expect(inRange(expense, getLocalDateRange(2026, 11))).toBe(false);
  });

  it('builds month ranges from Bogotá midnight', () => {
    expect(getLocalDateRange(2026, 10)).toEqual({
      start: new Date('2026-10-01T05:00:00.000Z'),
      end: new Date('2026-11-01T05:00:00.000Z'),
    });
  });

  it('handles the year change for December and whole-year ranges', () => {
    expect(getLocalDateRange(2026, 12)).toEqual({
      start: new Date('2026-12-01T05:00:00.000Z'),
      end: new Date('2027-01-01T05:00:00.000Z'),
    });
    expect(getLocalDateRange(2026)).toEqual({
      start: new Date('2026-01-01T05:00:00.000Z'),
      end: new Date('2027-01-01T05:00:00.000Z'),
    });
    const newYearsEve = new Date('2027-01-01T04:59:59.999Z');
    expect(getLocalNowParts(newYearsEve)).toEqual({ year: 2026, month: 12, day: 31 });
    expect(inRange(newYearsEve, getLocalDateRange(2026))).toBe(true);
    expect(inRange(newYearsEve, getLocalDateRange(2027))).toBe(false);
  });

  it('computes day/month starts and days left in Bogotá', () => {
    const now = new Date('2026-11-01T01:30:00.000Z');
    expect(startOfLocalDay(now).toISOString()).toBe('2026-10-31T05:00:00.000Z');
    expect(startOfLocalMonth(now).toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(daysLeftInMonth(2026, 10, now)).toBe(0);
    expect(daysLeftInMonth(2026, 11, now)).toBeNull();
  });

  it('parses date-only values as Bogotá midnight', () => {
    expect(parseLocalDateOrInstant('2026-10-29').toISOString()).toBe(
      '2026-10-29T05:00:00.000Z',
    );
    expect(parseLocalDateOrInstant('2026-10-29T15:00:00.000Z').toISOString()).toBe(
      '2026-10-29T15:00:00.000Z',
    );
  });
});

describe('budget cycle', () => {
  const now = new Date('2026-10-29T15:00:00.000Z');

  it('expects the cycle to end one calendar month after it starts', () => {
    const start = new Date('2026-10-15T05:00:00.000Z');
    expect(expectedCycleEnd(start).toISOString()).toBe('2026-11-15T04:59:59.999Z');
    const endOfJan = new Date('2027-01-31T05:00:00.000Z');
    expect(expectedCycleEnd(endOfJan).toISOString()).toBe('2027-02-28T04:59:59.999Z');
  });

  it('reports days left/elapsed and staleness', () => {
    const progress = getCycleProgress(new Date('2026-10-15T05:00:00.000Z'), now);
    expect(progress.daysElapsed).toBe(14);
    expect(progress.daysLeft).toBe(16);
    expect(progress.isStale).toBe(false);

    const old = getCycleProgress(new Date('2026-09-20T05:00:00.000Z'), now);
    expect(old.daysLeft).toBe(0);
    expect(old.isStale).toBe(true);
  });

  it('accepts cycle starts within the last year up to tomorrow', () => {
    expect(isCycleStartWithinWindow(new Date('2026-10-29T05:00:00.000Z'), now)).toBe(true);
    expect(isCycleStartWithinWindow(new Date('2026-10-30T20:00:00.000Z'), now)).toBe(true);
    expect(isCycleStartWithinWindow(new Date('2026-10-31T05:00:00.000Z'), now)).toBe(false);
    expect(isCycleStartWithinWindow(new Date('2025-10-28T05:00:00.000Z'), now)).toBe(true);
    expect(isCycleStartWithinWindow(new Date('2025-10-20T05:00:00.000Z'), now)).toBe(false);
    expect(isCycleStartWithinWindow(new Date('invalid'), now)).toBe(false);
  });
});
