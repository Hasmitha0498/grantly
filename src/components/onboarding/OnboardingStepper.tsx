'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProgressBar } from '@/components/ui/primitives';
import { useJourneyActions } from '@/repository/use-journey-actions';
import { AboutYouFields, PlansFields, PriorityFields } from './ProfileFields';
import { emptyForm, toProfileInput, validateStep, type FormErrors, type ProfileFormValues } from './profile-form';

const STEPS = [
  { title: 'Let’s start with you.', helper: 'A few details help us rule out opportunities that aren’t relevant.' },
  { title: 'What are you planning to study?', helper: 'We’ll focus on funding that fits your degree and destination.' },
  { title: 'What matters most to you?', helper: 'There isn’t one best scholarship for everyone.' },
] as const;

export function focusFirstError(root: HTMLElement | null) {
  requestAnimationFrame(() => {
    const el = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.focus();
  });
}

export function OnboardingStepper() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [values, setValues] = useState<ProfileFormValues>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const actions = useJourneyActions();
  const router = useRouter();

  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const goTo = (s: 1 | 2 | 3) => {
    setStep(s);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateStep(values, step);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      focusFirstError(formRef.current);
      return;
    }
    if (step < 3) {
      goTo((step + 1) as 2 | 3);
      return;
    }
    const r = actions.saveProfile(toProfileInput(values, false), 'Your funding profile is ready.');
    if (r.ok) router.push('/dashboard');
  };

  const meta = STEPS[step - 1];
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-semibold text-muted" aria-live="polite">
        Step {step} of 3
      </p>
      <div className="mt-2">
        <ProgressBar value={(step / 3) * 100} label={`Profile setup, step ${step} of 3`} />
      </div>
      <form ref={formRef} noValidate onSubmit={onSubmit} className="card mt-6 p-5 sm:p-8">
        <h1 ref={headingRef} tabIndex={-1} className="text-[1.75rem] font-semibold leading-tight sm:text-3xl">
          {meta.title}
        </h1>
        <p className="mt-2 text-muted">{meta.helper}</p>
        <div className="mt-6">
          {step === 1 ? <AboutYouFields v={values} set={set} errors={errors} /> : null}
          {step === 2 ? <PlansFields v={values} set={set} errors={errors} /> : null}
          {step === 3 ? <PriorityFields v={values} set={set} /> : null}
        </div>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <button type="button" className="btn btn-secondary" onClick={() => goTo((step - 1) as 1 | 2)}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary">
            {step < 3 ? 'Continue' : 'Show my funding options'}
          </button>
        </div>
      </form>
    </div>
  );
}
