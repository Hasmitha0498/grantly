'use client';

/**
 * Local demo repository: versioned localStorage with schema validation.
 * Only used in "Demo mode — saved on this device". Writes are confirmed
 * before the in-memory state changes, so the UI never claims a save that
 * did not happen.
 */
import { useSyncExternalStore } from 'react';
import { journeyStateSchema } from '@/domain/schemas';
import type { JourneyState } from '@/domain/types';
import { emptyState } from './journey-core';

export const STORAGE_KEY = 'grantly:journey:v1';

export class StorageError extends Error {
  constructor() {
    super('Your changes couldn’t be saved.');
    this.name = 'StorageError';
  }
}

export type LoadResult = { state: JourneyState; recovered: boolean };

export function parseStored(raw: string | null): LoadResult {
  if (!raw) return { state: emptyState(), recovered: false };
  try {
    const parsed = journeyStateSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return { state: parsed.data as JourneyState, recovered: false };
  } catch {
    // fall through to reset
  }
  return { state: emptyState(), recovered: true };
}

type Listener = () => void;

let current: JourneyState | null = null;
let recovered = false;
const listeners = new Set<Listener>();

function read(): JourneyState {
  if (current) return current;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  const result = parseStored(raw);
  current = result.state;
  recovered = result.recovered;
  return current;
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      current = parseStored(e.newValue).state;
      emit();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Apply a pure transition and persist it. Throws StorageError if the write fails. */
export function commit<T = void>(fn: (s: JourneyState) => { state: JourneyState; result?: T } | JourneyState): T | undefined {
  const prev = read();
  const out = fn(prev);
  const next = 'version' in out ? out : out.state;
  const result = 'version' in out ? undefined : out.result;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new StorageError();
  }
  current = next;
  emit();
  return result;
}

export function wasRecovered(): boolean {
  return recovered;
}

/** For tests: drop the in-memory cache. */
export function __resetCache() {
  current = null;
}

const serverSnapshot = null;

/** Returns null during SSR/hydration so no localStorage read happens on the server. */
export function useJourney(): JourneyState | null {
  return useSyncExternalStore(subscribe, read, () => serverSnapshot);
}
