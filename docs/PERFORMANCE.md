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

## Post-sprint measurements (commit 1c4a35d, 18:30 IST, 7 Nov 2026)

**Condition A: fresh visitor.** Lighthouse 12, default mobile emulation, one run per page against production:

| Page | Perf | A11y | BP | FCP | LCP | CLS | TBT | Script transfer |
|---|---|---|---|---|---|---|---|---|
| `/` | 97 (repeat runs 98, 98, 99) | 100 | 100 | 0.9 s | 2.0–2.5 s | 0 | 10–50 ms | 259 KiB |
| `/dashboard` | 99 | 100 | 100 | 0.8 s | 2.0 s | 0 | 10 ms | 259 KiB |
| `/discover` | 99 | 100 | 100 | 0.8 s | 2.0 s | 0 | 10 ms | 259 KiB |
| `/compare` | 100 | 100 | 100 | 0.8 s | 1.8 s | 0 | 40 ms | 259 KiB |
| `/applications` | 100 | 100 | 100 | 0.8 s | 1.8 s | 0 | 20 ms | 259 KiB |
| `/applications/[id]` | 99 | 100 | 100 | 0.8 s | 2.0 s | 0 | 40 ms | 270 KiB |
| Essay Studio | 99 | 100 | 100 | 0.8 s | 2.0 s | 0 | 50 ms | 269 KiB |

**Condition B: populated demo.** Lighthouse cannot seed localStorage, so this was measured with a
Playwright script against production. The script seeds the demo, adds two compare options, and reads
`PerformanceObserver` entries (LCP, layout-shift, longtask) on each route. The viewport was 412×823 with
**no CPU or network throttling**, on an Apple-silicon laptop with a warm HTTP cache. The page `h1` was
checked to confirm populated content. These numbers are not comparable to Lighthouse mobile scores.

| Route | FCP | LCP | CLS | Long-task time over 50 ms |
|---|---|---|---|---|
| `/dashboard` | 48 ms | 64 ms | 0 | 0 ms |
| `/discover` | 64 ms | 92 ms | 0 | 0 ms |
| `/compare` (2 options) | 92 ms | 124 ms | 0 | 0 ms |
| `/applications` | 68 ms | 96 ms | 0 | 0 ms |
| `/applications/[id]` | 300 ms | 348 ms | 0 | 0 ms |
| Essay Studio | 316 ms | 348 ms | 0 | 0 ms |

The two dynamic routes are slower because they are server-rendered on demand rather than prerendered.
Typing 11 characters into Discover search and seeing results took 45 ms end to end, with no long
tasks. INP was not measured, because it is a field metric.
