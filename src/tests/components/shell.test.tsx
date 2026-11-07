import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavLinks } from '@/components/shell/NavLinks';
import { ModeIndicator } from '@/components/shell/ModeIndicator';
import { LandingCtas } from '@/components/onboarding/LandingCtas';
import { saveProfile, emptyState } from '@/repository/journey-core';
import { STORAGE_KEY, __resetCache } from '@/repository/local-store';
import { demoProfile } from '@/data/demo-profile';
import { nav, renderApp, resetEnv, seed, stored } from './helpers-b';
import { NOW } from '../fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const current = () => screen.queryAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page').map((l) => l.textContent?.trim());

describe('NavLinks', () => {
  beforeEach(resetEnv);

  it('rail marks the active route, including nested and profile routes', () => {
    nav.pathname = '/applications/abc';
    const { rerender } = renderApp(<NavLinks variant="rail" />);
    expect(screen.getAllByRole('link')).toHaveLength(5);
    expect(current()).toEqual(['Applications']);
    nav.pathname = '/profile';
    rerender(<NavLinks variant="rail" />);
    expect(current()).toEqual(['My profile']);
  });

  it('tabs treat scholarship detail pages as Discover', () => {
    nav.pathname = '/scholarships/lakeshore-global';
    renderApp(<NavLinks variant="tabs" />);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(current()).toEqual(['Discover']);
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('profile link is current only on profile routes', () => {
    nav.pathname = '/profile/edit';
    const { rerender } = renderApp(<NavLinks variant="profile" />);
    expect(screen.getByRole('link', { name: 'My profile' })).toHaveAttribute('aria-current', 'page');
    nav.pathname = '/dashboard';
    rerender(<NavLinks variant="profile" />);
    expect(screen.getByRole('link', { name: 'My profile' })).not.toHaveAttribute('aria-current');
  });
});

describe('ModeIndicator', () => {
  beforeEach(resetEnv);

  it('labels local persistence without a profile', () => {
    renderApp(<ModeIndicator />);
    expect(screen.getByText('Demo mode — saved on this device')).toBeInTheDocument();
    expect(screen.getByText(/All opportunities are fictional samples\./)).toBeInTheDocument();
  });

  it('mentions sample data for the demo profile, in both layouts', () => {
    seed();
    const { rerender } = renderApp(<ModeIndicator />);
    expect(screen.getByText(/Sample data — not real scholarship offers\./)).toBeInTheDocument();
    rerender(<ModeIndicator compact />);
    expect(screen.getByText(/Demo mode — saved on this device/)).toBeInTheDocument();
    expect(screen.getByText('· Sample data')).toBeInTheDocument();
  });
});

describe('LandingCtas', () => {
  beforeEach(resetEnv);

  it('without a profile: no continue link; demo seeds and navigates', async () => {
    const user = userEvent.setup();
    renderApp(<LandingCtas />);
    expect(screen.queryByRole('link', { name: 'Continue my journey' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create my funding profile' })).toHaveAttribute('href', '/onboarding');
    await user.click(screen.getByRole('button', { name: 'Explore a demo journey' }));
    expect(nav.push).toHaveBeenCalledWith('/dashboard');
    expect(stored().profile?.isDemo).toBe(true);
    expect(stored().applications).toHaveLength(3);
  });

  it('with the demo profile: shows continue and reseeds without asking', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<LandingCtas />);
    expect(screen.getByRole('link', { name: 'Continue my journey' })).toHaveAttribute('href', '/dashboard');
    await user.click(screen.getByRole('button', { name: 'Explore a demo journey' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(nav.push).toHaveBeenCalledWith('/dashboard');
  });

  it('with a real profile: asks before replacing it', async () => {
    const real = saveProfile(emptyState(), { ...demoProfile, displayName: 'Ravi', isDemo: false }, NOW);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(real));
    __resetCache();
    const user = userEvent.setup();
    renderApp(<LandingCtas />);
    expect(screen.getByRole('link', { name: 'Continue my journey' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Explore a demo journey' }));
    let dialog = screen.getByRole('dialog', { name: 'Replace your saved profile with the demo?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep my profile' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
    expect(stored().profile?.displayName).toBe('Ravi');

    await user.click(screen.getByRole('button', { name: 'Explore a demo journey' }));
    dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Load the demo' }));
    expect(nav.push).toHaveBeenCalledWith('/dashboard');
    expect(stored().profile?.isDemo).toBe(true);
  });
});
