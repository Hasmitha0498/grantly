import { describe, expect, it } from 'vitest';
import { getScholarship } from '@/data/demo-catalog';
import { bucketFor, getNextActions } from '@/domain/action-priority';
import { addDays } from '@/domain/date';
import { makeApp, makeTask, TODAY } from '../fixtures';

const tomorrow = addDays(TODAY, 1);
const yesterday = addDays(TODAY, -1);

describe('getNextActions', () => {
  it('AC-01 a mandatory essay due tomorrow comes first', () => {
    const app = makeApp({ closesOn: addDays(TODAY, 20) });
    const tasks = [
      makeTask({ id: 'a-optional', required: false, dueDate: tomorrow }),
      makeTask({ id: 'b-form', dueDate: addDays(TODAY, 5) }),
      makeTask({ id: 'c-essay', type: 'essay', essayPromptId: 'lk-impact', dueDate: tomorrow }),
    ];
    const { actions } = getNextActions([app], tasks, getScholarship, TODAY);
    expect(actions.map((a) => a.id)).toEqual(['task-c-essay', 'task-b-form', 'task-a-optional']);
    expect(actions[0]).toMatchObject({ tier: 1, bucket: 'within-48h', dueDate: tomorrow, cta: 'Finish essay', href: '/applications/app-1/essay/lk-impact' });
    expect(actions[0]!.reason).toBe('it is required for Lakeshore Global and it is due tomorrow');
  });

  it('AC-02 a completed task is removed from actions', () => {
    const app = makeApp();
    const tasks = [makeTask({ id: 'done', status: 'complete', dueDate: tomorrow }), makeTask({ id: 'open', dueDate: tomorrow })];
    const { actions } = getNextActions([app], tasks, getScholarship, TODAY);
    expect(actions.map((a) => a.id)).toEqual(['task-open']);
  });

  it('AC-03 a waiting task is not an action but appears in waiting', () => {
    const app = makeApp();
    const tasks = [makeTask({ id: 'rec', status: 'waiting', owner: 'recommender', type: 'recommendation', label: 'Recommendation' })];
    const plan = getNextActions([app], tasks, getScholarship, TODAY);
    expect(plan.actions).toEqual([]);
    expect(plan.waiting).toEqual([{ id: 'rec', applicationId: 'app-1', title: 'Recommendation', scholarshipTitle: 'Lakeshore Global', nextFollowUpOn: null }]);
  });

  it('AC-04 a follow-up becomes an action when nextFollowUpOn <= today', () => {
    const app = makeApp();
    for (const followUp of [TODAY, yesterday]) {
      const tasks = [makeTask({ id: 'rec', status: 'waiting', owner: 'recommender', label: 'Recommendation', nextFollowUpOn: followUp })];
      const plan = getNextActions([app], tasks, getScholarship, TODAY);
      expect(plan.waiting).toEqual([]);
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0]).toMatchObject({ id: 'follow-rec', kind: 'follow-up', tier: 3, title: 'Follow up: Recommendation' });
    }
  });

  it('AC-05 withdrawn and not-selected applications produce no actions or waiting items', () => {
    const apps = [makeApp({ id: 'w', status: 'withdrawn' }), makeApp({ id: 'n', status: 'not-selected' })];
    const tasks = [
      makeTask({ id: 'w1', applicationId: 'w', dueDate: tomorrow }),
      makeTask({ id: 'n1', applicationId: 'n', dueDate: tomorrow }),
      makeTask({ id: 'n2', applicationId: 'n', status: 'waiting', owner: 'recommender' }),
    ];
    expect(getNextActions(apps, tasks, getScholarship, TODAY)).toEqual({ actions: [], waiting: [] });
  });

  it('AC-06 equal urgency is ordered stably by id regardless of input order', () => {
    const app = makeApp();
    const t1 = makeTask({ id: 'zeta', dueDate: tomorrow });
    const t2 = makeTask({ id: 'alpha', dueDate: tomorrow });
    const t3 = makeTask({ id: 'mid', dueDate: tomorrow });
    const a = getNextActions([app], [t1, t2, t3], getScholarship, TODAY).actions.map((x) => x.id);
    const b = getNextActions([app], [t3, t1, t2], getScholarship, TODAY).actions.map((x) => x.id);
    expect(a).toEqual(['task-alpha', 'task-mid', 'task-zeta']);
    expect(b).toEqual(a);
  });

  it('AC-07 no deadline → bucket undated and not tier 1', () => {
    const app = makeApp({ closesOn: null });
    const { actions } = getNextActions([app], [makeTask({ id: 'x', dueDate: null })], getScholarship, TODAY);
    expect(actions[0]!.bucket).toBe('undated');
    expect(actions[0]!.dueDate).toBeNull();
    expect(actions[0]!.tier).not.toBe(1);
    expect(actions[0]!.tier).toBe(4);
  });

  it('AC-08 all tasks done → empty plan', () => {
    const app = makeApp();
    const tasks = [makeTask({ id: 'a', status: 'complete' }), makeTask({ id: 'b', status: 'complete', owner: 'recommender' })];
    expect(getNextActions([app], tasks, getScholarship, TODAY)).toEqual({ actions: [], waiting: [] });
  });

  it('AC-09 a task without dueDate inherits app closesOn within 24h → tier 1', () => {
    const app = makeApp({ closesOn: tomorrow });
    const { actions } = getNextActions([app], [makeTask({ id: 'x', dueDate: null })], getScholarship, TODAY);
    expect(actions[0]).toMatchObject({ dueDate: tomorrow, bucket: 'within-48h', tier: 1 });
    expect(actions[0]!.reason).toContain('(the application deadline)');
  });

  it('AC-10 lastFollowUpOn yesterday and nextFollowUpOn +5 → not actionable, stays waiting', () => {
    const app = makeApp();
    const next = addDays(TODAY, 5);
    const tasks = [makeTask({ id: 'rec', status: 'waiting', owner: 'recommender', lastFollowUpOn: yesterday, nextFollowUpOn: next })];
    const plan = getNextActions([app], tasks, getScholarship, TODAY);
    expect(plan.actions).toEqual([]);
    expect(plan.waiting.map((w) => [w.id, w.nextFollowUpOn])).toEqual([['rec', next]]);
  });

  it('AC-11 awarded with a pending offer and deadline → offer-response action; accepted removes it', () => {
    const deadline = addDays(TODAY, 4);
    const pending = makeApp({ status: 'awarded', offerResponseStatus: 'pending', offerResponseDeadlineOn: deadline });
    const plan = getNextActions([pending], [makeTask({ id: 'left-over', dueDate: tomorrow })], getScholarship, TODAY);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({ id: 'offer-app-1', kind: 'offer-response', dueDate: deadline, bucket: 'within-7d', tier: 2 });

    const accepted = { ...pending, offerResponseStatus: 'accepted' as const };
    expect(getNextActions([accepted], [], getScholarship, TODAY).actions).toEqual([]);
  });

  it('submitted applications hide student prep tasks', () => {
    const app = makeApp({ status: 'submitted' });
    expect(getNextActions([app], [makeTask({ dueDate: tomorrow })], getScholarship, TODAY).actions).toEqual([]);
  });

  it('bucketFor boundaries', () => {
    expect(bucketFor(TODAY, yesterday)).toBe('overdue');
    expect(bucketFor(TODAY, TODAY)).toBe('within-48h');
    expect(bucketFor(TODAY, addDays(TODAY, 2))).toBe('within-48h');
    expect(bucketFor(TODAY, addDays(TODAY, 3))).toBe('within-7d');
    expect(bucketFor(TODAY, addDays(TODAY, 7))).toBe('within-7d');
    expect(bucketFor(TODAY, addDays(TODAY, 8))).toBe('later');
    expect(bucketFor(TODAY, null)).toBe('undated');
    expect(bucketFor(TODAY, '2026-13-01')).toBe('undated');
  });
});
