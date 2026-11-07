/**
 * Pure state transitions for the journey. Both the local adapter and tests use
 * these, so business rules (idempotent start, valid transitions, revision
 * checks) live in exactly one place.
 */
import { getProgram, getScholarship, isValidPairing } from '@/data/demo-catalog';
import { demoProfile } from '@/data/demo-profile';
import { canTransition, TransitionError } from '@/domain/application-state';
import { addDays, toDateOnly } from '@/domain/date';
import { evaluateEssayDraft } from '@/domain/essay';
import { profileInputSchema, storySchema } from '@/domain/schemas';
import type {
  Application,
  ApplicationStatus,
  ApplicationTask,
  EssayDraft,
  FundingOption,
  JourneyState,
  ProfileInput,
  StoryBankItem,
} from '@/domain/types';

export class ConflictError extends Error {
  constructor(public readonly current: EssayDraft) {
    super('This draft was changed somewhere else.');
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`We couldn’t find that ${what}.`);
    this.name = 'NotFoundError';
  }
}

export function emptyState(): JourneyState {
  return { version: 1, profile: null, bookmarks: [], compare: [], applications: [], tasks: [], stories: [], essays: [], anchorAt: null };
}

export function applicationId(scholarshipId: string, programId: string): string {
  return `${scholarshipId}__${programId}`;
}

export function deadlineFor(scholarshipId: string, anchorAt: string): string | null {
  const s = getScholarship(scholarshipId);
  if (!s || s.deadlineOffsetDays === null) return null;
  return addDays(toDateOnly(new Date(anchorAt)), s.deadlineOffsetDays);
}

export function saveProfile(state: JourneyState, input: ProfileInput, now: Date, userId = 'local-user'): JourneyState {
  const parsed = profileInputSchema.parse(input);
  const validTargets = parsed.targetProgramIds.filter((p) => getProgram(p));
  return {
    ...state,
    anchorAt: state.anchorAt ?? now.toISOString(),
    profile: { ...parsed, targetProgramIds: validTargets, userId: state.profile?.userId ?? userId, updatedAt: now.toISOString() },
  };
}

export function setBookmark(state: JourneyState, scholarshipId: string, saved: boolean): JourneyState {
  if (!getScholarship(scholarshipId)) throw new NotFoundError('opportunity');
  const without = state.bookmarks.filter((b) => b !== scholarshipId);
  return { ...state, bookmarks: saved ? [...without, scholarshipId] : without };
}

export const MAX_COMPARE = 3;

export function setCompare(state: JourneyState, option: FundingOption, selected: boolean): JourneyState {
  if (!isValidPairing(option.scholarshipId, option.programId)) throw new NotFoundError('program for this opportunity');
  const without = state.compare.filter((c) => !(c.scholarshipId === option.scholarshipId && c.programId === option.programId));
  if (!selected) return { ...state, compare: without };
  if (without.length >= MAX_COMPARE) return state;
  return { ...state, compare: [...without, option] };
}

/** Idempotent: returns the existing application if the pairing already exists. */
export function startApplication(state: JourneyState, scholarshipId: string, programId: string, now: Date): { state: JourneyState; application: Application } {
  const scholarship = getScholarship(scholarshipId);
  if (!scholarship || !isValidPairing(scholarshipId, programId)) throw new NotFoundError('opportunity and program pairing');
  const appId = applicationId(scholarshipId, programId);
  const existing = state.applications.find((a) => a.id === appId);
  if (existing) return { state, application: existing };

  const anchor = state.anchorAt ?? now.toISOString();
  const iso = now.toISOString();
  const application: Application = {
    id: appId,
    scholarshipId,
    programId,
    status: 'preparing',
    closesOn: deadlineFor(scholarshipId, anchor),
    submittedAt: null,
    awardConfirmedUsd: null,
    awardEvidence: 'none',
    offerResponseStatus: null,
    offerResponseDeadlineOn: null,
    createdAt: iso,
    updatedAt: iso,
  };
  const tasks: ApplicationTask[] = scholarship.tasks.map((t) => ({
    id: `${appId}__${t.key}`,
    applicationId: appId,
    key: t.key,
    label: t.label,
    required: t.required,
    type: t.type,
    status: t.owner === 'student' ? 'todo' : 'waiting',
    dueDate: null,
    lastFollowUpOn: null,
    nextFollowUpOn: null,
    owner: t.owner,
    essayPromptId: t.essayPromptId ?? null,
  }));
  return {
    state: { ...state, anchorAt: anchor, applications: [...state.applications, application], tasks: [...state.tasks, ...tasks] },
    application,
  };
}

export interface ApplicationPatch {
  status?: ApplicationStatus;
  confirmSubmission?: boolean;
  awardConfirmedUsd?: number | null;
  offerResponseStatus?: 'pending' | 'accepted' | 'declined' | null;
  offerResponseDeadlineOn?: string | null;
}

export function updateApplication(state: JourneyState, id: string, patch: ApplicationPatch, now: Date): JourneyState {
  const app = state.applications.find((a) => a.id === id);
  if (!app) throw new NotFoundError('application');
  const next: Application = { ...app, updatedAt: now.toISOString() };

  if (patch.status && patch.status !== app.status) {
    if (!canTransition(app.status, patch.status)) throw new TransitionError(app.status, patch.status);
    if (patch.status === 'submitted') {
      if (patch.confirmSubmission !== true) throw new Error('Please confirm you submitted through the official route.');
      next.submittedAt = now.toISOString();
    }
    if (patch.status === 'awarded') {
      next.awardEvidence = 'student-reported';
      next.offerResponseStatus = 'pending';
    }
    next.status = patch.status;
  }
  if (patch.awardConfirmedUsd !== undefined) {
    if (next.status !== 'awarded') throw new Error('Record an award before entering its amount.');
    if (patch.awardConfirmedUsd !== null && (!Number.isFinite(patch.awardConfirmedUsd) || patch.awardConfirmedUsd < 0)) throw new Error('Enter a valid award amount.');
    next.awardConfirmedUsd = patch.awardConfirmedUsd;
  }
  if (patch.offerResponseDeadlineOn !== undefined) next.offerResponseDeadlineOn = patch.offerResponseDeadlineOn;
  if (patch.offerResponseStatus !== undefined) {
    if (next.status !== 'awarded') throw new Error('You can only respond to an award you’ve recorded.');
    next.offerResponseStatus = patch.offerResponseStatus;
  }
  return { ...state, applications: state.applications.map((a) => (a.id === id ? next : a)) };
}

