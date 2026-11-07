import { toDateOnly } from '@/domain/date';
import type { ApplicationRoute, FundingType } from '@/domain/types';

export { formatMoney } from '@/domain/eligibility';

/** Student's current calendar date (UTC-based, consistent with stored deadlines). */
export function today(): string {
  return toDateOnly(new Date());
}

export const FUNDING_TYPE_LABEL: Record<FundingType, string> = {
  merit: 'Merit-based',
  need: 'Need-based',
  fellowship: 'Fellowship',
  assistantship: 'Assistantship',
};

export const ROUTE_LABEL: Record<ApplicationRoute, string> = {
  'automatic-via-admission': 'Automatic with admission',
  'admission-supplement': 'Additional form required',
  'separate-external': 'Separate application',
  'after-admission': 'After admission',
};

export const ROUTE_HELP: Record<ApplicationRoute, string> = {
  'automatic-via-admission': 'You’re considered when you apply for admission. There’s no separate scholarship application — track it as funding consideration.',
  'admission-supplement': 'Submit an extra scholarship form or essay alongside your admission application.',
  'separate-external': 'Apply directly to the provider, separately from your university application.',
  'after-admission': 'Apply once you’ve been admitted to the program.',
};
