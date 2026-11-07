'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { getScholarship } from '@/data/demo-catalog';
import { evaluateEssayDraft } from '@/domain/essay';
import type { Application, EssayDraft, EssayOutline, EssayPrompt, JourneyState, StoryBankItem, StudentProfile } from '@/domain/types';
import { ConflictError } from '@/repository/journey-core';
import { useJourneyActions } from '@/repository/use-journey-actions';
import { JourneyGate } from '@/components/shell/JourneyGate';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { StoryBank } from './StoryBank';

const STAGES = ['Understand', 'My stories', 'Outline', 'Draft', 'Review'] as const;
type Stage = (typeof STAGES)[number];
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

const OUTLINE_FIELDS: { key: keyof EssayOutline; label: string }[] = [
  { key: 'situation', label: 'Start with the situation' },
  { key: 'action', label: 'Show what you did' },
  { key: 'result', label: 'Explain the outcome' },
  { key: 'connection', label: 'Connect it to your goals' },
];

export function EssayStudio({ applicationId, promptId }: { applicationId: string; promptId: string }) {
  return (
    <JourneyGate>
      {(state) => {
        const app = state.applications.find((a) => a.id === applicationId);
        const prompt = app ? getScholarship(app.scholarshipId)?.essayPrompts.find((p) => p.id === promptId) : undefined;
        if (!app || !prompt) {
          return (
            <div className="card p-8 text-center">
              <h1 className="font-display text-2xl font-semibold">We couldn’t find that essay.</h1>
              <Link href="/applications" className="btn btn-primary mt-5">
                Back to applications
              </Link>
            </div>
          );
        }
        const draft = state.essays.find((e) => e.applicationId === app.id && e.promptId === prompt.id) ?? null;
        return <Studio app={app} prompt={prompt} saved={draft} state={state} />;
      }}
    </JourneyGate>
  );
}

interface Buffer {
  body: string;
  outline: EssayOutline;
  selectedStoryIds: string[];
}

function bufferOf(d: EssayDraft | null): Buffer {
  return {
    body: d?.body ?? '',
    outline: d?.outline ?? { situation: '', action: '', result: '', connection: '' },
    selectedStoryIds: d?.selectedStoryIds ?? [],
  };
}

