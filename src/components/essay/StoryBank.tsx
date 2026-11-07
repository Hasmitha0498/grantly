'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { StoryBankItem } from '@/domain/types';
import { useJourneyActions } from '@/repository/use-journey-actions';

const FIELDS: { key: keyof Omit<StoryBankItem, 'id' | 'tags'>; label: string }[] = [
  { key: 'title', label: 'Give it a short title' },
  { key: 'situation', label: 'What happened?' },
  { key: 'action', label: 'What did you do?' },
  { key: 'result', label: 'What changed?' },
  { key: 'reflection', label: 'What did you learn?' },
];

const blank = (): StoryBankItem => ({ id: `story-${Date.now().toString(36)}`, title: '', situation: '', action: '', result: '', reflection: '', tags: [] });

export function StoryBank({ stories, selected, onToggle }: { stories: StoryBankItem[]; selected: string[]; onToggle: (s: StoryBankItem) => void }) {
  const actions = useJourneyActions();
  const [editing, setEditing] = useState<StoryBankItem | null>(null);
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.title.trim() || !editing.situation.trim()) {
      setError('Add a title and what happened.');
      return;
    }
    const r = actions.saveStory({ ...editing, title: editing.title.trim() });
    if (r.ok) {
      setEditing(null);
      setError('');
    }
  };

  return (
    <div className="mt-4">
      {stories.length === 0 && !editing ? <p className="rounded-xl bg-canvas p-4 text-sm text-muted">No stories yet. Add one real experience to start.</p> : null}
      <ul className="space-y-3">
        {stories.map((s) => {
          const on = selected.includes(s.id);
          return (
            <li key={s.id} className={`rounded-xl border p-4 ${on ? 'border-forest bg-mint' : 'border-line'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" className="mt-1 size-4 accent-[#194D43]" checked={on} onChange={() => onToggle(s)} />
                  <span>
                    <span className="block font-semibold">{s.title}</span>
                    <span className="text-sm text-muted">{s.situation}</span>
                  </span>
                </label>
                <div className="flex gap-1">
                  <button type="button" className="btn btn-ghost min-h-10 px-2" aria-label={`Edit story ${s.title}`} onClick={() => setEditing(s)}>
                    <Pencil aria-hidden="true" size={16} />
                  </button>
                  <button type="button" className="btn btn-ghost min-h-10 px-2" aria-label={`Delete story ${s.title}`} onClick={() => actions.removeStory(s.id)}>
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {editing ? (
        <form onSubmit={submit} noValidate className="mt-4 space-y-3 rounded-xl border border-line p-4" aria-label="Story editor">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`sf-${f.key}`} className="label">
                {f.label}
              </label>
              {f.key === 'title' ? (
                <input id={`sf-${f.key}`} className="input" maxLength={120} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              ) : (
                <textarea id={`sf-${f.key}`} className="input min-h-16" maxLength={1500} value={editing[f.key]} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
              )}
            </div>
          ))}
          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              Save story
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-secondary mt-4" onClick={() => setEditing(blank())}>
          <Plus aria-hidden="true" size={18} /> Add a story
        </button>
      )}
    </div>
  );
}
