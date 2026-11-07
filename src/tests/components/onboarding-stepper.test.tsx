import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, readStored } from './render';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/onboarding',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => pushMock.mockReset());

describe('OnboardingStepper', () => {
  it('flags an invalid academic score, focuses it, and keeps values on Back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OnboardingStepper />);
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const score = screen.getByLabelText('Academic score (%)');
    expect(screen.getByText('Enter a value between 0 and 100.')).toBeInTheDocument();
    expect(score).toHaveAttribute('aria-invalid', 'true');
    expect(score).toHaveAccessibleDescription('Enter a value between 0 and 100.');
    await waitFor(() => expect(score).toHaveFocus());

    await user.type(score, '101');
    // Editing clears the error until the next submit.
    expect(score).not.toHaveAttribute('aria-invalid');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter a value between 0 and 100.')).toBeInTheDocument();

    await user.clear(score);
    await user.type(score, '84');
    await user.type(screen.getByLabelText('Your first name (optional)'), 'Ravi');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'What are you planning to study?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Academic score (%)')).toHaveValue('84');
    expect(screen.getByLabelText('Your first name (optional)')).toHaveValue('Ravi');
  });

  it('requires a subject on step 2, then saves the profile and routes to the dashboard', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OnboardingStepper />);
    await user.type(screen.getByLabelText('Academic score (%)'), '84');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const subject = screen.getByLabelText('Subject you want to study');
    expect(screen.getByText('Choose a subject to continue.')).toBeInTheDocument();
    expect(subject).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(subject).toHaveFocus());

    await user.selectOptions(subject, 'Computer Science');
    await user.type(screen.getByLabelText(/Total budget for the whole program/), '45000');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Least application effort/ }));
    await user.click(screen.getByRole('button', { name: 'Show my funding options' }));

    expect(pushMock).toHaveBeenCalledWith('/dashboard');
    const stored = readStored();
    expect(stored.profile).toMatchObject({
      intendedField: 'Computer Science',
      academicMetric: { kind: 'percentage', value: 84 },
      fullProgramBudgetUsd: 45000,
      priority: 'least-effort',
      isDemo: false,
    });
    expect(await screen.findByText('Your funding profile is ready.')).toBeInTheDocument();
  });
});
