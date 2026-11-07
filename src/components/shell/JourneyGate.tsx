'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { LoadingState } from '@/components/ui/primitives';
import { useJourney } from '@/repository/local-store';
import { useJourneyActions } from '@/repository/use-journey-actions';
import type { JourneyState, StudentProfile } from '@/domain/types';

/** Renders children only once local state is loaded and a profile exists. */
export function JourneyGate({
  children,
  loadingLabel,
}: {
  children: (state: JourneyState & { profile: StudentProfile }) => React.ReactNode;
  loadingLabel?: string;
}) {
  const state = useJourney();
  const actions = useJourneyActions();
  if (!state) return <LoadingState label={loadingLabel} />;
  if (!state.profile) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto mb-3 w-fit rounded-full bg-mint p-3 text-forest">
          <Sparkles aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-semibold">Let’s set up your funding journey first.</h1>
        <p className="mt-2 text-muted">Create a short profile, or explore with a fictional sample student.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" className="btn btn-primary" onClick={() => actions.seedDemo()}>
            Explore a demo journey
          </button>
          <Link href="/onboarding" className="btn btn-secondary">
            Create my funding profile
          </Link>
        </div>
      </div>
    );
  }
  return <>{children(state as JourneyState & { profile: StudentProfile })}</>;
}
