# Automatic weekly practice

Checkpoint: 2026-10-07. Starting PL commit:
`c10ebc0647667a32b5e746c116519dc9b9fdbcc2`, clean on
`codex/tutor-auth-ownership`. RS started at
`8fe8d7d01709bf52ab5e2b9f3df82d1797e06178`; its pre-existing `.env.example`
change is unrelated and preserved. The live proof required a small RS projection privacy correction described below.

## Existing model and ownership

`generate_placeholder_weekly_plan` already creates five `weekly_sessions`, numbered
1–5, with `duration_minutes` (default 15). It also creates three legacy activity
slots per session. Those rows and their independent results remain unchanged.
Session ordering is numeric; there is no separate session-date schedule.
Optional AI session titles are not a weekly pedagogy engine.

Each plan belongs to one reflection and learner. The reflection's editable
`extracted_objectives` row contains focus, developing, secure and retrieval arrays,
plus a separate misconception array and `updated_at`. Several objectives can be
selected. There is no existing structured difficulty, scaffolding or priority
column. The new small review form supplies priority and lets the tutor associate
existing misconceptions with the relevant selected objective without retyping.
Duplicate objective text across groups is presented once; developing state is
still recognized even when the focus key is selected.

Practice Loop owns the weekly sequence, allocation and approval. Resource Studio
owns resource/source choice, activity type, content, precise dose and validation.
No content generator or additional AI planner is added to PL.

## Deterministic planning

Entry point: `buildWeeklyPracticePlan` in `lib/weekly-practice-planner.ts`.
`WeeklyPracticePlan` contains exactly the five existing IDs in numeric order.
Each session currently has one educational `WeeklyNeed`, fulfilled by one or more
RS activities. One to five distinct selected objectives are supported. Selecting
more is rejected rather than silently dropping objectives or overloading sessions.

Rules:

- Reserve one exposure for every selected objective, then allocate remaining
  exposures by weighted need. Focus/developing has weight 3, maintenance weight 1;
  high priority adds 2 and a selected misconception adds 1.
- Prefer another objective between repeated exposures when one remains available.
  Consecutive focus practice is allowed after intervening needs are exhausted.
- First exposures and the final session include retrieval. Ordinary core practice
  uses fluency; explicit vocabulary and reading objectives use their matching
  existing contract intents.
- Repeated misconceptions are checked on later recurring exposures. A sole
  exposure to an objective with a misconception checks it immediately.
- Developing state or a known misconception prevents automatic application/
  reasoning escalation. Focus objectives with no such insecurity can progress
  after two prior exposures. These are simple inspectable heuristics, not an
  assessment of mastery or a universal calendar-based progression template.
- Use each stored duration, with a centralized 15-minute fallback. The supported
  MVP range is 5–30 minutes. Reserve two minutes outside the request; secure/
  retrieval maintenance gets at most seven requested minutes. RS further budgets
  activity transitions/headroom within the request.

Requests reuse the exact RS v1 allowlist: subject, year, objective, durationMinutes
and supported intents. Existing v1 has no separate misconception field, so selected
educational misconception text is appended to the objective for the check. The
240-character contract limit is enforced without truncation. Longer needs must be
edited/simplified before building. IDs, names, profiles, raw reflections and
medical/SEND data are never added to the request. As before, tutors must confirm
that the educational free text itself is fictional and non-identifying.

## Fulfilment and review

`fulfilWeeklyPractice` uses two workers for five requests, with stable result
indices. A failed request or activity leaves other successful proposals intact.
The complete draft identifies failures and cannot be sent until all are resolved.
Rebuild requests a new full week with a new PL identity. A session rebuild uses
the same planned educational need, replaces only that session and preserves
successful siblings under a new week identity. The earliest retained expiry still applies. Building and previewing make no learner assignments or packages.

Server-only `WeeklyDraft` retains tutor/plan ownership, generated time, expiry,
source-objective version hash, planned needs and RS proposal references/results.
Review state is process-local, bounded to 50 drafts and expires no later than
30 minutes or the earliest RS proposal. Restart/eviction can remove it. Normal
DTOs omit capabilities and internal references; previews resolve each activity
through the existing RS review renderer. Dose text containing provider/provenance
or URL markers is rejected. Structured source fields and content are not retained.

The page presents objective checkboxes, priority, relevant stored misconceptions,
subject/year, **Build weekly practice**, all five session summaries and previews,
then **Approve & send week**. It shows requested time per session and total time,
types, purposes and doses. Incomplete and expired drafts are clearly blocked.
Changing inputs discards the displayed draft. Single-session approval and manual
library search remain collapsed fallbacks; legacy slots remain separately labelled.

