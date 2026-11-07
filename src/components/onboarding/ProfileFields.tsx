'use client';

import { useId } from 'react';
import { FIELDS, programs } from '@/data/demo-catalog';
import { PRIORITY_OPTIONS, type FormErrors, type ProfileFormValues } from './profile-form';

type Setter = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;

interface FieldProps {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: (a11y: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => React.ReactNode;
}

export function Field({ id, label, help, error, children }: FieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, ...(error ? { 'aria-invalid': true as const } : {}) })}
      {help ? (
        <p id={helpId} className="help mt-1">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="error-text mt-1">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AboutYouFields({ v, set, errors }: { v: ProfileFormValues; set: Setter; errors: FormErrors }) {
  const uid = useId();
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id={`${uid}-name`} label="Your first name (optional)" help="We’ll use it to greet you." error={errors.displayName}>
        {(a) => <input {...a} name="displayName" className="input" autoComplete="given-name" maxLength={60} value={v.displayName} onChange={(e) => set('displayName', e.target.value)} />}
      </Field>
      <Field id={`${uid}-nat`} label="Nationality" error={errors.nationality}>
        {(a) => <input {...a} name="nationality" className="input" maxLength={60} value={v.nationality} onChange={(e) => set('nationality', e.target.value)} />}
      </Field>
      <Field id={`${uid}-cat`} label="Applicant category" help="We don’t infer this from nationality." error={errors.applicantCategory}>
        {(a) => (
          <select {...a} name="applicantCategory" className="input" value={v.applicantCategory} onChange={(e) => set('applicantCategory', e.target.value as ProfileFormValues['applicantCategory'])}>
            <option value="international">International applicant</option>
            <option value="us-citizen">US citizen</option>
            <option value="us-permanent-resident">US permanent resident</option>
            <option value="other-unknown">Other/unsure</option>
          </select>
        )}
      </Field>
      <Field id={`${uid}-qual`} label="Current qualification">
        {(a) => (
          <select {...a} name="currentQualification" className="input" value={v.currentQualification} onChange={(e) => set('currentQualification', e.target.value as ProfileFormValues['currentQualification'])}>
            <option value="final-year-bachelors">Final-year bachelor’s student</option>
            <option value="bachelors-complete">Bachelor’s completed</option>
          </select>
        )}
      </Field>
      <Field id={`${uid}-mk`} label="Academic score type" help="We never convert between grading scales.">
        {(a) => (
          <select {...a} name="metricKind" className="input" value={v.metricKind} onChange={(e) => set('metricKind', e.target.value as ProfileFormValues['metricKind'])}>
            <option value="percentage">Percentage</option>
            <option value="gpa-4">4.0 GPA</option>
            <option value="other">Other</option>
            <option value="none">I’d rather not say yet</option>
          </select>
        )}
      </Field>
      {v.metricKind === 'percentage' || v.metricKind === 'gpa-4' ? (
        <Field
          id={`${uid}-mv`}
          label={v.metricKind === 'percentage' ? 'Academic score (%)' : 'GPA (out of 4.0)'}
          error={errors.metricValue}
        >
          {(a) => (
            <input {...a} name="metricValue" className="input" inputMode="decimal" value={v.metricValue} onChange={(e) => set('metricValue', e.target.value)} />
          )}
        </Field>
      ) : v.metricKind === 'other' ? (
        <Field id={`${uid}-mo`} label="Describe your score" help="For example “8.6 / 10 CGPA”." error={errors.metricOther}>
          {(a) => <input {...a} name="metricOther" className="input" maxLength={80} value={v.metricOther} onChange={(e) => set('metricOther', e.target.value)} />}
        </Field>
      ) : (
        <div />
      )}
      <Field id={`${uid}-exp`} label="Full-time relevant experience (months)" error={errors.experienceMonths}>
        {(a) => <input {...a} name="experienceMonths" className="input" inputMode="numeric" value={v.experienceMonths} onChange={(e) => set('experienceMonths', e.target.value)} />}
      </Field>
      <fieldset className="rounded-xl border border-line p-4 sm:col-span-2">
        <legend className="px-1 font-semibold">Annual household income (optional)</legend>
        <p className="help mb-3">
          Only used for a preliminary check on need-based funding. It isn’t proof of need, and you can skip it. Providers assess need from their own documents.
        </p>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field id={`${uid}-inc`} label="Amount" error={errors.incomeAmount}>
            {(a) => <input {...a} name="incomeAmount" className="input" inputMode="numeric" value={v.incomeAmount} onChange={(e) => set('incomeAmount', e.target.value)} />}
          </Field>
          <Field id={`${uid}-cur`} label="Currency">
            {(a) => (
              <select {...a} name="incomeCurrency" className="input" value={v.incomeCurrency} onChange={(e) => set('incomeCurrency', e.target.value as 'INR' | 'USD')}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            )}
          </Field>
        </div>
      </fieldset>
    </div>
  );
}

export function PlansFields({ v, set, errors }: { v: ProfileFormValues; set: Setter; errors: FormErrors }) {
  const uid = useId();
  const toggleProgram = (id: string, on: boolean) => {
    const next = on ? [...v.targetProgramIds.filter((p) => p !== id), id] : v.targetProgramIds.filter((p) => p !== id);
    set('targetProgramIds', next.slice(0, 3));
  };
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id={`${uid}-field`} label="Subject you want to study" error={errors.intendedField}>
        {(a) => (
          <select {...a} name="intendedField" className="input" value={v.intendedField} onChange={(e) => set('intendedField', e.target.value)}>
            <option value="">Choose a subject</option>
            {FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field id={`${uid}-intake`} label="Start term">
        {(a) => (
          <select {...a} name="targetIntake" className="input" value={v.targetIntake} onChange={(e) => set('targetIntake', e.target.value)}>
            <option>Fall 2027</option>
            <option>Spring 2028</option>
            <option>Fall 2028</option>
          </select>
        )}
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="label">Programs you’re considering (optional, up to 3)</legend>
        <ul className="grid gap-2 sm:grid-cols-3">
          {programs.map((p) => {
            const checked = v.targetProgramIds.includes(p.id);
            return (
              <li key={p.id}>
                <label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${checked ? 'border-forest bg-mint' : 'border-line bg-white'}`}>
                  <input type="checkbox" className="mt-1 size-4 accent-[#194D43]" checked={checked} onChange={(e) => toggleProgram(p.id, e.target.checked)} />
                  <span>
                    <span className="block font-semibold">{p.title}</span>
                    <span className="text-muted">{p.universityName}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {errors.targetProgramIds ? <p className="error-text mt-1">{errors.targetProgramIds}</p> : null}
      </fieldset>
      <Field id={`${uid}-budget`} label="Total budget for the whole program (USD, optional)" help="Tuition, fees and living costs you can cover without this funding." error={errors.budget}>
        {(a) => <input {...a} name="budget" className="input" inputMode="numeric" value={v.budget} onChange={(e) => set('budget', e.target.value)} />}
      </Field>
    </div>
  );
}

export function PriorityFields({ v, set, legend = 'What matters most to you?' }: { v: ProfileFormValues; set: Setter; legend?: string }) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {PRIORITY_OPTIONS.map((o) => {
          const checked = v.priority === o.value;
          return (
            <label key={o.value} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4 ${checked ? 'border-forest bg-mint' : 'border-line bg-white'}`}>
              <input type="radio" name="priority" className="mt-1 size-4 accent-[#194D43]" value={o.value} checked={checked} onChange={() => set('priority', o.value)} />
              <span>
                <span className="block font-semibold">{o.label}</span>
                <span className="text-sm text-muted">{o.help}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
