import type { EvidenceItem, Priority, ProfileInput, StudentProfile } from '@/domain/types';

export interface ProfileFormValues {
  displayName: string;
  nationality: string;
  applicantCategory: ProfileInput['applicantCategory'];
  currentQualification: ProfileInput['currentQualification'];
  metricKind: 'percentage' | 'gpa-4' | 'other' | 'none';
  metricValue: string;
  metricOther: string;
  experienceMonths: string;
  incomeAmount: string;
  incomeCurrency: 'INR' | 'USD';
  intendedField: string;
  targetProgramIds: string[];
  targetIntake: string;
  budget: string;
  priority: Priority;
  evidence: EvidenceItem[];
}

export type FormErrors = Partial<Record<keyof ProfileFormValues, string>>;

export const emptyForm: ProfileFormValues = {
  displayName: '',
  nationality: 'India',
  applicantCategory: 'international',
  currentQualification: 'final-year-bachelors',
  metricKind: 'percentage',
  metricValue: '',
  metricOther: '',
  experienceMonths: '0',
  incomeAmount: '',
  incomeCurrency: 'INR',
  intendedField: '',
  targetProgramIds: [],
  targetIntake: 'Fall 2027',
  budget: '',
  priority: 'lowest-cost',
  evidence: [],
};

export function fromProfile(p: StudentProfile): ProfileFormValues {
  const m = p.academicMetric;
  return {
    displayName: p.displayName,
    nationality: p.nationality,
    applicantCategory: p.applicantCategory,
    currentQualification: p.currentQualification,
    metricKind: m.kind,
    metricValue: m.kind === 'percentage' || m.kind === 'gpa-4' ? String(m.value) : '',
    metricOther: m.kind === 'other' ? m.description : '',
    experienceMonths: String(p.relevantExperienceMonths),
    incomeAmount: p.householdIncome ? String(p.householdIncome.amount) : '',
    incomeCurrency: p.householdIncome?.currency ?? 'INR',
    intendedField: p.intendedField,
    targetProgramIds: p.targetProgramIds,
    targetIntake: p.targetIntake,
    budget: p.fullProgramBudgetUsd === null ? '' : String(p.fullProgramBudgetUsd),
    priority: p.priority,
    evidence: p.evidence,
  };
}

const isNum = (s: string) => s.trim() !== '' && Number.isFinite(Number(s));

export function validateStep(v: ProfileFormValues, step: 1 | 2 | 3): FormErrors {
  const e: FormErrors = {};
  if (step === 1) {
    if (v.displayName.length > 60) e.displayName = 'Use 60 characters or fewer.';
    if (!v.nationality.trim()) e.nationality = 'Enter your nationality.';
    if (v.metricKind === 'percentage') {
      const n = Number(v.metricValue);
      if (!isNum(v.metricValue) || n < 0 || n > 100) e.metricValue = 'Enter a value between 0 and 100.';
    }
    if (v.metricKind === 'gpa-4') {
      const n = Number(v.metricValue);
      if (!isNum(v.metricValue) || n < 0 || n > 4) e.metricValue = 'Enter a GPA from 0.0 to 4.0.';
    }
    if (v.metricKind === 'other' && !v.metricOther.trim()) e.metricOther = 'Describe your grading scale, for example “8.6 / 10 CGPA”.';
    const months = Number(v.experienceMonths);
    if (!isNum(v.experienceMonths) || months < 0 || months > 600 || !Number.isInteger(months)) {
      e.experienceMonths = 'Enter whole months, 0 or more.';
    }
    if (v.incomeAmount.trim() !== '') {
      const n = Number(v.incomeAmount);
      if (!isNum(v.incomeAmount) || n < 0) e.incomeAmount = 'Enter a positive amount, or leave this blank.';
    }
  }
  if (step === 2) {
    if (!v.intendedField.trim()) e.intendedField = 'Choose a subject to continue.';
    if (v.targetProgramIds.length > 3) e.targetProgramIds = 'Choose up to 3 programs.';
    if (v.budget.trim() !== '') {
      const n = Number(v.budget);
      if (!isNum(v.budget) || n < 0 || n > 10_000_000) e.budget = 'Enter a budget in US dollars, or leave this blank.';
    }
  }
  return e;
}

export function validateAll(v: ProfileFormValues): FormErrors {
  return { ...validateStep(v, 1), ...validateStep(v, 2) };
}

export function toProfileInput(v: ProfileFormValues, isDemo: boolean): ProfileInput {
  const metric: ProfileInput['academicMetric'] =
    v.metricKind === 'percentage' || v.metricKind === 'gpa-4'
      ? { kind: v.metricKind, value: Number(v.metricValue) }
      : v.metricKind === 'other'
        ? { kind: 'other', description: v.metricOther.trim() }
        : { kind: 'none' };
  return {
    displayName: v.displayName.trim(),
    nationality: v.nationality.trim(),
    applicantCategory: v.applicantCategory,
    householdIncome: v.incomeAmount.trim() === '' ? null : { amount: Number(v.incomeAmount), currency: v.incomeCurrency },
    evidence: v.evidence.filter((e) => e.description.trim()),
    currentQualification: v.currentQualification,
    academicMetric: metric,
    relevantExperienceMonths: Number(v.experienceMonths),
    intendedField: v.intendedField.trim(),
    targetProgramIds: v.targetProgramIds.slice(0, 3),
    targetIntake: v.targetIntake.trim(),
    fullProgramBudgetUsd: v.budget.trim() === '' ? null : Number(v.budget),
    priority: v.priority,
    isDemo,
  };
}

export const PRIORITY_OPTIONS: { value: Priority; label: string; help: string }[] = [
  { value: 'lowest-cost', label: 'Lowest remaining cost', help: 'What you’d still pay after funding.' },
  { value: 'least-effort', label: 'Least application effort', help: 'Fewer essays, forms and recommenders.' },
  { value: 'program-fit', label: 'Best program fit', help: 'Matches your subject and chosen programs.' },
  { value: 'clearer-terms', label: 'More certain funding', help: 'Clear amounts, durations and conditions.' },
];
