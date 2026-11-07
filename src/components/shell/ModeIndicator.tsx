'use client';

import { HardDrive } from 'lucide-react';
import { useJourney } from '@/repository/local-store';

/** Honest persistence label: this build only saves on this device. */
export function ModeIndicator({ compact = false }: { compact?: boolean }) {
  const state = useJourney();
  const isDemo = state?.profile?.isDemo ?? false;

  if (compact) {
    return (
      <p className="flex items-center justify-center gap-2 bg-mint px-4 py-1.5 text-center text-xs font-semibold text-forest">
        <HardDrive aria-hidden="true" size={14} />
        Demo mode — saved on this device
        {isDemo ? <span className="font-normal">· Sample data</span> : null}
      </p>
    );
  }
  return (
    <div className="rounded-xl bg-mint p-3 text-xs text-forest">
      <p className="flex items-center gap-2 font-semibold">
        <HardDrive aria-hidden="true" size={14} />
        Demo mode — saved on this device
      </p>
      <p className="mt-1 text-[0.78rem] leading-snug text-muted">
        {isDemo ? 'Sample data — not real scholarship offers.' : 'All opportunities are fictional samples.'} Nothing is sent to a server.
      </p>
    </div>
  );
}
