'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Lightbulb, Scale, X } from 'lucide-react';
import { getProgram, getScholarship } from '@/data/demo-catalog';
import { buildFacts, compareOptions, type OptionFacts } from '@/domain/decision';
import { formatMoney } from '@/domain/eligibility';
import type { FundingScenario } from '@/domain/financial';
import type { JourneyState, Priority, StudentProfile } from '@/domain/types';
import { applicationId } from '@/repository/journey-core';
import { useJourneyActions } from '@/repository/use-journey-actions';
import { JourneyGate } from '@/components/shell/JourneyGate';
import { EligibilityBadge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ROUTE_LABEL } from '@/lib/format';
import { useRouter } from 'next/navigation';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'lowest-cost', label: 'Lowest remaining cost' },
  { value: 'least-effort', label: 'Least application work' },
  { value: 'program-fit', label: 'Best program fit' },
  { value: 'clearer-terms', label: 'Clearer funding terms' },
];

export function DecisionStudio() {
  return <JourneyGate>{(state) => <Studio state={state} />}</JourneyGate>;
}

function short(name: string) {
  return name.replace(/ \(fictional\)$/, '');
}

function Studio({ state }: { state: JourneyState & { profile: StudentProfile } }) {
  const actions = useJourneyActions();
  const router = useRouter();
  const [priority, setPriority] = useState<Priority>(state.profile.priority);
  const [scenario, setScenario] = useState<Exclude<FundingScenario, 'no-award'>>('potential');
  const [budget, setBudget] = useState(state.profile.fullProgramBudgetUsd === null ? '' : String(state.profile.fullProgramBudgetUsd));

  const budgetNum = budget.trim() === '' ? null : Number(budget);
  const budgetValid = budgetNum === null || (Number.isFinite(budgetNum) && budgetNum >= 0 && budgetNum <= 10_000_000);
  const profile = useMemo(
    () => ({ ...state.profile, fullProgramBudgetUsd: budgetValid ? budgetNum : state.profile.fullProgramBudgetUsd }),
    [state.profile, budgetNum, budgetValid],
  );

  const facts = useMemo(
    () => buildFacts(state.compare, profile, { scholarship: getScholarship, program: getProgram }, scenario, state.applications),
    [state.compare, profile, scenario, state.applications],
  );
  const decision = useMemo(() => compareOptions(facts, priority), [facts, priority]);

  if (state.compare.length < 2) {
    return (
      <div>
        <PageHeader title="Choose what works for you." subtitle="The biggest award isn’t always the most affordable path." />
        {state.compare.length === 1 ? <SelectionStrip facts={facts} onRemove={(f) => actions.setCompare(f.option, false)} /> : null}
        <EmptyState
          icon={<Scale aria-hidden="true" />}
          title="Select at least two opportunities to compare."
          body="Pick two opportunities to see their trade-offs side by side."
          action={{ href: '/discover', label: 'Explore scholarships' }}
        />
      </div>
    );
  }

  const maxCost = Math.max(1, ...facts.map((f) => (f.financial.kind === 'ok' ? f.financial.fullProgramCost : 0)));
  const winner = facts.find((f) => f.key === decision.recommendedKey) ?? null;

  const saveBudget = () => {
    if (!budgetValid) return;
    const { userId: _u, updatedAt: _t, ...rest } = state.profile;
    void _u;
    void _t;
    actions.saveProfile({ ...rest, fullProgramBudgetUsd: budgetNum }, 'Budget saved to your profile.');
  };

  return (
    <div>
      <PageHeader title="Choose what works for you." subtitle="The biggest award isn’t always the most affordable path." />
      <SelectionStrip facts={facts} onRemove={(f) => actions.setCompare(f.option, false)} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="pri">
            <fieldset>
              <legend id="pri" className="font-display text-xl font-semibold">
                What matters most right now?
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <label key={p.value} className={`pill min-h-11 cursor-pointer border px-4 text-sm ${priority === p.value ? 'border-forest bg-forest text-white' : 'border-line bg-white text-ink'}`}>
                    <input type="radio" name="priority" value={p.value} className="sr-only" checked={priority === p.value} onChange={() => setPriority(p.value)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="label">Funding scenario</legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['potential', 'If the award is received'],
                      ['confirmed', 'Based on confirmed funding'],
                    ] as const
                  ).map(([v, l]) => (
                    <label key={v} className={`pill min-h-11 cursor-pointer border px-4 text-sm ${scenario === v ? 'border-forest bg-mint text-forest' : 'border-line bg-white text-ink'}`}>
                      <input type="radio" name="scenario" value={v} className="sr-only" checked={scenario === v} onChange={() => setScenario(v)} />
                      {l}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="budget" className="label">
                  Your full-program budget (USD)
                </label>
                <div className="flex gap-2">
                  <input
                    id="budget"
                    className="input"
                    inputMode="numeric"
                    value={budget}
                    aria-invalid={!budgetValid || undefined}
                    aria-describedby="budget-help"
                    onChange={(e) => setBudget(e.target.value)}
                  />
                  <button type="button" className="btn btn-secondary" onClick={saveBudget} disabled={!budgetValid}>
                    Save
                  </button>
                </div>
                <p id="budget-help" className={budgetValid ? 'help mt-1' : 'error-text mt-1'}>
                  {budgetValid ? 'Changes update the gap below right away.' : 'Enter a budget in US dollars.'}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="facts" className="card overflow-hidden">
            <h2 id="facts" className="px-5 pt-5 font-display text-xl font-semibold sm:px-6">
              Side by side
            </h2>
            <p className="px-5 text-sm text-muted sm:px-6">
              {scenario === 'potential' ? 'If the award is received — none of these awards is confirmed.' : 'Based on confirmed funding you’ve recorded. Options without a recorded award show their full cost.'}
            </p>
            {/* Desktop table */}
            <div className="mt-4 hidden md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Full-program cost comparison</caption>
                <thead className="bg-canvas">
                  <tr>
                    <th scope="col" className="px-6 py-3 font-semibold">
                      &nbsp;<span className="sr-only">Measure</span>
                    </th>
                    {facts.map((f) => (
                      <th key={f.key} scope="col" className="px-4 py-3 font-semibold">
                        {f.scholarship.shortTitle}
                        <span className="block font-normal text-muted">{short(f.program.universityName)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rowsFor(facts).map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="px-6 py-3 font-semibold">
                        {row.label}
                      </th>
                      {row.values.map((v, i) => (
                        <td key={facts[i]!.key} className="px-4 py-3">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="mt-4 space-y-3 px-4 pb-4 md:hidden">
              {facts.map((f, i) => (
                <li key={f.key} className="rounded-xl border border-line p-4">
                  <p className="font-semibold">{f.scholarship.shortTitle}</p>
                  <p className="text-sm text-muted">{short(f.program.universityName)}</p>
                  <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                    {rowsFor(facts).map((row) => (
                      <div key={row.label} className="contents">
                        <dt className="text-muted">{row.label}</dt>
                        <dd className="text-right font-semibold">{row.values[i]}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="bars" className="card p-5 sm:p-6">
            <h2 id="bars" className="font-display text-xl font-semibold">
              Where the money goes
            </h2>
            <ul className="mt-4 space-y-4">
              {facts.map((f) => (
                <li key={f.key}>
                  <p className="text-sm font-semibold">
                    {f.scholarship.shortTitle} · {short(f.program.universityName)}
                  </p>
                  {f.financial.kind === 'ok' ? (
                    <>
                      <div className="mt-1.5 flex h-4 overflow-hidden rounded-full bg-canvas" aria-hidden="true" style={{ width: `${(f.financial.fullProgramCost / maxCost) * 100}%` }}>
                        <div className="bg-forest" style={{ width: `${(f.financial.remaining / f.financial.fullProgramCost) * 100}%` }} />
                        <div className="bg-accent/70" style={{ width: `${(f.financial.appliedAward / f.financial.fullProgramCost) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {formatMoney(f.financial.remaining)} left to pay of {formatMoney(f.financial.fullProgramCost)}; award covers {formatMoney(f.financial.appliedAward)}.
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-warning">Not comparable yet — {f.financial.kind === 'insufficient' ? `${f.financial.missing.join(', ')} unknown` : f.financial.reason}.</p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm bg-forest" aria-hidden="true" /> Remaining cost
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm bg-accent/70" aria-hidden="true" /> Funding applied
              </span>
            </p>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Recommendation">
          <section className="card border-forest/30 p-5" aria-live="polite">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent">
              <Lightbulb aria-hidden="true" size={16} /> Why this option fits your priority
            </p>
            {winner ? (
              <p className="mt-2 font-display text-lg font-semibold">
                {winner.scholarship.shortTitle} · {short(winner.program.universityName)}
              </p>
            ) : null}
            <p className="mt-2 text-[0.95rem]">{decision.why}</p>
            <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-muted">What you’re trading off</h2>
            <p className="mt-1 text-[0.95rem]">{decision.tradeoff}</p>
            {decision.incompleteData.length ? (
              <div className="mt-4 rounded-lg bg-warning-bg p-3 text-sm text-warning">
                <p className="font-semibold">Missing information</p>
                <ul className="mt-1 list-disc pl-5">
                  {decision.incompleteData.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {winner ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const r = actions.startApplication(winner.option.scholarshipId, winner.option.programId);
                    if (r.ok) router.push(`/applications/${encodeURIComponent(applicationId(winner.option.scholarshipId, winner.option.programId))}`);
                  }}
                >
                  {state.applications.some((a) => a.id === applicationId(winner.option.scholarshipId, winner.option.programId)) ? 'Open application' : 'Start preparing'}
                </button>
                <Link href={`/scholarships/${winner.scholarship.id}`} className="btn btn-secondary">
                  View requirements
                </Link>
              </div>
            ) : null}
          </section>
          <p className="text-xs text-muted">A transparent comparison of sample data, not financial advice. Awards are decided by providers.</p>
        </aside>
      </div>
    </div>
  );
}

function SelectionStrip({ facts, onRemove }: { facts: OptionFacts[]; onRemove: (f: OptionFacts) => void }) {
  return (
    <ul className="mb-6 flex flex-wrap gap-2" aria-label="Options in comparison">
      {facts.map((f) => (
        <li key={f.key} className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-4 pr-1 text-sm">
          <span className="font-semibold">{f.scholarship.shortTitle}</span>
          <span className="text-muted">· {short(f.program.universityName)}</span>
          <EligibilityBadge status={f.eligibility} />
          <button type="button" className="rounded-full p-2 hover:bg-canvas" aria-label={`Remove ${f.scholarship.shortTitle} from compare`} onClick={() => onRemove(f)}>
            <X aria-hidden="true" size={16} />
          </button>
        </li>
      ))}
      <li>
        <Link href="/discover" className="btn btn-ghost min-h-10 text-sm">
          + Add another
        </Link>
      </li>
    </ul>
  );
}

function money(f: OptionFacts, pick: 'full' | 'award' | 'remaining' | 'gap'): string {
  const r = f.financial;
  if (r.kind === 'not-applicable') return 'Not applicable';
  if (r.kind === 'insufficient') {
    if (pick === 'full' && r.fullProgramCost !== null) return formatMoney(r.fullProgramCost);
    return 'Not comparable yet';
  }
  if (pick === 'full') return formatMoney(r.fullProgramCost);
  if (pick === 'award') return r.confirmedSource === 'none-recorded' ? 'No confirmed award recorded' : formatMoney(r.appliedAward);
  if (pick === 'remaining') return formatMoney(r.remaining);
  return r.budgetGap === null ? 'Add a budget' : formatMoney(r.budgetGap);
}

function rowsFor(facts: OptionFacts[]): { label: string; values: React.ReactNode[] }[] {
  return [
    { label: 'Full-program cost', values: facts.map((f) => money(f, 'full')) },
    { label: 'Potential funding', values: facts.map((f) => money(f, 'award')) },
    { label: 'Remaining cost if awarded', values: facts.map((f) => money(f, 'remaining')) },
    { label: 'Current budget gap', values: facts.map((f) => money(f, 'gap')) },
    { label: 'Eligibility', values: facts.map((f) => <EligibilityBadge key={f.key} status={f.eligibility} />) },
    { label: 'Application work', values: facts.map((f) => `${f.effort} steps · ${ROUTE_LABEL[f.scholarship.applicationRoute]}`) },
    { label: 'Program fit', values: facts.map((f) => (f.fit === 2 ? 'Subject + shortlist' : f.fit === 1 ? 'Subject matches' : 'Different subject')) },
  ];
}