## Atomic approval and immutable delivery

Migration: `20261007120000_weekly_practice_approval.sql`.
New private immutable tables: `weekly_practice_approvals` (one per plan) and
`weekly_practice_batches` (links to the existing five approval batches).
Both use forced RLS with no ordinary client grants. Service-only RPCs independently
check active tutor ownership and the integration flag.

`approveWeeklyPractice` looks up durable success before requiring the transient
draft, enabling retries after cache expiry/restart. Otherwise it requires a ready,
current, tutor-owned draft, the original five sessions and unchanged objective
version. Every activity is materialised using existing deterministic RS keys and
strict opaque-reference validation. PL stores no activity bodies, hidden answers
or provenance. The objective/session checks run again after remote work.

`approve_weekly_practice` locks the plan, verifies the reflection objective row's
version under lock, validates all five session mappings, objective keys and budgets,
and calls the existing transactional per-session approval function inside one
database transaction. It then records the week and links its batches. Failure in
any session rolls back all PL references, batches, assignments and week state.
Already-materialised RS packages can remain harmless and unassigned; retries use
the same keys. Same-proposal retries return the same assignments, even without
review data. A different prior approval blocks the send. A database trigger also
prevents the single-session fallback from appending after a week is sent.

Learner `/learn`, exact-package delivery, submissions, scoring and tutor reporting
are reused unchanged. Ordered assignments occupy their intended sessions. Sent
state is durable and reloaded independently of draft state. No replacement,
deletion, reset or automatic adaptation of started/completed work is implemented.

## Automated verification

Final complete run: **301 tests passed**, including 27 new planner, orchestration,
approval, UI-rendering and real disposable PostgreSQL checks. Typecheck, lint and
production build passed. Final diff/scope review and credential-pattern scans passed; 65 PL client JavaScript bundles contained no tested private-key patterns or service-token variable names. New tests cover deterministic ordering, fractions,
multi-objective allocation, insecure progression, budgets, identity allowlists,
bounded concurrency, sibling failure, previews, expiration, objective changes,
materialisation/transaction failure, idempotency/double clicks, conflicts, RLS,
complete five-session learner reads and unchanged exact-package delivery. Existing
all-11 delivery/scoring/submission and tutor-results coverage remains green.

## Live proof status

The migration has been applied only to the verified isolated synthetic PL database.
Canonical PL and RS development servers run against local ports 56321 and 57321.
A fresh plan for Fictional Student — Local Lab was provisioned through tutor-scoped
reflection/objective inserts and the existing placeholder-plan RPC:
`ecb989d6-7b34-4804-b278-63fe25fe1224`. It uses the Year 5 equivalent-fractions
objective, developing/focus state and numerator/denominator misconception.
Before/after counts and per-row digests are stored in the task artifact directory.

The tutor clicked Build weekly practice once. Five RS requests (maximum two
concurrent) produced four successful sessions and one failed Spot Mistake activity
in Session 5. Successful previews remained available and Send stayed disabled.
A session-only rebuild retried the same Session 5 need, preserving Sessions 1–4.
During preview review, a generated MCQ exposed an internal generation citation.
The narrow RS privacy correction below was applied, then Session 5 was rebuilt
again. Total: **seven RS proposal requests**, with no tutor source/type selection.
No draft build created packages, assignments, submissions or public publications.

All eight final previews rendered in the embedded RS review surface:

| Session | PL purpose | RS activities and doses | Activity minutes |
| --- | --- | --- | ---: |
| 1 | Retrieval + fluency | Multiple Choice, 5 questions; Arithmetic Input, 8 questions | 5 + 6 |
| 2 | Fluency | Arithmetic Input, 8 questions | 6 |
| 3 | Spaced retrieval + misconception check | Multiple Choice, 5 questions; Spot Mistake, 4 examples | 5 + 6 |
| 4 | Continued fluency | Arithmetic Input, 8 questions | 6 |
| 5 | Retrieval + misconception consolidation | Multiple Choice, 5 questions; Spot Mistake, 4 examples | 5 + 6 |

The weekly target is 75 minutes, with 65 minutes requested and 45 minutes of actual
activities supplied by RS, plus transitions/headroom. These are now distinguished
in the review UI. Every session covers the selected equivalent-fractions objective.
This is defensible variation/consolidation for a developing objective, not an
unsupported escalation to reasoning. It is not five identical sessions. However,
RS reused the arithmetic exercise across fluency sessions; unique question sets
for every exposure are not guaranteed by the current fulfilment contract.

