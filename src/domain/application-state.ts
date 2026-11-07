import type { Application, ApplicationStatus, ApplicationTask } from './types';

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  preparing: ['submitted', 'withdrawn'],
  submitted: ['waiting', 'action-required', 'awarded', 'not-selected', 'withdrawn'],
  waiting: ['action-required', 'awarded', 'not-selected', 'withdrawn'],
  'action-required': ['waiting', 'awarded', 'not-selected', 'withdrawn'],
  awarded: [],
  'not-selected': [],
  withdrawn: [],
};

export function allowedTransitions(from: ApplicationStatus): ApplicationStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class TransitionError extends Error {
  constructor(from: ApplicationStatus, to: ApplicationStatus) {
    super(`This application can’t move from “${STATUS_LABEL[from]}” to “${STATUS_LABEL[to]}”.`);
    this.name = 'TransitionError';
  }
}

export function progress(tasks: ApplicationTask[]): { completed: number; total: number; percent: number } {
  const required = tasks.filter((t) => t.required);
  const completed = required.filter((t) => t.status === 'complete').length;
  const total = required.length;
  return { completed, total, percent: total === 0 ? 100 : Math.round((completed / total) * 100) };
}

export type DisplayStatus = ApplicationStatus | 'ready';

/** `ready` is presentation-only and never persisted. */
export function displayStatus(app: Application, tasks: ApplicationTask[]): DisplayStatus {
  if (app.status !== 'preparing') return app.status;
  const p = progress(tasks);
  return p.total > 0 && p.completed === p.total ? 'ready' : 'preparing';
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  preparing: 'Preparing',
  ready: 'Ready to submit',
  submitted: 'Submitted — recorded by you',
  waiting: 'Waiting for provider',
  'action-required': 'Action required',
  awarded: 'Awarded — self-reported',
  'not-selected': 'Not selected',
  withdrawn: 'Withdrawn',
};

export function isClosed(status: ApplicationStatus): boolean {
  return status === 'not-selected' || status === 'withdrawn' || status === 'awarded';
}
