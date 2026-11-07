import { beforeEach, describe, expect, it } from 'vitest';
import { getProgram, getScholarship } from '@/data/demo-catalog';
import { bucketFor, getNextActions } from '@/domain/action-priority';
import { allowedTransitions, canTransition, displayStatus, isClosed, progress, STATUS_LABEL } from '@/domain/application-state';
import { buildFacts, clarityScore, compareOptions, effortScore, fitScore, INCONCLUSIVE } from '@/domain/decision';
import { evaluateEligibility, evaluateRequirement, formatMoney } from '@/domain/eligibility';
import { calculateFinancialImpact, combineAwards, fullProgramCost, normalizeAward } from '@/domain/financial';
import {
  applicationId,
  deadlineFor,
  emptyState,
  MAX_COMPARE,
  NotFoundError,
  removeApplication,
  removeStory,
  saveEssay,
  saveProfile,
  saveStory,
  seedDemo,
  setBookmark,
  setCompare,
  startApplication,
  updateApplication,
  updateTask,
} from '@/repository/journey-core';
import { __resetCache, commit, parseStored, STORAGE_KEY, StorageError, wasRecovered } from '@/repository/local-store';
import { demoProfile } from '@/data/demo-profile';
import { makeApp, makeProfile, makeProgram, makeRequirement, makeScholarship, makeTask, NOW, TODAY } from '../fixtures';

const lookup = { scholarship: getScholarship, program: getProgram };
const A = { scholarshipId: 'northfield-excellence', programId: 'prog-northfield-mscs' };
const B = { scholarshipId: 'lakeshore-global', programId: 'prog-lakeshore-mscs' };

describe('Audit 3.1 — confirmed-award handling', () => {
  const s = makeScholarship({ award: { amountUsd: 30_000, period: 'one-time', coveredCategories: ['tuition'], maximumPeriods: 1, stackability: 'no' } });
  const p = makeProgram();

  it('no award recorded → $0 confirmed funding, flagged none-recorded (not a confirmed $0 award)', () => {
    const r = calculateFinancialImpact({ scholarship: s, program: p, budgetUsd: 50_000, scenario: 'confirmed' });
    expect(r).toMatchObject({ kind: 'ok', appliedAward: 0, remaining: 90_000, budgetGap: 40_000, confirmedSource: 'none-recorded' });
  });

  it('award recorded with unknown amount → insufficient, never assumed $0', () => {
    const r = calculateFinancialImpact({ scholarship: s, program: p, budgetUsd: 50_000, scenario: 'confirmed', awardRecorded: true, confirmedAwardUsd: null });
    expect(r.kind).toBe('insufficient');
    if (r.kind === 'insufficient') expect(r.missing).toContain('Awarded amount (add it on the application)');
  });

  it('recorded award of exactly $0 is a real recorded value', () => {
    const r = calculateFinancialImpact({ scholarship: s, program: p, budgetUsd: null, scenario: 'confirmed', awardRecorded: true, confirmedAwardUsd: 0 });
    expect(r).toMatchObject({ kind: 'ok', appliedAward: 0, remaining: 90_000, confirmedSource: 'recorded', budgetGap: null });
  });

  it('recorded positive award is capped by covered categories', () => {
    const r = calculateFinancialImpact({ scholarship: s, program: p, budgetUsd: null, scenario: 'confirmed', awardRecorded: true, confirmedAwardUsd: 70_000 });
    expect(r).toMatchObject({ kind: 'ok', nominalAward: 70_000, appliedAward: 60_000, remaining: 30_000, confirmedSource: 'recorded' });
  });

  it('negative or NaN recorded amounts are rejected as insufficient', () => {
    for (const bad of [-5, Number.NaN]) {
      const r = calculateFinancialImpact({ scholarship: s, program: p, budgetUsd: null, scenario: 'confirmed', confirmedAwardUsd: bad });
      expect(r.kind).toBe('insufficient');
    }
  });

  it('missing program cost with confirmed scenario → insufficient listing costs', () => {
    const r = calculateFinancialImpact({ scholarship: s, program: makeProgram({ livingTotalUsd: null }), budgetUsd: null, scenario: 'confirmed', confirmedAwardUsd: 5_000 });
    expect(r).toMatchObject({ kind: 'insufficient', fullProgramCost: null });
  });

  it('no-award scenario: full cost and gap; insufficient when costs unknown', () => {
    expect(calculateFinancialImpact({ scholarship: s, program: p, budgetUsd: 100_000, scenario: 'no-award' })).toMatchObject({ kind: 'ok', remaining: 90_000, budgetGap: 0 });
    expect(calculateFinancialImpact({ scholarship: s, program: makeProgram({ tuitionTotalUsd: null }), budgetUsd: 1, scenario: 'no-award' }).kind).toBe('insufficient');
  });

  it('negative budget is treated as no budget (no gap)', () => {
    const r = calculateFinancialImpact({ scholarship: s, program: p, budgetUsd: -1, scenario: 'potential' });
    expect(r).toMatchObject({ kind: 'ok', budgetGap: null });
  });

  it('decision facts: an awarded app without amount makes the confirmed option insufficient', () => {
    const app = makeApp({ ...A, id: applicationId(A.scholarshipId, A.programId), status: 'awarded', awardConfirmedUsd: null });
    const facts = buildFacts([A, B], makeProfile(), lookup, 'confirmed', [app]);
    expect(facts[0]!.financial.kind).toBe('insufficient');
    expect(facts[1]!.financial).toMatchObject({ kind: 'ok', confirmedSource: 'none-recorded', remaining: 70_000 });
    expect(compareOptions(facts, 'lowest-cost').recommendationStrength).toBe('inconclusive');
  });

  it('decision: confirmed scenario wording does not say "If awarded"', () => {
    const app = makeApp({ ...A, id: applicationId(A.scholarshipId, A.programId), status: 'awarded', awardConfirmedUsd: 30_000 });
    const r = compareOptions(buildFacts([A, B], makeProfile(), lookup, 'confirmed', [app]), 'lowest-cost');
    expect(r.recommendedKey).toBe('northfield-excellence::prog-northfield-mscs');
    expect(r.why.startsWith('Based on confirmed funding, Northfield Excellence')).toBe(true);
    expect(r.why).toContain('$60,000');
  });
});

