# Performance

## Methodology

- **Tool**: Lighthouse 12, default mobile emulation (simulated throttling).
- **Target**: production deployment `https://grantly-snowy.vercel.app`, run from a local machine.
- **Runs**: a single lab run per page. Numbers can vary between runs; no median was taken.
- **Profile**: fresh browser profile with empty `localStorage`.

**Important limitation.** Because the profile was empty, personalised routes (`/dashboard`, `/discover`
personalisation, `/compare`, `/applications`, application detail, Essay Studio) were measured in their
empty **"set up your journey"** state. Lighthouse was **not** run with a populated demo journey, so the
cost of rendering real dashboards, checklists and essays is not reflected below.

## Results

| Page | Performance | Accessibility | Best practices | FCP | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/` | 99 | 100 | 100 | 0.9 s | 2.0 s | 0 | 40 ms |
| `/dashboard` | 99 | 100 | 100 | 0.8 s | 2.0 s | — | 40 ms |
| `/discover` | 99 | 100 | 100 | 0.8 s | 2.0 s | — | 0 ms |
| `/compare` | 100 | 100 | 100 | — | 1.8 s | — | 20 ms |
| `/applications` | 100 | 100 | 100 | — | 1.8 s | — | 50 ms |
| Application detail | 99 | 100 | 100 | — | 2.0 s | — | 80 ms |
| Essay Studio | 99 | 100 | 100 | — | 2.0 s | — | 70 ms |

"—" means the value was not recorded in our notes, not that it was zero.

**INP was not measured.** It is a field metric that needs real user interactions; lab Lighthouse
reports TBT as a proxy only.

## Rendering decisions

- **System fonts**: no web-font downloads.
- **No images** in the UI; icons come from `lucide-react` as inline SVG.
- **CSS-only charts**: cost and progress visuals are styled elements, not a charting library.
- **No animation library**: a few CSS animations, disabled under `prefers-reduced-motion`.
- **Code-split Essay Studio**: `/applications/[id]/essay/[promptId]` loads `EssayStudio` via
  `next/dynamic` with a loading fallback.
- **Static scholarship pages**: `/scholarships/[id]` uses `generateStaticParams` with
  `dynamicParams = false`.
- **Thin route wrappers**: route files are server components that render one client component.
- **Small dependency list**: runtime dependencies are `next`, `react`, `react-dom`, `zod`,
  `lucide-react` and `@radix-ui/react-dialog`.
- **Discover search** (`src/components/discover/DiscoverExplorer.tsx`): results are filtered from
  local component state on every keystroke, and the URL is synced once after a 300 ms debounce
  (`SEARCH_URL_DEBOUNCE_MS`). Previously every keystroke called `router.replace()`. Typing "civic"
  now causes 1 URL replace instead of 5; a component test asserts that no navigation occurs
  before the debounce. This is a source-level reduction in navigation work. A latency
  difference was not separately benchmarked.
- **Decision Studio**: comparison rows are derived once per state change with `useMemo` and shared
  by the desktop table and mobile cards (previously `rowsFor` ran 1 + N times per render).

## Remaining bottlenecks

- **Synchronous `localStorage`**: the first `useJourney()` read and every `commit` write block the main
  thread for a `JSON.parse`/`stringify` plus Zod validation of the whole journey. This grows with the
  amount of stored data. An in-memory snapshot avoids repeat reads.
- **Client-rendered personalisation**: all personalised routes render their content after hydration,
  since state exists only in the browser. The server sends a shell; the meaningful content appears after
  JavaScript runs.
- **Unmeasured populated state**: see the limitation above; this should be measured before claiming
  performance for real usage.
