import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStored, renderWithProviders, seedState } from './render';
import { FundingFitPanel } from '@/components/funding/FundingFitPanel';
import { applicationId } from '@/repository/journey-core';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/scholarships/x',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => pushMock.mockReset());

describe('FundingFitPanel', () => {
  it('shows an eligible verdict, expandable details and the missing-source note', async () => {
    seedState();
    const user = userEvent.setup();
    renderWithProviders(<FundingFitPanel scholarshipId="northfield-excellence" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Northfield Graduate Excellence Award' })).toBeInTheDocument();
    expect(screen.getByText('Eligible based on the criteria we’ve verified.')).toBeInTheDocument();
    expect(screen.getByText(/Source link unavailable in this demo\./)).toBeInTheDocument();
    // Automatic-consideration awards are tracked, not "prepared".
    expect(screen.getByRole('button', { name: 'Track funding consideration' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View official source/ })).not.toBeInTheDocument();

    const details = screen.getAllByRole('button', { name: 'Details' });
    expect(details.length).toBeGreaterThan(0);
    const first = details[0]!;
    expect(first).toHaveAttribute('aria-expanded', 'false');
    await user.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(first.getAttribute('aria-controls')!);
    expect(panel).not.toBeNull();
    expect(within(panel!).getByText('Rule')).toBeInTheDocument();
    await user.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(first.getAttribute('aria-controls')!)).toBeNull();
  });

  it('Start preparing creates the application and routes to it', async () => {
    seedState();
    const user = userEvent.setup();
    renderWithProviders(<FundingFitPanel scholarshipId="cascade-assistantship" />);
    await user.click(screen.getByRole('button', { name: 'Start preparing' }));
    const id = applicationId('cascade-assistantship', 'prog-cascade-msds');
    expect(pushMock).toHaveBeenCalledWith(`/applications/${encodeURIComponent(id)}`);
    expect(readStored().applications.some((a) => a.id === id)).toBe(true);
  });

  it('warns and hides Start preparing when a required condition is not met', () => {
    seedState();
    renderWithProviders(<FundingFitPanel scholarshipId="civic-scholars" />);
    expect(screen.getByText('You don’t meet a required condition.')).toBeInTheDocument();
    expect(screen.getByText(/applying isn’t recommended/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start preparing' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save scholarship/ })).toBeInTheDocument();
  });

  it('asks for more information when the profile lacks a needed field', async () => {
    seedState();
    const user = userEvent.setup();
    renderWithProviders(<FundingFitPanel scholarshipId="meridian-need" />);
    expect(screen.getByText('We need more information.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Update profile' })).toHaveAttribute('href', '/profile');
    // Seed already started this award for Lakeshore; the other program is still pickable.
    expect(screen.getByRole('link', { name: /Open application/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start preparing' }));
    const dialog = screen.getByRole('dialog', { name: 'Which program are you applying with?' });
    const picked = within(dialog).getByRole('button', { pressed: true });
    expect(picked).toHaveTextContent(/Lakeshore/);
    await user.click(within(dialog).getByRole('button', { pressed: false }));
    expect(pushMock).toHaveBeenCalledWith(`/applications/${encodeURIComponent(applicationId('meridian-need', 'prog-northfield-mscs'))}`);
  });

  it('renders nothing for an unknown scholarship', () => {
    seedState();
    const { container } = renderWithProviders(<FundingFitPanel scholarshipId="nope" />);
    expect(container.querySelector('article')).toBeNull();
  });
});
