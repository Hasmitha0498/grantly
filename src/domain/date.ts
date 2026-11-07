/**
 * Date-only helpers. Provider deadlines in GRANTLY are calendar dates
 * (YYYY-MM-DD) with no invented closing time. All arithmetic is done on
 * UTC calendar days so results never depend on the machine's time zone.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(value: string | null | undefined): value is string {
  if (!value || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Calendar date (UTC) of an instant. */
export function toDateOnly(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

export function addDays(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnly(d);
}

/** Whole calendar days from `today` to `target` (negative when past). */
export function daysBetween(today: string, target: string): number {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${target}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Earliest valid date among candidates, or null. */
export function earliestDate(...dates: (string | null | undefined)[]): string | null {
  const valid = dates.filter(isValidDateOnly).sort();
  return valid[0] ?? null;
}

const formatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDateOnly(dateOnly: string | null): string {
  if (!isValidDateOnly(dateOnly)) return 'No date set';
  return formatter.format(new Date(`${dateOnly}T00:00:00Z`));
}

export function describeRelative(today: string, target: string | null): string {
  if (!isValidDateOnly(target)) return 'No date set';
  const days = daysBetween(today, target);
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} ago`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
