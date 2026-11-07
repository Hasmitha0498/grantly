import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStored, renderWithProviders, seedState } from './render';
import { ProfileEditor } from '@/components/onboarding/ProfileEditor';
import { JourneyGate } from '@/components/shell/JourneyGate';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/profile',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => pushMock.mockReset());

describe('ProfileEditor', () => {
  it('saves an edited household income to storage', async () => {
    seedState();
    const user = userEvent.setup();
    renderWithProviders(<ProfileEditor />);
    const amount = screen.getByLabelText('Amount');
    expect(amount).toHaveValue('');
    await user.type(amount, '1200000');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(readStored().profile?.householdIncome).toEqual({ amount: 1200000, currency: 'INR' });
    expect(await screen.findByText('Profile updated. We’ve refreshed your funding fit.')).toBeInTheDocument();
  });

  it('blocks saving an invalid income and shows the field error', async () => {
    seedState();
    const user = userEvent.setup();
    renderWithProviders(<ProfileEditor />);
    await user.type(screen.getByLabelText('Amount'), '-5');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Enter a positive amount, or leave this blank.')).toBeInTheDocument();
    expect(readStored().profile?.householdIncome).toBeNull();
  });

  it('adds and removes evidence rows; blank rows are dropped on save', async () => {
    seedState();
    const user = userEvent.setup();
    renderWithProviders(<ProfileEditor />);
    expect(screen.getAllByLabelText('Example')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Add evidence' }));
    await user.click(screen.getByRole('button', { name: 'Add evidence' }));
    const examples = screen.getAllByLabelText('Example');
    expect(examples).toHaveLength(3);
    await user.type(examples[1]!, 'Led a 12-person robotics team.');

    await user.click(screen.getByRole('button', { name: 'Remove evidence 1' }));
    expect(screen.getAllByLabelText('Example')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const evidence = readStored().profile?.evidence ?? [];
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ category: 'leadership', description: 'Led a 12-person robotics team.' });
  });

  it('opens the reset dialog and Cancel closes it without changes', async () => {
    seedState();
    const before = localStorage.getItem('grantly:journey:v1');
    const user = userEvent.setup();
    renderWithProviders(<ProfileEditor />);
    await user.click(screen.getByRole('button', { name: 'Reset demo journey' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset demo journey?' });
    expect(within(dialog).getByText('This clears only this demo session’s saved progress.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('grantly:journey:v1')).toBe(before);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('Reset demo reseeds and routes to the dashboard', async () => {
    seedState((s) => ({ ...s, bookmarks: [] }));
    const user = userEvent.setup();
    renderWithProviders(<ProfileEditor />);
    await user.click(screen.getByRole('button', { name: 'Reset demo journey' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset demo' }));
    expect(readStored().bookmarks).toEqual(['lakeshore-global', 'northfield-excellence']);
    expect(pushMock).toHaveBeenCalledWith('/dashboard');
  });
});

describe('JourneyGate', () => {
  it('offers the demo when no profile exists and seeds one on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JourneyGate>{(s) => <p>Hello {s.profile.displayName}</p>}</JourneyGate>);
    expect(screen.getByRole('heading', { name: 'Let’s set up your funding journey first.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create my funding profile' })).toHaveAttribute('href', '/onboarding');

    await user.click(screen.getByRole('button', { name: 'Explore a demo journey' }));
    expect(screen.getByText('Hello Aisha')).toBeInTheDocument();
    expect(readStored().profile?.isDemo).toBe(true);
  });
});
