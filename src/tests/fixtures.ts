import { demoProfile } from '@/data/demo-profile';
import type {
  Application,
  ApplicationTask,
  Program,
  Requirement,
  Scholarship,
  StudentProfile,
} from '@/domain/types';

export const NOW = new Date('2026-11-07T06:00:00Z');
export const TODAY = '2026-11-07';

export function makeProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    ...demoProfile,
    evidence: demoProfile.evidence.map((e) => ({ ...e })),
    targetProgramIds: [...demoProfile.targetProgramIds],
    userId: 'test-user',
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

export function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: 'req',
    label: 'Requirement',
    mandatory: true,
    kind: 'nationality',
    operator: 'in',
    expectedValue: ['India'],
    sourceNote: 'test',
    verified: true,
    ...overrides,
  };
}

export function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: 'prog-test',
    title: 'MS Test',
    universityName: 'Test University (fictional)',
    field: 'Computer Science',
    durationMonths: 24,
    tuitionTotalUsd: 60_000,
    mandatoryFeesTotalUsd: 6_000,
    livingTotalUsd: 24_000,
    costBasisDate: '2026-10-01',
    ...overrides,
  };
}

export function makeScholarship(overrides: Partial<Scholarship> = {}): Scholarship {
  return {
    id: 'sch-test',
    title: 'Test Scholarship',
    shortTitle: 'Test',
    provider: 'Test Provider',
    fundingType: 'merit',
    programIds: ['prog-test'],
    applicationRoute: 'separate-external',
    description: '',
    benefits: '',
    requirements: [],
    selectionCriteria: [],
    award: { amountUsd: 10_000, period: 'one-time', coveredCategories: ['tuition'], maximumPeriods: 1, stackability: 'no' },
    deadlineOffsetDays: 10,
    deadlineKind: 'separate-application',
    essayPrompts: [],
    tasks: [],
    officialUrl: null,
    provenance: 'demo',
    checkedAt: null,
    ...overrides,
  };
}

export function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    scholarshipId: 'lakeshore-global',
    programId: 'prog-lakeshore-mscs',
    status: 'preparing',
    closesOn: null,
    submittedAt: null,
    awardConfirmedUsd: null,
    awardEvidence: 'none',
    offerResponseStatus: null,
    offerResponseDeadlineOn: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

export function makeTask(overrides: Partial<ApplicationTask> = {}): ApplicationTask {
  return {
    id: 't-1',
    applicationId: 'app-1',
    key: 'k',
    label: 'Task',
    required: true,
    type: 'form',
    status: 'todo',
    dueDate: null,
    lastFollowUpOn: null,
    nextFollowUpOn: null,
    owner: 'student',
    essayPromptId: null,
    ...overrides,
  };
}
