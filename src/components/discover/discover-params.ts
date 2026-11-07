import { FIELDS } from '@/data/demo-catalog';
import type { Eligibility, FundingType } from '@/domain/types';

export type DiscoverSort = 'relevant' | 'deadline' | 'funding';
export type DeadlineFilter = '' | 'open' | '30';

export interface DiscoverParams {
  q: string;
  type: FundingType | '';
  eligibility: Eligibility | '';
  course: string;
  deadline: DeadlineFilter;
  sort: DiscoverSort;
}

const TYPES: readonly FundingType[] = ['merit', 'need', 'fellowship', 'assistantship'];
const ELIGIBILITY: readonly Eligibility[] = ['eligible', 'not-eligible', 'needs-information', 'unverified'];
const SORTS: readonly DiscoverSort[] = ['relevant', 'deadline', 'funding'];
const DEADLINES: readonly DeadlineFilter[] = ['open', '30'];

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T | ''): T | '' {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Parses Discover URL parameters against explicit allowlists; unknown values are ignored. */
export function parseDiscoverParams(params: Pick<URLSearchParams, 'get'>): DiscoverParams {
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    type: pick(params.get('type'), TYPES, ''),
    eligibility: pick(params.get('eligibility'), ELIGIBILITY, ''),
    course: pick(params.get('course'), FIELDS, ''),
    deadline: pick(params.get('deadline'), DEADLINES, '') as DeadlineFilter,
    sort: (pick(params.get('sort'), SORTS, 'relevant') || 'relevant') as DiscoverSort,
  };
}

/** Delay before a typed search query is written to the URL. Results update immediately. */
export const SEARCH_URL_DEBOUNCE_MS = 300;
