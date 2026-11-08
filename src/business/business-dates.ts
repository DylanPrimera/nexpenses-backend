import { BadRequestException } from '@nestjs/common';
import { getLocalNowParts, localMidnight } from '../common/utils/index.js';

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function todayDayKey(now = new Date()): string {
  const { year, month, day } = getLocalNowParts(now);
  return `${year}-${pad(month)}-${pad(day)}`;
}

type DayError = { message: string; code: string };
type DayErrors = { invalid: DayError; future: DayError };

const COLLECTED_ON_ERRORS: DayErrors = {
  invalid: {
    message: 'La fecha de cobro no es válida',
    code: 'INVALID_COLLECTED_ON',
  },
  future: {
    message: 'La fecha de cobro no puede ser futura',
    code: 'FUTURE_COLLECTED_ON',
  },
};

const SPENT_ON_ERRORS: DayErrors = {
  invalid: {
    message: 'La fecha del gasto no es válida',
    code: 'INVALID_SPENT_ON',
  },
  future: {
    message: 'La fecha del gasto no puede ser futura',
    code: 'FUTURE_SPENT_ON',
  },
};

const NOON_MS = 12 * 60 * 60 * 1000;

function parseDayKey(value: string, now: Date, errors: DayErrors): Date {
  const match = DAY_PATTERN.exec(value);
  if (!match) throw new BadRequestException(errors.invalid);
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(errors.invalid);
  }
  if (value > todayDayKey(now)) throw new BadRequestException(errors.future);
  return date;
}

export function parseCollectedOn(value: string, now = new Date()): Date {
  return parseDayKey(value, now, COLLECTED_ON_ERRORS);
}

export function parseSpentOn(value: string, now = new Date()): Date {
  return parseDayKey(value, now, SPENT_ON_ERRORS);
}

export function dayInstant(spentOn: string, now = new Date()): Date {
  if (spentOn === todayDayKey(now)) return now;
  const [year, month, day] = spentOn.split('-').map(Number);
  return new Date(localMidnight(year, month - 1, day).getTime() + NOON_MS);
}

export function personalExpenseDate(
  spentOn: string,
  floor: Date,
  now = new Date(),
): Date {
  const instant = dayInstant(spentOn, now);
  return instant.getTime() >= floor.getTime()
    ? instant
    : new Date(floor.getTime());
}

export function parseMonthRange(value: string): { gte: Date; lt: Date } {
  const match = MONTH_PATTERN.exec(value);
  const year = match ? Number(match[1]) : NaN;
  const month = match ? Number(match[2]) : NaN;
  if (!match || month < 1 || month > 12) {
    throw new BadRequestException({
      message: 'El mes no es válido',
      code: 'INVALID_MONTH',
    });
  }
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
