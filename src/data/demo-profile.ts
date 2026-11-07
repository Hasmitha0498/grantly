import type { ProfileInput } from '@/domain/types';

/** Aisha is a fictional, editable demo persona. */
export const demoProfile: ProfileInput = {
  displayName: 'Aisha',
  nationality: 'India',
  applicantCategory: 'international',
  householdIncome: null,
  evidence: [
    { id: 'ev-1', category: 'academic', description: 'Top 5% of my B.Tech class in data structures and algorithms.' },
  ],
  currentQualification: 'final-year-bachelors',
  academicMetric: { kind: 'percentage', value: 84 },
  relevantExperienceMonths: 0,
  intendedField: 'Computer Science',
  targetProgramIds: ['prog-lakeshore-mscs', 'prog-northfield-mscs'],
  targetIntake: 'Fall 2027',
  fullProgramBudgetUsd: 50_000,
  priority: 'lowest-cost',
  isDemo: true,
};
