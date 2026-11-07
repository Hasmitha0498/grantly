import { describe, expect, it } from 'vitest';
import { getProgram, getScholarship } from '@/data/demo-catalog';
import { buildFacts, compareOptions, effortScore, INCONCLUSIVE, optionKey } from '@/domain/decision';
import type { FundingOption, Priority } from '@/domain/types';
import { makeProfile } from '../fixtures';

const lookup = { scholarship: getScholarship, program: getProgram };
const NF: FundingOption = { scholarshipId: 'northfield-excellence', programId: 'prog-northfield-mscs' };
const LK: FundingOption = { scholarshipId: 'lakeshore-global', programId: 'prog-lakeshore-mscs' };

function decide(options: FundingOption[], priority: Priority) {
  const facts = buildFacts(options, makeProfile(), lookup, 'potential');
  return compareOptions(facts, priority);
}

describe('compareOptions', () => {
  it('DC-01 lowest-cost recommends Lakeshore and explains the $10,000 difference', () => {
    const r = decide([NF, LK], 'lowest-cost');
    expect(r.recommendedKey).toBe(optionKey(LK));
    expect(r.recommendationStrength).toBe('explainable');
    expect(r.why).toContain('$10,000');
    expect(r.why).toBe(
      'If awarded, Lakeshore Global (Lakeshore State University) leaves $50,000 to pay over the full program — $10,000 less than Northfield Excellence (Northfield Institute of Technology).',
    );
  });

  it('DC-02 least-effort chooses the automatic-via-admission route', () => {
    expect(effortScore(getScholarship('northfield-excellence')!)).toBe(2);
    expect(effortScore(getScholarship('lakeshore-global')!)).toBe(4);
    const r = decide([NF, LK], 'least-effort');
    expect(r.recommendedKey).toBe(optionKey(NF));
    expect(r.why).toContain('considered automatically with your admission');
  });

  it('changing the priority changes the explanation', () => {
    const cost = decide([NF, LK], 'lowest-cost');
    const effort = decide([NF, LK], 'least-effort');
    expect(cost.why).not.toBe(effort.why);
    expect(cost.priority).toBe('lowest-cost');
    expect(effort.priority).toBe('least-effort');
  });

  it('DC-03 clearer-terms with both options unclear → inconclusive', () => {
    const r = decide(
      [
        { scholarshipId: 'summit-leadership', programId: 'prog-northfield-mscs' },
        { scholarshipId: 'cascade-assistantship', programId: 'prog-cascade-msds' },
      ],
      'clearer-terms',
    );
    expect(r.facts.map((f) => f.clarity)).toEqual([1, 1]);
    expect(r.recommendedKey).toBeNull();
    expect(r.recommendationStrength).toBe('inconclusive');
  });

  it('DC-04 a tie on the priority picks no winner', () => {
    const r = decide([NF, LK], 'program-fit');
    expect(r.facts.map((f) => f.fit)).toEqual([2, 2]);
    expect(r.recommendedKey).toBeNull();
    expect(r.recommendationStrength).toBe('inconclusive');
    expect(r.why).toBe('These options are tied on that priority, so we won’t pick a winner.');
  });

  it('DC-05 an ineligible option (civic-scholars) is never recommended, even when cheaper', () => {
    const civic: FundingOption = { scholarshipId: 'civic-scholars', programId: 'prog-lakeshore-mscs' };
    const r = decide([civic, LK], 'lowest-cost');
    const civicFacts = r.facts.find((f) => f.key === optionKey(civic))!;
    expect(civicFacts.eligibility).toBe('not-eligible');
    expect(civicFacts.financial.kind === 'ok' && civicFacts.financial.remaining).toBe(45_000);
    expect(r.recommendedKey).toBe(optionKey(LK));
    expect(r.why).toContain('Civic Scholars (Lakeshore State University) is not recommended because a required condition isn’t met.');
  });

  it('DC-06 missing cost data on lowest-cost → inconclusive and incomplete data listed', () => {
    const r = decide([NF, { scholarshipId: 'summit-leadership', programId: 'prog-cascade-msds' }], 'lowest-cost');
    expect(r.recommendedKey).toBeNull();
    expect(r.recommendationStrength).toBe('inconclusive');
    expect(r.why).toBe(INCONCLUSIVE);
    expect(r.incompleteData).toEqual(['Summit Leadership (Cascade University): Program living costs, Award renewal terms unknown']);
  });

  it('fewer than two options is inconclusive', () => {
    const r = decide([NF], 'lowest-cost');
    expect(r.recommendedKey).toBeNull();
    expect(r.why).toBe('Select at least two opportunities to compare.');
  });
});