describe('Audit 3.3 — essay readiness stays consistent with the checklist', () => {
  const appId = applicationId('lakeshore-global', 'prog-lakeshore-mscs');
  const base = () => startApplication(saveProfile(emptyState(), demoProfile, NOW), 'lakeshore-global', 'prog-lakeshore-mscs', NOW).state;
  const input = (body: string, ready: boolean) => ({
    applicationId: appId,
    promptId: 'lk-impact',
    body,
    outline: { situation: '', action: '', result: '', connection: '' },
    selectedStoryIds: [],
    userMarkedReady: ready,
  });
  const essayTask = (st: ReturnType<typeof base>) => st.tasks.find((t) => t.essayPromptId === 'lk-impact')!;

  it('marking ready completes the essay task atomically', () => {
    const { state, draft } = saveEssay(base(), input('My real story.', true), 0, NOW);
    expect(draft.userMarkedReady).toBe(true);
    expect(essayTask(state).status).toBe('complete');
  });

  it('cannot mark an empty draft ready', () => {
    const { state, draft } = saveEssay(base(), input('   ', true), 0, NOW);
    expect(draft.userMarkedReady).toBe(false);
    expect(essayTask(state).status).toBe('todo');
  });

  it('editing a ready draft over the limit reopens it and the task', () => {
    let st = saveEssay(base(), input('Short and ready.', true), 0, NOW).state;
    const r = saveEssay(st, input(Array.from({ length: 251 }, () => 'w').join(' '), true), 1, NOW);
    st = r.state;
    expect(r.draft.userMarkedReady).toBe(false);
    expect(essayTask(st).status).toBe('todo');
    const plan = getNextActions(st.applications, st.tasks, getScholarship, TODAY);
    expect(plan.actions.some((a) => a.taskId === essayTask(st).id)).toBe(true);
  });

  it('unknown application or prompt is rejected', () => {
    expect(() => saveEssay(emptyState(), input('x', false), 0, NOW)).toThrow(NotFoundError);
    expect(() => saveEssay(base(), { ...input('x', false), promptId: 'nope' }, 0, NOW)).toThrow(NotFoundError);
  });
});

