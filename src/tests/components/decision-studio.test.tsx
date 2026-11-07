import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStored, renderWithProviders, seedState } from './render';
import { DecisionStudio } from '@/components/compare/DecisionStudio';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/compare',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => pushMock.mockReset());

const TWO = [
  { scholarshipId: 'northfield-excellence', programId: 'prog-northfield-mscs' },
  { scholarshipId: 'lakeshore-global', programId: 'prog-lakeshore-mscs' },
];

const why = () => screen.getByRole('complementary', { name: 'Recommendation' }).textContent ?? '';
const gapCells = () => {
  const row = within(screen.getByRole('table')).getByRole('row', { name: /Current budget gap/ });
  return within(row).getAllByRole('cell').map((c) => c.textContent);
};

describe('DecisionStudio', () => {
  it('asks for at least two options', () => {
    seedState((s) => ({ ...s, compare: [TWO[0]!] }));
    renderWithProviders(<DecisionStudio />);
    expect(screen.getByText('Select at least two opportunities to compare.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Options in comparison' })).toBeInTheDocument();
  });

  it('explains the recommendation and reacts to priority changes', async () => {
    seedState((s) => ({ ...s, compare: TWO }));
    const user = userEvent.setup();
    renderWithProviders(<DecisionStudio />);
    const initial = why();
    expect(initial).toContain('$10,000');

    await user.click(screen.getByRole('radio', { name: 'Least application work' }));
    expect(screen.getByRole('radio', { name: 'Least application work' })).toBeChecked();
    expect(why()).not.toBe(initial);
  });

  it('updates the budget gap live and validates the budget', async () => {
    seedState((s) => ({ ...s, compare: TWO }));
    const user = userEvent.setup();
    renderWithProviders(<DecisionStudio />);
    expect(gapCells()).toEqual(['$10,000', '$0']);
    const budget = screen.getByLabelText('Your full-program budget (USD)');
    expect(budget).toHaveValue('50000');

    await user.clear(budget);
    await user.type(budget, '40000');
    const after = gapCells();
    expect(after).toEqual(['$20,000', '$10,000']);
    expect(screen.getByText('Changes update the gap below right away.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(readStored().profile?.fullProgramBudgetUsd).toBe(40000);

    await user.type(budget, 'abc');
    expect(screen.getByText('Enter a budget in US dollars.')).toBeInTheDocument();
    expect(budget).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    // Invalid input falls back to the saved budget rather than blanking the table.
    expect(gapCells()).toEqual(after);
  });

  it('removes an option from the comparison', async () => {
    seedState((s) => ({ ...s, compare: TWO }));
    const user = userEvent.setup();
    renderWithProviders(<DecisionStudio />);
    const strip = screen.getByRole('list', { name: 'Options in comparison' });
    const remove = within(strip).getAllByRole('button', { name: /^Remove .* from compare$/ });
    expect(remove).toHaveLength(2);
    await user.click(remove[0]!);
    expect(readStored().compare).toHaveLength(1);
    expect(screen.getByText('Select at least two opportunities to compare.')).toBeInTheDocument();
  });
});
