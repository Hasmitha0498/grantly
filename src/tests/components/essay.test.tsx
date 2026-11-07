import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EssayStudio } from '@/components/essay/EssayStudio';
import { saveEssay } from '@/repository/journey-core';
import { externalCommit, LK, nav, renderApp, resetEnv, seed, stored } from './helpers-b';
import { NOW } from '../fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const PROMPT = 'lk-impact';
const essay = () => stored().essays.find((e) => e.applicationId === LK && e.promptId === PROMPT);
const stage = (name: string) => within(screen.getByRole('list', { name: 'Essay steps' })).getByRole('button', { name });
const body = () => screen.getByRole('textbox', { name: 'Write in your own words' });
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

describe('EssayStudio', () => {
  beforeEach(resetEnv);

  it('shows not-found for an unknown prompt', () => {
    seed();
    renderApp(<EssayStudio applicationId={LK} promptId="nope" />);
    expect(screen.getByRole('heading', { name: 'We couldn’t find that essay.' })).toBeInTheDocument();
  });

  it('switches content between stages', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<EssayStudio applicationId={LK} promptId={PROMPT} />);
    expect(screen.getByRole('heading', { name: 'What this question is really asking' })).toBeInTheDocument();
    expect(stage('Understand')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('save-status')).toHaveTextContent('Not saved yet');

    await user.click(screen.getByRole('button', { name: 'Choose a story' }));
    expect(screen.getByRole('heading', { name: 'Your Story Bank' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Build your outline' }));
    expect(screen.getByLabelText('Start with the situation')).toBeInTheDocument();
    await user.click(stage('Review'));
    expect(screen.getByRole('heading', { name: 'Ready to review?' })).toBeInTheDocument();
    expect(screen.getByText('✗ Your draft is empty.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark essay ready' })).toBeDisabled();
    await user.click(stage('Draft'));
    expect(body()).toBeInTheDocument();
    expect(stage('Draft')).toHaveAttribute('aria-current', 'step');
    expect(stage('Review')).not.toHaveAttribute('aria-current');
  });

  it('adds, validates, edits, selects and deletes stories', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<EssayStudio applicationId={LK} promptId={PROMPT} />);
    await user.click(stage('My stories'));

    await user.click(screen.getByRole('button', { name: 'Add a story' }));
    const form = screen.getByRole('form', { name: 'Story editor' });
    await user.click(within(form).getByRole('button', { name: 'Save story' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('Add a title and what happened.');

    await user.type(within(form).getByLabelText('Give it a short title'), 'Hackathon win');
    await user.type(within(form).getByLabelText('What happened?'), 'Built a water sensor in 24 hours.');
    await user.click(within(form).getByRole('button', { name: 'Save story' }));
    expect(screen.queryByRole('form', { name: 'Story editor' })).not.toBeInTheDocument();
    expect(screen.getByText('Story saved.')).toBeInTheDocument();
    expect(stored().stories.map((s) => s.title)).toContain('Hackathon win');

    await user.click(screen.getByRole('button', { name: 'Edit story Hackathon win' }));
    const title = screen.getByLabelText('Give it a short title');
    expect(title).toHaveValue('Hackathon win');
    await user.clear(title);
    await user.type(title, 'Hackathon finalist');
    await user.click(screen.getByRole('button', { name: 'Save story' }));
    expect(stored().stories.map((s) => s.title)).toEqual(['Teaching coding at the community library', 'Hackathon finalist']);

    await user.click(screen.getByRole('checkbox', { name: /Teaching coding at the community library/ }));
    expect(screen.getByRole('checkbox', { name: /Teaching coding/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Build your outline' }));
    expect(screen.getByText('Using: Teaching coding at the community library')).toBeInTheDocument();

    await user.click(stage('My stories'));
    await user.click(screen.getByRole('button', { name: 'Delete story Hackathon finalist' }));
    expect(screen.queryByText('Hackathon finalist')).not.toBeInTheDocument();
    expect(stored().stories).toHaveLength(1);
  });

  it('counts words, flags going over the limit, and autosaves', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<EssayStudio applicationId={LK} promptId={PROMPT} />);
    await user.click(stage('Draft'));
    await user.type(body(), 'I taught kids to code');
    expect(screen.getByText('5 / 250 words')).toBeInTheDocument();
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saving…');
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Saved'), { timeout: 3000 });
    expect(essay()?.body).toBe('I taught kids to code');
    expect(essay()?.revision).toBe(1);

    await user.clear(body());
    await user.click(body());
    await user.paste(words(253));
    expect(screen.getByText(/253 \/ 250 words/)).toHaveTextContent('You’re 3 words over the limit.');
    expect(body()).toHaveAttribute('aria-invalid', 'true');
  });

  it('marks the essay ready only after the own-words confirmation', async () => {
    seed();
    const user = userEvent.setup();
    renderApp(<EssayStudio applicationId={LK} promptId={PROMPT} />);
    await user.click(stage('Draft'));
    await user.click(body());
    await user.paste('Every weekend I taught twenty kids Python at the library.');
    await user.click(stage('Review'));
    await user.click(screen.getByRole('button', { name: 'Mark essay ready' }));
    const dialog = screen.getByRole('dialog', { name: 'Mark essay ready?' });
    const confirm = within(dialog).getByRole('button', { name: 'Mark essay ready' });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(confirm);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stored().tasks.find((t) => t.id === `${LK}__essay`)?.status).toBe('complete');
    expect(essay()?.userMarkedReady).toBe(true);
    expect(screen.getByText('✓ You marked this essay ready.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keep working on it' }));
    expect(stored().tasks.find((t) => t.id === `${LK}__essay`)?.status).toBe('todo');
    expect(essay()?.userMarkedReady).toBe(false);
  });

  describe('conflict with another tab', () => {
    const otherTab = () =>
      externalCommit(
        (s) =>
          saveEssay(
            s,
            { applicationId: LK, promptId: PROMPT, body: 'From the other tab', outline: { situation: '', action: '', result: '', connection: '' }, selectedStoryIds: [], userMarkedReady: false },
            0,
            NOW,
          ).state,
      );

    async function triggerConflict() {
      seed();
      const user = userEvent.setup();
      renderApp(<EssayStudio applicationId={LK} promptId={PROMPT} />);
      await user.click(stage('Draft'));
      otherTab();
      await user.click(body());
      await user.paste('My local words');
      await user.click(screen.getByRole('button', { name: 'Save draft' }));
      const dialog = await screen.findByRole('dialog', { name: 'This draft changed in another tab' });
      expect(screen.getByTestId('save-status')).toHaveTextContent('Changed in another tab');
      return { user, dialog };
    }

    it('can load the saved version', async () => {
      const { user, dialog } = await triggerConflict();
      await user.click(within(dialog).getByRole('button', { name: 'Load the saved version' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(body()).toHaveValue('From the other tab');
      expect(screen.getByTestId('save-status')).toHaveTextContent('Saved');
      expect(essay()?.body).toBe('From the other tab');
    });

    it('can keep my version', async () => {
      const { user, dialog } = await triggerConflict();
      await user.click(within(dialog).getByRole('button', { name: 'Keep my version' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(body()).toHaveValue('My local words');
      expect(essay()?.body).toBe('My local words');
      expect(essay()?.revision).toBe(2);
    });
  });
});
