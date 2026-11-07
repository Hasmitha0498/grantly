'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertTriangle, ArrowLeft, CalendarClock, PenLine, Trash2 } from 'lucide-react';
import { getProgram, getScholarship } from '@/data/demo-catalog';
import { allowedTransitions, displayStatus, progress, STATUS_LABEL } from '@/domain/application-state';
import { describeRelative, formatDateOnly, isValidDateOnly } from '@/domain/date';
import { evaluateEssayDraft } from '@/domain/essay';
import { formatMoney } from '@/domain/eligibility';
import type { Application, ApplicationStatus, ApplicationTask, JourneyState, Scholarship, StudentProfile, TaskStatus } from '@/domain/types';
import { useJourneyActions } from '@/repository/use-journey-actions';
import { JourneyGate } from '@/components/shell/JourneyGate';
import { Dialog } from '@/components/ui/Dialog';
import { Badge, ProgressBar } from '@/components/ui/primitives';
import { ROUTE_LABEL, today } from '@/lib/format';
import { STATUS_TONE } from './ApplicationsList';

export function ApplicationWorkspace({ id }: { id: string }) {
  return (
    <JourneyGate>
      {(state) => {
        const app = state.applications.find((a) => a.id === id);
        const s = app ? getScholarship(app.scholarshipId) : undefined;
        if (!app || !s) {
          return (
            <div className="card p-8 text-center">
              <h1 className="font-display text-2xl font-semibold">We couldn’t find that application.</h1>
              <p className="mt-2 text-muted">It may have been removed, or it was saved in a different browser.</p>
              <Link href="/applications" className="btn btn-primary mt-5">
                Back to applications
              </Link>
            </div>
          );
        }
        return <Workspace app={app} s={s} state={state} />;
      }}
    </JourneyGate>
  );
}

const TASK_STATUS_LABEL: Record<TaskStatus, string> = { todo: 'To do', waiting: 'Waiting on someone', complete: 'Ready' };