describe('Repository operations', () => {
  it('bookmarks are idempotent and validated', () => {
    let s = setBookmark(emptyState(), 'civic-scholars', true);
    s = setBookmark(s, 'civic-scholars', true);
    expect(s.bookmarks).toEqual(['civic-scholars']);
    expect(setBookmark(s, 'civic-scholars', false).bookmarks).toEqual([]);
    expect(() => setBookmark(s, 'nope', true)).toThrow(NotFoundError);
  });

  it('compare enforces valid pairing, no duplicates, max 3', () => {
    let s = emptyState();
    s = setCompare(s, A, true);
    s = setCompare(s, A, true);
    expect(s.compare).toHaveLength(1);
    s = setCompare(s, B, true);
    s = setCompare(s, { scholarshipId: 'meridian-need', programId: 'prog-lakeshore-mscs' }, true);
    const full = setCompare(s, { scholarshipId: 'meridian-need', programId: 'prog-northfield-mscs' }, true);
    expect(full.compare).toHaveLength(MAX_COMPARE);
    expect(setCompare(s, A, false).compare).toHaveLength(2);
    expect(() => setCompare(s, { scholarshipId: 'lakeshore-global', programId: 'prog-northfield-mscs' }, true)).toThrow(NotFoundError);
  });

  it('start application rejects an invalid pairing and computes the deadline once', () => {
    expect(() => startApplication(emptyState(), 'lakeshore-global', 'prog-cascade-msds', NOW)).toThrow(NotFoundError);
    expect(deadlineFor('lakeshore-global', NOW.toISOString())).toBe('2026-11-09');
    expect(deadlineFor('cascade-assistantship', NOW.toISOString())).toBeNull();
    expect(deadlineFor('nope', NOW.toISOString())).toBeNull();
  });

  it('third-party tasks start as waiting; student tasks as todo', () => {
    const { state } = startApplication(emptyState(), 'meridian-need', 'prog-lakeshore-mscs', NOW);
    expect(state.tasks.find((t) => t.key === 'recommendation')?.status).toBe('waiting');
    expect(state.tasks.find((t) => t.key === 'essay')?.status).toBe('todo');
  });

  it('award recording: amount requires awarded status; response requires awarded; accepted clears action', () => {
    let s = seedDemo(NOW);
    const id = applicationId('summit-leadership', 'prog-northfield-mscs');
    expect(() => updateApplication(s, id, { awardConfirmedUsd: 100 }, NOW)).toThrow('Record an award');
    expect(() => updateApplication(s, id, { offerResponseStatus: 'accepted' }, NOW)).toThrow('only respond');
    s = updateApplication(s, id, { status: 'awarded' }, NOW);
    expect(() => updateApplication(s, id, { awardConfirmedUsd: -1 }, NOW)).toThrow('valid award amount');
    s = updateApplication(s, id, { awardConfirmedUsd: 10_000, offerResponseDeadlineOn: '2026-11-08' }, NOW);
    let plan = getNextActions(s.applications, s.tasks, getScholarship, TODAY);
    // Tier 1 (essay due within 48h) correctly outranks the tier-2 offer response.
    expect(plan.actions[0]).toMatchObject({ kind: 'task', tier: 1 });
    expect(plan.actions.find((a) => a.kind === 'offer-response')).toMatchObject({ tier: 2, dueDate: '2026-11-08' });
    s = updateApplication(s, id, { offerResponseStatus: 'accepted' }, NOW);
    plan = getNextActions(s.applications, s.tasks, getScholarship, TODAY);
    expect(plan.actions.some((a) => a.kind === 'offer-response')).toBe(false);
    expect(() => updateApplication(s, 'missing', {}, NOW)).toThrow(NotFoundError);
  });

  it('remove application deletes its tasks and drafts but keeps bookmarks', () => {
    const s = seedDemo(NOW);
    const id = applicationId('lakeshore-global', 'prog-lakeshore-mscs');
    const r = removeApplication(s, id);
    expect(r.applications.some((a) => a.id === id)).toBe(false);
    expect(r.tasks.some((t) => t.applicationId === id)).toBe(false);
    expect(r.bookmarks).toContain('lakeshore-global');
  });

  it('stories: create, edit, delete also unlinks from drafts; invalid story rejected', () => {
    let s = seedDemo(NOW);
    s = saveStory(s, { ...s.stories[0]!, title: 'Edited' });
    expect(s.stories[0]!.title).toBe('Edited');
    s = { ...s, essays: [{ id: 'e', applicationId: 'x', promptId: 'p', selectedStoryIds: ['story-demo-1'], outline: { situation: '', action: '', result: '', connection: '' }, body: '', userMarkedReady: false, revision: 1, updatedAt: '' }] };
    s = removeStory(s, 'story-demo-1');
    expect(s.stories).toHaveLength(0);
    expect(s.essays[0]!.selectedStoryIds).toEqual([]);
    expect(() => saveStory(s, { id: 'bad id!', title: '', situation: '', action: '', result: '', reflection: '', tags: [] })).toThrow();
    expect(() => updateTask(s, 'missing', { status: 'complete' })).toThrow(NotFoundError);
  });

  it('profile save drops unknown program IDs and rejects hostile input', () => {
    const s = saveProfile(emptyState(), { ...demoProfile, targetProgramIds: ['prog-lakeshore-mscs', 'not-a-program'] }, NOW);
    expect(s.profile?.targetProgramIds).toEqual(['prog-lakeshore-mscs']);
    expect(() => saveProfile(emptyState(), { ...demoProfile, displayName: 'x'.repeat(61) }, NOW)).toThrow();
    expect(() => saveProfile(emptyState(), { ...demoProfile, relevantExperienceMonths: -1 }, NOW)).toThrow();
    expect(() => saveProfile(emptyState(), { ...demoProfile, academicMetric: { kind: 'percentage', value: 101 } }, NOW)).toThrow();
  });
});

