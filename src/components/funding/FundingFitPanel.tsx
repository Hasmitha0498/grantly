'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, ChevronDown, CircleHelp, ExternalLink, ShieldQuestion, XCircle } from 'lucide-react';
import { getProgram, getScholarship } from '@/data/demo-catalog';
import { ELIGIBILITY_COPY, evaluateEligibility, formatMoney, type RequirementCheck } from '@/domain/eligibility';
import { assessEvidence } from '@/domain/evidence';
import { calculateFinancialImpact, fullProgramCost } from '@/domain/financial';
import { describeRelative, formatDateOnly } from '@/domain/date';
import { applicationId, deadlineFor } from '@/repository/journey-core';
import { useJourneyActions } from '@/repository/use-journey-actions';
import { JourneyGate } from '@/components/shell/JourneyGate';
import { Badge, DemoLabel, EligibilityBadge } from '@/components/ui/primitives';
import { CompareButton, ProgramPicker, SaveButton } from '@/components/discover/OpportunityActions';
import { FUNDING_TYPE_LABEL, ROUTE_HELP, ROUTE_LABEL, today } from '@/lib/format';
import { safeExternalUrl } from '@/lib/safe-url';
import type { JourneyState, Scholarship, StudentProfile } from '@/domain/types';

const RESULT_META = {
  pass: { Icon: CheckCircle2, label: 'Meets', cls: 'text-success' },
  fail: { Icon: XCircle, label: 'Doesn’t meet', cls: 'text-danger' },
  unknown: { Icon: CircleHelp, label: 'Need info', cls: 'text-warning' },
  unverified: { Icon: ShieldQuestion, label: 'Needs verification', cls: 'text-info' },
} as const;

export function FundingFitPanel({ scholarshipId }: { scholarshipId: string }) {
  const scholarship = getScholarship(scholarshipId);
  if (!scholarship) return null;
  return <JourneyGate>{(state) => <Detail s={scholarship} state={state} />}</JourneyGate>;
}

