import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationsList } from '@/components/apply/ApplicationsList';
import { nav, renderApp, resetEnv, seed } from './helpers-b';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const cards = () => within(screen.getByRole('tabpanel')).queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);

describe('ApplicationsList', () => {
  beforeEach(resetEnv);

  it('shows the empty state with no applications', () => {
    seed((s) => ({ ...s, applications: [], tasks: [] }));
    renderApp(<ApplicationsList />);
    expect(screen.getByText(/No applications yet\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Discover scholarships' })).toHaveAttribute('href', '/discover');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('filters by tab and reflects selection', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<ApplicationsList />);
    expect(screen.getByRole('tab', { name: /^All/ })).toHaveAttribute('aria-selected', 'true');
    expect(cards()).toHaveLength(3);

    await user.click(screen.getByRole('tab', { name: /^Preparing/ }));
    expect(screen.getByRole('tab', { name: /^Preparing/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^All/ })).toHaveAttribute('aria-selected', 'false');
    expect(cards()).toHaveLength(2);

    await user.click(screen.getByRole('tab', { name: /^Submitted/ }));
    expect(cards()).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: /^Closed/ }));
    expect(screen.getByText('Nothing in this view right now.')).toBeInTheDocument();
  });

  it('supports arrow-key navigation between tabs', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<ApplicationsList />);
    const all = screen.getByRole('tab', { name: /^All/ });
    all.focus();
    await user.keyboard('{ArrowRight}');
    const preparing = screen.getByRole('tab', { name: /^Preparing/ });
    expect(preparing).toHaveAttribute('aria-selected', 'true');
    expect(preparing).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    const closed = screen.getByRole('tab', { name: /^Closed/ });
    expect(closed).toHaveAttribute('aria-selected', 'true');
    expect(closed).toHaveFocus();
    expect(closed).toHaveAttribute('tabindex', '0');
    expect(all).toHaveAttribute('tabindex', '-1');
  });

  it('shows progress text per application', () => {
    seed();
    renderApp(<ApplicationsList />);
    expect(screen.getAllByText('0 of 2 required steps ready')).toHaveLength(1);
    expect(screen.getByText('0 of 3 required steps ready')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 required steps ready')).toBeInTheDocument();
  });
});
