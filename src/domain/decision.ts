import { evaluateEligibility } from './eligibility';
import { calculateFinancialImpact, type FinancialResult, type FundingScenario } from './financial';
import { formatMoney } from './eligibility';
import type { Application, FundingOption, Priority, Program, Scholarship, StudentProfile } from './types';

export interface OptionFacts {
  key: string;
  option: FundingOption;
  scholarship: Scholarship;
  program: Program;
  eligibility: ReturnType<typeof evaluateEligibility>['status'];
  financial: FinancialResult;
  effort: number;
  fit: number;
  clarity: number;
}

export interface DecisionResult {
  recommendedKey: string | null;
  priority: Priority;
  why: string;
  tradeoff: string;
  incompleteData: string[];
  recommendationStrength: 'explainable' | 'inconclusive';
  facts: OptionFacts[];
}

export const INCONCLUSIVE = 'There’s not enough reliable information to rank these on that priority.';

export function optionKey(o: FundingOption): string {
  return `${o.scholarshipId}::${o.programId}`;
}

/** Estimated checklist workload: required student tasks, essays, separate routes, recommenders. */
export function effortScore(s: Scholarship): number {
  const required = s.tasks.filter((t) => t.required).length;
  const route = s.applicationRoute === 'automatic-via-admission' ? 0 : s.applicationRoute === 'separate-external' ? 2 : 1;
  const recommender = s.tasks.some((t) => t.type === 'recommendation') ? 1 : 0;
  return required + s.essayPrompts.length + route + recommender;
}

export function fitScore(program: Program, profile: StudentProfile): number {
  let score = 0;
  if (profile.intendedField && program.field.toLowerCase() === profile.intendedField.toLowerCase()) score += 1;
  if (profile.targetProgramIds.includes(program.id)) score += 1;
  return score;
}

/** 3 = confirmed amount recorded; 2 = fully specified terms; 1 = conditional/unclear terms. */
export function clarityScore(s: Scholarship, app?: Application): number {
  if (app?.status === 'awarded' && app.awardConfirmedUsd !== null) return 3;
  const a = s.award;
  const periodic = a.period === 'per-year' || a.period === 'per-semester';
  const clear = a.amountUsd !== null && a.period !== 'unknown' && (!periodic || a.maximumPeriods !== null) && a.stackability !== 'unknown';
  return clear ? 2 : 1;
}

const PRIORITY_NOUN: Record<Priority, string> = {
  'lowest-cost': 'the lowest remaining cost',
  'least-effort': 'the least application work',
  'program-fit': 'the best program fit',
  'clearer-terms': 'the clearest funding terms',
};

function remainingOf(f: OptionFacts): number | null {
  return f.financial.kind === 'ok' ? f.financial.remaining : null;
}

export function buildFacts(
  options: FundingOption[],
  profile: StudentProfile,
  lookup: { scholarship: (id: string) => Scholarship | undefined; program: (id: string) => Program | undefined },
  scenario: FundingScenario,
  applications: Application[] = [],
): OptionFacts[] {
  const out: OptionFacts[] = [];
  for (const option of options) {
    const scholarship = lookup.scholarship(option.scholarshipId);
    const program = lookup.program(option.programId);
    if (!scholarship || !program) continue;
    const app = applications.find((a) => a.scholarshipId === option.scholarshipId && a.programId === option.programId);
    out.push({
      key: optionKey(option),
      option,
      scholarship,
      program,
      eligibility: evaluateEligibility(profile, scholarship).status,
      financial: calculateFinancialImpact({
        scholarship,
        program,
        budgetUsd: profile.fullProgramBudgetUsd,
        scenario,
        confirmedAwardUsd: app?.status === 'awarded' ? app.awardConfirmedUsd : null,
      }),
      effort: effortScore(scholarship),
      fit: fitScore(program, profile),
      clarity: clarityScore(scholarship, app),
    });
  }
  return out;
}

function label(f: OptionFacts): string {
  return `${f.scholarship.shortTitle} (${f.program.universityName.replace(/ \(fictional\)$/, '')})`;
}

