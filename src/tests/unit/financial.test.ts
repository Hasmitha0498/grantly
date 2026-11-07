import { describe, expect, it } from 'vitest';
import { getProgram, getScholarship } from '@/data/demo-catalog';
import { calculateFinancialImpact, combineAwards, fullProgramCost, normalizeAward } from '@/domain/financial';
import type { Program, Scholarship } from '@/domain/types';
import { makeProgram, makeScholarship } from '../fixtures';

const sch = (id: string): Scholarship => getScholarship(id)!;
const prog = (id: string): Program => getProgram(id)!;

const programA = makeProgram({ id: 'prog-a', tuitionTotalUsd: 60_000, mandatoryFeesTotalUsd: 6_000, livingTotalUsd: 24_000 });
const programB = makeProgram({ id: 'prog-b', durationMonths: 18, tuitionTotalUsd: 44_000, mandatoryFeesTotalUsd: 4_000, livingTotalUsd: 22_000 });
const awardA = makeScholarship({
  id: 'award-a',
  programIds: ['prog-a'],
  award: { amountUsd: 30_000, period: 'one-time', coveredCategories: ['tuition'], maximumPeriods: 1, stackability: 'no' },
});
const awardB = makeScholarship({
  id: 'award-b',
  programIds: ['prog-b'],
  award: { amountUsd: 20_000, period: 'one-time', coveredCategories: ['tuition'], maximumPeriods: 1, stackability: 'no' },
});

