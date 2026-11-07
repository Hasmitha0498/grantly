import { describe, expect, it } from 'vitest';
import { getProgram, getScholarship } from '@/data/demo-catalog';
import { buildFacts } from '@/domain/decision';
import { parseDiscoverParams } from '@/components/discover/discover-params';
import { rowsFor, SCENARIO_LABELS } from '@/components/compare/DecisionStudio';
import { applicationId } from '@/repository/journey-core';
import { makeApp, makeProfile } from '../fixtures';

const lookup = { scholarship: getScholarship, program: getProgram };
const A = { scholarshipId: 'northfield-excellence', programId: 'prog-northfield-mscs' };
const B = { scholarshipId: 'lakeshore-global', programId: 'prog-lakeshore-mscs' };

describe('Discover URL parameters are validated against allowlists', () => {
  it('accepts valid values', () => {
    const p = parseDiscoverParams(new URLSearchParams('q=civic&type=need&eligibility=not-eligible&course=Data%20Science&deadline=30&sort=funding'));
    expect(p).toEqual({ q: 'civic', type: 'need', eligibility: 'not-eligible', course: 'Data Science', deadline: '30', sort: 'funding' });
  });
  it('ignores unsupported values instead of casting them', () => {
    const p = parseDiscoverParams(new URLSearchParams('type=<script>&eligibility=maybe&course=Astrology&deadline=999&sort=random'));
    expect(p).toEqual({ q: '', type: '', eligibility: '', course: '', deadline: '', sort: 'relevant' });
  });
  it('bounds the query length', () => {
    expect(parseDiscoverParams(new URLSearchParams(`q=${'a'.repeat(500)}`)).q).toHaveLength(100);
  });
});

describe('Decision Studio rows follow the selected funding scenario', () => {
  const labels = (rows: ReturnType<typeof rowsFor>) => rows.map((r) => r.label);
  const value = (rows: ReturnType<typeof rowsFor>, label: string, i: number) => rows.find((r) => r.label === label)!.values[i];

  it('potential scenario uses potential labels and amounts', () => {
    const rows = rowsFor(buildFacts([A, B], makeProfile(), lookup, 'potential'), 'potential');
    expect(labels(rows)).toContain('Potential funding');
    expect(labels(rows)).toContain('Remaining cost if awarded');
    expect(value(rows, 'Potential funding', 0)).toBe('$30,000');
  });

  it('confirmed scenario: no award recorded, recorded $0, recorded positive, unknown amount', () => {
    const { funding, remaining } = SCENARIO_LABELS.confirmed;
    const none = rowsFor(buildFacts([A, B], makeProfile(), lookup, 'confirmed'), 'confirmed');
    expect(labels(none)).toEqual(expect.arrayContaining([funding, remaining]));
    expect(labels(none)).not.toContain('Potential funding');
    expect(value(none, funding, 0)).toBe('No confirmed award recorded');
    expect(value(none, remaining, 0)).toBe('$90,000');

    const id = applicationId(A.scholarshipId, A.programId);
    const zero = rowsFor(buildFacts([A, B], makeProfile(), lookup, 'confirmed', [makeApp({ ...A, id, status: 'awarded', awardConfirmedUsd: 0 })]), 'confirmed');
    expect(value(zero, funding, 0)).toBe('$0');

    const positive = rowsFor(buildFacts([A, B], makeProfile(), lookup, 'confirmed', [makeApp({ ...A, id, status: 'awarded', awardConfirmedUsd: 25_000 })]), 'confirmed');
    expect(value(positive, funding, 0)).toBe('$25,000');
    expect(value(positive, remaining, 0)).toBe('$65,000');

    const unknown = rowsFor(buildFacts([A, B], makeProfile(), lookup, 'confirmed', [makeApp({ ...A, id, status: 'awarded', awardConfirmedUsd: null })]), 'confirmed');
    expect(value(unknown, funding, 0)).toBe('Not comparable yet');
  });
});
