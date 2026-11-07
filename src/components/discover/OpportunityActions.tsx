'use client';

import { useState } from 'react';
import { Bookmark, BookmarkCheck, Check, Plus } from 'lucide-react';
import { getProgram } from '@/data/demo-catalog';
import { MAX_COMPARE } from '@/repository/journey-core';
import { useJourneyActions } from '@/repository/use-journey-actions';
import { useToast } from '@/components/ui/Toast';
import { Dialog } from '@/components/ui/Dialog';
import type { JourneyState, Scholarship } from '@/domain/types';

export function SaveButton({ scholarship, state, label = 'Save' }: { scholarship: Scholarship; state: JourneyState; label?: string }) {
  const actions = useJourneyActions();
  const saved = state.bookmarks.includes(scholarship.id);
  return (
    <button
      type="button"
      className="btn btn-secondary"
      aria-pressed={saved}
      onClick={() => actions.setBookmark(scholarship.id, !saved)}
    >
      {saved ? <BookmarkCheck aria-hidden="true" size={18} /> : <Bookmark aria-hidden="true" size={18} />}
      {saved ? 'Saved' : label}
      <span className="sr-only"> {scholarship.title}</span>
    </button>
  );
}

/** Lets the student choose which program a multi-program award applies to. */
export function ProgramPicker({
  scholarship,
  open,
  onOpenChange,
  title,
  onPick,
  isPicked,
}: {
  scholarship: Scholarship;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  onPick: (programId: string) => void;
  isPicked?: (programId: string) => boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={`${scholarship.shortTitle} can be used for more than one program. Costs differ, so pick the one you mean.`}>
      <ul className="space-y-2">
        {scholarship.programIds.map((pid) => {
          const p = getProgram(pid);
          if (!p) return null;
          const picked = isPicked?.(pid) ?? false;
          return (
            <li key={pid}>
              <button type="button" className="btn btn-secondary w-full justify-between text-left" onClick={() => onPick(pid)} aria-pressed={isPicked ? picked : undefined}>
                <span>
                  {p.title}
                  <span className="block text-sm font-normal text-muted">{p.universityName}</span>
                </span>
                {picked ? <Check aria-hidden="true" size={18} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

export function CompareButton({ scholarship, state }: { scholarship: Scholarship; state: JourneyState }) {
  const actions = useJourneyActions();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const selected = state.compare.filter((c) => c.scholarshipId === scholarship.id);
  const inCompare = selected.length > 0;

  const toggle = (programId: string) => {
    const isOn = state.compare.some((c) => c.scholarshipId === scholarship.id && c.programId === programId);
    if (!isOn && state.compare.length >= MAX_COMPARE) {
      notify(`You can compare up to ${MAX_COMPARE} options. Remove one first.`, 'error');
      return;
    }
    const r = actions.setCompare({ scholarshipId: scholarship.id, programId }, !isOn);
    if (r.ok) notify(isOn ? 'Removed from compare.' : `Added to compare (${state.compare.length + 1} of ${MAX_COMPARE}).`);
    setOpen(false);
  };

  const onClick = () => {
    if (scholarship.programIds.length === 1) toggle(scholarship.programIds[0]!);
    else setOpen(true);
  };

  return (
    <>
      <button type="button" className="btn btn-secondary" aria-pressed={inCompare} onClick={onClick}>
        {inCompare ? <Check aria-hidden="true" size={18} /> : <Plus aria-hidden="true" size={18} />}
        {inCompare ? 'In compare' : 'Add to compare'}
        <span className="sr-only"> {scholarship.title}</span>
      </button>
      {scholarship.programIds.length > 1 ? (
        <ProgramPicker
          scholarship={scholarship}
          open={open}
          onOpenChange={setOpen}
          title="Which program should we compare?"
          onPick={toggle}
          isPicked={(pid) => state.compare.some((c) => c.scholarshipId === scholarship.id && c.programId === pid)}
        />
      ) : null}
    </>
  );
}
