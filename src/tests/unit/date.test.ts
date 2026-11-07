import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, describeRelative, earliestDate, formatDateOnly, isValidDateOnly, toDateOnly } from '@/domain/date';

describe('date helpers', () => {
  it('validates calendar dates strictly', () => {
    expect(isValidDateOnly('2026-11-07')).toBe(true);
    expect(isValidDateOnly('2026-02-30')).toBe(false);
    expect(isValidDateOnly('2028-02-29')).toBe(true);
    expect(isValidDateOnly('2026-11-7')).toBe(false);
    expect(isValidDateOnly('')).toBe(false);
    expect(isValidDateOnly(null)).toBe(false);
    expect(isValidDateOnly(undefined)).toBe(false);
  });

  it('toDateOnly uses the UTC calendar date', () => {
    expect(toDateOnly(new Date('2026-11-07T06:00:00Z'))).toBe('2026-11-07');
    expect(toDateOnly(new Date('2026-11-07T23:59:59Z'))).toBe('2026-11-07');
  });

  it('addDays crosses month, year and DST boundaries', () => {
    expect(addDays('2026-11-07', 2)).toBe('2026-11-09');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-07', -3)).toBe('2026-11-04');
  });

  it('daysBetween counts whole calendar days', () => {
    expect(daysBetween('2026-11-07', '2026-11-07')).toBe(0);
    expect(daysBetween('2026-11-07', '2026-11-09')).toBe(2);
    expect(daysBetween('2026-11-07', '2026-11-04')).toBe(-3);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('earliestDate ignores invalid values', () => {
    expect(earliestDate('2026-11-09', null, 'bad', '2026-11-08')).toBe('2026-11-08');
    expect(earliestDate(null, undefined)).toBeNull();
  });

  it('formats and describes dates', () => {
    expect(formatDateOnly('2026-11-09')).toBe('9 Nov 2026');
    expect(formatDateOnly(null)).toBe('No date set');
    expect(describeRelative('2026-11-07', '2026-11-07')).toBe('today');
    expect(describeRelative('2026-11-07', '2026-11-08')).toBe('tomorrow');
    expect(describeRelative('2026-11-07', '2026-11-12')).toBe('in 5 days');
    expect(describeRelative('2026-11-07', '2026-11-06')).toBe('1 day ago');
    expect(describeRelative('2026-11-07', '2026-11-04')).toBe('3 days ago');
    expect(describeRelative('2026-11-07', null)).toBe('No date set');
  });
});
