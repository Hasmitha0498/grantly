'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useJourney } from '@/repository/local-store';
import { useJourneyActions } from '@/repository/use-journey-actions';
import { Dialog } from '@/components/ui/Dialog';

export function LandingCtas() {
  const state = useJourney();
  const actions = useJourneyActions();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hasProfile = Boolean(state?.profile);
  const isRealProfile = Boolean(state?.profile && !state.profile.isDemo);

  const startDemo = () => {
    const r = actions.seedDemo();
    if (r.ok) router.push('/dashboard');
  };

  return (
    <div className="mt-8 flex min-h-[48px] flex-col gap-3 sm:flex-row sm:flex-wrap">
      {hasProfile ? (
        <Link href="/dashboard" className="btn btn-primary">
          Continue my journey
        </Link>
      ) : null}
      <button
        type="button"
        className={`btn ${hasProfile ? 'btn-secondary' : 'btn-primary'}`}
        onClick={() => (isRealProfile ? setConfirmOpen(true) : startDemo())}
      >
        Explore a demo journey
      </button>
      <Link href="/onboarding" className="btn btn-secondary">
        Create my funding profile
      </Link>
      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Replace your saved profile with the demo?"
        description="The demo uses a fictional student, Aisha. Loading it replaces the profile and progress saved on this device."
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>
            Keep my profile
          </button>
          <button type="button" className="btn btn-primary" onClick={startDemo}>
            Load the demo
          </button>
        </div>
      </Dialog>
    </div>
  );
}
