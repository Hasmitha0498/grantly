import { describe, expect, it } from 'vitest';
import { countWords, evaluateEssayDraft } from '@/domain/essay';

describe('essay word counting', () => {
  it('ES-01 whitespace-only body → 0 words and cannot be marked ready', () => {
    const r = evaluateEssayDraft('   \n\t  \n ', 250, true);
    expect(r).toEqual({ words: 0, limit: 250, overBy: 0, isEmpty: true, canMarkReady: false, ready: false });
  });

  it('ES-02 251 words over a 250 limit → overBy 1, cannot be marked ready', () => {
    const body = Array.from({ length: 251 }, (_, i) => `w${i}`).join(' ');
    const r = evaluateEssayDraft(body, 250, true);
    expect(r.words).toBe(251);
    expect(r.overBy).toBe(1);
    expect(r.canMarkReady).toBe(false);
    expect(r.ready).toBe(false);
  });

  it('exactly at the limit can be marked ready; ready requires the user flag', () => {
    const body = Array.from({ length: 250 }, () => 'word').join(' ');
    expect(evaluateEssayDraft(body, 250, false)).toMatchObject({ words: 250, overBy: 0, canMarkReady: true, ready: false });
    expect(evaluateEssayDraft(body, 250, true).ready).toBe(true);
  });

  it('counts across newlines and repeated spaces', () => {
    expect(countWords('one   two\n\nthree\tfour  ')).toBe(4);
    expect(countWords('  leading and trailing  ')).toBe(3);
  });

  it('treats apostrophes and unspaced em dashes as part of a word', () => {
    expect(countWords("I don't know what I'd do")).toBe(6);
    expect(countWords('well—maybe not')).toBe(2);
  });

  it('empty string → 0', () => {
    expect(countWords('')).toBe(0);
  });
});
