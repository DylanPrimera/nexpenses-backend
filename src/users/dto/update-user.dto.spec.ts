import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateUserDto } from './update-user.dto.js';

function errorsFor(cycleStartedAt: unknown) {
  const dto = plainToInstance(UpdateUserDto, { cycleStartedAt });
  return validateSync(dto).map((e) => e.property);
}

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

describe('UpdateUserDto.cycleStartedAt', () => {
  it('is optional', () => {
    expect(validateSync(plainToInstance(UpdateUserDto, {}))).toHaveLength(0);
  });

  it('accepts recent ISO dates and date-only values', () => {
    expect(errorsFor(daysFromNow(0))).toEqual([]);
    expect(errorsFor(daysFromNow(-200))).toEqual([]);
    expect(errorsFor(new Date().toISOString().slice(0, 10))).toEqual([]);
  });

  it('rejects non-ISO, too old and far-future values', () => {
    expect(errorsFor('29/10/2026')).toEqual(['cycleStartedAt']);
    expect(errorsFor(daysFromNow(-400))).toEqual(['cycleStartedAt']);
    expect(errorsFor(daysFromNow(5))).toEqual(['cycleStartedAt']);
    expect(errorsFor(123)).toEqual(['cycleStartedAt']);
  });
});

describe('UpdateUserDto profile names', () => {
  const props = (body: object) =>
    validateSync(plainToInstance(UpdateUserDto, body)).map((e) => e.property);

  it('accepts a single-word first name and a free last name', () => {
    expect(props({ firstName: 'Dylan', lastName: 'Primera Gómez' })).toEqual([]);
  });

  it('rejects first names with spaces or too long', () => {
    expect(props({ firstName: 'Dylan Jose' })).toEqual(['firstName']);
    expect(props({ firstName: 'x'.repeat(21) })).toEqual(['firstName']);
    expect(props({ firstName: '' })).toEqual(['firstName']);
  });

  it('rejects blank or too long last names', () => {
    expect(props({ lastName: '   ' })).toEqual(['lastName']);
    expect(props({ lastName: 'x'.repeat(81) })).toEqual(['lastName']);
  });
});
