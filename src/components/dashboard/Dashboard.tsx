'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Clock, Hourglass } from 'lucide-react';
import { getScholarship, scholarships } from '@/data/demo-catalog';
import { getNextActions } from '@/domain/action-priority';
import { isClosed } from '@/domain/application-state';
import { describeRelative, formatDateOnly } from '@/domain/date';
import { evaluateEligibility } from '@/domain/eligibility';
import { JourneyGate } from '@/components/shell/JourneyGate';
import { EligibilityBadge } from '@/components/ui/primitives';
import { maxPotential } from '@/components/discover/DiscoverExplorer';
import { formatMoney, today } from '@/lib/format';
import type { JourneyState, StudentProfile } from '@/domain/types';

export function Dashboard() {
  return <JourneyGate>{(state) => <Home state={state} />}</JourneyGate>;
}

function Home({ state }: { state: JourneyState & { profile: StudentProfile } }) {
  const now = today();
  const firstName = state.profile.displayName.trim().split(/\s+/)[0] || 'there';
  const plan = getNextActions(state.applications, state.tasks, getScholarship, now);
  const top = plan.actions[0];
  const upcoming = plan.actions.slice(1, 5);
  const eligibilities = scholarships.map((s) => ({ s, status: evaluateEligibility(state.profile, s).status }));
  const potentialMatches = eligibilities.filter((e) => e.status === 'eligible' || e.status === 'needs-information').length;
  const inProgress = state.applications.filter((a) => !isClosed(a.status)).length;
  const actionsSoon = plan.actions.filter((a) => a.bucket === 'overdue' || a.bucket === 'within-48h' || a.bucket === 'within-7d').length;
  const pursued = new Set(state.applications.map((a) => a.scholarshipId));
  const recommendations = eligibilities.filter((e) => e.status === 'eligible' && !pursued.has(e.s.id)).slice(0, 3);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[1.75rem] font-semibold leading-tight sm:text-4xl">Good to see you, {firstName}.</h1>
        <p className="mt-2 text-muted">Here’s where your funding journey stands.</p>
        {state.profile.isDemo ? <p className="mt-2 text-sm text-muted">Sample data — not real scholarship offers. Dates are simulated from when you opened the demo.</p> : null}
      </header>

      <section aria-labelledby="nba" className="card relative overflow-hidden border-forest/25 p-6 sm:p-8">
        <div aria-hidden="true" className="absolute -right-16 -top-16 size-48 rounded-full bg-mint" />
        <div className="relative">
          <h2 id="nba" className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">
            Your next best action
          </h2>
          {top ? (
            <>
              <p className="mt-3 font-display text-2xl font-semibold leading-snug sm:text-3xl">{top.title}</p>
              <p className="mt-1 text-muted">
                {top.scholarshipTitle}
                {top.dueDate ? ` · due ${formatDateOnly(top.dueDate)} (${describeRelative(now, top.dueDate)})` : ''}
              </p>
              {top.warning ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-danger-bg px-3 py-1.5 text-sm font-semibold text-danger">
                  <AlertTriangle aria-hidden="true" size={16} /> {top.warning}
                </p>
              ) : null}
              <p className="mt-3">We prioritized this because {top.reason}.</p>
              <Link href={top.href} className="btn btn-primary mt-5">
                {top.cta} <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </>
          ) : state.applications.length === 0 ? (
            <>
              <p className="mt-3 font-display text-2xl font-semibold">You’re ready to explore. Let’s find funding that fits your plans.</p>
              <Link href="/discover" className="btn btn-primary mt-5">
                Find scholarships
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 font-display text-2xl font-semibold">You’re caught up. Check back for updates or explore more opportunities.</p>
              <Link href="/discover" className="btn btn-secondary mt-5">
                Explore opportunities
              </Link>
            </>
          )}
        </div>
      </section>

      <section aria-label="Journey summary">
        <dl className="grid grid-cols-3 gap-3">
          {[
            { label: 'Potential matches', value: potentialMatches, href: '/discover' },
            { label: 'Applications in progress', value: inProgress, href: '/applications' },
            { label: 'Actions coming up', value: actionsSoon, href: '#coming-up' },
          ].map((m) => (
            <div key={m.label} className="card p-4">
              <dt className="text-xs font-semibold text-muted sm:text-sm">{m.label}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold text-forest">
                <Link href={m.href} className="hover:underline">
                  {m.value}
                  <span className="sr-only"> — view {m.label.toLowerCase()}</span>
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="coming-up-h" id="coming-up" className="card scroll-mt-24 p-5 sm:p-6">
          <h2 id="coming-up-h" className="font-display text-xl font-semibold">
            Coming up next
          </h2>
          {upcoming.length ? (
            <ul className="mt-3 divide-y divide-line">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="flex gap-3">
                    <Clock aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-muted" />
                    <div>
                      <Link href={a.href} className="font-semibold hover:underline">
                        {a.title}
                      </Link>
                      <p className="text-sm text-muted">
                        {a.scholarshipTitle} · {a.dueDate ? describeRelative(now, a.dueDate) : 'no date'}
                        {a.tier >= 5 ? ' · optional' : ''}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-muted">Nothing else scheduled.</p>
          )}
          {plan.waiting.length ? (
            <>
              <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <Hourglass aria-hidden="true" size={15} /> Waiting on others
              </h3>
              <ul className="mt-2 space-y-2 text-sm">
                {plan.waiting.map((w) => (
                  <li key={w.id}>
                    <Link href={`/applications/${encodeURIComponent(w.applicationId)}#task-${w.id}`} className="font-semibold hover:underline">
                      {w.title}
                    </Link>
                    <span className="text-muted">
                      {' '}
                      · {w.scholarshipTitle} · {w.nextFollowUpOn ? `follow up ${describeRelative(now, w.nextFollowUpOn)}` : 'no follow-up date set'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section aria-labelledby="worth" className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="worth" className="font-display text-xl font-semibold">
              Worth exploring
            </h2>
            <Link href="/discover" className="text-sm font-semibold text-forest hover:underline">
              See all opportunities
            </Link>
          </div>
          {recommendations.length ? (
            <ul className="mt-3 divide-y divide-line">
              {recommendations.map(({ s, status }) => {
                const pot = maxPotential(s);
                return (
                  <li key={s.id} className="py-3">
                    <Link href={`/scholarships/${s.id}`} className="font-semibold hover:underline">
                      {s.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                      <EligibilityBadge status={status} />
                      {pot !== null ? `Potential award up to ${formatMoney(pot)}` : 'Amount not stated'}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-muted">You’ve started everything you currently meet the criteria for. Updating your profile may reveal more.</p>
          )}
          <Link href="/compare" className="btn btn-secondary mt-4">
            Compare your options ({state.compare.length})
          </Link>
        </section>
      </div>
    </div>
  );
}
