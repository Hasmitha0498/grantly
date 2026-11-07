# Architecture

GRANTLY is a Next.js 16 App Router application (React 19, strict TypeScript). In this build there is
no backend: all of a student's journey state lives on the device in a versioned `localStorage` entry.
The code is split into four layers, and dependencies point in one direction only.

```
src/app          → thin route wrappers (server components), metadata, loading/error/not-found, /api/health
src/components   → client components: shell, ui, onboarding, discover, funding, compare, apply, essay, dashboard
src/repository   → journey-core.ts (pure transitions) · local-store.ts (persistence) · use-journey-actions.ts (mutations)
src/domain       → types, Zod schemas, pure rule engines (eligibility, evidence, financial, decision,
                   action-priority, application-state, essay, date)
src/data         → fictional demo catalog and demo persona
```

## Dependency direction

`components → repository → domain`. Components read state through `useJourney()` and change it through
`useJourneyActions()`; they also call domain engines directly to derive views (for example
`getNextActions`, `displayStatus`, `evaluateEssayDraft`). The repository calls domain rules to validate
transitions. `src/domain` imports nothing from React or Next.js, so every engine is a plain function that
can be unit tested without a DOM.

## Layers

### App routes: thin server wrappers
Each `page.tsx` exports `metadata` and renders one client component, for example
`src/app/dashboard/page.tsx` renders `<Dashboard />`. Route files hold no business logic.

- `/scholarships/[id]` is statically generated: `generateStaticParams()` returns every catalog id and
  `dynamicParams = false`, so unknown ids go to `notFound()`. Metadata is built from the catalog.
- `/applications/[id]/essay/[promptId]` loads `EssayStudio` with `next/dynamic` and a `LoadingState`
  fallback, so the editor code is split out of other routes' bundles.
- `src/app/api/health/route.ts` is a health endpoint.

### Client components
Interactive UI lives in `src/components/**`. `JourneyGate` (shell) waits for the client snapshot,
shows a "set up your journey" state when there is no profile, and shows a notice when stored data was
reset after failing validation (`wasRecovered()`).

### Domain engines (pure)
Deterministic functions with a `today` date injected as `YYYY-MM-DD` where time matters. See
`docs/PRODUCT_FLOWS.md` for the state machine, essay readiness and Action Engine tiers.

### Repository
- **`journey-core.ts`**: pure `(state, input, now) → state` transitions: `saveProfile`, `setBookmark`,
  `setCompare` (max 3), `startApplication` (idempotent id `scholarshipId__programId`),
  `updateApplication` (enforces `canTransition`, requires explicit submission confirmation),
  `updateTask`, `saveStory`/`removeStory`, `saveEssay` (compare-and-swap on `revision`, throws
  `ConflictError` on a stale write), `removeApplication`, `seedDemo`, `emptyState`.
- **`local-store.ts`**: the `localStorage` adapter exposed to React via `useSyncExternalStore`.
- **`use-journey-actions.ts`**: the mutation facade. Each action is `run(() => commit(transition))`;
  success toasts fire only after `commit` returns.

## Server vs client responsibilities

| Server (build/request time) | Client (after hydration) |
|---|---|
| Route shells, metadata, static scholarship pages from the catalog | Reading and writing journey state |
| `notFound()` for unknown scholarship ids | Eligibility, cost, decision and next-action computation on the user's profile |
| Code-split boundary for Essay Studio | Toasts, dialogs, autosave |

`useJourney()` returns `null` as the server snapshot, so no `localStorage` access happens during SSR or
hydration; personalised content renders after hydration.

## Persistence model

- **Key**: `grantly:journey:v1` (`STORAGE_KEY`). The version lives in the key and in the state shape.
- **Validation on read**: `parseStored` runs `JSON.parse` then `journeyStateSchema.safeParse` (Zod).
  Missing data gives `emptyState()`. Unparseable or invalid data also gives `emptyState()` with
  `recovered: true`, and `JourneyGate` tells the user their saved data was reset.
- **Persist before success**: `commit(fn)` applies the pure transition, calls `localStorage.setItem`, and
  only then updates the in-memory cache and notifies subscribers. If the write throws, it raises
  `StorageError`; the facade shows "Your changes couldn't be saved." with a retry action and the UI state
  is not advanced.
- **Cross-tab sync**: `subscribe` listens for `storage` events on the same key, re-parses the new
  value and notifies listeners.
- **Cache**: one module-level snapshot so `useSyncExternalStore` returns a stable reference.

## Data flow: complete a task → next best action recomputes

1. The user marks a checklist task done in `ApplicationWorkspace`.
2. The component calls the `useJourneyActions()` method, which runs
   `commit((s) => core.updateTask(s, taskId, { status: 'complete' }))`.
3. `updateTask` returns a new state; `commit` writes it to `grantly:journey:v1`, replaces the cache and
   emits.
4. Every component using `useJourney()` re-renders with the new snapshot.
5. `Dashboard` calls `getNextActions(applications, tasks, getScholarship, today)` again; the completed
   task is skipped, the remaining actions are re-sorted by tier → due date → id, and the top item becomes
   "Your next best action". `displayStatus` may now derive "Ready to submit".
6. Other open tabs receive the `storage` event and update the same way.

Essay saves follow the same path through `saveEssay`, which also updates the linked checklist task in
the same state write.

## Trade-offs

- **No backend in this build.** Data is per browser and per device; there is no account, sync, or
  server-side backup. Clearing site data removes the journey.
- **`supabase/migrations/001_initial.sql`** is a reference cloud schema with RLS. It is not wired into
  the app and nothing reads or writes it.
- **Client-rendered personalisation.** Personalised routes render after hydration because state is only
  available in the browser.
- **Synchronous storage.** `localStorage` reads and writes are synchronous; the in-memory cache limits
  reads to the first access and storage events.