describe('Local store adapter', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetCache();
  });

  it('commit persists validated state and storage failure throws StorageError without changing memory', () => {
    commit(() => seedDemo(NOW));
    expect(parseStored(localStorage.getItem(STORAGE_KEY)).state.profile?.displayName).toBe('Aisha');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    try {
      expect(() => commit((s) => setBookmark(s, 'civic-scholars', true))).toThrow(StorageError);
    } finally {
      Storage.prototype.setItem = original;
    }
    expect(parseStored(localStorage.getItem(STORAGE_KEY)).state.bookmarks).not.toContain('civic-scholars');
  });

  it('commit returns a result payload', () => {
    const app = commit((s) => {
      const r = startApplication(saveProfile(s, demoProfile, NOW), 'lakeshore-global', 'prog-lakeshore-mscs', NOW);
      return { state: r.state, result: r.application };
    });
    expect(app?.id).toBe('lakeshore-global__prog-lakeshore-mscs');
  });

  it('corrupted storage is reported as recovered and reset to empty', () => {
    localStorage.setItem(STORAGE_KEY, '{"version":1,"profile":{"userId":"<script>"}}');
    commit((s) => s);
    expect(wasRecovered()).toBe(true);
    expect(parseStored('{"version":2}').recovered).toBe(true);
    expect(parseStored(JSON.stringify({ ...emptyState(), bookmarks: ['javascript:alert(1)'] })).recovered).toBe(true);
  });
});

