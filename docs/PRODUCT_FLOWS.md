# Product flows

GRANTLY follows one journey: **Discover → Evaluate → Apply → Manage**. All scholarships, providers,
universities and programs are fictional demo data. A user starts from `/` with **Explore a demo
journey** (`seedDemo`), **Create my funding profile** (`/onboarding`) or **Continue my journey**.

## 0. Profile (`/onboarding`, `/profile`)

- Three-step onboarding with validation; on an invalid step, focus moves to the first field with
  `aria-invalid="true"`. Going back keeps entered data.
- `/profile` edits everything, adds structured evidence and can reset the demo (`resetAll`).
- Saving calls `journey-core.saveProfile`; eligibility and fit recompute from the new profile.

## 1. Discover (`/discover`)

- Text search, filters (funding type, eligibility, course, deadline) and sorting.
- Filter state is reflected in the URL so a view can be shared or restored with back/forward.
- **Save** (`setBookmark`) and **Compare** (`setCompare`, up to `MAX_COMPARE = 3` scholarship/program
  options).

## 2. Evaluate (`/scholarships/[id]`, `/compare`)

- **Funding Fit** (`/scholarships/[id]`, statically generated):
  - Eligibility (`eligibility.ts`): each mandatory rule returns `eligible`, `not-eligible`,
    `needs-information` or `unverified`. No percentages; no grade-scale or currency conversion; missing
    household income gives "needs information".
  - Evidence alignment (`evidence.ts`): documented criteria vs the student's structured evidence. Not a
    probability.
  - Cost coverage (`financial.ts`): full-program cost; awards capped at the categories they cover;
    unknown data shows "Insufficient data".
- **Decision Studio** (`/compare`, `decision.ts`): compares explicit `(scholarshipId, programId)`
  options, separates potential and confirmed funding, shows the budget gap, and explains the result
  from the student's priorities. Ineligible options are never recommended; ties or missing data give an
  explicit inconclusive result.

## 3. Apply (`/applications/[id]`, Essay Studio)

- **Start preparing** calls `startApplication`. It is idempotent: the id is
  `scholarshipId__programId`, so starting twice does not duplicate the application or its tasks.
- The checklist groups tasks as To do / Waiting on someone / Ready. Tasks owned by someone else (e.g.
  a recommender) can carry a `nextFollowUpOn` date.
- **Essay Studio** (`/applications/[id]/essay/[promptId]`, code-split): prompt interpretation, Story
  Bank, outline, draft with live word count, debounced autosave, and revision-conflict handling.

### Essay readiness rule (`essay.ts`, `journey-core.saveEssay`)

`evaluateEssayDraft(body, wordLimit, userMarkedReady)`:

- Words are whitespace-delimited tokens after trimming.
- `canMarkReady` = draft is non-empty **and** word count ≤ limit.
- `ready` = `canMarkReady` **and** the student explicitly marked it ready.

`saveEssay` is a compare-and-swap write: if the stored revision differs from `expectedRevision`, it
throws `ConflictError` and the Studio offers to resolve it. On success it stores
`userMarkedReady: ready` (so an over-limit or empty draft can never be saved as ready) and, **in the
same state write**, updates the linked checklist task: complete when ready, and back to `todo` if it was
complete but the draft is no longer ready.

## 4. Manage (`/applications`, `/applications/[id]`, `/dashboard`)

### Application state machine (`application-state.ts`)

| From | Allowed to |
|---|---|
| `preparing` | `submitted`, `withdrawn` |
| `submitted` | `waiting`, `action-required`, `awarded`, `not-selected`, `withdrawn` |
| `waiting` | `action-required`, `awarded`, `not-selected`, `withdrawn` |
| `action-required` | `waiting`, `awarded`, `not-selected`, `withdrawn` |
| `awarded`, `not-selected`, `withdrawn` | none (closed) |

- `updateApplication` throws `TransitionError` for any other move.
- Moving to `submitted` requires `confirmSubmission: true` ("Submitted — recorded by you"); GRANTLY does
  not submit anything to providers.
- Moving to `awarded` records `awardEvidence: 'student-reported'` and sets `offerResponseStatus:
  'pending'`. An award amount or offer response can only be entered on an awarded application.

### Derived "Ready to submit"

`displayStatus(app, tasks)` returns `ready` when the application is `preparing` and every **required**
task is complete (`progress` counts required tasks only). `ready` is presentation-only and never
persisted.

### Action Engine (`action-priority.ts`)

`getNextActions(applications, tasks, getScholarship, today)` builds a deterministic list. Deadline
buckets from `today`: `overdue` (< 0 days), `within-48h` (≤ 2), `within-7d` (≤ 7), `later`, `undated`.

| Tier | What |
|---|---|
| 1 | Required student task, overdue or due within 48h |
| 2 | Pending award offer response with a response date |
| 3 | Required task due within 7 days; follow-up whose `nextFollowUpOn` has arrived |
| 4 | Required task due later or undated; offer response with no date |
| 5 | Optional task |

Rules:
- A task's due date is the earlier of its own date and the application's `closesOn` (it inherits the
  application deadline).
- Student preparation tasks are only listed while the application is `preparing` or `action-required`.
- Tasks that are `waiting` or owned by someone else appear as actions only once `nextFollowUpOn` is on or
  before today; until then they go in the separate **waiting** list.
- `withdrawn` and `not-selected` applications produce nothing; an award offer clears once a response
  is recorded.
- Sort: tier, then due date (undated last), then id. Each action includes a plain-language `reason`, a
  CTA, a deep link (Essay Studio for essay tasks) and an overdue warning.

The dashboard shows the first action as **Your next best action**, with its reason, plus coming-up and
waiting-on-others lists.
