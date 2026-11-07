import { describe, expect, it } from 'vitest';
import { emptyState, seedDemo } from '@/repository/journey-core';
import { parseStored } from '@/repository/local-store';
import { NOW } from '../fixtures';

describe('parseStored', () => {
  it('null → empty state, not recovered', () => {
    expect(parseStored(null)).toEqual({ state: emptyState(), recovered: false });
    expect(parseStored('')).toEqual({ state: emptyState(), recovered: false });
  });

  it('garbage JSON → empty state, recovered', () => {
    expect(parseStored('{not json')).toEqual({ state: emptyState(), recovered: true });
  });

  it('valid JSON with the wrong shape → empty state, recovered', () => {
    expect(parseStored(JSON.stringify({ version: 2, applications: 'nope' }))).toEqual({ state: emptyState(), recovered: true });
  });

  it('a valid state round-trips exactly', () => {
    const state = seedDemo(NOW);
    const result = parseStored(JSON.stringify(state));
    expect(result.recovered).toBe(false);
    expect(result.state).toEqual(state);
  });
});
