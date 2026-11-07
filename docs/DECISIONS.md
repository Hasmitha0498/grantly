# Decisions

Short ADR-style records of the main choices in this build.

## ADR-1: Next.js App Router

- **Context**: needed routing, metadata, static generation and code splitting with little setup.
- **Decision**: Next.js 16 App Router with React 19. Route files are thin server components; interactive
  UI is client components.
- **Consequences**: scholarship pages are statically generated (`generateStaticParams`,
  `dynamicParams = false`); Essay Studio is code-split with `next/dynamic`. Personalised pages still
  render after hydration because their data is on the device.

## ADR-2: Strict TypeScript and Zod at the boundary

- **Decision**: TypeScript strict mode across the codebase; Zod schemas (`src/domain/schemas.ts`)
  validate anything read from storage and user-entered stories.
- **Consequences**: `npm run typecheck` runs in CI; stored data that fails the schema is reset instead of
  being trusted.

## ADR-3: On-device persistence instead of a backend (this build)

- **Context**: a demo with no accounts, delivered quickly, with no personal data held on a server.
- **Decision**: store the journey in `localStorage` under `grantly:journey:v1`, behind a repository
  (`journey-core` pure transitions + `local-store` adapter + `use-journey-actions` facade).
- **Consequences**: no sync across devices, no server backup; clearing site data loses the journey.
  The repository boundary keeps a future backend swap contained.
  `supabase/migrations/001_initial.sql` is a reference schema only and is not active.

## ADR-4: Deterministic rule engines, not AI scoring

- **Decision**: eligibility, evidence alignment, cost coverage, decisions and next actions are pure,
  deterministic functions in `src/domain`.
- **Consequences**: every result can be explained line by line and unit tested. No percentages or
  "chance of winning" scores; missing data yields "needs information" or "insufficient data", and ties
  are reported as inconclusive.

## ADR-5: Fictional demo scholarships, clearly labelled

- **Decision**: every scholarship, provider, university, program and the persona "Aisha" are fictional
  (`src/data`). The UI and README say so.
- **Consequences**: nothing in the app is a real offer; users should not act on catalog content.

## ADR-6: No live integrations or provider status sync

- **Decision**: GRANTLY does not submit applications or read status from providers. Submission and
  awards are recorded by the student ("Submitted — recorded by you", "Awarded — self-reported") and
  submission requires explicit confirmation.
- **Consequences**: status is only as current as the student keeps it; follow-up dates help prompt
  checks.

## ADR-7: Radix only for dialogs

- **Decision**: use `@radix-ui/react-dialog` for modal dialogs (focus trap, Escape, labelling) and build
  everything else with plain elements and Tailwind.
- **Consequences**: a small dependency list. Because dialogs open without a Radix `Trigger`,
  `Dialog.tsx` restores focus to the opener itself via `onOpenAutoFocus`/`onCloseAutoFocus`.

## ADR-8: Dates are provider calendar dates

- **Decision**: deadlines are stored as `YYYY-MM-DD` calendar dates as published by the provider, with no
  invented closing time or time zone. Engines take `today` as an injected date string and compare whole
  calendar days (`daysBetween`).
- **Consequences**: no false precision such as "closes at 23:59". **Current limitation**: "today" is
  derived from the UTC calendar date (`toDateOnly` uses `toISOString`), so for a user in India the date
  rolls over at 05:30 IST rather than local midnight, and a deadline can show as "today" or "overdue"
  a few hours early or late.
