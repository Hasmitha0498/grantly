import type { EvidenceItem, Scholarship } from './types';

export type EvidenceCriterionResult = 'evidence-present' | 'evidence-missing' | 'not-assessable';
export type EvidenceSummary =
  | 'strong'
  | 'some'
  | 'more-needed'
  | 'cannot-assess';

export interface EvidenceAssessment {
  summary: EvidenceSummary;
  label: string;
  criteria: { id: string; label: string; result: EvidenceCriterionResult; detail: string }[];
  supports: string[];
  strengthen: string[];
}

export const EVIDENCE_LABEL: Record<EvidenceSummary, string> = {
  strong: 'Strong evidence alignment',
  some: 'Some evidence available',
  'more-needed': 'More evidence needed',
  'cannot-assess': 'Cannot assess yet',
};

/**
 * Compares documented selection criteria with the student's own structured
 * evidence. Not a probability; never ranks the student against others.
 * Criteria of category "other" are provider-assessed and not assessable here.
 */
export function assessEvidence(evidence: EvidenceItem[], criteria: Scholarship['selectionCriteria']): EvidenceAssessment {
  if (criteria.length === 0) {
    return {
      summary: 'cannot-assess',
      label: EVIDENCE_LABEL['cannot-assess'],
      criteria: [],
      supports: [],
      strengthen: ['The provider hasn’t published selection criteria in this demo.'],
    };
  }

  const rows = criteria.map((c) => {
    if (c.category === 'other') {
      return { id: c.id, label: c.label, result: 'not-assessable' as const, detail: 'The provider assesses this directly.' };
    }
    const match = evidence.find((e) => e.category === c.category && e.description.trim().length > 0);
    return match
      ? { id: c.id, label: c.label, result: 'evidence-present' as const, detail: match.description }
      : { id: c.id, label: c.label, result: 'evidence-missing' as const, detail: c.evidenceHint };
  });

  const assessable = rows.filter((r) => r.result !== 'not-assessable');
  const present = assessable.filter((r) => r.result === 'evidence-present');

  let summary: EvidenceSummary;
  if (assessable.length === 0) summary = 'cannot-assess';
  else if (present.length === assessable.length) summary = 'strong';
  else if (present.length > 0) summary = 'some';
  else summary = 'more-needed';

  return {
    summary,
    label: EVIDENCE_LABEL[summary],
    criteria: rows,
    supports: present.map((r) => `${r.label}: ${r.detail}`),
    strengthen: rows.filter((r) => r.result === 'evidence-missing').map((r) => `${r.label} — e.g. ${r.detail.toLowerCase()}`),
  };
}
