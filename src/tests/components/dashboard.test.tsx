import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { updateTask } from '@/repository/journey-core';
import { externalCommit, LK, MD, nav, renderApp, resetEnv, seed } from './helpers-b';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

describe('Dashboard', () => {
  beforeEach(resetEnv);

  it('greets the demo student and recommends the essay first', () => {
    seed();
    renderApp(<Dashboard />);
    expect(screen.getByRole('heading', { level: 1, name: 'Good to see you, Aisha.' })).toBeInTheDocument();
    const nba = screen.getByRole('region', { name: 'Your next best action' });
    expect(within(nba).getByText('Write the community impact essay')).toBeInTheDocument();
    expect(within(nba).getByText(/We prioritized this because/)).toBeInTheDocument();
  });

  it('updates the next best action once the essay task is complete', () => {
    seed();
    renderApp(<Dashboard />);
    externalCommit((s) => updateTask(s, `${LK}__essay`, { status: 'complete' }));
    const nba = screen.getByRole('region', { name: 'Your next best action' });
    expect(within(nba).queryByText('Write the community impact essay')).not.toBeInTheDocument();
    expect(within(nba).getByText(/We prioritized this because/)).toBeInTheDocument();
  });

  it('lists the recommendation under Waiting on others', () => {
    seed();
    renderApp(<Dashboard />);
    expect(screen.getByText('Waiting on others')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Get one recommendation letter from a professor' });
    expect(link).toHaveAttribute('href', `/applications/${encodeURIComponent(MD)}#task-${MD}__recommendation`);
    expect(screen.getByText(/follow up/)).toBeInTheDocument();
  });

  it('shows the explore state when there are no applications', () => {
    seed((s) => ({ ...s, applications: [], tasks: [], essays: [] }));
    renderApp(<Dashboard />);
    expect(screen.getByText(/You’re ready to explore\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find scholarships' })).toHaveAttribute('href', '/discover');
  });

  it('falls back to "there" when the display name is blank', () => {
    seed((s) => ({ ...s, profile: { ...s.profile!, displayName: '   ' } }));
    renderApp(<Dashboard />);
    expect(screen.getByRole('heading', { level: 1, name: 'Good to see you, there.' })).toBeInTheDocument();
  });

  it('offers the demo when no profile exists', () => {
    renderApp(<Dashboard />);
    expect(screen.getByRole('heading', { name: 'Let’s set up your funding journey first.' })).toBeInTheDocument();
  });
});
