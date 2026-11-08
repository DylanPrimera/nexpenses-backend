import { BadRequestException } from '@nestjs/common';
import { getLocalNowParts } from '../common/utils/index.js';

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function todayDayKey(now = new Date()): string {
  const { year, month, day } = getLocalNowParts(now);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseCollectedOn(value: string, now = new Date()): Date {
  const match = DAY_PATTERN.exec(value);
  if (!match) {
    throw new BadRequestException({
      message: 'La fecha de cobro no es válida',
      code: 'INVALID_COLLECTED_ON',
    });
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException({
      message: 'La fecha de cobro no es válida',
      code: 'INVALID_COLLECTED_ON',
    });
  }
  if (value > todayDayKey(now)) {
    throw new BadRequestException({
      message: 'La fecha de cobro no puede ser futura',
      code: 'FUTURE_COLLECTED_ON',
    });
  }
  return date;
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