function Workspace({ app, s, state }: { app: Application; s: Scholarship; state: JourneyState & { profile: StudentProfile } }) {
  const tasks = state.tasks.filter((t) => t.applicationId === app.id);
  const p = progress(tasks);
  const display = displayStatus(app, tasks);
  const program = getProgram(app.programId);
  const now = today();
  const required = tasks.filter((t) => t.required);
  const optional = tasks.filter((t) => !t.required);

  return (
    <div className="space-y-6">
      <Link href="/applications" className="btn btn-ghost -ml-3 min-h-10 px-3">
        <ArrowLeft aria-hidden="true" size={18} /> All applications
      </Link>
      <header className="card p-5 sm:p-7">
        <div className="flex flex-wrap gap-2">
          <Badge tone={STATUS_TONE[display]}>{STATUS_LABEL[display]}</Badge>
          <Badge tone="neutral">Simulated · recorded by you</Badge>
        </div>
        <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight sm:text-4xl">Get your {s.shortTitle} application ready.</h1>
        <p className="mt-1 text-muted">
          {program?.title} · {program?.universityName}
        </p>
        <p className="mt-4">
          This opportunity is considered through <strong>{ROUTE_LABEL[s.applicationRoute].toLowerCase()}</strong>. Follow the provider’s instructions to submit.
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <CalendarClock aria-hidden="true" size={16} />
          {app.closesOn ? `Closes ${formatDateOnly(app.closesOn)} (${describeRelative(now, app.closesOn)}) — provider date, no closing time stated.` : 'No deadline published.'}
        </p>
        {app.closesOn && app.closesOn < now && app.status === 'preparing' ? (
          <p className="mt-2 flex items-center gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger">
            <AlertTriangle aria-hidden="true" size={16} /> Deadline may be missed — check with the provider.
          </p>
        ) : null}
        <div className="mt-5">
          <p className="mb-1.5 font-semibold" aria-live="polite">
            {p.completed} of {p.total} required steps ready
          </p>
          <ProgressBar value={p.percent} label="Required steps ready" />
        </div>
      </header>

      <section aria-labelledby="checklist" className="card p-5 sm:p-7">
        <h2 id="checklist" className="text-2xl font-semibold">Your preparation checklist</h2>
        <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Required</h3>
        <ul className="mt-2 divide-y divide-line">
          {required.map((t) => (
            <TaskRow key={t.id} task={t} app={app} s={s} state={state} />
          ))}
        </ul>
        {optional.length ? (
          <>
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Optional</h3>
            <ul className="mt-2 divide-y divide-line">
              {optional.map((t) => (
                <TaskRow key={t.id} task={t} app={app} s={s} state={state} />
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <StatusPanel app={app} s={s} tasks={tasks} isDemo={state.profile.isDemo} />
    </div>
  );
}

function TaskRow({ task, app, s, state }: { task: ApplicationTask; app: Application; s: Scholarship; state: JourneyState }) {
  const actions = useJourneyActions();
  const [followUp, setFollowUp] = useState(task.nextFollowUpOn ?? '');
  const now = today();
  const isEssay = task.type === 'essay' && task.essayPromptId;
  const prompt = isEssay ? s.essayPrompts.find((p) => p.id === task.essayPromptId) : undefined;
  const draft = isEssay ? state.essays.find((e) => e.applicationId === app.id && e.promptId === task.essayPromptId) : undefined;
  const essayEval = prompt ? evaluateEssayDraft(draft?.body ?? '', prompt.wordLimit, draft?.userMarkedReady ?? false) : null;
  const due = task.dueDate ?? app.closesOn;
  const thirdParty = task.owner !== 'student';
  const followUpId = `fu-${task.id}`;

  return (
    <li id={`task-${task.id}`} className="scroll-mt-24 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`font-semibold ${task.status === 'complete' ? 'text-muted line-through decoration-1' : ''}`}>{task.label}</p>
          <p className="text-sm text-muted">
            {thirdParty ? (task.owner === 'recommender' ? 'Your recommender does this · ' : 'The provider does this · ') : ''}
            {due ? `Due ${formatDateOnly(due)} (${describeRelative(now, due)})${!task.dueDate ? ' — application deadline' : ''}` : 'No due date'}
          </p>
          {essayEval ? (
            <p className="text-sm text-muted">
              Draft: {essayEval.words} / {essayEval.limit} words{draft?.userMarkedReady ? ' · marked ready' : ''}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEssay ? (
            <Link href={`/applications/${encodeURIComponent(app.id)}/essay/${encodeURIComponent(task.essayPromptId!)}`} className="btn btn-primary">
              <PenLine aria-hidden="true" size={17} /> Work on essay
            </Link>
          ) : null}
          {isEssay ? (
            // Essay readiness has one source of truth: Essay Studio (valid draft + student confirmation).
            <span className="pill border border-line bg-canvas text-muted">
              {TASK_STATUS_LABEL[task.status]} · set in Essay Studio
            </span>
          ) : (
            <>
            <label className="sr-only" htmlFor={`st-${task.id}`}>
              Status for {task.label}
            </label>
            <select
              id={`st-${task.id}`}
              className="input w-auto min-w-44"
              value={task.status}
              onChange={(e) => {
                const v = e.target.value as TaskStatus;
                actions.updateTask(task.id, { status: v }, v === 'complete' ? 'Step marked ready.' : 'Your progress was updated.');
              }}
            >
              {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((k) => (
                <option key={k} value={k}>
                  {TASK_STATUS_LABEL[k]}
                </option>
              ))}
            </select>
            </>
          )}
        </div>
      </div>
      {(thirdParty || task.status === 'waiting') && task.status !== 'complete' ? (
        <div className="mt-3 rounded-xl bg-canvas p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div>
              <label htmlFor={followUpId} className="label text-sm">
                Add a follow-up date
              </label>
              <input id={followUpId} type="date" className="input" value={followUp} min={now} aria-describedby={`${followUpId}-help`} onChange={(e) => setFollowUp(e.target.value)} />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!isValidDateOnly(followUp)}
              onClick={() => actions.updateTask(task.id, { nextFollowUpOn: followUp }, `Follow-up set for ${formatDateOnly(followUp)}.`)}
            >
              Save date
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setFollowUp('');
                actions.updateTask(task.id, { lastFollowUpOn: now, nextFollowUpOn: null }, 'Follow-up recorded. Set a new date if you need another reminder.');
              }}
            >
              I followed up today
            </button>
          </div>
          <p id={`${followUpId}-help`} className="help mt-2">
            {task.nextFollowUpOn ? `Next reminder ${formatDateOnly(task.nextFollowUpOn)}. ` : ''}
            {task.lastFollowUpOn ? `Last followed up ${formatDateOnly(task.lastFollowUpOn)}. ` : ''}
            Reminders appear only inside GRANTLY — we don’t send emails or notifications.
          </p>
        </div>
      ) : null}
    </li>
  );
}

function StatusPanel({ app, s, tasks, isDemo }: { app: Application; s: Scholarship; tasks: ApplicationTask[]; isDemo: boolean }) {
  const actions = useJourneyActions();
  const router = useRouter();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus | ''>('');
  const [award, setAward] = useState(app.awardConfirmedUsd === null ? '' : String(app.awardConfirmedUsd));
  const [responseDate, setResponseDate] = useState(app.offerResponseDeadlineOn ?? '');
  const p = progress(tasks);
  const incomplete = p.completed < p.total;
  const transitions = allowedTransitions(app.status).filter((t) => t !== 'submitted');
  const automatic = s.applicationRoute === 'automatic-via-admission';
  const awardNum = Number(award);
  const awardValid = award.trim() !== '' && Number.isFinite(awardNum) && awardNum >= 0 && awardNum <= 10_000_000;

  return (
    <section id="status" aria-labelledby="status-h" className="card scroll-mt-24 p-5 sm:p-7">
      <h2 id="status-h" className="text-2xl font-semibold">Status</h2>
      <p className="mt-1 text-sm text-muted">
        Every status here is recorded by you{isDemo ? ' and simulated in this demo' : ''}. GRANTLY can’t see provider systems.
      </p>
      <p className="mt-3">
        Current: <strong>{STATUS_LABEL[displayStatus(app, tasks)]}</strong>
        {app.submittedAt ? <span className="text-muted"> · recorded {formatDateOnly(app.submittedAt.slice(0, 10))}</span> : null}
      </p>

      {app.status === 'preparing' ? (
        <button type="button" className="btn btn-primary mt-4" onClick={() => { setConfirmed(false); setSubmitOpen(true); }}>
          {isDemo ? 'Mark sample submission complete' : automatic ? 'I’ve submitted my admission application' : 'I’ve submitted this application'}
        </button>
      ) : null}

      {transitions.length && app.status !== 'preparing' ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div>
            <label htmlFor="next-status" className="label">
              Record an update from the provider
            </label>
            <select id="next-status" className="input" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as ApplicationStatus)}>
              <option value="">Choose an update</option>
              {transitions.map((t) => (
                <option key={t} value={t}>
                  {STATUS_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!nextStatus}
            onClick={() => {
              if (!nextStatus) return;
              const r = actions.updateApplication(app.id, { status: nextStatus });
              if (r.ok) setNextStatus('');
            }}
          >
            Save update
          </button>
        </div>
      ) : null}

      {app.status === 'awarded' ? (
        <div className="mt-5 space-y-4 rounded-xl bg-success-bg/60 p-4">
          <p className="text-sm">
            Award recorded by you{app.awardConfirmedUsd !== null ? `: ${formatMoney(app.awardConfirmedUsd)}` : ''}. Response: <strong>{app.offerResponseStatus ?? 'not needed'}</strong>.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div>
              <label htmlFor="award-amt" className="label">
                Awarded amount (USD, from your offer letter)
              </label>
              <input id="award-amt" className="input" inputMode="numeric" value={award} onChange={(e) => setAward(e.target.value)} />
            </div>
            <button type="button" className="btn btn-secondary" disabled={!awardValid} onClick={() => actions.updateApplication(app.id, { awardConfirmedUsd: awardNum })}>
              Save amount
            </button>
          </div>
          {app.offerResponseStatus === 'pending' ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div>
                  <label htmlFor="resp-date" className="label">
                    Offer response deadline (from the provider)
                  </label>
                  <input id="resp-date" type="date" className="input" value={responseDate} onChange={(e) => setResponseDate(e.target.value)} />
                </div>
                <button type="button" className="btn btn-secondary" disabled={!isValidDateOnly(responseDate)} onClick={() => actions.updateApplication(app.id, { offerResponseDeadlineOn: responseDate })}>
                  Save date
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => actions.updateApplication(app.id, { offerResponseStatus: 'accepted' }, 'Recorded: you accepted the offer.')}>
                  I accepted the offer
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => actions.updateApplication(app.id, { offerResponseStatus: 'declined' }, 'Recorded: you declined the offer.')}>
                  I declined the offer
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <button type="button" className="btn btn-ghost mt-6 -ml-3 text-danger" onClick={() => setRemoveOpen(true)}>
        <Trash2 aria-hidden="true" size={17} /> Remove application
      </button>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen} title="Record your submission" description="GRANTLY doesn’t send applications. Record this only after you’ve submitted through the provider’s official route.">
        {incomplete ? (
          <p className="mb-4 flex items-center gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm font-semibold text-warning">
            <AlertTriangle aria-hidden="true" size={16} /> You still have incomplete checklist items.
          </p>
        ) : null}
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-4 accent-[#194D43]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>I understand GRANTLY has not submitted anything for me. I submitted through the required official route.</span>
        </label>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => setSubmitOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!confirmed}
            onClick={() => {
              const r = actions.updateApplication(app.id, { status: 'submitted', confirmSubmission: true }, 'Submitted — recorded by you.');
              if (r.ok) setSubmitOpen(false);
            }}
          >
            Record submission
          </button>
        </div>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen} title="Remove this application from GRANTLY?" description="Your saved progress for it will be deleted.">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => setRemoveOpen(false)}>
            Keep it
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              const r = actions.removeApplication(app.id);
              if (r.ok) router.push('/applications');
            }}
          >
            Remove
          </button>
        </div>
      </Dialog>
    </section>
  );
}
