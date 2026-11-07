'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { JourneyGate } from '@/components/shell/JourneyGate';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/ui/primitives';
import { useJourneyActions } from '@/repository/use-journey-actions';
import type { EvidenceCategory, StudentProfile } from '@/domain/types';
import { AboutYouFields, Field, PlansFields, PriorityFields } from './ProfileFields';
import { focusFirstError } from './OnboardingStepper';
import { fromProfile, toProfileInput, validateAll, type FormErrors, type ProfileFormValues } from './profile-form';

export function ProfileEditor() {
  return <JourneyGate>{(state) => <Editor key={state.profile.updatedAt} profile={state.profile} />}</JourneyGate>;
}

const CATEGORIES: EvidenceCategory[] = ['academic', 'research', 'leadership', 'community', 'other'];

function Editor({ profile }: { profile: StudentProfile }) {
  const [values, setValues] = useState<ProfileFormValues>(() => fromProfile(profile));
  const [errors, setErrors] = useState<FormErrors>({});
  const [resetOpen, setResetOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const actions = useJourneyActions();
  const router = useRouter();

  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateAll(values);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      focusFirstError(formRef.current);
      return;
    }
    actions.saveProfile(toProfileInput(values, profile.isDemo), 'Profile updated. We’ve refreshed your funding fit.');
  };

  const addEvidence = () =>
    set('evidence', [...values.evidence, { id: `ev-${Date.now().toString(36)}`, category: 'leadership', description: '' }]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Your funding profile" subtitle="Keep this up to date so your matches and cost comparisons stay relevant." />
      <p className="mb-6 rounded-xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">Your eligibility may change when these details change.</p>
      <form ref={formRef} noValidate onSubmit={onSubmit} className="space-y-6">
        <section className="card p-5 sm:p-7" aria-labelledby="sec-about">
          <h2 id="sec-about" className="mb-5 text-xl font-semibold">About you</h2>
          <AboutYouFields v={values} set={set} errors={errors} />
        </section>
        <section className="card p-5 sm:p-7" aria-labelledby="sec-plans">
          <h2 id="sec-plans" className="mb-5 text-xl font-semibold">Your master’s plans</h2>
          <PlansFields v={values} set={set} errors={errors} />
        </section>
        <section className="card p-5 sm:p-7" aria-labelledby="sec-priority">
          <h2 id="sec-priority" className="mb-5 text-xl font-semibold">Your priority</h2>
          <PriorityFields v={values} set={set} />
        </section>
        <section className="card p-5 sm:p-7" aria-labelledby="sec-evidence">
          <h2 id="sec-evidence" className="text-xl font-semibold">Evidence &amp; achievements</h2>
          <p className="help mt-1 mb-5">
            Real examples in your own words. We use these to show how your evidence lines up with selection criteria — never as a chance of winning.
          </p>
          <ul className="space-y-4">
            {values.evidence.map((ev, i) => (
              <li key={ev.id} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[180px_1fr_auto] sm:items-end">
                <Field id={`${ev.id}-cat`} label="Category">
                  {(a) => (
                    <select
                      {...a}
                      className="input"
                      value={ev.category}
                      onChange={(e) => set('evidence', values.evidence.map((x, j) => (j === i ? { ...x, category: e.target.value as EvidenceCategory } : x)))}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field id={`${ev.id}-desc`} label="Example">
                  {(a) => (
                    <input
                      {...a}
                      className="input"
                      maxLength={400}
                      value={ev.description}
                      onChange={(e) => set('evidence', values.evidence.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                    />
                  )}
                </Field>
                <button type="button" className="btn btn-ghost" aria-label={`Remove evidence ${i + 1}`} onClick={() => set('evidence', values.evidence.filter((_, j) => j !== i))}>
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-secondary mt-4" onClick={addEvidence} disabled={values.evidence.length >= 20}>
            <Plus aria-hidden="true" size={18} /> Add evidence
          </button>
        </section>
        <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between md:bottom-4">
          <p className="text-sm text-muted">Saved on this device</p>
          <button type="submit" className="btn btn-primary">
            Save changes
          </button>
        </div>
      </form>

      <section className="card mt-10 p-5 sm:p-7" aria-labelledby="sec-reset">
        <h2 id="sec-reset" className="text-xl font-semibold">{profile.isDemo ? 'Reset demo journey' : 'Clear saved data'}</h2>
        <p className="help mt-1">Removes the profile, applications, stories and drafts saved in this browser.</p>
        <button type="button" className="btn btn-secondary mt-4" onClick={() => setResetOpen(true)}>
          {profile.isDemo ? 'Reset demo journey' : 'Clear saved data'}
        </button>
      </section>
      <Dialog open={resetOpen} onOpenChange={setResetOpen} title={profile.isDemo ? 'Reset demo journey?' : 'Clear saved data?'} description="This clears only this demo session’s saved progress.">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => setResetOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              const r = profile.isDemo ? actions.seedDemo() : actions.resetAll();
              setResetOpen(false);
              if (r.ok) router.push(profile.isDemo ? '/dashboard' : '/');
            }}
          >
            {profile.isDemo ? 'Reset demo' : 'Clear data'}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
