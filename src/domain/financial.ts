import type { Award, CostCategory, Program, Scholarship } from './types';

export type FundingScenario = 'no-award' | 'potential' | 'confirmed';

export type FinancialResult =
  | {
      kind: 'ok';
      scenario: FundingScenario;
      fullProgramCost: number;
      nominalAward: number;
      appliedAward: number;
      remaining: number;
      budgetGap: number | null;
    }
  | { kind: 'insufficient'; scenario: FundingScenario; fullProgramCost: number | null; missing: string[] }
  | { kind: 'not-applicable'; scenario: FundingScenario; reason: string };

const COST_FIELD: Record<CostCategory, keyof Program> = {
  tuition: 'tuitionTotalUsd',
  fees: 'mandatoryFeesTotalUsd',
  living: 'livingTotalUsd',
};

const COST_LABEL: Record<CostCategory, string> = {
  tuition: 'tuition',
  fees: 'mandatory fees',
  living: 'living costs',
};

function cost(program: Program, cat: CostCategory): number | null {
  const v = program[COST_FIELD[cat]];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Full-program cost, or the list of missing cost fields. */
export function fullProgramCost(program: Program): { total: number | null; missing: string[] } {
  const cats: CostCategory[] = ['tuition', 'fees', 'living'];
  const missing = cats.filter((c) => cost(program, c) === null).map((c) => `Program ${COST_LABEL[c]}`);
  if (missing.length) return { total: null, missing };
  return { total: cats.reduce((sum, c) => sum + (cost(program, c) ?? 0), 0), missing };
}

/**
 * Award value over the full program. Periodic awards are only multiplied by
 * documented maximum periods (capped by program length), never by assumption.
 */
export function normalizeAward(award: Award, program: Program): { amount: number | null; missing: string[] } {
  if (award.amountUsd === null || !Number.isFinite(award.amountUsd) || award.amountUsd < 0) {
    return { amount: null, missing: ['Award amount'] };
  }
  switch (award.period) {
    case 'one-time':
      return { amount: award.amountUsd, missing: [] };
    case 'per-year':
    case 'per-semester': {
      if (award.maximumPeriods === null) return { amount: null, missing: ['Award renewal terms'] };
      const monthsPerPeriod = award.period === 'per-year' ? 12 : 6;
      const programPeriods = Math.ceil(program.durationMonths / monthsPerPeriod);
      return { amount: award.amountUsd * Math.min(award.maximumPeriods, programPeriods), missing: [] };
    }
    default:
      return { amount: null, missing: ['Award period'] };
  }
}

export interface FinancialInput {
  scholarship: Scholarship;
  program: Program;
  budgetUsd: number | null;
  scenario: FundingScenario;
  /** Student-recorded awarded amount; used only in the confirmed scenario. */
  confirmedAwardUsd?: number | null;
}

export function calculateFinancialImpact(input: FinancialInput): FinancialResult {
  const { scholarship, program, budgetUsd, scenario } = input;
  if (!scholarship.programIds.includes(program.id)) {
    return { kind: 'not-applicable', scenario, reason: `${scholarship.shortTitle} can’t be used for ${program.title} at ${program.universityName}.` };
  }

  const total = fullProgramCost(program);
  const gap = (remaining: number) =>
    budgetUsd === null || !Number.isFinite(budgetUsd) || budgetUsd < 0 ? null : Math.max(0, remaining - budgetUsd);

  if (scenario === 'no-award') {
    if (total.total === null) return { kind: 'insufficient', scenario, fullProgramCost: null, missing: total.missing };
    return { kind: 'ok', scenario, fullProgramCost: total.total, nominalAward: 0, appliedAward: 0, remaining: total.total, budgetGap: gap(total.total) };
  }

  const missing = [...total.missing];
  let nominal: number | null;
  if (scenario === 'confirmed') {
    nominal = input.confirmedAwardUsd ?? 0;
  } else {
    const n = normalizeAward(scholarship.award, program);
    nominal = n.amount;
    missing.push(...n.missing);
  }

  // Only explicitly covered categories can absorb the award.
  const coveredMissing = scholarship.award.coveredCategories
    .filter((c) => cost(program, c) === null)
    .map((c) => `Program ${COST_LABEL[c]}`);
  for (const m of coveredMissing) if (!missing.includes(m)) missing.push(m);

  if (missing.length || total.total === null || nominal === null) {
    return { kind: 'insufficient', scenario, fullProgramCost: total.total, missing };
  }

  const coveredCosts = scholarship.award.coveredCategories.reduce((sum, c) => sum + (cost(program, c) ?? 0), 0);
  const applied = Math.min(nominal, coveredCosts);
  const remaining = Math.max(0, total.total - applied);
  return { kind: 'ok', scenario, fullProgramCost: total.total, nominalAward: nominal, appliedAward: applied, remaining, budgetGap: gap(remaining) };
}

/**
 * Combine several awards on ONE program. Awards are only summed when every
 * one is explicitly stackable; otherwise they are treated as alternatives.
 */
export function combineAwards(results: { stackability: Award['stackability']; applied: number }[]): {
  stacked: boolean;
  total: number;
  reason: string;
} {
  if (results.length === 0) return { stacked: false, total: 0, reason: 'No awards selected.' };
  if (results.every((r) => r.stackability === 'yes')) {
    return { stacked: true, total: results.reduce((s, r) => s + r.applied, 0), reason: 'All selected awards say they can be combined.' };
  }
  const best = Math.max(...results.map((r) => r.applied));
  return { stacked: false, total: best, reason: 'At least one award doesn’t confirm it can be combined, so we treat them as alternatives.' };
}
