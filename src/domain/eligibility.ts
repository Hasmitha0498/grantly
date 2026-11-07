import type { Eligibility, Requirement, RequirementResult, Scholarship, StudentProfile } from './types';

export interface RequirementCheck {
  ruleId: string;
  label: string;
  mandatory: boolean;
  result: RequirementResult;
  studentValue: string;
  requiredValue: string;
  reason: string;
  sourceNote: string;
  /** Profile field the student can fill to resolve an unknown result. */
  missingField: 'householdIncome' | 'academicMetric' | 'applicantCategory' | 'intendedField' | null;
}

export interface EligibilityResult {
  status: Eligibility;
  checks: RequirementCheck[];
  failed: RequirementCheck[];
  unknown: RequirementCheck[];
}

const CATEGORY_LABEL: Record<StudentProfile['applicantCategory'], string> = {
  international: 'International applicant',
  'us-citizen': 'US citizen',
  'us-permanent-resident': 'US permanent resident',
  'other-unknown': 'Other / unsure',
};

const QUAL_LABEL: Record<StudentProfile['currentQualification'], string> = {
  'final-year-bachelors': 'Final-year bachelor’s',
  'bachelors-complete': 'Bachelor’s completed',
};

function listValue(v: Requirement['expectedValue']): string[] {
  if (Array.isArray(v)) return v;
  if (v === null) return [];
  return [String(v)];
}

function humanList(values: string[], labels?: Record<string, string>): string {
  return values.map((v) => labels?.[v] ?? v).join(' or ');
}

function check(
  req: Requirement,
  result: RequirementResult,
  studentValue: string,
  requiredValue: string,
  reason: string,
  missingField: RequirementCheck['missingField'] = null,
): RequirementCheck {
  return {
    ruleId: req.id,
    label: req.label,
    mandatory: req.mandatory,
    result,
    studentValue,
    requiredValue,
    reason,
    sourceNote: req.sourceNote,
    missingField,
  };
}

function compare(op: Requirement['operator'], actual: number, expected: number): boolean {
  switch (op) {
    case 'gte':
      return actual >= expected;
    case 'lte':
      return actual <= expected;
    case 'equals':
      return actual === expected;
    default:
      return false;
  }
}

