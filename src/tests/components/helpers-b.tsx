import { act, cleanup, render } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import type { ReactElement } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { seedDemo } from '@/repository/journey-core';
import { __resetCache, commit, STORAGE_KEY } from '@/repository/local-store';
import type { JourneyState } from '@/domain/types';
import { NOW } from '../fixtures';

export const LK = 'lakeshore-global__prog-lakeshore-mscs';
export const MD = 'meridian-need__prog-lakeshore-mscs';
export const SM = 'summit-leadership__prog-northfield-mscs';

export const nav = {
  push: vi.fn(),
  replace: vi.fn(),
  pathname: '/dashboard',
};

export function resetEnv() {
  localStorage.clear();
  __resetCache();
  nav.push.mockReset();
  nav.replace.mockReset();
  nav.pathname = '/dashboard';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

export function seed(mutate?: (s: JourneyState) => JourneyState): JourneyState {
  let s = seedDemo(NOW);
  if (mutate) s = mutate(s);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  __resetCache();
  return s;
}

export function stored(): JourneyState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as JourneyState;
}

/** Simulate a write from elsewhere (another tab / background action). */
export function externalCommit(fn: (s: JourneyState) => JourneyState) {
  act(() => {
    commit(fn);
  });
}

export function renderApp(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}