function Detail({ s, state }: { s: Scholarship; state: JourneyState & { profile: StudentProfile } }) {
  const profile = state.profile;
  const elig = evaluateEligibility(profile, s);
  const evidence = assessEvidence(profile.evidence, s.selectionCriteria);
  const closes = deadlineFor(s.id, state.anchorAt ?? new Date().toISOString());
  const now = today();
  const official = safeExternalUrl(s.officialUrl);
  const isAutomatic = s.applicationRoute === 'automatic-via-admission';

  return (
    <article className="space-y-6">
      <header className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <DemoLabel />
          <Badge tone="neutral">{FUNDING_TYPE_LABEL[s.fundingType]}</Badge>
          <Badge tone="neutral">{ROUTE_LABEL[s.applicationRoute]}</Badge>
        </div>
        <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight sm:text-4xl">{s.title}</h1>
        <p className="mt-1 text-muted">{s.provider}</p>
        <p className="mt-4 max-w-3xl">{s.description}</p>
        <p className="mt-2 font-semibold">{s.benefits}</p>
        <p className="mt-3 text-sm text-muted">
          {closes ? `${s.deadlineKind === 'admission' ? 'Admission deadline' : 'Closes'} ${formatDateOnly(closes)} (${describeRelative(now, closes)}). Date given by the provider; no closing time stated.` : 'No deadline published.'}
        </p>
        <StartActions s={s} state={state} />
      </header>

      <section aria-labelledby="fit-eligible" className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="fit-eligible" className="text-2xl font-semibold">Am I eligible?</h2>
          <EligibilityBadge status={elig.status} />
        </div>
        <p className="mt-2 font-semibold">{ELIGIBILITY_COPY[elig.status].sentence}</p>
        <p className="help mt-1">A preliminary check against sample demo rules — not an official decision.</p>
        <ul className="mt-4 divide-y divide-line">
          {elig.checks.map((c) => (
            <RequirementRow key={c.ruleId} c={c} />
          ))}
        </ul>
        {elig.unknown.some((u) => u.missingField) ? (
          <Link href="/profile" className="btn btn-secondary mt-4">
            Update profile
          </Link>
        ) : null}
      </section>

      <section aria-labelledby="fit-evidence" className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="fit-evidence" className="text-2xl font-semibold">How strong is my evidence?</h2>
          <Badge tone={evidence.summary === 'strong' ? 'success' : evidence.summary === 'cannot-assess' ? 'neutral' : 'warning'}>{evidence.label}</Badge>
        </div>
        <p className="help mt-1">Evidence alignment is not an admission or award probability.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">What supports this</h3>
            {evidence.supports.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {evidence.supports.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Insufficient evidence to assess yet.</p>
            )}
          </div>
          <div>
            <h3 className="font-semibold">What to strengthen</h3>
            {evidence.strengthen.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {evidence.strengthen.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Nothing obvious — keep your examples specific.</p>
            )}
          </div>
        </div>
        <Link href="/profile" className="btn btn-ghost mt-3 -ml-3">
          Add evidence to your profile
        </Link>
      </section>

      <section aria-labelledby="fit-cover" className="card p-5 sm:p-7">
        <h2 id="fit-cover" className="text-2xl font-semibold">What could this cover?</h2>
        <p className="help mt-1">This is potential funding, not an award offer.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {s.programIds.map((pid) => {
            const p = getProgram(pid);
            if (!p) return null;
            const total = fullProgramCost(p);
            const f = calculateFinancialImpact({ scholarship: s, program: p, budgetUsd: profile.fullProgramBudgetUsd, scenario: 'potential' });
            return (
              <div key={pid} className="rounded-xl border border-line p-4">
                <h3 className="font-semibold">
                  {p.title} <span className="block text-sm font-normal text-muted">{p.universityName} · {p.durationMonths} months</span>
                </h3>
                <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                  <dt>Full-program cost</dt>
                  <dd className="text-right font-semibold">{total.total !== null ? formatMoney(total.total) : 'Cost estimate unavailable'}</dd>
                  {f.kind === 'ok' ? (
                    <>
                      <dt>Potential funding (applied)</dt>
                      <dd className="text-right font-semibold">−{formatMoney(f.appliedAward)}</dd>
                      <dt>Remaining cost if awarded</dt>
                      <dd className="text-right font-semibold">{formatMoney(f.remaining)}</dd>
                      <dt>Current budget gap</dt>
                      <dd className="text-right font-semibold">{f.budgetGap === null ? 'Add a budget' : formatMoney(f.budgetGap)}</dd>
                    </>
                  ) : null}
                </dl>
                {f.kind === 'insufficient' ? (
                  <p className="mt-3 text-sm text-warning">Insufficient data to estimate: {f.missing.join(', ')} unknown.</p>
                ) : null}
                {f.kind === 'ok' && f.appliedAward < f.nominalAward ? (
                  <p className="mt-2 text-xs text-muted">Capped at the covered costs ({s.award.coveredCategories.join(', ')}).</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="route" className="card p-5 sm:p-7">
        <h2 id="route" className="text-2xl font-semibold">How scholarship consideration works</h2>
        <p className="mt-2 font-semibold">{ROUTE_LABEL[s.applicationRoute]}</p>
        <p className="mt-1 text-muted">{ROUTE_HELP[s.applicationRoute]}</p>
        <h3 className="mt-5 font-semibold">What you’ll need to prepare</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {s.tasks.map((t) => (
            <li key={t.key} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>
                {t.label} <span className="text-muted">({t.required ? 'required' : 'optional'})</span>
              </span>
            </li>
          ))}
          {s.essayPrompts.map((p) => (
            <li key={p.id} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>Essay: “{p.question}” — {p.wordLimit} words</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded-xl bg-canvas p-4 text-sm">
          <p className="font-semibold">Source</p>
          {official ? (
            <a href={official} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-forest underline">
              View official source <ExternalLink aria-hidden="true" size={14} />
            </a>
          ) : (
            <p className="mt-1 text-muted">Source link unavailable in this demo. {isAutomatic ? '' : 'Official application link isn’t available here.'}</p>
          )}
        </div>
      </section>
    </article>
  );
}

function RequirementRow({ c }: { c: RequirementCheck }) {
  const [open, setOpen] = useState(false);
  const meta = RESULT_META[c.result];
  const panelId = `req-${c.ruleId}`;
  return (
    <li className="py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <meta.Icon aria-hidden="true" size={20} className={`mt-0.5 shrink-0 ${meta.cls}`} />
          <div>
            <p className="font-semibold">
              {c.label} {!c.mandatory ? <span className="text-sm font-normal text-muted">(optional)</span> : null}
            </p>
            <p className="text-sm">
              <span className={`font-semibold ${meta.cls}`}>{meta.label}.</span> {c.reason}
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-ghost min-h-9 shrink-0 self-start px-2 text-sm" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
          Details <ChevronDown aria-hidden="true" size={16} className={open ? 'rotate-180' : ''} />
        </button>
      </div>
      {open ? (
        <dl id={panelId} className="ml-8 mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-canvas p-3 text-sm">
          <dt className="text-muted">You</dt>
          <dd>{c.studentValue}</dd>
          <dt className="text-muted">Rule</dt>
          <dd>{c.requiredValue}</dd>
          <dt className="text-muted">Source</dt>
          <dd>{c.sourceNote}</dd>
        </dl>
      ) : null}
    </li>
  );
}

function StartActions({ s, state }: { s: Scholarship; state: JourneyState & { profile: StudentProfile } }) {
  const actions = useJourneyActions();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const status = evaluateEligibility(state.profile, s).status;
  const existing = state.applications.filter((a) => a.scholarshipId === s.id);
  const label = s.applicationRoute === 'automatic-via-admission' ? 'Track funding consideration' : 'Start preparing';

  const start = (programId: string) => {
    if (pending) return;
    setPending(true);
    const r = actions.startApplication(s.id, programId);
    setPickerOpen(false);
    if (r.ok) router.push(`/applications/${encodeURIComponent(applicationId(s.id, programId))}`);
    else setPending(false);
  };

  return (
    <div className="mt-6">
      {status === 'not-eligible' ? (
        <p className="mb-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">You can save this, but applying isn’t recommended — a required condition isn’t met.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {existing.length ? (
          existing.map((a) => (
            <Link key={a.id} href={`/applications/${encodeURIComponent(a.id)}`} className="btn btn-primary">
              Open application{s.programIds.length > 1 ? ` (${getProgram(a.programId)?.universityName.replace(/ \(fictional\)$/, '')})` : ''}
            </Link>
          ))
        ) : null}
        {status !== 'not-eligible' && existing.length < s.programIds.length ? (
          <button
            type="button"
            className={`btn ${existing.length ? 'btn-secondary' : 'btn-primary'}`}
            disabled={pending}
            onClick={() => (s.programIds.length === 1 ? start(s.programIds[0]!) : setPickerOpen(true))}
          >
            {pending ? 'Starting…' : label}
          </button>
        ) : null}
        <SaveButton scholarship={s} state={state} label="Save scholarship" />
        <CompareButton scholarship={s} state={state} />
      </div>
      {s.programIds.length > 1 ? (
        <ProgramPicker
          scholarship={s}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title="Which program are you applying with?"
          onPick={start}
          isPicked={(pid) => existing.some((a) => a.programId === pid)}
        />
      ) : null}
    </div>
  );
}