describe('Eligibility edge branches', () => {
  const p = makeProfile();
  it('nationality missing → unknown; field missing → unknown with missingField', () => {
    expect(evaluateRequirement(makeProfile({ nationality: ' ' }), makeRequirement()).result).toBe('unknown');
    const r = evaluateRequirement(makeProfile({ intendedField: '' }), makeRequirement({ kind: 'field', expectedValue: ['Computer Science'] }));
    expect(r).toMatchObject({ result: 'unknown', missingField: 'intendedField' });
  });
  it('field mismatch fails; qualification mismatch fails', () => {
    expect(evaluateRequirement(p, makeRequirement({ kind: 'field', expectedValue: ['Biology'] })).result).toBe('fail');
    expect(evaluateRequirement(p, makeRequirement({ kind: 'qualification', expectedValue: ['bachelors-complete'] })).result).toBe('fail');
  });
  it('gpa-4 scale pass and fail; other scale unknown; equals operator', () => {
    const gpa = makeProfile({ academicMetric: { kind: 'gpa-4', value: 3.5 } });
    const req = makeRequirement({ kind: 'academic-min', operator: 'gte', expectedValue: 3.5, metricScale: 'gpa-4' });
    expect(evaluateRequirement(gpa, req).result).toBe('pass');
    expect(evaluateRequirement(makeProfile({ academicMetric: { kind: 'gpa-4', value: 3.49 } }), req).result).toBe('fail');
    expect(evaluateRequirement(makeProfile({ academicMetric: { kind: 'other', description: '8.6/10 CGPA' } }), req)).toMatchObject({ result: 'unknown', studentValue: '8.6/10 CGPA' });
    expect(evaluateRequirement(makeProfile({ relevantExperienceMonths: 12 }), makeRequirement({ kind: 'experience-min-months', operator: 'equals', expectedValue: 12 })).result).toBe('pass');
  });
  it('unsupported kinds and operators are not passed', () => {
    expect(evaluateRequirement(p, makeRequirement({ kind: 'document', operator: 'present', expectedValue: null })).result).toBe('unknown');
    expect(evaluateRequirement(p, makeRequirement({ kind: 'experience-min-months', operator: 'in', expectedValue: 0 })).result).toBe('fail');
  });
  it('optional requirement failure does not gate eligibility', () => {
    const s = makeScholarship({ requirements: [makeRequirement({ id: 'm' }), makeRequirement({ id: 'o', mandatory: false, expectedValue: ['Kenya'] })] });
    expect(evaluateEligibility(p, s).status).toBe('eligible');
  });
  it('formats INR with Indian grouping', () => {
    expect(formatMoney(1_500_000, 'INR')).toBe('₹15,00,000');
  });
});

