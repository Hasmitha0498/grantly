import { cleanup, render, type RenderOptions } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { __resetCache, STORAGE_KEY } from '@/repository/local-store';
import { seedDemo } from '@/repository/journey-core';
import type { JourneyState } from '@/domain/types';
import { NOW } from '../fixtures';

// Vitest globals are off, so RTL's auto-cleanup isn't registered; do it here.
afterEach(() => cleanup());
beforeEach(() => {
  localStorage.clear();
  __resetCache();
});

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(<ToastProvider>{ui}</ToastProvider>, options);
}

export function seedState(mutate?: (s: JourneyState) => JourneyState): JourneyState {
  const base = seedDemo(NOW);
  const state = mutate ? mutate(base) : base;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  __resetCache();
  return state;
}

export function readStored(): JourneyState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as JourneyState;
}
