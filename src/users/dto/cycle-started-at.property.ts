import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, ValidateBy } from 'class-validator';
import {
  MAX_CYCLE_START_FUTURE_DAYS,
  MAX_CYCLE_START_PAST_DAYS,
  isCycleStartWithinWindow,
  parseLocalDateOrInstant,
} from '../../common/utils/index.js';

function IsCycleStartWithinWindow() {
  return ValidateBy({
    name: 'isCycleStartWithinWindow',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' &&
        isCycleStartWithinWindow(parseLocalDateOrInstant(value)),
      defaultMessage: () =>
        `cycleStartedAt must be within the last ${MAX_CYCLE_START_PAST_DAYS} days and at most ${MAX_CYCLE_START_FUTURE_DAYS} day ahead`,
    },
  });
}

/** Optional start of a new budget cycle. `YYYY-MM-DD` is read as Bogotá midnight. */
export function CycleStartedAtProperty() {
  return applyDecorators(
    ApiPropertyOptional({
      example: '2026-10-29T05:00:00.000Z',
      description:
        'Starts a new budget cycle at this date (ISO 8601). Date-only values are midnight in America/Bogota. Omit to keep the current cycle.',
    }),
    IsOptional(),
    IsISO8601({ strict: true }),
    IsCycleStartWithinWindow(),
  );
}
