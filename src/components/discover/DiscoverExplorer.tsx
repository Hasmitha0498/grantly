'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Scale, Search, SlidersHorizontal, X } from 'lucide-react';
import { getProgram, programs, scholarships } from '@/data/demo-catalog';
import { evaluateEligibility, formatMoney } from '@/domain/eligibility';
import { normalizeAward } from '@/domain/financial';
import { daysBetween, describeRelative } from '@/domain/date';
import { deadlineFor } from '@/repository/journey-core';
import { JourneyGate } from '@/components/shell/JourneyGate';
import { Badge, DemoLabel, EligibilityBadge, PageHeader } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/Dialog';
import { FUNDING_TYPE_LABEL, ROUTE_LABEL, today } from '@/lib/format';
import type { Eligibility, JourneyState, Scholarship, StudentProfile } from '@/domain/types';
import { CompareButton, SaveButton } from './OpportunityActions';
import { parseDiscoverParams, SEARCH_URL_DEBOUNCE_MS } from './discover-params';

const ELIG_ORDER: Record<Eligibility, number> = { eligible: 0, 'needs-information': 1, unverified: 2, 'not-eligible': 3 };


export function maxPotential(s: Scholarship): number | null {
  const values = s.programIds
    .map((pid) => getProgram(pid))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => normalizeAward(s.award, p).amount);
  if (values.some((v) => v === null) || values.length === 0) return null;
  return Math.max(...(values as number[]));
}

function whyThisAppears(s: Scholarship, profile: StudentProfile, status: Eligibility): string {
  const fieldMatch = s.programIds.some((pid) => getProgram(pid)?.field === profile.intendedField);
  const target = s.programIds.some((pid) => profile.targetProgramIds.includes(pid));
  if (status === 'not-eligible') return 'Shown for completeness — a required condition doesn’t match your profile.';
  if (target) return 'It funds a program on your shortlist.';
  if (fieldMatch) return `It funds ${profile.intendedField} programs.`;
  return 'It’s open to students at your qualification stage.';
}

export function DiscoverExplorer() {
  return <JourneyGate loadingLabel="Loading opportunities…">{(state) => <Explorer state={state} />}</JourneyGate>;
}