One **Approve & send week** click succeeded: one week record, five linked session
batches and eight ordered assignments. The tutor saw **Week sent to learner**.
The learner's `/learn` view showed all five sessions with counts **2, 1, 2, 1, 2**.
Activities opened through the existing exact-package safe-delivery path.

The learner completed Session 1 Multiple Choice through the actual embedded UI:
**4/5**, including a deliberately incorrect response. They completed Session 5
Spot Mistake: **8/8 identification/correction**, with four written explanations
saved as pending tutor review. The session end page correctly showed **1 of 2**
submitted and **Practice still to submit**. On tutor return the report showed
**2 of 8** submitted, both exact scores and all pending explanations; the other
six activities and all five sessions remained unfinished. No completed sibling
or legacy result was overwritten.

Authentication used existing synthetic accounts. A temporary loopback-only test
helper loaded existing tutor credentials privately and called normal Supabase
password authentication; it preserved the already-authenticated learner session
in memory for role switching. It did not change credentials, mappings, roles or
product authentication. Browser iframe input required keyboard navigation because
direct iframe-element clicks were unavailable. No assignment/result rows were
inserted manually: send and both submissions used the actual PL user interface.

### Database audit

Baseline below is after the fresh fictional reflection/plan setup, before building.

| Table | Before | After send | After limited learner proof |
| --- | ---: | ---: | ---: |
| PL weekly approvals | 0 | 1 | 1 |
| PL week/batch links | 0 | 5 | 5 |
| PL session approval batches | 6 | 11 | 11 |
| PL package references | 12 | 20 | 20 |
| PL session assignments | 10 | 18 | 18 |
| PL durable submissions | 5 | 5 | 7 |
| PL plans / sessions | 3 / 15 | 3 / 15 | 3 / 15 |
| PL legacy activities / results | 45 / 0 | 45 / 0 | 45 / 0 |
| RS private packages / provenance | 12 / 12 | 20 / 20 | 20 / 20 |
| RS public activities / versions | 2 / 10 | 2 / 10 | 2 / 10 |

Every pre-existing row retained its digest after send. Student and learner-account
counts/digests also remained identical. Provenance remains private in RS; only
opaque references and educational metadata were stored in PL.

### Narrow Resource Studio correction

The live preview contained `Cite: Original generation brief, not retrieved evidence`
in generated supporting text. `tutorPreviewData` and `learnerProjection` now reject
these internal generation markers recursively, rather than removing or rewriting
canonical content. This also makes affected new proposals fail preparation before
assignment. The replacement Session 5 passed the boundary and preview review.
No generator, source, ranking, orchestration or provenance persistence was changed.
Two regressions cover nested display fields and canonical-content immutability.

RS commit: `a7852ddc730050873298a4816ca168aba0e2bccd` (`Reject internal generation citations in practice views`). Only the pre-existing `.env.example` change remains dirty there; nothing was pushed.

RS validation: **50 focused tests**, typecheck and lint passed; the full suite
passed **1,241 tests in 74 files** using two workers. The first full run, concurrent
with live generation, had one unrelated parser test exceed its five-second timeout;
the bounded-worker rerun passed without product/test changes for that timeout.

### Restart proof

Both canonical app processes were stopped and restarted after successful production builds. The tutor report retained the sent week, 2 of 8 submissions and both scores. The learner retained all five sessions and the saved 4/5 score; an unfinished Arithmetic Input activity rendered through a fresh RS delivery capability. Every audited table count and row digest was identical before and after restart. The temporary authentication helper was stopped and removed.

## Limits

This remains a local fictional-data development demonstration. Existing production
gates, learner onboarding, operational security, rate limits, retention, monitoring,
media/acknowledgement obligations and deployment hardening are not changed.
Later improvements: explicit mastery/scaffolding fields,
richer objective mixtures, safe week replacement, review resolution and combined
legacy/approved progress presentation. None justifies duplicating RS authoring.

## MVP assessment

The normal development flow now supports confirmed learning needs → automatic five-session build → whole-week review → one approval → all five learner sessions, without tutor source or activity-type selection.

- **Demo blockers:** none remaining in the tested core flow.
- **Pilot/production hardening:** production enablement, onboarding, operational security, rate limits, retention, monitoring and durable/recoverable review drafts remain outside this checkpoint.
- **Nice-to-have enhancements:** varied questions across repeated exposures, closer duration filling, richer multi-objective sessions, safe replacement, written-response review resolution and unified progress presentation.