describe('calculateFinancialImpact', () => {
  it('FN-01 Program A $90k with $30k one-time tuition award → remaining 60000', () => {
    expect(fullProgramCost(programA)).toEqual({ total: 90_000, missing: [] });
    const r = calculateFinancialImpact({ scholarship: awardA, program: programA, budgetUsd: null, scenario: 'potential' });
    expect(r).toEqual({
      kind: 'ok',
      scenario: 'potential',
      fullProgramCost: 90_000,
      nominalAward: 30_000,
      appliedAward: 30_000,
      remaining: 60_000,
      budgetGap: null,
    });
  });

  it('FN-01 catalog northfield-excellence on northfield program matches → 60000', () => {
    const r = calculateFinancialImpact({ scholarship: sch('northfield-excellence'), program: prog('prog-northfield-mscs'), budgetUsd: null, scenario: 'potential' });
    expect(r.kind === 'ok' && r.remaining).toBe(60_000);
  });

  it('FN-02 Program B $70k with $20k → remaining 50000', () => {
    const r = calculateFinancialImpact({ scholarship: awardB, program: programB, budgetUsd: null, scenario: 'potential' });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.fullProgramCost).toBe(70_000);
    expect(r.remaining).toBe(50_000);
  });

  it('FN-03 budget 50k → gaps 10000 (A) and 0 (B)', () => {
    const a = calculateFinancialImpact({ scholarship: awardA, program: programA, budgetUsd: 50_000, scenario: 'potential' });
    const b = calculateFinancialImpact({ scholarship: awardB, program: programB, budgetUsd: 50_000, scenario: 'potential' });
    expect(a.kind === 'ok' && a.budgetGap).toBe(10_000);
    expect(b.kind === 'ok' && b.budgetGap).toBe(0);
  });

  it('FN-04 tuition-only award exceeding tuition is capped at tuition', () => {
    const big = makeScholarship({
      programIds: ['prog-a'],
      award: { amountUsd: 80_000, period: 'one-time', coveredCategories: ['tuition'], maximumPeriods: 1, stackability: 'no' },
    });
    const r = calculateFinancialImpact({ scholarship: big, program: programA, budgetUsd: null, scenario: 'potential' });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.nominalAward).toBe(80_000);
    expect(r.appliedAward).toBe(60_000);
    expect(r.remaining).toBe(30_000);
  });

  it('FN-05 award larger than all covered costs never produces a negative remaining', () => {
    const huge = makeScholarship({
      programIds: ['prog-a'],
      award: { amountUsd: 500_000, period: 'one-time', coveredCategories: ['tuition', 'fees', 'living'], maximumPeriods: 1, stackability: 'no' },
    });
    const r = calculateFinancialImpact({ scholarship: huge, program: programA, budgetUsd: 10_000, scenario: 'potential' });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.appliedAward).toBe(90_000);
    expect(r.remaining).toBe(0);
    expect(r.budgetGap).toBe(0);
  });

  it('FN-06 unknown living cost → insufficient, listing what is missing', () => {
    const r = calculateFinancialImpact({ scholarship: sch('horizon-gpa'), program: prog('prog-cascade-msds'), budgetUsd: 50_000, scenario: 'potential' });
    expect(r).toEqual({ kind: 'insufficient', scenario: 'potential', fullProgramCost: null, missing: ['Program living costs'] });
    const noAward = calculateFinancialImpact({ scholarship: sch('horizon-gpa'), program: prog('prog-cascade-msds'), budgetUsd: 50_000, scenario: 'no-award' });
    expect(noAward.kind).toBe('insufficient');
  });

  it('FN-07 per-year award with maximumPeriods null → insufficient ("Award renewal terms")', () => {
    const r = calculateFinancialImpact({ scholarship: sch('summit-leadership'), program: prog('prog-northfield-mscs'), budgetUsd: null, scenario: 'potential' });
    expect(r.kind).toBe('insufficient');
    if (r.kind !== 'insufficient') return;
    expect(r.missing).toEqual(['Award renewal terms']);
    expect(r.fullProgramCost).toBe(90_000);
  });

  it('FN-08 confirmed scenario uses confirmedAwardUsd (10000), not the catalog 30000', () => {
    const r = calculateFinancialImpact({ scholarship: awardA, program: programA, budgetUsd: null, scenario: 'confirmed', confirmedAwardUsd: 10_000 });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.nominalAward).toBe(10_000);
    expect(r.appliedAward).toBe(10_000);
    expect(r.remaining).toBe(80_000);
  });

  it('FN-09 combineAwards does not sum when any award is not stackable', () => {
    expect(combineAwards([{ stackability: 'no', applied: 30_000 }, { stackability: 'yes', applied: 15_000 }])).toEqual({
      stacked: false,
      total: 30_000,
      reason: 'At least one award doesn’t confirm it can be combined, so we treat them as alternatives.',
    });
    expect(combineAwards([{ stackability: 'unknown', applied: 5_000 }, { stackability: 'yes', applied: 8_000 }]).total).toBe(8_000);
    expect(combineAwards([{ stackability: 'yes', applied: 15_000 }, { stackability: 'yes', applied: 8_000 }])).toMatchObject({ stacked: true, total: 23_000 });
    expect(combineAwards([])).toMatchObject({ stacked: false, total: 0 });
  });

  it('FN-10 zero budget is valid and gives a gap equal to remaining', () => {
    const r = calculateFinancialImpact({ scholarship: awardA, program: programA, budgetUsd: 0, scenario: 'potential' });
    expect(r.kind === 'ok' && r.budgetGap).toBe(60_000);
    const noAward = calculateFinancialImpact({ scholarship: awardA, program: programA, budgetUsd: 0, scenario: 'no-award' });
    expect(noAward).toEqual({ kind: 'ok', scenario: 'no-award', fullProgramCost: 90_000, nominalAward: 0, appliedAward: 0, remaining: 90_000, budgetGap: 90_000 });
  });

  it('FN-11 scholarship not valid for program → not-applicable', () => {
    const r = calculateFinancialImpact({ scholarship: sch('northfield-excellence'), program: prog('prog-lakeshore-mscs'), budgetUsd: 50_000, scenario: 'potential' });
    expect(r.kind).toBe('not-applicable');
    if (r.kind !== 'not-applicable') return;
    expect(r.reason).toBe('Northfield Excellence can’t be used for MS in Computer Science at Lakeshore State University (fictional).');
  });

  it('FN-12 meridian-need is computed independently for each program (15k × min(1, periods))', () => {
    const meridian = sch('meridian-need');
    const nf = calculateFinancialImpact({ scholarship: meridian, program: prog('prog-northfield-mscs'), budgetUsd: 50_000, scenario: 'potential' });
    const lk = calculateFinancialImpact({ scholarship: meridian, program: prog('prog-lakeshore-mscs'), budgetUsd: 50_000, scenario: 'potential' });
    expect(nf).toEqual({ kind: 'ok', scenario: 'potential', fullProgramCost: 90_000, nominalAward: 15_000, appliedAward: 15_000, remaining: 75_000, budgetGap: 25_000 });
    expect(lk).toEqual({ kind: 'ok', scenario: 'potential', fullProgramCost: 70_000, nominalAward: 15_000, appliedAward: 15_000, remaining: 55_000, budgetGap: 5_000 });
  });

  it('normalizeAward multiplies periodic awards only by documented periods, capped by program length', () => {
    const award = { amountUsd: 10_000, period: 'per-year' as const, coveredCategories: ['tuition' as const], maximumPeriods: 5, stackability: 'no' as const };
    expect(normalizeAward(award, makeProgram({ durationMonths: 18 }))).toEqual({ amount: 20_000, missing: [] });
    expect(normalizeAward({ ...award, period: 'per-semester', maximumPeriods: 3 }, makeProgram({ durationMonths: 24 }))).toEqual({ amount: 30_000, missing: [] });
    expect(normalizeAward({ ...award, period: 'unknown' }, makeProgram())).toEqual({ amount: null, missing: ['Award period'] });
    expect(normalizeAward({ ...award, amountUsd: null }, makeProgram())).toEqual({ amount: null, missing: ['Award amount'] });
  });
});
