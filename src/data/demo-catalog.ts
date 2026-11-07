import type { Program, Scholarship } from '@/domain/types';

/**
 * DEMO — fictional catalog. Every university, provider and award below is
 * invented for demonstration. Nothing here is a real scholarship offer.
 * Version is bumped whenever IDs or rules change.
 */
export const CATALOG_VERSION = '2026-11-07.1';

export const programs: Program[] = [
  {
    id: 'prog-northfield-mscs',
    title: 'MS in Computer Science',
    universityName: 'Northfield Institute of Technology (fictional)',
    field: 'Computer Science',
    durationMonths: 24,
    tuitionTotalUsd: 60_000,
    mandatoryFeesTotalUsd: 6_000,
    livingTotalUsd: 24_000,
    costBasisDate: '2026-10-01',
  },
  {
    id: 'prog-lakeshore-mscs',
    title: 'MS in Computer Science',
    universityName: 'Lakeshore State University (fictional)',
    field: 'Computer Science',
    durationMonths: 18,
    tuitionTotalUsd: 44_000,
    mandatoryFeesTotalUsd: 4_000,
    livingTotalUsd: 22_000,
    costBasisDate: '2026-10-01',
  },
  {
    id: 'prog-cascade-msds',
    title: 'MS in Data Science',
    universityName: 'Cascade University (fictional)',
    field: 'Data Science',
    durationMonths: 24,
    tuitionTotalUsd: 52_000,
    mandatoryFeesTotalUsd: 5_000,
    livingTotalUsd: null,
    costBasisDate: '2026-10-01',
  },
];

const demoNote = 'Sample rule written for this demo catalog.';