describe('Decision and action edge branches', () => {
  it('effort, fit and clarity scoring', () => {
    expect(effortScore(getScholarship('northfield-excellence')!)).toBe(2);
    expect(effortScore(getScholarship('meridian-need')!)).toBe(3 + 1 + 2 + 1);
    expect(fitScore(getProgram('prog-cascade-msds')!, makeProfile())).toBe(0);
    expect(clarityScore(getScholarship('summit-leadership')!)).toBe(1);
    expect(clarityScore(getScholarship('northfield-excellence')!)).toBe(2);
  });
  it('program-fit with a shortlisted winner explains the match', () => {
    const facts = buildFacts([A, { scholarshipId: 'horizon-gpa', programId: 'prog-cascade-msds' }], makeProfile(), lookup, 'potential');
    const r = compareOptions(facts, 'program-fit');
    expect(r.recommendedKey).toBe('northfield-excellence::prog-northfield-mscs');
    expect(r.why).toContain('both your subject and your target program list');
  });
  it('single viable option among ineligible ones is explained as the only one', () => {
    const facts = buildFacts([B, { scholarshipId: 'civic-scholars', programId: 'prog-lakeshore-mscs' }], makeProfile(), lookup, 'potential');
    const r = compareOptions(facts, 'least-effort');
    expect(r.why).toContain('the only option here');
    expect(r.why).toContain('not recommended');
  });
  it('all ineligible → inconclusive', () => {
    const facts = buildFacts([{ scholarshipId: 'civic-scholars', programId: 'prog-lakeshore-mscs' }, { scholarshipId: 'aurora-research', programId: 'prog-northfield-mscs' }], makeProfile(), lookup, 'potential');
    expect(compareOptions(facts, 'lowest-cost').why).toContain('None of these options');
    expect(INCONCLUSIVE).toContain('not enough reliable information');
  });
  it('action CTA per task type and bucket boundaries', () => {
    const app = makeApp({ closesOn: '2026-11-20' });
    const types = ['essay', 'document', 'recommendation', 'review', 'form'] as const;
    const tasks = types.map((type, i) => makeTask({ id: `t${i}`, type, essayPromptId: type === 'essay' ? 'lk-impact' : null }));
    const plan = getNextActions([app], tasks, getScholarship, TODAY);
    expect(plan.actions.map((a) => a.cta).sort()).toEqual(['Check recommendation', 'Complete step', 'Finish essay', 'Prepare document', 'Review application']);
    expect(plan.actions.find((a) => a.cta === 'Finish essay')?.href).toBe('/applications/app-1/essay/lk-impact');
    expect(bucketFor(TODAY, '2026-11-07')).toBe('within-48h');
    expect(bucketFor(TODAY, '2026-11-14')).toBe('within-7d');
    expect(bucketFor(TODAY, 'not-a-date')).toBe('undated');
  });
  it('overdue mandatory work is tier 1 with a warning; due-today phrasing', () => {
    const plan = getNextActions([makeApp({ closesOn: '2026-11-05' })], [makeTask()], getScholarship, TODAY);
    expect(plan.actions[0]).toMatchObject({ tier: 1, bucket: 'overdue', warning: 'Deadline may be missed' });
    expect(plan.actions[0]!.reason).toContain('passed 2 days ago');
    const today = getNextActions([makeApp({ closesOn: TODAY })], [makeTask()], getScholarship, TODAY);
    expect(today.actions[0]!.reason).toContain('due today');
  });
  it('unknown scholarship is skipped; awarded with no deadline is tier 4', () => {
    expect(getNextActions([makeApp({ scholarshipId: 'gone' })], [makeTask()], getScholarship, TODAY).actions).toEqual([]);
    const plan = getNextActions([makeApp({ status: 'awarded', offerResponseStatus: 'pending' })], [], getScholarship, TODAY);
    expect(plan.actions[0]).toMatchObject({ kind: 'offer-response', tier: 4, dueDate: null });
  });
  it('state machine helpers', () => {
    expect(allowedTransitions('awarded')).toEqual([]);
    expect(canTransition('waiting', 'action-required')).toBe(true);
    expect(isClosed('withdrawn')).toBe(true);
    expect(isClosed('submitted')).toBe(false);
    expect(progress([])).toEqual({ completed: 0, total: 0, percent: 100 });
    expect(displayStatus(makeApp(), [])).toBe('preparing');
    expect(STATUS_LABEL.ready).toBe('Ready to submit');
  });
  it('helpers: normalizeAward per-semester, fullProgramCost, combineAwards empty', () => {
    expect(normalizeAward({ amountUsd: 5_000, period: 'per-semester', coveredCategories: ['tuition'], maximumPeriods: 10, stackability: 'no' }, makeProgram({ durationMonths: 24 })).amount).toBe(20_000);
    expect(fullProgramCost(makeProgram()).total).toBe(90_000);
    expect(combineAwards([]).total).toBe(0);
  });
  it('clearer-terms: a recorded confirmed award wins with an explicit reason', () => {
    const app = makeApp({ ...B, id: applicationId(B.scholarshipId, B.programId), status: 'awarded', awardConfirmedUsd: 20_000 });
    const r = compareOptions(buildFacts([A, B], makeProfile(), lookup, 'potential', [app]), 'clearer-terms');
    expect(r.recommendedKey).toBe('lakeshore-global::prog-lakeshore-mscs');
    expect(r.why).toContain('You recorded a confirmed award');
    expect(r.tradeoff.length).toBeGreaterThan(0);
  });
  it('clearer-terms: clear vs unclear terms explains which terms are stated', () => {
    const r = compareOptions(buildFacts([A, { scholarshipId: 'summit-leadership', programId: 'prog-northfield-mscs' }], makeProfile(), lookup, 'potential'), 'clearer-terms');
    expect(r.recommendedKey).toBe('northfield-excellence::prog-northfield-mscs');
    expect(r.why).toContain('states its amount, duration and combination rules');
  });
  it('program-fit with no field match anywhere is inconclusive', () => {
    const facts = buildFacts([{ scholarshipId: 'horizon-gpa', programId: 'prog-cascade-msds' }, { scholarshipId: 'cascade-assistantship', programId: 'prog-cascade-msds' }], makeProfile(), lookup, 'potential');
    expect(compareOptions(facts, 'program-fit').recommendationStrength).toBe('inconclusive');
  });
  it('fewer than two options asks for more', () => {
    expect(compareOptions(buildFacts([A], makeProfile(), lookup, 'potential'), 'lowest-cost').why).toBe('Select at least two opportunities to compare.');
  });
  it('unknown catalog IDs are skipped when building facts', () => {
    expect(buildFacts([{ scholarshipId: 'x', programId: 'y' }], makeProfile(), lookup, 'potential')).toEqual([]);
  });
});
