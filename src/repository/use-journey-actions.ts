'use client';

import { useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import * as core from './journey-core';
import { commit, StorageError } from './local-store';
import type { FundingOption, ProfileInput, StoryBankItem } from '@/domain/types';

/**
 * Mutation facade over the local repository. Each call persists first and
 * only then reports success; failures surface an honest message + retry.
 */
export function useJourneyActions() {
  const { notify } = useToast();

  const run = useCallback(
    <T,>(fn: () => T, success?: string): { ok: true; value: T } | { ok: false; error: unknown } => {
      const attempt = (): { ok: true; value: T } | { ok: false; error: unknown } => {
        try {
          const value = fn();
          if (success) notify(success);
          return { ok: true, value };
        } catch (error) {
          if (error instanceof core.ConflictError) return { ok: false, error };
          const message = error instanceof StorageError ? 'Your changes couldn’t be saved.' : error instanceof Error ? error.message : 'Something went wrong.';
          notify(message, 'error', error instanceof StorageError ? () => void attempt() : undefined);
          return { ok: false, error };
        }
      };
      return attempt();
    },
    [notify],
  );

  return {
    run,
    seedDemo: () => run(() => commit(() => core.seedDemo(new Date()))),
    resetAll: () => run(() => commit(() => core.emptyState())),
    saveProfile: (input: ProfileInput, success?: string) => run(() => commit((s) => core.saveProfile(s, input, new Date())), success),
    setBookmark: (id: string, saved: boolean) =>
      run(() => commit((s) => core.setBookmark(s, id, saved)), saved ? 'Saved to your journey.' : 'Removed from your saved list.'),
    setCompare: (option: FundingOption, selected: boolean) =>
      run(() => commit((s) => core.setCompare(s, option, selected))),
    startApplication: (scholarshipId: string, programId: string) =>
      run(() =>
        commit((s) => {
          const r = core.startApplication(s, scholarshipId, programId, new Date());
          return { state: r.state, result: r.application };
        }),
      ),
    updateApplication: (id: string, patch: core.ApplicationPatch, success = 'Your progress was updated.') =>
      run(() => commit((s) => core.updateApplication(s, id, patch, new Date())), success),
    removeApplication: (id: string) => run(() => commit((s) => core.removeApplication(s, id)), 'Application removed.'),
    updateTask: (taskId: string, patch: core.TaskPatch, success = 'Your progress was updated.') =>
      run(() => commit((s) => core.updateTask(s, taskId, patch)), success),
    saveStory: (story: StoryBankItem) => run(() => commit((s) => core.saveStory(s, story)), 'Story saved.'),
    removeStory: (id: string) => run(() => commit((s) => core.removeStory(s, id)), 'Story removed.'),
    saveEssay: (input: core.EssayInput, expectedRevision: number) =>
      run(() =>
        commit((s) => {
          const r = core.saveEssay(s, input, expectedRevision, new Date());
          return { state: r.state, result: r.draft };
        }),
      ),
  };
}
