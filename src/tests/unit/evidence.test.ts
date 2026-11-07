import { describe, expect, it } from 'vitest';
import { assessEvidence } from '@/domain/evidence';
import type { Scholarship } from '@/domain/types';

const criteria: Scholarship['selectionCriteria'] = [
  { id: 'c1', label: 'Academic achievement', evidenceHint: 'Class rank or awards', category: 'academic' },
  { id: 'c2', label: 'Leadership', evidenceHint: 'Leading a club', category: 'leadership' },
];

describe('assessEvidence', () => {
  it('EV-01 evidence for every assessable criterion → strong', () => {
    const r = assessEvidence(
      [
        { id: 'e1', category: 'academic', description: 'Top 5% of class' },
        { id: 'e2', category: 'leadership', description: 'Led coding club' },
      ],
      criteria,
    );
    expect(r.summary).toBe('strong');
    expect(r.label).toBe('Strong evidence alignment');
    expect(r.supports).toEqual(['Academic achievement: Top 5% of class', 'Leadership: Led coding club']);
    expect(r.strengthen).toEqual([]);
  });

  it('EV-02 partial evidence → some, missing criterion appears in strengthen; blank descriptions do not count', () => {
    const r = assessEvidence(
      [
        { id: 'e1', category: 'academic', description: 'Top 5% of class' },
        { id: 'e2', category: 'leadership', description: '   ' },
      ],
      criteria,
    );
    expect(r.summary).toBe('some');
    expect(r.criteria.map((c) => c.result)).toEqual(['evidence-present', 'evidence-missing']);
    expect(r.strengthen).toEqual(['Leadership — e.g. leading a club']);
  });

  it('EV-02 no matching evidence → more-needed', () => {
    const r = assessEvidence([], criteria);
    expect(r.summary).toBe('more-needed');
    expect(r.supports).toEqual([]);
    expect(r.strengthen).toHaveLength(2);
  });

  it('EV-03 no criteria or only provider-assessed criteria → cannot-assess', () => {
    const empty = assessEvidence([{ id: 'e', category: 'academic', description: 'x' }], []);
    expect(empty.summary).toBe('cannot-assess');
    expect(empty.criteria).toEqual([]);

    const onlyOther = assessEvidence([{ id: 'e', category: 'other', description: 'x' }], [
      { id: 'o', label: 'Financial need', evidenceHint: 'Provider assesses', category: 'other' },
    ]);
    expect(onlyOther.summary).toBe('cannot-assess');
    expect(onlyOther.criteria[0]!.result).toBe('not-assessable');
    expect(onlyOther.strengthen).toEqual([]);
  });
});