export function removeApplication(state: JourneyState, id: string): JourneyState {
  return {
    ...state,
    applications: state.applications.filter((a) => a.id !== id),
    tasks: state.tasks.filter((t) => t.applicationId !== id),
    essays: state.essays.filter((e) => e.applicationId !== id),
  };
}

export type TaskPatch = Partial<Pick<ApplicationTask, 'status' | 'nextFollowUpOn' | 'lastFollowUpOn'>>;

export function updateTask(state: JourneyState, taskId: string, patch: TaskPatch): JourneyState {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) throw new NotFoundError('task');
  return { ...state, tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) };
}

export function saveStory(state: JourneyState, story: StoryBankItem): JourneyState {
  const parsed = storySchema.parse(story);
  const exists = state.stories.some((s) => s.id === parsed.id);
  return { ...state, stories: exists ? state.stories.map((s) => (s.id === parsed.id ? parsed : s)) : [...state.stories, parsed] };
}

export function removeStory(state: JourneyState, id: string): JourneyState {
  return {
    ...state,
    stories: state.stories.filter((s) => s.id !== id),
    essays: state.essays.map((e) => ({ ...e, selectedStoryIds: e.selectedStoryIds.filter((s) => s !== id) })),
  };
}

export type EssayInput = Omit<EssayDraft, 'id' | 'revision' | 'updatedAt'>;

/** Compare-and-swap save: rejects writes based on a stale revision. */
export function saveEssay(state: JourneyState, input: EssayInput, expectedRevision: number, now: Date): { state: JourneyState; draft: EssayDraft } {
  const app = state.applications.find((a) => a.id === input.applicationId);
  if (!app) throw new NotFoundError('application');
  const prompt = getScholarship(app.scholarshipId)?.essayPrompts.find((p) => p.id === input.promptId);
  if (!prompt) throw new NotFoundError('essay prompt');
  const current = state.essays.find((e) => e.applicationId === input.applicationId && e.promptId === input.promptId);
  const currentRevision = current?.revision ?? 0;
  if (current && expectedRevision !== currentRevision) throw new ConflictError(current);
  // Readiness requires a non-empty draft within the limit AND explicit confirmation.
  const ready = evaluateEssayDraft(input.body, prompt.wordLimit, input.userMarkedReady).ready;
  const draft: EssayDraft = {
    ...input,
    userMarkedReady: ready,
    id: current?.id ?? `${input.applicationId}__${input.promptId}`,
    revision: currentRevision + 1,
    updatedAt: now.toISOString(),
  };
  const essays = current ? state.essays.map((e) => (e.id === draft.id ? draft : e)) : [...state.essays, draft];
  // Keep the linked checklist task consistent with the draft in the same write.
  const tasks = state.tasks.map((t) => {
    if (t.applicationId !== input.applicationId || t.essayPromptId !== input.promptId) return t;
    if (ready) return { ...t, status: 'complete' as const };
    return t.status === 'complete' ? { ...t, status: 'todo' as const } : t;
  });
  return { state: { ...state, essays, tasks }, draft };
}

/** Demo seed: schedule computed once and persisted as absolute dates. */
export function seedDemo(now: Date): JourneyState {
  let state = saveProfile(emptyState(), demoProfile, now, 'demo-aisha');
  state = { ...state, anchorAt: now.toISOString(), bookmarks: ['lakeshore-global', 'northfield-excellence'] };
  const today = toDateOnly(now);

  state = startApplication(state, 'lakeshore-global', 'prog-lakeshore-mscs', now).state;
  const lkEssay = `${applicationId('lakeshore-global', 'prog-lakeshore-mscs')}__essay`;
  state = updateTask(state, lkEssay, { status: 'todo' });
  state = {
    ...state,
    tasks: state.tasks.map((t) => (t.id === lkEssay ? { ...t, dueDate: addDays(today, 2) } : t)),
  };

  state = startApplication(state, 'meridian-need', 'prog-lakeshore-mscs', now).state;
  state = updateTask(state, `${applicationId('meridian-need', 'prog-lakeshore-mscs')}__recommendation`, {
    lastFollowUpOn: addDays(today, -3),
    nextFollowUpOn: addDays(today, 4),
  });

  const summitId = applicationId('summit-leadership', 'prog-northfield-mscs');
  state = startApplication(state, 'summit-leadership', 'prog-northfield-mscs', now).state;
  state = updateTask(state, `${summitId}__form`, { status: 'complete' });
  state = updateApplication(state, summitId, { status: 'submitted', confirmSubmission: true }, now);

  state = saveStory(state, {
    id: 'story-demo-1',
    title: 'Teaching coding at the community library',
    situation: 'Kids near my college had no access to computers after school.',
    action: 'I organised weekend Python sessions with two friends and borrowed laptops.',
    result: 'About 20 students joined; four built their first games.',
    reflection: 'Explaining ideas simply made me a better engineer.',
    tags: ['community', 'leadership'],
  });
  return state;
}
