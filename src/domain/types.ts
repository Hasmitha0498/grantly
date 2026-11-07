/**
 * Canonical domain types for GRANTLY.
 * Persisted shapes are validated by the Zod schemas in ./schemas.ts.
 */

export type DemoProvenance = 'demo' | 'verified-public';
export type FundingType = 'merit' | 'need' | 'fellowship' | 'assistantship';
export type ApplicationRoute =
  | 'automatic-via-admission'
  | 'admission-supplement'
  | 'separate-external'
  | 'after-admission';
export type Priority = 'lowest-cost' | 'least-effort' | 'program-fit' | 'clearer-terms';
export type Eligibility = 'eligible' | 'not-eligible' | 'needs-information' | 'unverified';
export type RequirementResult = 'pass' | 'fail' | 'unknown' | 'unverified';
/** Readiness is derived, never persisted. */
export type ApplicationStatus =
  | 'preparing'
  | 'submitted'
  | 'waiting'
  | 'action-required'
  | 'awarded'
  | 'not-selected'
  | 'withdrawn';
export type TaskStatus = 'todo' | 'waiting' | 'complete';
export type ApplicantCategory =
  | 'international'
  | 'us-citizen'
  | 'us-permanent-resident'
  | 'other-unknown';
export type EvidenceCategory = 'academic' | 'research' | 'leadership' | 'community' | 'other';

export type AcademicMetric =
  | { kind: 'percentage'; value: number }
  | { kind: 'gpa-4'; value: number }
  | { kind: 'other'; description: string }
  | { kind: 'none' };

export interface EvidenceItem {
  id: string;
  category: EvidenceCategory;
  description: string;
}

export interface StudentProfile {
  userId: string;
  displayName: string;
  nationality: string;
  applicantCategory: ApplicantCategory;
  householdIncome: { amount: number; currency: 'INR' | 'USD' } | null;
  evidence: EvidenceItem[];
  currentQualification: 'final-year-bachelors' | 'bachelors-complete';
  academicMetric: AcademicMetric;
  relevantExperienceMonths: number;
  intendedField: string;
  targetProgramIds: string[];
  targetIntake: string;
  fullProgramBudgetUsd: number | null;
  priority: Priority;
  isDemo: boolean;
  updatedAt: string;
}

export type ProfileInput = Omit<StudentProfile, 'userId' | 'updatedAt'>;

export interface Requirement {
  id: string;
  label: string;
  mandatory: boolean;
  kind:
    | 'nationality'
    | 'field'
    | 'qualification'
    | 'academic-min'
    | 'experience-min-months'
    | 'applicant-status'
    | 'income-max'
    | 'enrollment'
    | 'document'
    | 'custom';
  operator: 'in' | 'equals' | 'gte' | 'lte' | 'present' | 'manual-review';
  expectedValue: string | number | string[] | null;
  metricScale?: 'percentage' | 'gpa-4';
  expectedCurrency?: 'INR' | 'USD';
  sourceNote: string;
  /** In demo data: the sample rule is internally complete — NOT a real-world verification. */
  verified: boolean;
}

export interface Program {
  id: string;
  title: string;
  universityName: string;
  field: string;
  durationMonths: number;
  tuitionTotalUsd: number | null;
  mandatoryFeesTotalUsd: number | null;
  livingTotalUsd: number | null;
  costBasisDate: string | null;
}

export type CostCategory = 'tuition' | 'fees' | 'living';

export interface Award {
  amountUsd: number | null;
  period: 'one-time' | 'per-year' | 'per-semester' | 'unknown';
  coveredCategories: CostCategory[];
  maximumPeriods: number | null;
  stackability: 'yes' | 'no' | 'unknown';
}

export type DeadlineKind =
  | 'admission'
  | 'funding-priority'
  | 'separate-application'
  | 'recommendation'
  | 'response'
  | 'award-acceptance';

export interface Deadline {
  kind: DeadlineKind;
  at: string | null;
  localDate: string;
  timeZone: string | null;
  sourceNote: string;
}

export interface EssayPrompt {
  id: string;
  question: string;
  wordLimit: number;
  interpretation: string[];
}

export interface TaskTemplate {
  key: string;
  label: string;
  required: boolean;
  type: 'essay' | 'document' | 'recommendation' | 'form' | 'review';
  owner: 'student' | 'recommender' | 'provider';
  essayPromptId?: string;
}

export interface Scholarship {
  id: string;
  title: string;
  shortTitle: string;
  provider: string;
  fundingType: FundingType;
  programIds: string[];
  applicationRoute: ApplicationRoute;
  description: string;
  benefits: string;
  requirements: Requirement[];
  selectionCriteria: { id: string; label: string; evidenceHint: string; category: EvidenceCategory }[];
  award: Award;
  /** Demo deadlines are expressed relative to demo initialisation and become absolute on seed. */
  deadlineOffsetDays: number | null;
  deadlineKind: DeadlineKind;
  essayPrompts: EssayPrompt[];
  tasks: TaskTemplate[];
  officialUrl: string | null;
  provenance: DemoProvenance;
  checkedAt: string | null;
}

export interface Application {
  id: string;
  scholarshipId: string;
  programId: string;
  status: ApplicationStatus;
  /** Absolute deadline persisted at creation so it never drifts. */
  closesOn: string | null;
  submittedAt: string | null;
  awardConfirmedUsd: number | null;
  awardEvidence: 'student-reported' | 'provider-confirmed' | 'none';
  offerResponseStatus: 'pending' | 'accepted' | 'declined' | null;
  offerResponseDeadlineOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationTask {
  id: string;
  applicationId: string;
  key: string;
  label: string;
  required: boolean;
  type: TaskTemplate['type'];
  status: TaskStatus;
  dueDate: string | null;
  lastFollowUpOn: string | null;
  nextFollowUpOn: string | null;
  owner: 'student' | 'recommender' | 'provider';
  essayPromptId: string | null;
}

export interface StoryBankItem {
  id: string;
  title: string;
  situation: string;
  action: string;
  result: string;
  reflection: string;
  tags: string[];
}

export interface EssayOutline {
  situation: string;
  action: string;
  result: string;
  connection: string;
}

export interface EssayDraft {
  id: string;
  applicationId: string;
  promptId: string;
  selectedStoryIds: string[];
  outline: EssayOutline;
  body: string;
  userMarkedReady: boolean;
  revision: number;
  updatedAt: string;
}

export interface FundingOption {
  scholarshipId: string;
  programId: string;
}

export interface JourneyState {
  version: 1;
  profile: StudentProfile | null;
  bookmarks: string[];
  compare: FundingOption[];
  applications: Application[];
  tasks: ApplicationTask[];
  stories: StoryBankItem[];
  essays: EssayDraft[];
  anchorAt: string | null;
}
