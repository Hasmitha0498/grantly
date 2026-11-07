import { describe, expect, it } from 'vitest';
import { safeExternalUrl } from '@/lib/safe-url';
import { emptyForm, fromProfile, toProfileInput, validateAll, validateStep, type ProfileFormValues } from '@/components/onboarding/profile-form';
import { makeProfile } from '../fixtures';

describe('safeExternalUrl', () => {
  it.each([
    ['javascript:alert(1)'],
    ['JavaScript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['http://example.com'],
    ['https://user:pass@example.com/'],
    ['https://user@example.com/'],
    ['//example.com'],
    ['not a url'],
    [''],
  ])('rejects %s', (input) => {
    expect(safeExternalUrl(input)).toBeNull();
  });

  it('rejects null/undefined', () => {
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });

  it('accepts and normalises https', () => {
    expect(safeExternalUrl('https://Example.com')).toBe('https://example.com/');
    expect(safeExternalUrl('https://example.com/a?b=1#c')).toBe('https://example.com/a?b=1#c');
  });
});

const valid = (o: Partial<ProfileFormValues> = {}): ProfileFormValues => ({ ...emptyForm, metricValue: '80', intendedField: 'Computer Science', ...o });

describe('profile-form validateStep', () => {
  it('accepts a minimal valid form', () => {
    expect(validateAll(valid())).toEqual({});
  });

  it.each([
    ['', 'Enter a value between 0 and 100.'],
    ['-1', 'Enter a value between 0 and 100.'],
    ['100.1', 'Enter a value between 0 and 100.'],
    ['abc', 'Enter a value between 0 and 100.'],
  ])('percentage %j is invalid', (metricValue, msg) => {
    expect(validateStep(valid({ metricValue }), 1).metricValue).toBe(msg);
  });

  it('accepts percentage boundaries 0 and 100', () => {
    expect(validateStep(valid({ metricValue: '0' }), 1).metricValue).toBeUndefined();
    expect(validateStep(valid({ metricValue: '100' }), 1).metricValue).toBeUndefined();
  });

  it('validates GPA range and other/none metric kinds', () => {
    expect(validateStep(valid({ metricKind: 'gpa-4', metricValue: '4.1' }), 1).metricValue).toBe('Enter a GPA from 0.0 to 4.0.');
    expect(validateStep(valid({ metricKind: 'gpa-4', metricValue: '4' }), 1).metricValue).toBeUndefined();
    expect(validateStep(valid({ metricKind: 'other', metricOther: '  ' }), 1).metricOther).toMatch(/Describe your grading scale/);
    expect(validateStep(valid({ metricKind: 'none', metricValue: '' }), 1)).toEqual({});
  });

  it('validates name, nationality, experience and income', () => {
    const e = validateStep(valid({ displayName: 'x'.repeat(61), nationality: ' ', experienceMonths: '1.5', incomeAmount: '-3' }), 1);
    expect(e).toEqual({
      displayName: 'Use 60 characters or fewer.',
      nationality: 'Enter your nationality.',
      experienceMonths: 'Enter whole months, 0 or more.',
      incomeAmount: 'Enter a positive amount, or leave this blank.',
    });
    expect(validateStep(valid({ experienceMonths: '601' }), 1).experienceMonths).toBeDefined();
    expect(validateStep(valid({ experienceMonths: '' }), 1).experienceMonths).toBeDefined();
    expect(validateStep(valid({ incomeAmount: '   ' }), 1).incomeAmount).toBeUndefined();
  });

  it('validates step 2 subject, program count and budget', () => {
    const e = validateStep(valid({ intendedField: ' ', targetProgramIds: ['a', 'b', 'c', 'd'], budget: '10000001' }), 2);
    expect(e).toEqual({
      intendedField: 'Choose a subject to continue.',
      targetProgramIds: 'Choose up to 3 programs.',
      budget: 'Enter a budget in US dollars, or leave this blank.',
    });
    expect(validateStep(valid({ budget: '' }), 2)).toEqual({});
  });

  it('step 3 has no validation', () => {
    expect(validateStep({ ...emptyForm }, 3)).toEqual({});
  });
});

describe('profile-form toProfileInput / fromProfile', () => {
  it('maps blanks to nulls, trims text and drops empty evidence', () => {
    const input = toProfileInput(
      valid({
        displayName: '  Ravi ',
        nationality: ' India ',
        incomeAmount: '',
        budget: ' ',
        targetProgramIds: ['a', 'b', 'c', 'd'],
        evidence: [
          { id: '1', category: 'academic', description: '  ' },
          { id: '2', category: 'research', description: 'Paper' },
        ],
      }),
      false,
    );
    expect(input).toMatchObject({
      displayName: 'Ravi',
      nationality: 'India',
      householdIncome: null,
      fullProgramBudgetUsd: null,
      targetProgramIds: ['a', 'b', 'c'],
      academicMetric: { kind: 'percentage', value: 80 },
      isDemo: false,
    });
    expect(input.evidence.map((e) => e.id)).toEqual(['2']);
  });

  it('maps other/none metric kinds and income with currency', () => {
    expect(toProfileInput(valid({ metricKind: 'other', metricOther: ' 8.6 / 10 ' }), true).academicMetric).toEqual({ kind: 'other', description: '8.6 / 10' });
    expect(toProfileInput(valid({ metricKind: 'none' }), true).academicMetric).toEqual({ kind: 'none' });
    expect(toProfileInput(valid({ incomeAmount: '900000', incomeCurrency: 'USD', budget: '0' }), true)).toMatchObject({
      householdIncome: { amount: 900000, currency: 'USD' },
      fullProgramBudgetUsd: 0,
      isDemo: true,
    });
  });

  it('round-trips a profile through the form', () => {
    const p = makeProfile({ householdIncome: { amount: 1_000_000, currency: 'INR' } });
    const v = fromProfile(p);
    expect(v).toMatchObject({ metricKind: 'percentage', metricValue: '84', incomeAmount: '1000000', budget: '50000' });
    const back = toProfileInput(v, p.isDemo);
    expect(back.academicMetric).toEqual(p.academicMetric);
    expect(back.householdIncome).toEqual(p.householdIncome);
    expect(back.fullProgramBudgetUsd).toBe(p.fullProgramBudgetUsd);
  });

  it('fromProfile handles null income/budget and non-numeric metrics', () => {
    const none = fromProfile(makeProfile({ householdIncome: null, fullProgramBudgetUsd: null, academicMetric: { kind: 'none' } }));
    expect(none).toMatchObject({ incomeAmount: '', incomeCurrency: 'INR', budget: '', metricValue: '', metricOther: '' });
    const other = fromProfile(makeProfile({ academicMetric: { kind: 'other', description: '8.6 / 10 CGPA' } }));
    expect(other).toMatchObject({ metricKind: 'other', metricValue: '', metricOther: '8.6 / 10 CGPA' });
  });
});