function Explorer({ state }: { state: JourneyState & { profile: StudentProfile } }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { q, type, eligibility: elig, course, deadline, sort } = parseDiscoverParams(params);
  // The visible query is local state so results update on every keystroke;
  // the URL is synced after a short debounce to avoid a navigation per key.
  const [query, setQuery] = useState(q);
  const [urlQuery, setUrlQuery] = useState(q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (q !== urlQuery) {
    // URL changed externally (back/forward, chip removal): adopt it.
    setUrlQuery(q);
    if (q !== query.trim()) setQuery(q);
  }
  // Latest params for delayed callbacks, so a debounced search sync never drops newer filters.
  const paramsRef = useRef(params);
  // Query string we last requested; router.replace is async, so back-to-back
  // updates must build on it until the router reports that URL.
  const pendingQs = useRef<string | null>(null);
  useEffect(() => {
    paramsRef.current = params;
    if (pendingQs.current === params.toString()) pendingQs.current = null;
  }, [params]);
  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const update = (input: Record<string, string>) => {
    let patch = input;
    // A filter/sort change while a search sync is pending carries the current
    // query in the same URL update, so the two writes can never race.
    if (searchTimer.current && !('q' in input)) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
      patch = { q: query.trim(), ...input };
    }
    const next = new URLSearchParams(pendingQs.current ?? paramsRef.current.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    // Only track a pending URL when it differs from the current one; an identical
    // replace produces no params change that would clear it.
    pendingQs.current = qs === paramsRef.current.toString() ? null : qs;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const now = today();
  const anchor = state.anchorAt ?? new Date().toISOString();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = scholarships.map((s) => {
      const result = evaluateEligibility(state.profile, s);
      return { s, status: result.status, needsInfo: result.unknown.some((u) => u.missingField), closes: deadlineFor(s.id, anchor), potential: maxPotential(s) };
    });
    const filtered = list.filter(({ s, status, closes }) => {
      if (needle) {
        const hay = [s.title, s.provider, s.description, FUNDING_TYPE_LABEL[s.fundingType], ...s.programIds.map((p) => getProgram(p)?.field ?? '')].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (type && s.fundingType !== type) return false;
      if (elig && status !== elig) return false;
      if (course && !s.programIds.some((pid) => getProgram(pid)?.field === course)) return false;
      if (deadline === '30') {
        if (!closes) return false;
        const days = daysBetween(now, closes);
        if (days < 0 || days > 30) return false;
      }
      if (deadline === 'open' && closes && closes < now) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sort === 'relevant') sorted.sort((a, b) => ELIG_ORDER[a.status] - ELIG_ORDER[b.status] || a.s.id.localeCompare(b.s.id));
    if (sort === 'deadline') sorted.sort((a, b) => (a.closes ?? '9999') .localeCompare(b.closes ?? '9999') || a.s.id.localeCompare(b.s.id));
    if (sort === 'funding') sorted.sort((a, b) => (b.potential ?? -1) - (a.potential ?? -1) || a.s.id.localeCompare(b.s.id));
    return sorted;
  }, [query, type, elig, course, deadline, sort, state.profile, anchor, now]);

  const activeChips: { key: string; label: string }[] = [
    query.trim() && { key: 'q', label: `“${query.trim()}”` },
    type && { key: 'type', label: FUNDING_TYPE_LABEL[type] },
    elig && { key: 'eligibility', label: { eligible: 'Meets demo criteria', 'not-eligible': 'Not eligible', 'needs-information': 'Needs information', unverified: 'Needs verification' }[elig] },
    course && { key: 'course', label: course },
    deadline && { key: 'deadline', label: deadline === '30' ? 'Closes within 30 days' : 'Still open' },
  ].filter(Boolean) as { key: string; label: string }[];

  const clearAll = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setQuery('');
    pendingQs.current = paramsRef.current.toString() === '' ? null : '';
    router.replace(pathname, { scroll: false });
  };

  const filters = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <FilterSelect id="f-type" label="Funding type" value={type} onChange={(v) => update({ type: v })} options={Object.entries(FUNDING_TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
      <FilterSelect
        id="f-elig"
        label="Eligibility"
        value={elig}
        onChange={(v) => update({ eligibility: v })}
        options={[
          { value: 'eligible', label: 'Meets demo criteria' },
          { value: 'needs-information', label: 'Needs information' },
          { value: 'unverified', label: 'Needs verification' },
          { value: 'not-eligible', label: 'Not eligible' },
        ]}
      />
      <FilterSelect id="f-course" label="Course" value={course} onChange={(v) => update({ course: v })} options={Array.from(new Set(programs.map((p) => p.field))).map((f) => ({ value: f, label: f }))} />
      <FilterSelect id="f-deadline" label="Deadline" value={deadline} onChange={(v) => update({ deadline: v })} options={[{ value: 'open', label: 'Still open' }, { value: '30', label: 'Closes within 30 days' }]} />
    </div>
  );

  return (
    <div>
      <PageHeader title="Find scholarships that fit you." subtitle="Explore funding for your US master’s and see how each opportunity fits your profile.">
        <Link href="/compare" className="btn btn-primary">
          <Scale aria-hidden="true" size={18} /> Compare ({state.compare.length})
        </Link>
      </PageHeader>

      <div className="card p-4 sm:p-5">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (searchTimer.current) clearTimeout(searchTimer.current);
            update({ q: query.trim() });
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="search" className="label">
              Search scholarships or providers
            </label>
            <div className="relative">
              <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="search"
                type="search"
                className="input pl-10"
                placeholder='Try "engineering" or "merit"'
                maxLength={100}
                value={query}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuery(value);
                  if (searchTimer.current) clearTimeout(searchTimer.current);
                  searchTimer.current = setTimeout(() => {
                    searchTimer.current = null;
                    update({ q: value.trim() });
                  }, SEARCH_URL_DEBOUNCE_MS);
                }}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 sm:w-56">
              <label htmlFor="sort" className="label">
                Sort by
              </label>
              <select id="sort" className="input" value={sort} onChange={(e) => update({ sort: e.target.value === 'relevant' ? '' : e.target.value })}>
                <option value="relevant">Most relevant</option>
                <option value="deadline">Soonest deadline</option>
                <option value="funding">Largest potential funding</option>
              </select>
            </div>
            <button type="button" className="btn btn-secondary self-end lg:hidden" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
              <SlidersHorizontal aria-hidden="true" size={18} /> Filters
            </button>
          </div>
        </form>
        <div className="mt-4 hidden lg:block">{filters}</div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold" aria-live="polite">
            {rows.length} {rows.length === 1 ? 'opportunity' : 'opportunities'}
          </p>
          {activeChips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="pill border border-line bg-mint text-forest hover:bg-white"
              onClick={() => {
                if (c.key === 'q') {
                  if (searchTimer.current) clearTimeout(searchTimer.current);
                  setQuery('');
                }
                update({ [c.key]: '' });
              }}
              aria-label={`Remove filter ${c.label}`}
            >
              {c.label} <X aria-hidden="true" size={13} />
            </button>
          ))}
          {activeChips.length ? (
            <button type="button" className="btn btn-ghost min-h-9 px-2 text-sm" onClick={clearAll}>
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen} title="Filter opportunities">
        {filters}
        <div className="mt-6 flex justify-between gap-3">
          <button type="button" className="btn btn-ghost" onClick={clearAll}>
            Clear filters
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setFiltersOpen(false)}>
            Show {rows.length} results
          </button>
        </div>
      </Dialog>

      <div className="mt-6">
        {rows.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <p className="font-display text-xl font-semibold">No opportunities match those filters.</p>
            <button type="button" className="btn btn-primary mt-5" onClick={clearAll}>
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ s, status, needsInfo, closes, potential }) => (
              <li key={s.id} className="card flex flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <EligibilityBadge status={status} />
                  <Badge tone="neutral">{FUNDING_TYPE_LABEL[s.fundingType]}</Badge>
                </div>
                <h2 className="mt-3 text-lg font-semibold leading-snug">
                  <Link href={`/scholarships/${s.id}`} className="hover:underline">
                    {s.title}
                  </Link>
                </h2>
                <p className="text-sm text-muted">{s.provider}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="sr-only">Potential funding</dt>
                    <dd className="font-semibold">{potential !== null ? `Potential award up to ${formatMoney(potential)}` : 'Award amount not stated'}</dd>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted">
                    <CalendarDays aria-hidden="true" size={15} />
                    <dt className="sr-only">Deadline</dt>
                    <dd>{closes ? `Closes ${describeRelative(now, closes)} (${closes}, provider date)` : 'No deadline published'}</dd>
                  </div>
                  <div className="text-muted">
                    <dt className="sr-only">Route</dt>
                    <dd>{ROUTE_LABEL[s.applicationRoute]}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm">
                  <span className="font-semibold">Why this appears: </span>
                  {whyThisAppears(s, state.profile, status)}
                </p>
                {status === 'needs-information' && needsInfo ? (
                  <p className="mt-2 text-sm text-warning">
                    We need one more detail to check your eligibility.{' '}
                    <Link href="/profile" className="font-semibold underline">
                      Update profile
                    </Link>
                  </p>
                ) : null}
                <div className="mt-2">
                  <DemoLabel />
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Link href={`/scholarships/${s.id}`} className="btn btn-primary">
                    See my funding fit<span className="sr-only"> for {s.title}</span>
                  </Link>
                  <SaveButton scholarship={s} state={state} />
                  <CompareButton scholarship={s} state={state} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
