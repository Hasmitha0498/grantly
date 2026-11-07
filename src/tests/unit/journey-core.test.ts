import { describe, expect, it } from 'vitest';
import { getNextActions } from '@/domain/action-priority';
import { getScholarship } from '@/data/demo-catalog';
import {
  applicationId,
  ConflictError,
  deadlineFor,
  emptyState,
  saveEssay,
  seedDemo,
  startApplication,
  type EssayInput,
} from '@/repository/journey-core';
import { NOW } from '../fixtures';

const LK_ID = applicationId('lakeshore-global', 'prog-lakeshore-mscs');
const MD_ID = applicationId('meridian-need', 'prog-lakeshore-mscs');
const SM_ID = applicationId('summit-leadership', 'prog-northfield-mscs');

function essayInput(body: string): EssayInput {
  return {
    applicationId: LK_ID,
    promptId: 'lk-impact',
    selectedStoryIds: [],
    outline: { situation: '', action: '', result: '', connection: '' },
    body,
    userMarkedReady: false,
  };
}

function withApp() {
  return startApplication(emptyState(), 'lakeshore-global', 'prog-lakeshore-mscs', NOW).state;
}

describe('essay saves', () => {
  it('ES-03 saveEssay then read back the exact content', () => {
    const body = 'Line one.\n\n  Line two — with “quotes” and don’t.  ';
    const { state, draft } = saveEssay(withApp(), essayInput(body), 0, NOW);
    expect(draft.revision).toBe(1);
    expect(draft.id).toBe(`${LK_ID}__lk-impact`);
    const read = state.essays.find((e) => e.applicationId === LK_ID && e.promptId === 'lk-impact')!;
    expect(read.body).toBe(body);
    expect(read.updatedAt).toBe(NOW.toISOString());
  });

  it('ES-04 a stale expectedRevision throws ConflictError and leaves the draft unchanged', () => {
    let state = saveEssay(withApp(), essayInput('v1'), 0, NOW).state;
    state = saveEssay(state, essayInput('v2'), 1, NOW).state;
    const before = structuredClone(state.essays);
    let caught: unknown;
    try {
      saveEssay(state, essayInput('stale overwrite'), 1, NOW);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConflictError);
    expect((caught as ConflictError).current.body).toBe('v2');
    expect((caught as ConflictError).current.revision).toBe(2);
    expect(state.essays).toEqual(before);
  });

  it('ES-05 two tabs from the same revision: the second save conflicts and the first one wins', () => {
    const base = saveEssay(withApp(), essayInput('original'), 0, NOW).state;
    const tabA = saveEssay(base, essayInput('from tab A'), 1, NOW).state;
    expect(() => saveEssay(tabA, essayInput('from tab B'), 1, NOW)).toThrow(ConflictError);
    expect(tabA.essays).toHaveLength(1);
    expect(tabA.essays[0]!.body).toBe('from tab A');
    expect(tabA.essays[0]!.revision).toBe(2);
  });
});

describe('seedDemo', () => {
  it('DT-02 creates the demo journey with absolute dates', () => {
    const state = seedDemo(NOW);
    expect(state.applications.map((a) => a.id)).toEqual([LK_ID, MD_ID, SM_ID]);
    expect(state.anchorAt).toBe(NOW.toISOString());
    expect(state.profile?.userId).toBe('demo-aisha');

    const lkEssay = state.tasks.find((t) => t.id === `${LK_ID}__essay`)!;
    expect(lkEssay.dueDate).toBe('2026-11-09');
    expect(state.applications.find((a) => a.id === LK_ID)!.closesOn).toBe('2026-11-09');

    const rec = state.tasks.find((t) => t.id === `${MD_ID}__recommendation`)!;
    expect(rec.nextFollowUpOn).toBe('2026-11-11');
    expect(rec.lastFollowUpOn).toBe('2026-11-04');

    const summit = state.applications.find((a) => a.id === SM_ID)!;
    expect(summit.status).toBe('submitted');
    expect(summit.submittedAt).toBe(NOW.toISOString());
    expect(summit.closesOn).toBe('2026-11-04');
  });

  it('DT-02 recomputing with a later date leaves persisted closesOn/dueDate unchanged', () => {
    const state = seedDemo(NOW);
    const snapshot = structuredClone(state);
    const later = new Date('2026-11-20T06:00:00Z');

    expect(deadlineFor('lakeshore-global', later.toISOString())).toBe('2026-11-22');
    const again = startApplication(state, 'lakeshore-global', 'prog-lakeshore-mscs', later);
    expect(again.application.closesOn).toBe('2026-11-09');

    const plan = getNextActions(state.applications, state.tasks, getScholarship, '2026-11-20');
    const essayAction = plan.actions.find((a) => a.id === `task-${LK_ID}__essay`)!;
    expect(essayAction.dueDate).toBe('2026-11-09');
    expect(essayAction.bucket).toBe('overdue');

    expect(state).toEqual(snapshot);
    expect(state.applications.map((a) => a.closesOn)).toEqual(['2026-11-09', '2026-11-17', '2026-11-04']);
    expect(state.tasks.find((t) => t.id === `${LK_ID}__essay`)!.dueDate).toBe('2026-11-09');
  });

  it('demo plan on the seed day puts the Lakeshore essay first and the recommendation in waiting', () => {
    const state = seedDemo(NOW);
    const plan = getNextActions(state.applications, state.tasks, getScholarship, '2026-11-07');
    expect(plan.actions[0]!.id).toBe(`task-${LK_ID}__essay`);
    expect(plan.waiting.map((w) => w.id)).toEqual([`${MD_ID}__recommendation`]);
  });
});
