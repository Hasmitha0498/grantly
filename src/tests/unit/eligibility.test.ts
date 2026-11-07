import { describe, expect, it } from 'vitest';
import { getScholarship } from '@/data/demo-catalog';
import { evaluateEligibility, evaluateRequirement } from '@/domain/eligibility';
import type { Scholarship } from '@/domain/types';
import { makeProfile, makeRequirement, makeScholarship } from '../fixtures';

function sch(id: string): Scholarship {
  const s = getScholarship(id);
  if (!s) throw new Error(`missing ${id}`);
  return s;
}

describe('evaluateEligibility', () => {
  it('EL-01 all mandatory rules pass → eligible', () => {
    const r = evaluateEligibility(makeProfile(), sch('northfield-excellence'));
    expect(r.status).toBe('eligible');
    expect(r.failed).toEqual([]);
    expect(r.unknown).toEqual([]);
    expect(r.checks.map((c) => c.result)).toEqual(['pass', 'pass', 'pass']);
  });

  it('EL-02 nationality fail → not-eligible and the failed rule is listed', () => {
    const r = evaluateEligibility(
      makeProfile({ nationality: 'Nepal', householdIncome: { amount: 1_000_000, currency: 'INR' } }),
      sch('meridian-need'),
    );
    expect(r.status).toBe('not-eligible');
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0]!.ruleId).toBe('md-nat');
    expect(r.failed[0]!.result).toBe('fail');
    expect(r.failed[0]!.studentValue).toBe('Nepal');
  });

  it('EL-03 academic metric kind none → needs-information', () => {
    const r = evaluateEligibility(makeProfile({ academicMetric: { kind: 'none' } }), sch('northfield-excellence'));
    expect(r.status).toBe('needs-information');
    expect(r.unknown.map((c) => c.ruleId)).toEqual(['nf-academic']);
    expect(r.unknown[0]!.missingField).toBe('academicMetric');
  });

  it('EL-04 gpa-4 rule vs percentage profile → needs-information (no scale conversion)', () => {
    const r = evaluateEligibility(makeProfile({ academicMetric: { kind: 'percentage', value: 95 } }), sch('horizon-gpa'));
    expect(r.status).toBe('needs-information');
    expect(r.unknown[0]!.ruleId).toBe('hz-gpa');
    expect(r.unknown[0]!.result).toBe('unknown');
  });

  it('EL-05 unverified mandatory → unverified; a verified hard fail elsewhere → not-eligible', () => {
    const passing = makeRequirement({ id: 'nat', expectedValue: ['India'] });
    const unverified = makeRequirement({ id: 'unv', kind: 'field', expectedValue: ['Computer Science'], verified: false });
    const r1 = evaluateEligibility(makeProfile(), makeScholarship({ requirements: [passing, unverified] }));
    expect(r1.status).toBe('unverified');
    expect(r1.checks.find((c) => c.ruleId === 'unv')!.result).toBe('unverified');

    const hardFail = makeRequirement({ id: 'status', kind: 'applicant-status', expectedValue: ['us-citizen'] });
    const r2 = evaluateEligibility(makeProfile(), makeScholarship({ requirements: [passing, unverified, hardFail] }));
    expect(r2.status).toBe('not-eligible');
    expect(r2.failed.map((c) => c.ruleId)).toEqual(['status']);
  });

  it('EL-06 experience threshold 36 months: 35 fails, 36 passes', () => {
    const req = makeRequirement({ id: 'exp', kind: 'experience-min-months', operator: 'gte', expectedValue: 36 });
    const s = makeScholarship({ requirements: [req] });
    const r35 = evaluateEligibility(makeProfile({ relevantExperienceMonths: 35 }), s);
    const r36 = evaluateEligibility(makeProfile({ relevantExperienceMonths: 36 }), s);
    expect(r35.status).toBe('not-eligible');
    expect(r35.failed[0]!.reason).toBe('You need 1 more months of experience.');
    expect(r36.status).toBe('eligible');
    expect(r36.checks[0]!.result).toBe('pass');
  });

  it('EL-06 catalog aurora-research (24 months) fails for demo profile with 0 months', () => {
    expect(evaluateEligibility(makeProfile(), sch('aurora-research')).status).toBe('not-eligible');
    expect(evaluateEligibility(makeProfile({ relevantExperienceMonths: 24 }), sch('aurora-research')).status).toBe('eligible');
  });

  it('EL-07 a missing optional criterion does not fail or block eligibility', () => {
    const mandatory = makeRequirement({ id: 'nat' });
    const optional = makeRequirement({
      id: 'inc',
      mandatory: false,
      kind: 'income-max',
      operator: 'lte',
      expectedValue: 100,
      expectedCurrency: 'USD',
    });
    const r = evaluateEligibility(makeProfile({ householdIncome: null }), makeScholarship({ requirements: [mandatory, optional] }));
    expect(r.status).toBe('eligible');
    expect(r.checks.find((c) => c.ruleId === 'inc')!.result).toBe('unknown');
    expect(r.unknown).toEqual([]);
    expect(r.failed).toEqual([]);
  });

  it('EL-07 a failing optional criterion is not listed as failed', () => {
    const optional = makeRequirement({ id: 'opt', mandatory: false, expectedValue: ['Nepal'] });
    const r = evaluateEligibility(makeProfile(), makeScholarship({ requirements: [makeRequirement({ id: 'nat' }), optional] }));
    expect(r.status).toBe('eligible');
    expect(r.failed).toEqual([]);
  });

  it('EL-08 empty requirements → unverified', () => {
    const r = evaluateEligibility(makeProfile(), makeScholarship({ requirements: [] }));
    expect(r.status).toBe('unverified');
    expect(r.checks).toEqual([]);
  });

  it('EL-09 income missing on income-max → needs-information', () => {
    const r = evaluateEligibility(makeProfile({ householdIncome: null }), sch('meridian-need'));
    expect(r.status).toBe('needs-information');
    expect(r.unknown.map((c) => c.ruleId)).toEqual(['md-income']);
    expect(r.unknown[0]!.missingField).toBe('householdIncome');
  });

  it('EL-10 INR income vs USD threshold → needs-information (no currency conversion)', () => {
    const req = makeRequirement({ id: 'inc', kind: 'income-max', operator: 'lte', expectedValue: 50_000, expectedCurrency: 'USD' });
    const r = evaluateEligibility(
      makeProfile({ householdIncome: { amount: 100_000, currency: 'INR' } }),
      makeScholarship({ requirements: [req] }),
    );
    expect(r.status).toBe('needs-information');
    expect(r.unknown[0]!.result).toBe('unknown');
  });

  it('EL-10 income exactly at the cap passes (lte); one above fails', () => {
    const atCap = evaluateEligibility(makeProfile({ householdIncome: { amount: 1_500_000, currency: 'INR' } }), sch('meridian-need'));
    expect(atCap.status).toBe('eligible');
    const above = evaluateEligibility(makeProfile({ householdIncome: { amount: 1_500_001, currency: 'INR' } }), sch('meridian-need'));
    expect(above.status).toBe('not-eligible');
    expect(above.failed.map((c) => c.ruleId)).toEqual(['md-income']);
  });

  it('EL-11 Indian national with international category vs us-citizen-only → not-eligible', () => {
    const r = evaluateEligibility(makeProfile({ nationality: 'India', applicantCategory: 'international' }), sch('civic-scholars'));
    expect(r.status).toBe('not-eligible');
    expect(r.failed[0]!.ruleId).toBe('cv-status');
    expect(r.failed[0]!.studentValue).toBe('International applicant');
  });

  it('EL-12 custom / manual-review requirement → unverified', () => {
    expect(evaluateEligibility(makeProfile(), sch('bridge-community')).status).toBe('unverified');
    const manualVerified = makeRequirement({ id: 'm', kind: 'document', operator: 'manual-review', verified: true });
    const check = evaluateRequirement(makeProfile(), manualVerified);
    expect(check.result).toBe('unverified');
    const customVerified = makeRequirement({ id: 'c', kind: 'custom', operator: 'present', verified: true });
    expect(evaluateEligibility(makeProfile(), makeScholarship({ requirements: [customVerified] })).status).toBe('unverified');
  });

  it('applicant category other-unknown → needs-information', () => {
    const r = evaluateEligibility(makeProfile({ applicantCategory: 'other-unknown' }), sch('civic-scholars'));
    expect(r.status).toBe('needs-information');
  });
});