function tradeoffFor(winner: OptionFacts, others: OptionFacts[], priority: Priority): string {
  const parts: string[] = [];
  for (const o of others) {
    if (priority !== 'least-effort' && o.effort < winner.effort) parts.push(`${label(o)} needs less application work`);
    if (priority !== 'program-fit' && o.fit > winner.fit) parts.push(`${label(o)} fits your program preferences better`);
    if (priority !== 'clearer-terms' && o.clarity > winner.clarity) parts.push(`${label(o)} has clearer funding terms`);
    if (priority !== 'lowest-cost') {
      const wr = remainingOf(winner);
      const or = remainingOf(o);
      if (wr !== null && or !== null && or < wr) parts.push(`${label(o)} would leave ${formatMoney(wr - or)} less to pay if awarded`);
    }
    if (winner.financial.kind === 'ok' && o.financial.kind === 'ok' && o.financial.nominalAward > winner.financial.nominalAward) {
      parts.push(`${label(o)} offers a larger headline award`);
    }
  }
  if (winner.scholarship.award.stackability !== 'yes') parts.push('this award may not combine with other funding');
  if (winner.financial.kind === 'ok' && winner.financial.scenario === 'potential') parts.push('the award is potential, not confirmed');
  const unique = Array.from(new Set(parts));
  return unique.length ? `${capitalize(unique.slice(0, 2).join('; '))}.` : 'No clear downside on the information we have.';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function compareOptions(facts: OptionFacts[], priority: Priority): DecisionResult {
  const incomplete: string[] = [];
  for (const f of facts) {
    if (f.financial.kind === 'insufficient') incomplete.push(`${label(f)}: ${f.financial.missing.join(', ')} unknown`);
    if (f.financial.kind === 'not-applicable') incomplete.push(f.financial.reason);
  }

  const inconclusive = (why = INCONCLUSIVE): DecisionResult => ({
    recommendedKey: null,
    priority,
    why,
    tradeoff: 'Add missing details or try another priority to see a clearer comparison.',
    incompleteData: incomplete,
    recommendationStrength: 'inconclusive',
    facts,
  });

  if (facts.length < 2) return inconclusive('Select at least two opportunities to compare.');

  const ineligible = facts.filter((f) => f.eligibility === 'not-eligible');
  const viable = facts.filter((f) => f.eligibility !== 'not-eligible');
  if (viable.length === 0) return inconclusive('None of these options meets the required conditions on your profile.');

  let metric: (f: OptionFacts) => number | null;
  let better: 'lower' | 'higher';
  switch (priority) {
    case 'lowest-cost':
      metric = remainingOf;
      better = 'lower';
      break;
    case 'least-effort':
      metric = (f) => f.effort;
      better = 'lower';
      break;
    case 'program-fit':
      metric = (f) => f.fit;
      better = 'higher';
      break;
    case 'clearer-terms':
      metric = (f) => f.clarity;
      better = 'higher';
      break;
  }

  const scored = viable.map((f) => ({ f, v: metric(f) }));
  if (scored.some((s) => s.v === null)) return inconclusive();
  const values = scored.map((s) => s.v as number);
  const bestValue = better === 'lower' ? Math.min(...values) : Math.max(...values);
  const winners = scored.filter((s) => s.v === bestValue);
  if (viable.length >= 2 && winners.length > 1) return inconclusive('These options are tied on that priority, so we won’t pick a winner.');
  if (priority === 'clearer-terms' && bestValue <= 1) return inconclusive();
  if (priority === 'program-fit' && bestValue === 0) return inconclusive();

  const winner = winners[0]!.f;
  const others = facts.filter((f) => f.key !== winner.key);
  const runnerUp = scored.filter((s) => s.f.key !== winner.key).sort((a, b) => (better === 'lower' ? (a.v as number) - (b.v as number) : (b.v as number) - (a.v as number)))[0];

  let why: string;
  if (!runnerUp) {
    why = `${label(winner)} is the only option here that you aren’t ruled out of.`;
  } else if (priority === 'lowest-cost') {
    const diff = (runnerUp.v as number) - (winner.financial.kind === 'ok' ? winner.financial.remaining : 0);
    why = `If awarded, ${label(winner)} leaves ${formatMoney(remainingOf(winner) ?? 0)} to pay over the full program — ${formatMoney(diff)} less than ${label(runnerUp.f)}.`;
  } else if (priority === 'least-effort') {
    why = `${label(winner)} needs about ${winner.effort} checklist steps versus ${runnerUp.v} for ${label(runnerUp.f)}${winner.scholarship.applicationRoute === 'automatic-via-admission' ? ', and it’s considered automatically with your admission' : ''}.`;
  } else if (priority === 'program-fit') {
    why = `${winner.program.title} at ${winner.program.universityName.replace(/ \(fictional\)$/, '')} matches ${winner.fit === 2 ? 'both your subject and your target program list' : 'your subject'}, more closely than ${label(runnerUp.f)}.`;
  } else {
    why = winner.clarity === 3
      ? `You recorded a confirmed award for ${label(winner)}, which is more certain than potential funding.`
      : `${label(winner)} states its amount, duration and combination rules; ${label(runnerUp.f)} leaves some of these unclear.`;
  }
  if (ineligible.length) why += ` ${ineligible.map(label).join(', ')} ${ineligible.length === 1 ? 'is' : 'are'} not recommended because a required condition isn’t met.`;

  return {
    recommendedKey: winner.key,
    priority,
    why,
    tradeoff: tradeoffFor(winner, others.filter((o) => o.eligibility !== 'not-eligible'), priority),
    incompleteData: incomplete,
    recommendationStrength: 'explainable',
    facts,
  };
}

export { PRIORITY_NOUN };