function Studio({ app, prompt, saved, state }: { app: Application; prompt: EssayPrompt; saved: EssayDraft | null; state: JourneyState & { profile: StudentProfile } }) {
  const actions = useJourneyActions();
  const { notify } = useToast();
  const [stage, setStage] = useState<Stage>(saved?.body ? 'Draft' : 'Understand');
  const [buffer, setBuffer] = useState<Buffer>(() => bufferOf(saved));
  const [status, setStatus] = useState<SaveStatus>(saved ? 'saved' : 'idle');
  const [conflict, setConflict] = useState<EssayDraft | null>(null);
  const [readyOpen, setReadyOpen] = useState(false);
  const [ownWords, setOwnWords] = useState(false);
  const revision = useRef(saved?.revision ?? 0);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferRef = useRef(buffer);
  useEffect(() => {
    bufferRef.current = buffer;
  }, [buffer]);

  const evaluation = evaluateEssayDraft(buffer.body, prompt.wordLimit, saved?.userMarkedReady ?? false);

  const save = useCallback(
    (opts: { markReady?: boolean; force?: boolean } = {}) => {
      if (timer.current) clearTimeout(timer.current);
      setStatus('saving');
      const b = bufferRef.current;
      const expected = opts.force && conflict ? conflict.revision : revision.current;
      const r = actions.saveEssay(
        {
          applicationId: app.id,
          promptId: prompt.id,
          body: b.body,
          outline: b.outline,
          selectedStoryIds: b.selectedStoryIds,
          userMarkedReady: opts.markReady ?? (saved?.userMarkedReady ?? false),
        },
        expected,
      );
      if (r.ok && r.value) {
        revision.current = r.value.revision;
        dirty.current = false;
        setConflict(null);
        setStatus('saved');
        return true;
      }
      if (!r.ok && r.error instanceof ConflictError) {
        setConflict(r.error.current);
        setStatus('conflict');
      } else {
        setStatus('error');
      }
      return false;
    },
    [actions, app.id, prompt.id, saved?.userMarkedReady, conflict],
  );

  const edit = (patch: Partial<Buffer>) => {
    setBuffer((b) => ({ ...b, ...patch }));
    dirty.current = true;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(), 800);
  };

  // Flush pending edits when the page is hidden or unloaded; warn only if persistence failed.
  useEffect(() => {
    const flush = () => {
      if (dirty.current && timer.current) save();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush();
      if (dirty.current) e.preventDefault();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [save]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const stories = state.stories;
  const toggleStory = (s: StoryBankItem) =>
    edit({ selectedStoryIds: buffer.selectedStoryIds.includes(s.id) ? buffer.selectedStoryIds.filter((x) => x !== s.id) : [...buffer.selectedStoryIds, s.id] });

  const markReady = () => {
    if (!evaluation.canMarkReady || !ownWords) return;
    if (save({ markReady: true })) notify('Essay marked ready. Your next action has been updated.');
    setReadyOpen(false);
  };

  const statusText: Record<SaveStatus, string> = { idle: 'Not saved yet', saving: 'Saving…', saved: 'Saved', error: 'Couldn’t save. Retry', conflict: 'Changed in another tab' };

  return (
    <div>
      <Link href={`/applications/${encodeURIComponent(app.id)}`} className="btn btn-ghost -ml-3 mb-4 min-h-10 px-3">
        <ArrowLeft aria-hidden="true" size={18} /> Back to application
      </Link>
      <h1 className="text-[1.75rem] font-semibold leading-tight sm:text-4xl">Turn your experience into a strong answer.</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">The prompt</p>
            <p className="mt-2 font-display text-lg leading-snug">“{prompt.question}”</p>
            <p className="mt-2 text-sm font-semibold">Word limit: {prompt.wordLimit}</p>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm" role="status" aria-live="polite">
            <span className={`inline-block size-2 rounded-full ${status === 'saved' ? 'bg-success' : status === 'error' || status === 'conflict' ? 'bg-danger' : 'bg-warning'}`} aria-hidden="true" />
            {status === 'error' ? (
              <button type="button" className="font-semibold text-danger underline" onClick={() => save()}>
                Couldn’t save. Retry
              </button>
            ) : (
              <span data-testid="save-status">{statusText[status]}</span>
            )}
            <span className="text-muted">· on this device</span>
          </p>
        </aside>

        <div className="min-w-0">
          <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Essay steps">
            {STAGES.map((s, i) => (
              <li key={s} className="shrink-0">
                <button
                  type="button"
                  aria-current={stage === s ? 'step' : undefined}
                  onClick={() => setStage(s)}
                  className={`pill min-h-11 border px-4 text-sm ${stage === s ? 'border-forest bg-forest text-white' : 'border-line bg-white text-ink hover:bg-mint'}`}
                >
                  <span aria-hidden="true">{i + 1}.</span> {s}
                </button>
              </li>
            ))}
          </ol>

          <div className="card mt-4 p-5 sm:p-7">
            {stage === 'Understand' ? (
              <section aria-labelledby="st-understand">
                <h2 id="st-understand" className="text-xl font-semibold">What this question is really asking</h2>
                <ul className="mt-3 space-y-2">
                  {prompt.interpretation.map((x) => (
                    <li key={x} className="flex gap-2">
                      <Check aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-success" />
                      {x}
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn-primary mt-6" onClick={() => setStage('My stories')}>
                  Choose a story
                </button>
              </section>
            ) : null}

            {stage === 'My stories' ? (
              <section aria-labelledby="st-stories">
                <h2 id="st-stories" className="text-xl font-semibold">Your Story Bank</h2>
                <p className="help mt-1">Real experiences in your own words. Select the ones to use for this answer.</p>
                <StoryBank stories={stories} selected={buffer.selectedStoryIds} onToggle={toggleStory} />
                <button type="button" className="btn btn-primary mt-6" onClick={() => setStage('Outline')}>
                  Build your outline
                </button>
              </section>
            ) : null}

            {stage === 'Outline' ? (
              <section aria-labelledby="st-outline">
                <h2 id="st-outline" className="text-xl font-semibold">Build your outline</h2>
                {buffer.selectedStoryIds.length ? (
                  <p className="help mt-1">Using: {stories.filter((s) => buffer.selectedStoryIds.includes(s.id)).map((s) => s.title).join(', ')}</p>
                ) : null}
                <div className="mt-4 space-y-4">
                  {OUTLINE_FIELDS.map((f) => (
                    <div key={f.key}>
                      <label htmlFor={`ol-${f.key}`} className="label">
                        {f.label}
                      </label>
                      <textarea
                        id={`ol-${f.key}`}
                        className="input min-h-20"
                        maxLength={1500}
                        value={buffer.outline[f.key]}
                        onChange={(e) => edit({ outline: { ...buffer.outline, [f.key]: e.target.value } })}
                      />
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-primary mt-6" onClick={() => setStage('Draft')}>
                  Start writing
                </button>
              </section>
            ) : null}

            {stage === 'Draft' ? (
              <section aria-labelledby="st-draft">
                <label id="st-draft" htmlFor="essay-body" className="font-display text-xl font-semibold">
                  Write in your own words
                </label>
                <textarea
                  id="essay-body"
                  className="input mt-3 min-h-80 leading-relaxed"
                  placeholder="Start with a real experience you want the reader to remember…"
                  maxLength={20000}
                  value={buffer.body}
                  aria-describedby="wc"
                  aria-invalid={evaluation.overBy > 0 || undefined}
                  onChange={(e) => edit({ body: e.target.value })}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p id="wc" className={`text-sm font-semibold ${evaluation.overBy ? 'text-danger' : 'text-muted'}`} aria-live="polite">
                    {evaluation.words} / {prompt.wordLimit} words
                    {evaluation.overBy ? ` — You’re ${evaluation.overBy} words over the limit.` : ''}
                  </p>
                  <button type="button" className="btn btn-secondary" onClick={() => save()}>
                    Save draft
                  </button>
                </div>
                {buffer.outline.situation || buffer.outline.action ? (
                  <details className="mt-4 rounded-xl bg-canvas p-4 text-sm">
                    <summary className="cursor-pointer font-semibold">Your outline</summary>
                    <dl className="mt-2 space-y-2">
                      {OUTLINE_FIELDS.filter((f) => buffer.outline[f.key]).map((f) => (
                        <div key={f.key}>
                          <dt className="font-semibold">{f.label}</dt>
                          <dd className="whitespace-pre-wrap text-muted">{buffer.outline[f.key]}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
              </section>
            ) : null}

            {stage === 'Review' ? (
              <section aria-labelledby="st-review">
                <h2 id="st-review" className="text-xl font-semibold">Ready to review?</h2>
                <p className="mt-2">Check the prompt, word limit, and whether every claim is your own.</p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li>{evaluation.isEmpty ? '✗ Your draft is empty.' : '✓ You have a draft.'}</li>
                  <li>{evaluation.overBy ? `✗ You’re ${evaluation.overBy} words over the limit.` : `✓ ${evaluation.words} of ${prompt.wordLimit} words.`}</li>
                  <li>{saved?.userMarkedReady ? '✓ You marked this essay ready.' : '○ Not marked ready yet.'}</li>
                </ul>
                <div className="mt-6 flex flex-wrap gap-2">
                  {saved?.userMarkedReady ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        if (save({ markReady: false })) notify('Essay moved back to drafting.');
                      }}
                    >
                      Keep working on it
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary" disabled={!evaluation.canMarkReady} onClick={() => { setOwnWords(false); setReadyOpen(true); }}>
                      Mark essay ready
                    </button>
                  )}
                  <Link href={`/applications/${encodeURIComponent(app.id)}`} className="btn btn-secondary">
                    Back to application
                  </Link>
                </div>
              </section>
            ) : null}
          </div>
          <p className="mt-4 text-sm text-muted">GRANTLY helps you plan and review. Follow each provider’s rules for AI and writing assistance.</p>
        </div>
      </div>

      <Dialog open={readyOpen} onOpenChange={setReadyOpen} title="Mark essay ready?" description="This marks the essay step in your checklist as ready. You submit the essay yourself through the provider.">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-4 accent-[#194D43]" checked={ownWords} onChange={(e) => setOwnWords(e.target.checked)} />
          <span>Every claim in this essay is true and written in my own words.</span>
        </label>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => setReadyOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!ownWords} onClick={markReady}>
            Mark essay ready
          </button>
        </div>
      </Dialog>

      <Dialog open={status === 'conflict' && conflict !== null} onOpenChange={() => undefined} title="This draft changed in another tab" description="Your text here is safe. Choose which version to keep.">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (!conflict) return;
              setBuffer(bufferOf(conflict));
              revision.current = conflict.revision;
              dirty.current = false;
              setConflict(null);
              setStatus('saved');
            }}
          >
            Load the saved version
          </button>
          <button type="button" className="btn btn-primary" onClick={() => save({ force: true })}>
            Keep my version
          </button>
        </div>
      </Dialog>
    </div>
  );
}


