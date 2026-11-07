'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { getProgram, getScholarship } from '@/data/demo-catalog';
import { displayStatus, isClosed, progress, STATUS_LABEL, type DisplayStatus } from '@/domain/application-state';
import { getNextActions } from '@/domain/action-priority';
import { evaluateEligibility } from '@/domain/eligibility';
import { describeRelative, formatDateOnly } from '@/domain/date';
import { JourneyGate } from '@/components/shell/JourneyGate';
import { Badge, EmptyState, PageHeader, ProgressBar, type Tone } from '@/components/ui/primitives';
import { today } from '@/lib/format';
import type { JourneyState, StudentProfile } from '@/domain/types';

const TABS = ['All', 'Preparing', 'Submitted', 'Action needed', 'Closed'] as const;
type Tab = (typeof TABS)[number];

export const STATUS_TONE: Record<DisplayStatus, Tone> = {
  preparing: 'warning',
  ready: 'success',
  submitted: 'info',
  waiting: 'info',
  'action-required': 'danger',
  awarded: 'success',
  'not-selected': 'neutral',
  withdrawn: 'neutral',
};

export function ApplicationsList() {
  return <JourneyGate>{(state) => <List state={state} />}</JourneyGate>;
}

function List({ state }: { state: JourneyState & { profile: StudentProfile } }) {
  const [tab, setTab] = useState<Tab>('All');
  const now = today();
  const plan = getNextActions(state.applications, state.tasks, getScholarship, now);
  const actionApps = new Set(plan.actions.filter((a) => a.tier <= 3).map((a) => a.applicationId));

  const items = state.applications.map((app) => {
    const tasks = state.tasks.filter((t) => t.applicationId === app.id);
    return { app, tasks, display: displayStatus(app, tasks), p: progress(tasks), next: plan.actions.find((a) => a.applicationId === app.id) };
  });
  const filtered = items.filter(({ app, display }) => {
    if (tab === 'Preparing') return display === 'preparing' || display === 'ready';
    if (tab === 'Submitted') return app.status === 'submitted' || app.status === 'waiting';
    if (tab === 'Action needed') return actionApps.has(app.id) || app.status === 'action-required';
    if (tab === 'Closed') return isClosed(app.status);
    return true;
  });
  const count = (t: Tab) =>
    items.filter(({ app, display }) =>
      t === 'All' ? true : t === 'Preparing' ? display === 'preparing' || display === 'ready' : t === 'Submitted' ? app.status === 'submitted' || app.status === 'waiting' : t === 'Action needed' ? actionApps.has(app.id) || app.status === 'action-required' : isClosed(app.status),
    ).length;

  return (
    <div>
      <PageHeader title="Your applications, all in one place." subtitle="See what’s ready, what’s waiting, and what needs you." />
      {state.applications.length === 0 ? (
        <EmptyState icon={<FileText aria-hidden="true" />} title="No applications yet. Save an opportunity and start preparing when you’re ready." action={{ href: '/discover', label: 'Discover scholarships' }} />
      ) : (
        <>
          <div role="tablist" aria-label="Filter applications" className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`pill min-h-11 shrink-0 border px-4 text-sm ${tab === t ? 'border-forest bg-forest text-white' : 'border-line bg-white text-ink hover:bg-mint'}`}
                onClick={() => setTab(t)}
                onKeyDown={(e) => {
                  const i = TABS.indexOf(t);
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
                    setTab(next);
                    (e.currentTarget.parentElement?.querySelectorAll('button')[TABS.indexOf(next)] as HTMLButtonElement | undefined)?.focus();
                  }
                }}
                tabIndex={tab === t ? 0 : -1}
              >
                {t} <span className="opacity-80">({count(t)})</span>
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={tab}>
            {filtered.length === 0 ? (
              <p className="card p-6 text-muted">Nothing in this view right now.</p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {filtered.map(({ app, display, p, next }) => {
                  const s = getScholarship(app.scholarshipId);
                  const prog = getProgram(app.programId);
                  if (!s || !prog) return null;
                  const eligibilityChanged = app.status === 'preparing' && evaluateEligibility(state.profile, s).status === 'not-eligible';
                  return (
                    <li key={app.id} className="card flex flex-col p-5">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={STATUS_TONE[display]}>{STATUS_LABEL[display]}</Badge>
                        <Badge tone="neutral">Simulated</Badge>
                        {eligibilityChanged ? <Badge tone="danger">Check eligibility again</Badge> : null}
                      </div>
                      <h2 className="mt-3 text-lg font-semibold">{s.title}</h2>
                      <p className="text-sm text-muted">
                        {prog.title} · {prog.universityName}
                      </p>
                      <div className="mt-4">
                        <p className="mb-1 text-sm">
                          {p.completed} of {p.total} required steps ready
                        </p>
                        <ProgressBar value={p.percent} label={`${s.shortTitle} preparation progress`} />
                      </div>
                      <p className="mt-3 text-sm">
                        <span className="font-semibold">Next: </span>
                        {next ? `${next.title}${next.dueDate ? ` — due ${describeRelative(now, next.dueDate)}` : ''}` : 'Nothing for you to do right now.'}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Closes {formatDateOnly(app.closesOn)} · Last updated {formatDateOnly(app.updatedAt.slice(0, 10))}
                      </p>
                      <div className="mt-auto flex flex-wrap gap-2 pt-4">
                        <Link href={`/applications/${encodeURIComponent(app.id)}`} className="btn btn-primary">
                          Open application<span className="sr-only"> for {s.title}</span>
                        </Link>
                        <Link href={`/applications/${encodeURIComponent(app.id)}#status`} className="btn btn-secondary">
                          Update status<span className="sr-only"> for {s.title}</span>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