export function evaluateRequirement(profile: StudentProfile, req: Requirement): RequirementCheck {
  if (!req.verified) {
    return check(req, 'unverified', '—', req.label, 'This condition needs to be confirmed with the provider.');
  }
  if (req.operator === 'manual-review' || req.kind === 'custom') {
    return check(req, 'unverified', '—', req.label, 'The provider reviews this condition by hand, so we can’t check it.');
  }

  switch (req.kind) {
    case 'applicant-status': {
      const allowed = listValue(req.expectedValue);
      const required = humanList(allowed, CATEGORY_LABEL);
      if (profile.applicantCategory === 'other-unknown') {
        return check(req, 'unknown', 'Not specified', required, 'Tell us your applicant category to check this.', 'applicantCategory');
      }
      const pass = allowed.includes(profile.applicantCategory);
      return check(
        req,
        pass ? 'pass' : 'fail',
        CATEGORY_LABEL[profile.applicantCategory],
        required,
        pass ? 'Your applicant category matches.' : `This is only open to: ${required}.`,
      );
    }
    case 'nationality': {
      const allowed = listValue(req.expectedValue);
      if (!profile.nationality.trim()) {
        return check(req, 'unknown', 'Not specified', humanList(allowed), 'Add your nationality to check this.');
      }
      const pass = allowed.some((a) => a.toLowerCase() === profile.nationality.trim().toLowerCase());
      return check(req, pass ? 'pass' : 'fail', profile.nationality, humanList(allowed), pass ? 'Your nationality matches.' : 'Your nationality isn’t listed for this award.');
    }
    case 'field': {
      const allowed = listValue(req.expectedValue);
      if (!profile.intendedField.trim()) {
        return check(req, 'unknown', 'Not specified', humanList(allowed), 'Choose a subject to check this.', 'intendedField');
      }
      const pass = allowed.some((a) => a.toLowerCase() === profile.intendedField.trim().toLowerCase());
      return check(req, pass ? 'pass' : 'fail', profile.intendedField, humanList(allowed), pass ? 'Your planned subject matches.' : 'This award is for a different subject.');
    }
    case 'qualification': {
      const allowed = listValue(req.expectedValue);
      const pass = allowed.includes(profile.currentQualification);
      return check(req, pass ? 'pass' : 'fail', QUAL_LABEL[profile.currentQualification], humanList(allowed, QUAL_LABEL), pass ? 'Your qualification stage matches.' : 'Your qualification stage isn’t accepted.');
    }
    case 'academic-min': {
      const expected = Number(req.expectedValue);
      const scaleLabel = req.metricScale === 'gpa-4' ? '4.0 GPA' : 'percentage';
      const required = req.metricScale === 'gpa-4' ? `${expected} GPA or higher` : `${expected}% or higher`;
      const m = profile.academicMetric;
      if (m.kind === 'none') {
        return check(req, 'unknown', 'Not provided', required, 'Add your academic score to check this.', 'academicMetric');
      }
      if (m.kind === 'other' || m.kind !== req.metricScale) {
        const shown = m.kind === 'other' ? m.description || 'Other scale' : m.kind === 'gpa-4' ? `${m.value} GPA` : `${m.value}%`;
        return check(req, 'unknown', shown, required, `This award uses a ${scaleLabel}. We don’t convert between grading scales, so the provider would need to confirm.`, 'academicMetric');
      }
      const pass = compare(req.operator, m.value, expected);
      const shown = m.kind === 'gpa-4' ? `${m.value} GPA` : `${m.value}%`;
      return check(req, pass ? 'pass' : 'fail', shown, required, pass ? 'Your score meets the minimum.' : 'Your score is below the minimum.');
    }
    case 'experience-min-months': {
      const expected = Number(req.expectedValue);
      const pass = compare(req.operator, profile.relevantExperienceMonths, expected);
      return check(req, pass ? 'pass' : 'fail', `${profile.relevantExperienceMonths} months`, `${expected} months or more`, pass ? 'Your experience meets the minimum.' : `You need ${expected - profile.relevantExperienceMonths} more months of experience.`);
    }
    case 'income-max': {
      const expected = Number(req.expectedValue);
      const cur = req.expectedCurrency ?? 'USD';
      const required = `${formatMoney(expected, cur)} or less`;
      const income = profile.householdIncome;
      if (!income) {
        return check(req, 'unknown', 'Not provided', required, 'Add your household income (optional) to check this. It’s only used for this preliminary screen.', 'householdIncome');
      }
      if (income.currency !== cur) {
        return check(req, 'unknown', formatMoney(income.amount, income.currency), required, `This rule is set in ${cur}. We don’t estimate currency conversions, so we can’t check it yet.`, 'householdIncome');
      }
      // income-max must be "lte": at or below the cap passes.
      const pass = income.amount <= expected;
      return check(req, pass ? 'pass' : 'fail', formatMoney(income.amount, income.currency), required, pass ? 'Your household income is within the limit.' : 'Your household income is above the limit.');
    }
    default:
      return check(req, 'unknown', '—', req.label, 'We can’t check this condition automatically.');
  }
}

export function evaluateEligibility(profile: StudentProfile, scholarship: Scholarship): EligibilityResult {
  const checks = scholarship.requirements.map((r) => evaluateRequirement(profile, r));
  const mandatory = checks.filter((c) => c.mandatory);
  const failed = mandatory.filter((c) => c.result === 'fail');
  const unknown = mandatory.filter((c) => c.result === 'unknown' || c.result === 'unverified');

  let status: Eligibility;
  if (mandatory.length === 0) status = 'unverified';
  else if (failed.length > 0) status = 'not-eligible';
  else if (mandatory.some((c) => c.result === 'unverified')) status = 'unverified';
  else if (mandatory.some((c) => c.result === 'unknown')) status = 'needs-information';
  else status = 'eligible';

  return { status, checks, failed, unknown };
}

export const ELIGIBILITY_COPY: Record<Eligibility, { label: string; sentence: string }> = {
  eligible: { label: 'Meets demo criteria', sentence: 'Eligible based on the criteria we’ve verified.' },
  'not-eligible': { label: 'Not eligible', sentence: 'You don’t meet a required condition.' },
  'needs-information': { label: 'Needs information', sentence: 'We need more information.' },
  unverified: { label: 'Needs verification', sentence: 'Eligibility rules need verification.' },
};

export function formatMoney(amount: number, currency: 'USD' | 'INR' = 'USD'): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
