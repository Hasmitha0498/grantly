import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const shortText = (max: number) => z.string().max(max);
const id = z.string().min(1).max(120).regex(/^[A-Za-z0-9_:.-]+$/);

export const academicMetricSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('percentage'), value: z.number().min(0).max(100) }),
  z.object({ kind: z.literal('gpa-4'), value: z.number().min(0).max(4) }),
  z.object({ kind: z.literal('other'), description: shortText(80) }),
  z.object({ kind: z.literal('none') }),
]);

export const evidenceSchema = z.object({
  id,
  category: z.enum(['academic', 'research', 'leadership', 'community', 'other']),
  description: shortText(400),
});

export const profileInputSchema = z.object({
  displayName: shortText(60),
  nationality: shortText(60),
  applicantCategory: z.enum(['international', 'us-citizen', 'us-permanent-resident', 'other-unknown']),
  householdIncome: z
    .object({ amount: z.number().min(0).max(1e11), currency: z.enum(['INR', 'USD']) })
    .nullable(),
  evidence: z.array(evidenceSchema).max(20),
  currentQualification: z.enum(['final-year-bachelors', 'bachelors-complete']),
  academicMetric: academicMetricSchema,
  relevantExperienceMonths: z.number().int().min(0).max(600),
  intendedField: shortText(80),
  targetProgramIds: z.array(id).max(3),
  targetIntake: shortText(40),
  fullProgramBudgetUsd: z.number().min(0).max(10_000_000).nullable(),
  priority: z.enum(['lowest-cost', 'least-effort', 'program-fit', 'clearer-terms']),
  isDemo: z.boolean(),
});

export const profileSchema = profileInputSchema.extend({
  userId: id,
  updatedAt: z.string().max(40),
});

export const applicationSchema = z.object({
  id,
  scholarshipId: id,
  programId: id,
  status: z.enum(['preparing', 'submitted', 'waiting', 'action-required', 'awarded', 'not-selected', 'withdrawn']),
  closesOn: dateOnly.nullable(),
  submittedAt: z.string().max(40).nullable(),
  awardConfirmedUsd: z.number().min(0).max(10_000_000).nullable(),
  awardEvidence: z.enum(['student-reported', 'provider-confirmed', 'none']),
  offerResponseStatus: z.enum(['pending', 'accepted', 'declined']).nullable(),
  offerResponseDeadlineOn: dateOnly.nullable(),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
});

export const taskSchema = z.object({
  id,
  applicationId: id,
  key: id,
  label: shortText(200),
  required: z.boolean(),
  type: z.enum(['essay', 'document', 'recommendation', 'form', 'review']),
  status: z.enum(['todo', 'waiting', 'complete']),
  dueDate: dateOnly.nullable(),
  lastFollowUpOn: dateOnly.nullable(),
  nextFollowUpOn: dateOnly.nullable(),
  owner: z.enum(['student', 'recommender', 'provider']),
  essayPromptId: id.nullable(),
});

export const storySchema = z.object({
  id,
  title: shortText(120),
  situation: shortText(1500),
  action: shortText(1500),
  result: shortText(1500),
  reflection: shortText(1500),
  tags: z.array(shortText(30)).max(10),
});

export const essaySchema = z.object({
  id,
  applicationId: id,
  promptId: id,
  selectedStoryIds: z.array(id).max(10),
  outline: z.object({
    situation: shortText(1500),
    action: shortText(1500),
    result: shortText(1500),
    connection: shortText(1500),
  }),
  body: shortText(20_000),
  userMarkedReady: z.boolean(),
  revision: z.number().int().min(0),
  updatedAt: z.string().max(40),
});

export const journeyStateSchema = z.object({
  version: z.literal(1),
  profile: profileSchema.nullable(),
  bookmarks: z.array(id).max(100),
  compare: z.array(z.object({ scholarshipId: id, programId: id })).max(3),
  applications: z.array(applicationSchema).max(100),
  tasks: z.array(taskSchema).max(1000),
  stories: z.array(storySchema).max(100),
  essays: z.array(essaySchema).max(200),
  anchorAt: z.string().max(40).nullable(),
});
