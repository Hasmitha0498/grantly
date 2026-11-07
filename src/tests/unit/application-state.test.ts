import { describe, expect, it } from 'vitest';
import { allowedTransitions, canTransition, displayStatus, progress, TransitionError } from '@/domain/application-state';
import { applicationId, emptyState, startApplication, updateApplication, updateTask } from '@/repository/journey-core';
import type { JourneyState } from '@/domain/types';
import { makeApp, makeTask, NOW } from '../fixtures';

const LATER = new Date('2026-11-08T06:00:00Z');
const LK_ID = applicationId('lakeshore-global', 'prog-lakeshore-mscs');

function started(): JourneyState {
  return startApplication(emptyState(), 'lakeshore-global', 'prog-lakeshore-mscs', NOW).state;
}

function appOf(state: JourneyState, id = LK_ID) {
  return state.applications.find((a) => a.id === id)!;
}

function tasksOf(state: JourneyState, id = LK_ID) {
  return state.tasks.filter((t) => t.applicationId === id);
}

describe('application lifecycle', () => {
  it('AP-01 startApplication twice returns the same id and does not duplicate tasks', () => {
    const first = startApplication(emptyState(), 'lakeshore-global', 'prog-lakeshore-mscs', NOW);
    const second = startApplication(first.state, 'lakeshore-global', 'prog-lakeshore-mscs', LATER);
    expect(second.application.id).toBe(first.application.id);
    expect(second.application.id).toBe('lakeshore-global__prog-lakeshore-mscs');
    expect(second.state).toBe(first.state);
    expect(second.state.applications).toHaveLength(1);
    expect(second.state.tasks).toHaveLength(3);
  });

  it('AP-02 progress counts required tasks only; optional tasks are ignored', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'complete' }),
      makeTask({ id: 'b', status: 'todo' }),
      makeTask({ id: 'c', required: false, status: 'todo' }),
    ];
    expect(progress(tasks)).toEqual({ completed: 1, total: 2, percent: 50 });
    expect(displayStatus(makeApp(), tasks)).toBe('preparing');
  });

  it('AP-03 displayStatus is ready when every required task is complete, even with optional ones open', () => {
    let state = started();
    for (const t of tasksOf(state).filter((t) => t.required)) state = updateTask(state, t.id, { status: 'complete' });
    expect(progress(tasksOf(state))).toEqual({ completed: 2, total: 2, percent: 100 });
    expect(tasksOf(state).some((t) => !t.required && t.status !== 'complete')).toBe(true);
    expect(displayStatus(appOf(state), tasksOf(state))).toBe('ready');
    // `ready` is derived, never persisted
    expect(appOf(state).status).toBe('preparing');
  });

  it('displayStatus with no required tasks stays preparing; non-preparing returns the stored status', () => {
    expect(displayStatus(makeApp(), [])).toBe('preparing');
    expect(displayStatus(makeApp({ status: 'waiting' }), [makeTask({ status: 'complete' })])).toBe('waiting');
  });

  it('AP-04 submitting without confirmSubmission throws and leaves state unchanged', () => {
    const state = started();
    const snapshot = structuredClone(state);
    expect(() => updateApplication(state, LK_ID, { status: 'submitted' }, LATER)).toThrow('Please confirm you submitted through the official route.');
    expect(() => updateApplication(state, LK_ID, { status: 'submitted', confirmSubmission: false }, LATER)).toThrow();
    expect(state).toEqual(snapshot);
    expect(appOf(state).status).toBe('preparing');
    expect(appOf(state).submittedAt).toBeNull();
  });

  it('AP-05 submitting with confirmSubmission sets submitted and submittedAt', () => {
    const next = updateApplication(started(), LK_ID, { status: 'submitted', confirmSubmission: true }, LATER);
    expect(appOf(next).status).toBe('submitted');
    expect(appOf(next).submittedAt).toBe('2026-11-08T06:00:00.000Z');
    expect(appOf(next).updatedAt).toBe('2026-11-08T06:00:00.000Z');
  });

  it('AP-06 an invalid transition throws TransitionError', () => {
    const state = started();
    expect(() => updateApplication(state, LK_ID, { status: 'awarded' }, LATER)).toThrow(TransitionError);
    expect(canTransition('preparing', 'awarded')).toBe(false);
    expect(canTransition('withdrawn', 'preparing')).toBe(false);
    expect(allowedTransitions('awarded')).toEqual([]);
    const withdrawn = updateApplication(state, LK_ID, { status: 'withdrawn' }, LATER);
    expect(() => updateApplication(withdrawn, LK_ID, { status: 'submitted', confirmSubmission: true }, LATER)).toThrow(TransitionError);
  });

  it('AP-07 reopening a completed task returns the display status to preparing', () => {
    let state = started();
    const required = tasksOf(state).filter((t) => t.required);
    for (const t of required) state = updateTask(state, t.id, { status: 'complete' });
    expect(displayStatus(appOf(state), tasksOf(state))).toBe('ready');
    state = updateTask(state, required[0]!.id, { status: 'todo' });
    expect(displayStatus(appOf(state), tasksOf(state))).toBe('preparing');
  });

  it('recording an award sets student-reported evidence and a pending offer', () => {
    let state = updateApplication(started(), LK_ID, { status: 'submitted', confirmSubmission: true }, NOW);
    state = updateApplication(state, LK_ID, { status: 'awarded' }, NOW);
    expect(appOf(state)).toMatchObject({ status: 'awarded', awardEvidence: 'student-reported', offerResponseStatus: 'pending' });
  });
});
