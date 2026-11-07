# Testing

## Layers

| Layer | Tool | Location |
|---|---|---|
| Domain and repository unit tests | Vitest (jsdom) | `src/tests/unit/*.test.ts` |
| Component tests | Vitest + Testing Library | `src/tests/components/*.test.tsx` |
| End-to-end, accessibility, security | Playwright (Chromium) + `@axe-core/playwright` | `e2e/journey.spec.ts` |

Shared test data is in `src/tests/fixtures.ts`; setup is `src/tests/setup.ts`; component render helpers
are `src/tests/components/render.tsx` and `helpers-b.tsx`.

### Unit tests (`src/tests/unit`)
One file per engine: `eligibility`, `evidence`, `financial`, `decision`, `action-priority`,
`application-state`, `essay`, `date`, plus `journey-core` (pure transitions, idempotent start,
compare-and-swap essay save), `local-store` (parsing, recovery, persistence) and `regressions`.

### Component tests (`src/tests/components`)
Dashboard, Discover explorer, Funding Fit panel, Decision Studio, applications list and workspace, Essay
Studio, onboarding stepper, profile editor, app shell, UI primitives, and lib/form helpers.

### E2E (`e2e/journey.spec.ts`)
- Demo journey → next action → complete essay → next action changes and persists after reload
- Eligibility recomputes after a profile edit
- Search, filter, bookmark persists
- Compare A vs B; priority and budget change the explanation
- Start preparing idempotently, complete a task, record submission
- Deep links, unknown routes, back/forward
- Onboarding validation, focus and keyboard
- Follow-up date does not surface early
- HTML in user text renders inert; corrupted local storage recovers with a notice
- No horizontal overflow at several viewport widths
- Keyboard-only: start demo, open next action, dialog Escape restores focus
- `@a11y` axe scan (tags `wcag2a`, `wcag2aa`, `wcag21aa`) on 10 routes, failing on any serious or
  critical violation

`playwright.config.ts` starts `npm run start -p 3107` locally (run `npm run build` first). If
`E2E_BASE_URL` is set, no server is started and the suite runs against that deployment.

## Commands

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint, zero warnings
npm run test:run         # Vitest once
npm run test:coverage    # Vitest with v8 coverage and thresholds
npm run build && npm run test:e2e
npm run test:a11y        # only @a11y tests
E2E_BASE_URL=https://grantly-snowy.vercel.app npm run test:e2e
```

## Measured results

- 17:48 IST baseline: Vitest 225/225, Playwright 17/17.
- After the 18:30 IST optimization sprint: **Vitest 230/230** and **Playwright 18/18**. The new tests cover URL-param allowlists,
  scenario-aware comparison labels, debounced search and URL sync, and invalid deep links. The workspace test for
  essay readiness was rewritten because the checklist no longer offers a status select for essay tasks.

Coverage (v8, `include: src/**/*.{ts,tsx}`, excluding `src/tests/**` and type-only
`src/domain/types.ts`):

| Scope | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| All `src` | 89.9% | 85.1% | 84.9% | 92.2% |
| `src/domain` | 96.7% | 92.4% | 97.8% | 98.9% |

Thresholds are enforced only on `src/domain/**` in `vitest.config.ts`: 90% statements, 85% branches,
90% functions, 90% lines. `npm run test:coverage` fails if the domain drops below them.

## CI

`.github/workflows/ci.yml` defines one job on Node 22: `npm ci` → typecheck → lint → coverage → build →
install Chromium → E2E → `npm audit --omit=dev --audit-level=high`.

The workflow file exists in the repository locally but **has not been pushed to GitHub**: the GitHub
token used lacks the `workflow` scope, so CI is not currently running on the remote. The results above
come from local runs.

## Known limits

- Route wrapper files in `src/app/**` are covered by E2E tests, not by unit coverage, which lowers the
  all-`src` numbers.
- Discover sort, course and deadline filter branches have less coverage than the rest of the explorer.
- E2E runs in desktop Chromium only.
- Automated axe checks do not prove full WCAG conformance (see `docs/ACCESSIBILITY.md`).
