import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationWorkspace } from '@/components/apply/ApplicationWorkspace';
import { LK, MD, nav, renderApp, resetEnv, seed, SM, stored } from './helpers-b';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const task = (id: string) => stored().tasks.find((t) => t.id === id)!;
const app = (id: string) => stored().applications.find((a) => a.id === id)!;

describe('ApplicationWorkspace', () => {
  beforeEach(resetEnv);

  it('handles an unknown application id', () => {
    seed();
    renderApp(<ApplicationWorkspace id="nope" />);
    expect(screen.getByRole('heading', { name: 'We couldn’t find that application.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to applications' })).toHaveAttribute('href', '/applications');
  });

  it('marks a non-essay step ready and persists it', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<ApplicationWorkspace id={LK} />);
    expect(screen.getByText('0 of 2 required steps ready')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status for Fill in the scholarship supplement form' }), 'Ready');
    expect(screen.getByText('1 of 2 required steps ready')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Required steps ready' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('Step marked ready.')).toBeInTheDocument();
    expect(task(`${LK}__supplement-form`).status).toBe('complete');
  });

  it('essay step status is read-only in the checklist and managed in Essay Studio', () => {
    seed();
    renderApp(<ApplicationWorkspace id={LK} />);
    expect(screen.queryByRole('combobox', { name: 'Status for Write the community impact essay' })).toBeNull();
    expect(screen.getByText('To do · set in Essay Studio')).toBeInTheDocument();
    expect(task(`${LK}__essay`).status).toBe('todo');
    expect(screen.getByRole('link', { name: /Work on essay/ })).toHaveAttribute('href', `/applications/${encodeURIComponent(LK)}/essay/lk-impact`);
  });

  it('records a submission only after confirmation, warning about incomplete items', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<ApplicationWorkspace id={LK} />);
    await user.click(screen.getByRole('button', { name: 'Mark sample submission complete' }));
    const dialog = screen.getByRole('dialog', { name: 'Record your submission' });
    expect(within(dialog).getByText('You still have incomplete checklist items.')).toBeInTheDocument();
    const record = within(dialog).getByRole('button', { name: 'Record submission' });
    expect(record).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox'));
    expect(record).toBeEnabled();
    await user.click(record);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Submitted — recorded by you.')).toBeInTheDocument();
    expect(app(LK).status).toBe('submitted');
    expect(within(screen.getByRole('region', { name: 'Status' })).getByText(/Current:/)).toHaveTextContent('Current: Submitted');
  });

  it('cancelling the submission dialog keeps the application preparing', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<ApplicationWorkspace id={LK} />);
    await user.click(screen.getByRole('button', { name: 'Mark sample submission complete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(app(LK).status).toBe('preparing');
  });

  it('saves a follow-up date and records a follow-up', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<ApplicationWorkspace id={MD} />);
    const recId = `${MD}__recommendation`;
    const input = screen.getByLabelText('Add a follow-up date');
    expect(input).toHaveValue('2026-11-11');
    await user.clear(input);
    await user.type(input, '2026-11-20');
    await user.click(screen.getByRole('button', { name: 'Save date' }));
    expect(task(recId).nextFollowUpOn).toBe('2026-11-20');
    expect(screen.getByText(/Follow-up set for/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'I followed up today' }));
    expect(task(recId).lastFollowUpOn).toBe('2026-11-07');
    expect(task(recId).nextFollowUpOn).toBeNull();
    expect(screen.getByLabelText('Add a follow-up date')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save date' })).toBeDisabled();
  });

  it('removes the application after confirmation and navigates back', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<ApplicationWorkspace id={LK} />);
    await user.click(screen.getByRole('button', { name: 'Remove application' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove this application from GRANTLY?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(nav.push).toHaveBeenCalledWith('/applications');
    expect(stored().applications.some((a) => a.id === LK)).toBe(false);
    expect(stored().tasks.some((t) => t.applicationId === LK)).toBe(false);
  });

  it('records an award, the amount and acceptance on a submitted application', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<ApplicationWorkspace id={SM} />);
    expect(screen.queryByRole('button', { name: 'Mark sample submission complete' })).not.toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save update' });
    expect(save).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Record an update from the provider' }), 'awarded');
    await user.click(save);
    expect(app(SM).status).toBe('awarded');

    const amount = screen.getByRole('textbox', { name: /Awarded amount/ });
    const saveAmount = screen.getByRole('button', { name: 'Save amount' });
    expect(saveAmount).toBeDisabled();
    await user.type(amount, 'abc');
    expect(saveAmount).toBeDisabled();
    await user.clear(amount);
    await user.type(amount, '12000');
    await user.click(saveAmount);
    expect(app(SM).awardConfirmedUsd).toBe(12000);

    await user.click(screen.getByRole('button', { name: 'I accepted the offer' }));
    expect(app(SM).offerResponseStatus).toBe('accepted');
    expect(screen.getByText('Recorded: you accepted the offer.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'I accepted the offer' })).not.toBeInTheDocument();
  });
});
