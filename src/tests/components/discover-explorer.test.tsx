import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStored, renderWithProviders, seedState } from './render';
import { DiscoverExplorer } from '@/components/discover/DiscoverExplorer';
import { scholarships } from '@/data/demo-catalog';

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  listeners: new Set<() => void>(),
  replaced: [] as string[],
}));

vi.mock('next/navigation', async () => {
  const React = await import('react');
  return {
    useRouter: () => ({
      push: vi.fn(),
      replace: (url: string) => {
        nav.replaced.push(url);
        nav.params = new URLSearchParams(url.split('?')[1] ?? '');
        nav.listeners.forEach((l) => l());
      },
    }),
    usePathname: () => '/discover',
    useSearchParams: () =>
      React.useSyncExternalStore(
        (cb: () => void) => {
          nav.listeners.add(cb);
          return () => nav.listeners.delete(cb);
        },
        () => nav.params,
      ),
  };
});

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.replaced = [];
});

const cardTitles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

describe('DiscoverExplorer', () => {
  it('lists every opportunity with a count', () => {
    seedState();
    renderWithProviders(<DiscoverExplorer />);
    expect(screen.getByText(`${scholarships.length} opportunities`)).toBeInTheDocument();
    expect(cardTitles()).toHaveLength(scholarships.length);
    expect(screen.getByRole('link', { name: 'Compare (0)' })).toHaveAttribute('href', '/compare');
  });

  it('filters by the q search param from the URL', () => {
    seedState();
    nav.params = new URLSearchParams('q=civic');
    renderWithProviders(<DiscoverExplorer />);
    expect(screen.getByText('1 opportunity')).toBeInTheDocument();
    expect(cardTitles()).toEqual(['Civic Scholars Award']);
    expect(screen.getByRole('searchbox', { name: 'Search scholarships or providers' })).toHaveValue('civic');
    expect(screen.getByRole('button', { name: 'Remove filter “civic”' })).toBeInTheDocument();
  });

  it('typing a search updates the URL and narrows results; Clear filters resets', async () => {
    seedState();
    const user = userEvent.setup();
    renderWithProviders(<DiscoverExplorer />);
    await user.type(screen.getByRole('searchbox', { name: 'Search scholarships or providers' }), 'civic');
    expect(nav.replaced.at(-1)).toBe('/discover?q=civic');
    expect(screen.getByText('1 opportunity')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect(nav.replaced.at(-1)).toBe('/discover');
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByText(`${scholarships.length} opportunities`)).toBeInTheDocument();
  });

  it('applies the eligibility filter', async () => {
    seedState();
    const user = userEvent.setup();
    renderWithProviders(<DiscoverExplorer />);
    // Filters render twice (inline + mobile dialog); the dialog is closed so only one is in the DOM.
    await user.selectOptions(screen.getByLabelText('Eligibility'), 'not-eligible');
    expect(nav.params.get('eligibility')).toBe('not-eligible');
    const titles = cardTitles();
    expect(titles).toContain('Civic Scholars Award');
    expect(titles).not.toContain('Northfield Graduate Excellence Award');
    expect(screen.getAllByText('Shown for completeness — a required condition doesn’t match your profile.')).toHaveLength(titles.length);
  });

  it('shows the empty state when nothing matches', async () => {
    seedState();
    nav.params = new URLSearchParams('q=zzzz-no-match');
    const user = userEvent.setup();
    renderWithProviders(<DiscoverExplorer />);
    expect(screen.getByText('No opportunities match those filters.')).toBeInTheDocument();
    expect(screen.getByText('0 opportunities')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Clear filters' });
    await user.click(buttons[buttons.length - 1]!);
    expect(screen.queryByText('No opportunities match those filters.')).not.toBeInTheDocument();
  });

  it('Save toggles aria-pressed and persists the bookmark', async () => {
    seedState((s) => ({ ...s, bookmarks: [] }));
    const user = userEvent.setup();
    renderWithProviders(<DiscoverExplorer />);
    const save = screen.getByRole('button', { name: /^Save\s*Civic Scholars Award$/ });
    expect(save).toHaveAttribute('aria-pressed', 'false');
    await user.click(save);
    const saved = screen.getByRole('button', { name: /^Saved\s*Civic Scholars Award$/ });
    expect(saved).toHaveAttribute('aria-pressed', 'true');
    expect(readStored().bookmarks).toEqual(['civic-scholars']);
    expect(await screen.findByText('Saved to your journey.')).toBeInTheDocument();

    await user.click(saved);
    expect(readStored().bookmarks).toEqual([]);
  });

  it('asks which program for a multi-program scholarship before adding to compare', async () => {
    seedState();
    const user = userEvent.setup();
    renderWithProviders(<DiscoverExplorer />);
    await user.click(screen.getByRole('button', { name: /^Add to compare\s*Meridian Foundation Need-Based Grant$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Which program should we compare?' });
    const options = within(dialog).getAllByRole('button', { pressed: false });
    expect(options).toHaveLength(2);
    await user.click(options[1]!);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(readStored().compare).toEqual([{ scholarshipId: 'meridian-need', programId: 'prog-lakeshore-mscs' }]);
    expect(screen.getByRole('button', { name: /^In compare\s*Meridian Foundation Need-Based Grant$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Compare (1)' })).toBeInTheDocument();
    expect(await screen.findByText('Added to compare (1 of 3).')).toBeInTheDocument();
  });

  it('refuses a fourth compare option with an error toast', async () => {
    seedState((s) => ({
      ...s,
      compare: [
        { scholarshipId: 'northfield-excellence', programId: 'prog-northfield-mscs' },
        { scholarshipId: 'lakeshore-global', programId: 'prog-lakeshore-mscs' },
        { scholarshipId: 'horizon-gpa', programId: 'prog-cascade-msds' },
      ],
    }));
    const user = userEvent.setup();
    renderWithProviders(<DiscoverExplorer />);
    await user.click(screen.getByRole('button', { name: /^Add to compare\s*Civic Scholars Award$/ }));
    expect(await screen.findByText('You can compare up to 3 options. Remove one first.')).toBeInTheDocument();
    expect(readStored().compare).toHaveLength(3);
  });
});
