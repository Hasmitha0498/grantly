'use client';

import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <RD.Content
          className="animate-rise fixed inset-x-3 bottom-3 z-50 max-h-[85dvh] overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(92vw,520px)] sm:-translate-x-1/2 sm:-translate-y-1/2"
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex items-start justify-between gap-4">
            <RD.Title className="font-display text-xl font-semibold">{title}</RD.Title>
            <RD.Close aria-label="Close dialog" className="rounded-md p-2 text-muted hover:bg-canvas">
              <X aria-hidden="true" size={18} />
            </RD.Close>
          </div>
          {description ? <RD.Description className="mt-2 text-muted">{description}</RD.Description> : null}
          <div className="mt-5">{children}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

export const DialogClose = RD.Close;
