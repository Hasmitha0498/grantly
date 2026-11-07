# Accessibility

GRANTLY targets WCAG 2.1 AA. This page lists what the code does and how it was checked. Automated checks
do **not** prove full WCAG conformance; no manual screen-reader audit or testing with disabled users is
recorded here.

## Structure and navigation

- **Landmarks**: `AppShell` renders header navigation and a single `<main id="main" tabIndex={-1}>`.
- **Skip link**: "Skip to content" is the first focusable element and targets `#main`.
- **Headings**: one `h1` per route. The onboarding stepper moves focus to the step heading when the
  step changes.
- **Current page**: navigation links (desktop and mobile in `NavLinks.tsx`) set
  `aria-current="page"` on the active route.

## Forms

- Every field has a visible `<label>`. `ProfileFields` passes `id`, `aria-describedby` (hint and error
  text) and `aria-invalid="true"` (only when there is an error) to each control.
- On a failed step, `OnboardingStepper` focuses the first element with `aria-invalid="true"`.
- Error messages are text, not colour alone.

## Dialogs

- Dialogs use `@radix-ui/react-dialog` (`src/components/ui/Dialog.tsx`), which provides a focus trap,
  `Escape` to close, and a labelled title (`RD.Title`) with optional description.
- Because dialogs are opened programmatically (no Radix `Trigger`), `Dialog.tsx` adds custom focus
  handling: `onOpenAutoFocus` records the element that had focus, and `onCloseAutoFocus` returns focus
  to it if it is still in the document.
- The close button has `aria-label="Close dialog"`; its icon is `aria-hidden`.

## Live feedback

- Toasts (`Toast.tsx`) render in a `role="status"` `aria-live="polite"` region; error toasts can carry
  a retry action.
- Loading states use `role="status"` with `aria-live="polite"`.
- Save status in the application workspace and the Discover result count are announced with
  `aria-live="polite"`.

## Status and colour

Eligibility, deadline and application status are never conveyed by colour alone: each badge pairs an
icon with a text label (for example "Ready to submit", "Waiting for provider", "Needs information").
Decorative icons are `aria-hidden`.

## Motion and touch targets

- `globals.css` has a `prefers-reduced-motion: reduce` block that disables animations and transitions.
- Buttons and form controls have `min-height: 44px`.
- E2E checks that there is no horizontal overflow at several viewport widths.

## Validation

| Check | Result |
|---|---|
| axe-core via Playwright (`wcag2a`, `wcag2aa`, `wcag21aa`) on 10 routes with demo data loaded: `/`, `/onboarding`, `/dashboard`, `/discover`, a scholarship page, `/compare`, `/applications`, an application detail, Essay Studio, `/profile` | 0 serious or critical violations |
| Lighthouse 12 accessibility (mobile, empty-journey state; see `PERFORMANCE.md`) | 100 on all 7 measured pages |
| Keyboard-only E2E | Start demo, open next action, open a dialog, close with `Escape`, focus returns to the opener |
| Onboarding E2E | Validation moves focus to the first invalid field; flow works by keyboard |

Run them with `npm run test:a11y` (axe only) or `npm run test:e2e` (everything).

## Known gaps

- axe reports only automatically detectable issues and the test fails only on serious/critical impact;
  moderate and minor findings are not gated.
- No recorded manual testing with VoiceOver, NVDA or TalkBack.
- No recorded testing at 200%/400% zoom beyond the overflow checks.
- Lighthouse accessibility scores were taken in the empty state, not with a populated journey.