export const scholarships: Scholarship[] = [
  {
    id: 'northfield-excellence',
    title: 'Northfield Graduate Excellence Award',
    shortTitle: 'Northfield Excellence',
    provider: 'Northfield Institute of Technology (fictional)',
    fundingType: 'merit',
    programIds: ['prog-northfield-mscs'],
    applicationRoute: 'automatic-via-admission',
    description:
      'A one-time tuition award considered automatically for strong international admits to the MS in Computer Science.',
    benefits: 'Up to $30,000 toward tuition, applied once across the program.',
    requirements: [
      { id: 'nf-status', label: 'Applies as an international student', mandatory: true, kind: 'applicant-status', operator: 'in', expectedValue: ['international'], sourceNote: demoNote, verified: true },
      { id: 'nf-academic', label: 'Undergraduate score of at least 75%', mandatory: true, kind: 'academic-min', operator: 'gte', expectedValue: 75, metricScale: 'percentage', sourceNote: demoNote, verified: true },
      { id: 'nf-field', label: 'Intends to study Computer Science', mandatory: true, kind: 'field', operator: 'in', expectedValue: ['Computer Science'], sourceNote: demoNote, verified: true },
    ],
    selectionCriteria: [
      { id: 'nf-c1', label: 'Academic achievement', evidenceHint: 'Class rank, awards or standout coursework', category: 'academic' },
      { id: 'nf-c2', label: 'Research potential', evidenceHint: 'A project, paper or lab experience', category: 'research' },
    ],
    award: { amountUsd: 30_000, period: 'one-time', coveredCategories: ['tuition'], maximumPeriods: 1, stackability: 'no' },
    deadlineOffsetDays: 21,
    deadlineKind: 'admission',
    essayPrompts: [],
    tasks: [
      { key: 'admission-app', label: 'Complete the Northfield admission application', required: true, type: 'form', owner: 'student' },
      { key: 'transcript', label: 'Upload official transcript to the admission portal', required: true, type: 'document', owner: 'student' },
      { key: 'portfolio', label: 'Add a project link to your admission profile', required: false, type: 'review', owner: 'student' },
    ],
    officialUrl: null,
    provenance: 'demo',
    checkedAt: null,
  },
  {
    id: 'lakeshore-global',
    title: 'Lakeshore Global Scholars Grant',
    shortTitle: 'Lakeshore Global',
    provider: 'Lakeshore State University (fictional)',
    fundingType: 'merit',
    programIds: ['prog-lakeshore-mscs'],
    applicationRoute: 'admission-supplement',
    description:
      'A one-time tuition grant for international MS students who submit a short supplemental essay with their admission application.',
    benefits: 'Up to $20,000 toward tuition, applied once.',
    requirements: [
      { id: 'lk-status', label: 'Applies as an international student', mandatory: true, kind: 'applicant-status', operator: 'in', expectedValue: ['international'], sourceNote: demoNote, verified: true },
      { id: 'lk-academic', label: 'Undergraduate score of at least 70%', mandatory: true, kind: 'academic-min', operator: 'gte', expectedValue: 70, metricScale: 'percentage', sourceNote: demoNote, verified: true },
      { id: 'lk-qual', label: 'Final-year or completed bachelor’s degree', mandatory: true, kind: 'qualification', operator: 'in', expectedValue: ['final-year-bachelors', 'bachelors-complete'], sourceNote: demoNote, verified: true },
    ],
    selectionCriteria: [
      { id: 'lk-c1', label: 'Community contribution', evidenceHint: 'Volunteering, teaching or organising', category: 'community' },
      { id: 'lk-c2', label: 'Leadership', evidenceHint: 'A time you led a team or initiative', category: 'leadership' },
    ],
    award: { amountUsd: 20_000, period: 'one-time', coveredCategories: ['tuition'], maximumPeriods: 1, stackability: 'no' },
    deadlineOffsetDays: 2,
    deadlineKind: 'funding-priority',
    essayPrompts: [
      {
        id: 'lk-impact',
        question: 'Describe a time you made a positive difference in a community you belong to. What did you learn, and how will it shape your graduate studies?',
        wordLimit: 250,
        interpretation: [
          'They want one specific experience, not a list of activities.',
          'Your own actions matter more than the group’s achievements.',
          'End by linking what you learned to your master’s plans.',
        ],
      },
    ],
    tasks: [
      { key: 'essay', label: 'Write the community impact essay', required: true, type: 'essay', owner: 'student', essayPromptId: 'lk-impact' },
      { key: 'supplement-form', label: 'Fill in the scholarship supplement form', required: true, type: 'form', owner: 'student' },
      { key: 'resume', label: 'Update your one-page résumé', required: false, type: 'document', owner: 'student' },
    ],
    officialUrl: null,
    provenance: 'demo',
    checkedAt: null,
  },
  {
    id: 'meridian-need',
    title: 'Meridian Foundation Need-Based Grant',
    shortTitle: 'Meridian Need-Based',
    provider: 'Meridian Education Foundation (fictional)',
    fundingType: 'need',
    programIds: ['prog-northfield-mscs', 'prog-lakeshore-mscs'],
    applicationRoute: 'separate-external',
    description:
      'An external need-based grant for Indian students admitted to partner MS programs. Requires a separate application and one recommendation.',
    benefits: '$15,000 per year toward tuition and fees, for up to 1 year.',
    requirements: [
      { id: 'md-nat', label: 'Indian national', mandatory: true, kind: 'nationality', operator: 'in', expectedValue: ['India'], sourceNote: demoNote, verified: true },
      { id: 'md-income', label: 'Annual household income at or below ₹15,00,000', mandatory: true, kind: 'income-max', operator: 'lte', expectedValue: 1_500_000, expectedCurrency: 'INR', sourceNote: 'Sample rule: total annual household income before tax, in INR.', verified: true },
    ],
    selectionCriteria: [
      { id: 'md-c1', label: 'Financial need', evidenceHint: 'Assessed by the provider from official documents', category: 'other' },
      { id: 'md-c2', label: 'Academic achievement', evidenceHint: 'Grades, awards or rank', category: 'academic' },
    ],
    award: { amountUsd: 15_000, period: 'per-year', coveredCategories: ['tuition', 'fees'], maximumPeriods: 1, stackability: 'yes' },
    deadlineOffsetDays: 10,
    deadlineKind: 'separate-application',
    essayPrompts: [
      {
        id: 'md-goals',
        question: 'How will a master’s degree help you contribute to your family and community? (Up to 300 words.)',
        wordLimit: 300,
        interpretation: [
          'They want to understand your goals and motivation, not your finances.',
          'Be concrete: name the work you hope to do after graduating.',
          'Keep the focus on what you will contribute.',
        ],
      },
    ],
    tasks: [
      { key: 'recommendation', label: 'Get one recommendation letter from a professor', required: true, type: 'recommendation', owner: 'recommender' },
      { key: 'essay', label: 'Write the goals essay', required: true, type: 'essay', owner: 'student', essayPromptId: 'md-goals' },
      { key: 'income-docs', label: 'Prepare household income documents for the provider', required: true, type: 'document', owner: 'student' },
    ],
    officialUrl: null,
    provenance: 'demo',
    checkedAt: null,
  },
  {
    id: 'summit-leadership',
    title: 'Summit Leadership Fellowship',
    shortTitle: 'Summit Leadership',
    provider: 'Summit Alumni Network (fictional)',
    fundingType: 'fellowship',
    programIds: ['prog-northfield-mscs', 'prog-cascade-msds'],
    applicationRoute: 'separate-external',
    description:
      'A yearly fellowship for students with a record of leadership. Renewal beyond the first year is not described by the provider.',
    benefits: '$10,000 per year toward tuition; renewal terms are not stated.',
    requirements: [
      { id: 'sm-qual', label: 'Final-year or completed bachelor’s degree', mandatory: true, kind: 'qualification', operator: 'in', expectedValue: ['final-year-bachelors', 'bachelors-complete'], sourceNote: demoNote, verified: true },
    ],
    selectionCriteria: [
      { id: 'sm-c1', label: 'Leadership', evidenceHint: 'Leading a club, team or project', category: 'leadership' },
    ],
    award: { amountUsd: 10_000, period: 'per-year', coveredCategories: ['tuition'], maximumPeriods: null, stackability: 'unknown' },
    deadlineOffsetDays: -3,
    deadlineKind: 'separate-application',
    essayPrompts: [],
    tasks: [
      { key: 'form', label: 'Submit the Summit application form', required: true, type: 'form', owner: 'student' },
    ],
    officialUrl: null,
    provenance: 'demo',
    checkedAt: null,
  },
  {
    id: 'civic-scholars',
    title: 'Civic Scholars Award',
    shortTitle: 'Civic Scholars',
    provider: 'Civic Futures Trust (fictional)',
    fundingType: 'merit',
    programIds: ['prog-lakeshore-mscs'],
    applicationRoute: 'separate-external',
    description: 'A merit award reserved for US citizens enrolling in public-university master’s programs.',
    benefits: '$25,000 one-time toward tuition.',
    requirements: [
      { id: 'cv-status', label: 'US citizen', mandatory: true, kind: 'applicant-status', operator: 'in', expectedValue: ['us-citizen'], sourceNote: demoNote, verified: true },
    ],
    selectionCriteria: [
      { id: 'cv-c1', label: 'Public service', evidenceHint: 'Community or civic work', category: 'community' },
    ],
    award: { amountUsd: 25_000, period: 'one-time', coveredCategories: ['tuition'], maximumPeriods: 1, stackability: 'no' },
    deadlineOffsetDays: 30,
    deadlineKind: 'separate-application',
    essayPrompts: [],
    tasks: [{ key: 'form', label: 'Submit the Civic Scholars form', required: true, type: 'form', owner: 'student' }],
    officialUrl: null,
    provenance: 'demo',
    checkedAt: null,
  },
  {
    id: 'aurora-research',
    title: 'Aurora Industry Research Fellowship',
    shortTitle: 'Aurora Research',
    provider: 'Aurora Labs Foundation (fictional)',
    fundingType: 'fellowship',
    programIds: ['prog-northfield-mscs'],
    applicationRoute: 'separate-external',
    description: 'A fellowship for applicants with at least two years of full-time industry research experience.',
    benefits: '$40,000 one-time toward tuition and living costs.',
    requirements: [
      { id: 'au-exp', label: 'At least 24 months of full-time relevant experience', mandatory: true, kind: 'experience-min-months', operator: 'gte', expectedValue: 24, sourceNote: demoNote, verified: true },
      { id: 'au-field', label: 'Intends to study Computer Science', mandatory: true, kind: 'field', operator: 'in', expectedValue: ['Computer Science'], sourceNote: demoNote, verified: true },
    ],
    selectionCriteria: [
      { id: 'au-c1', label: 'Research output', evidenceHint: 'Papers, patents or shipped research', category: 'research' },
    ],
    award: { amountUsd: 40_000, period: 'one-time', coveredCategories: ['tuition', 'living'], maximumPeriods: 1, stackability: 'no' },
    deadlineOffsetDays: 45,
    deadlineKind: 'separate-application',
    essayPrompts: [],
    tasks: [{ key: 'form', label: 'Submit the research statement', required: true, type: 'form', owner: 'student' }],
    officialUrl: null,
    provenance: 'demo',
    checkedAt: null,
  },
  {
    id: 'horizon-gpa',
    title: 'Horizon Data Science Merit Scholarship',
    shortTitle: 'Horizon Merit',
    provider: 'Cascade University (fictional)',
    fundingType: 'merit',
    programIds: ['prog-cascade-msds'],
    applicationRoute: 'after-admission',
    description: 'A merit scholarship for admitted Data Science students with a US-style GPA of 3.5 or higher.',
    benefits: '$18,000 one-time toward tuition.',
    requirements: [
      { id: 'hz-gpa', label: 'GPA of at least 3.5 on a 4.0 scale', mandatory: true, kind: 'academic-min', operator: 'gte', expectedValue: 3.5, metricScale: 'gpa-4', sourceNote: 'Sample rule: the provider publishes no conversion from other grading scales.', verified: true },
    ],
    selectionCriteria: [
      { id: 'hz-c1', label: 'Quantitative strength', evidenceHint: 'Maths or statistics coursework, competitions', category: 'academic' },
    ],
    award: { amountUsd: 18_000, period: 'one-time', coveredCategories: ['tuition'], maximumPeriods: 1, stackability: 'no' },
    deadlineOffsetDays: 60,
    deadlineKind: 'funding-priority',
    essayPrompts: [],
    tasks: [{ key: 'form', label: 'Complete the post-admission scholarship form', required: true, type: 'form', owner: 'student' }],
    officialUrl: null,
    provenance: 'demo',
    checkedAt: null,
  },
  {
    id: 'bridge-community',
    title: 'Bridge Community Builders Award',
    shortTitle: 'Bridge Community',
    provider: 'Bridge Collective (fictional)',
    fundingType: 'merit',
    programIds: ['prog-lakeshore-mscs'],
    applicationRoute: 'separate-external',
    description: 'An award whose main condition is reviewed manually by the provider, so we can’t check it automatically.',
    benefits: '$8,000 one-time toward living costs.',
    requirements: [
      { id: 'br-manual', label: 'Demonstrated sustained community service (reviewed by the provider)', mandatory: true, kind: 'custom', operator: 'manual-review', expectedValue: null, sourceNote: 'The sample provider assesses this condition by hand.', verified: false },
    ],
    selectionCriteria: [
      { id: 'br-c1', label: 'Community service', evidenceHint: 'Long-term volunteering', category: 'community' },
    ],
    award: { amountUsd: 8_000, period: 'one-time', coveredCategories: ['living'], maximumPeriods: 1, stackability: 'yes' },
    deadlineOffsetDays: 25,
    deadlineKind: 'separate-application',
    essayPrompts: [],
    tasks: [{ key: 'form', label: 'Submit the Bridge application', required: true, type: 'form', owner: 'student' }],
    officialUrl: null,
    provenance: 'demo',
    checkedAt: null,
  },
  {
    id: 'cascade-assistantship',
    title: 'Cascade Graduate Teaching Assistantship',
    shortTitle: 'Cascade Assistantship',
    provider: 'Cascade University (fictional)',
    fundingType: 'assistantship',
    programIds: ['prog-cascade-msds'],
    applicationRoute: 'after-admission',
    description: 'Paid teaching work for admitted students. The tuition benefit amount is not published in this demo.',
    benefits: 'Partial tuition benefit and hourly pay; amount not stated.',
    requirements: [
      { id: 'ca-qual', label: 'Final-year or completed bachelor’s degree', mandatory: true, kind: 'qualification', operator: 'in', expectedValue: ['final-year-bachelors', 'bachelors-complete'], sourceNote: demoNote, verified: true },
    ],
    selectionCriteria: [],
    award: { amountUsd: null, period: 'unknown', coveredCategories: ['tuition'], maximumPeriods: null, stackability: 'unknown' },
    deadlineOffsetDays: null,
    deadlineKind: 'funding-priority',
    essayPrompts: [],
    tasks: [{ key: 'interest', label: 'Tell the department you’re interested in a TA role', required: true, type: 'form', owner: 'student' }],
    officialUrl: null,
    provenance: 'demo',
    checkedAt: null,
  },
];

const scholarshipById = new Map(scholarships.map((s) => [s.id, s]));
const programById = new Map(programs.map((p) => [p.id, p]));

export function getScholarship(id: string): Scholarship | undefined {
  return scholarshipById.get(id);
}

export function getProgram(id: string): Program | undefined {
  return programById.get(id);
}

export function isValidPairing(scholarshipId: string, programId: string): boolean {
  return getScholarship(scholarshipId)?.programIds.includes(programId) ?? false;
}

export const FIELDS = Array.from(new Set(programs.map((p) => p.field)));
