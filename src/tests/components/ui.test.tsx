import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '@/components/ui/Toast';
import { Dialog } from '@/components/ui/Dialog';
import { EligibilityBadge, EmptyState, ProgressBar } from '@/components/ui/primitives';
import { ELIGIBILITY_COPY } from '@/domain/eligibility';
import { useJourneyActions } from '@/repository/use-journey-actions';
import type { Eligibility } from '@/domain/types';
import { renderApp, resetEnv, stored } from './helpers-b';

function ToastHarness({ onRetry }: { onRetry: () => void }) {
  const { notify } = useToast();
  return (
    <>
      <button type="button" onClick={() => notify('All good.')}>
        ok
      </button>
      <button type="button" onClick={() => notify('Broke.', 'error', onRetry)}>
        fail
      </button>
    </>
  );
}

describe('Toast', () => {
  beforeEach(resetEnv);

  it('shows a message and can be dismissed', async () => {
    const user = userEvent.setup();
    renderApp(<ToastHarness onRetry={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'ok' }));
    expect(screen.getByText('All good.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(screen.queryByText('All good.')).not.toBeInTheDocument();
  });

  it('error tone offers Retry which calls back and dismisses', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderApp(<ToastHarness onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: 'fail' }));
    expect(screen.getByText('Broke.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Broke.')).not.toBeInTheDocument();
  });

  it('keeps at most three toasts', async () => {
    const user = userEvent.setup();
    renderApp(<ToastHarness onRetry={vi.fn()} />);
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'ok' }));
    expect(screen.getAllByText('All good.')).toHaveLength(3);
  });
});

describe('primitives', () => {
  it('ProgressBar clamps and rounds aria-valuenow', () => {
    render(
      <>
        <ProgressBar value={-20} label="low" />
        <ProgressBar value={42.6} label="mid" />
        <ProgressBar value={180} label="high" />
      </>,
    );
    expect(screen.getByRole('progressbar', { name: 'low' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('progressbar', { name: 'mid' })).toHaveAttribute('aria-valuenow', '43');
    expect(screen.getByRole('progressbar', { name: 'high' })).toHaveAttribute('aria-valuenow', '100');
  });

  it('EligibilityBadge renders the label for each status', () => {
    const statuses: Eligibility[] = ['eligible', 'not-eligible', 'needs-information', 'unverified'];
    render(
      <>
        {statuses.map((s) => (
          <EligibilityBadge key={s} status={s} />
        ))}
      </>,
    );
    for (const s of statuses) expect(screen.getByText(ELIGIBILITY_COPY[s].label)).toBeInTheDocument();
  });

  it('EmptyState renders title, body and action link', () => {
    render(<EmptyState title="Nothing here" body="Try later" action={{ href: '/discover', label: 'Go discover' }} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Try later')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go discover' })).toHaveAttribute('href', '/discover');
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open it
      </button>
      <Dialog open={open} onOpenChange={setOpen} title="Hello dialog" description="Some details">
        <button type="button">Inside</button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('closes on Escape with focus trapped inside while open', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Open it' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Hello dialog' });
    expect(dialog).toHaveAccessibleDescription('Some details');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('restores focus to the opener after closing', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Open it' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus(), { timeout: 300 });
  });

  it('closes via the close button', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'Open it' }));
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

function ActionsHarness({ onResult }: { onResult: (ok: boolean) => void }) {
  const actions = useJourneyActions();
  return (
    <button type="button" onClick={() => onResult(actions.seedDemo().ok)}>
      seed
    </button>
  );
}

describe('useJourneyActions storage failure', () => {
  beforeEach(resetEnv);

  it('returns ok:false, shows an honest error and retries successfully', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceeded');
    });
    const onResult = vi.fn();
    const user = userEvent.setup();
    renderApp(<ActionsHarness onResult={onResult} />);
    await user.click(screen.getByRole('button', { name: 'seed' }));
    expect(onResult).toHaveBeenCalledWith(false);
    expect(screen.getByText('Your changes couldn’t be saved.')).toBeInTheDocument();
    expect(localStorage.getItem('grantly:journey:v1')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Your changes couldn’t be saved.')).not.toBeInTheDocument();
    expect(stored().profile?.isDemo).toBe(true);
  });

  it('surfaces non-storage errors without Retry', async () => {
    function Thrower() {
      const actions = useJourneyActions();
      return (
        <button type="button" onClick={() => actions.updateTask('missing-task', { status: 'complete' })}>
          go
        </button>
      );
    }
    const user = userEvent.setup();
    renderApp(<Thrower />);
    await user.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByRole('status')).not.toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
