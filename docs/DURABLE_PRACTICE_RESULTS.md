# Durable practice results — functional MVP report, 2026-10-06

This checkpoint makes the existing approved-package delivery loop durable. It is a
local, fictional-data private demonstration, not production onboarding or deployment.
Numbers below correspond to the requested final report.

## Practice Loop (1–20)

**1. Baseline.** Canonical PL began clean on `codex/tutor-auth-ownership` at
`867a402b4bf54a3fdfa85ef965e88ea2f379f7f0`. Canonical RS began on `main` at
`ab12a7ea5617cc8c0a7ffd4911c1a6fd51416f92`, with only the longstanding unstaged
`.env.example` modification. Environment-file content was not inspected or changed.

**2–3. Model and migration.**
`20261007000000_resource_practice_submissions.sql` adds one private table,
`practice_loop_private.resource_practice_submissions`, containing UUID attempt ID,
unique assignment FK, student FK, authenticated-user FK, bounded response/result
JSON and `submitted_at`. Plan, session, package ID, integrity, content version and
activity type remain bound through the immutable assignment/reference chain rather
than duplicating mutable identifiers in each row. No draft/start row is saved: the
attempt exists only after valid submission and trusted checking. No eleven-table
model or authoring schemas were copied into PL. Migration applied only to isolated
synthetic PL on local port 56322; no hosted database was changed. RS has no migration.

**4. Response contract.** The browser sends `{responses}` only. PL bounds the body
and resolves its assignment; RS derives strict response-only schemas from the
answer-free learner projection. Exact question/option/item membership, required
responses, selection uniqueness, mode-specific fields and text limits are checked.
Unexpected keys/type/identity/score, missing answers, foreign IDs, oversized input
and wrong package integrity fail before persistence. Text is bounded to 4,000
characters (200 for arithmetic/typed corrections), request responses to 32 KiB,
and HTTP bodies to 40 KiB. PL strictly allowlists the returned safe result envelope.

**5. Idempotency and attempt policy.** Existing imported-MCQ practice keeps one
submitted result per assignment; the new flow follows the same small policy.
A UNIQUE assignment FK plus an assignment row lock means the first valid commit
wins, even for concurrent retries. Subsequent requests return the same stored
attempt without rechecking or replacing the response. Reopen never starts an
attempt. No reset/retry product was added. Upstream failure creates no submission;
a later valid retry succeeds. If a save acknowledgement is lost, reopen/retry
finds the committed row safely.

**6. Authorization/RLS.** Every submit first calls `requireLearner()`. The active
admin-managed Supabase mapping determines identity internally; the browser cannot
supply a student ID. The learner reference RPC checks mapped student → plan and
reflection → session → approval batch/assignment → exact package/integrity.
`save_practice_submission` is callable only by `service_role` and rechecks that
relationship, active mapping, immutable version/type and package integrity under
locks. The private table has forced RLS, no public/anon/authenticated grants, and
an update/delete rejection trigger. `get_practice_submission_report` uses a fixed
empty search path and permits only the active mapped learner or active owning tutor.
PL's tutor report calls `requireTutor()` independently. Existing tutor policies
were not weakened. Normal users cannot forge results or write mapping/admin state.
The POST also checks browser Origin against the actual Host/protocol; it does not
trust forwarded-host headers. A live Next internal-origin mismatch was fixed
narrowly and covered by a regression.

**7–9. Scoring audit and persistence.** The actual RS registry/scorers were audited:

| Activity | Existing semantics | Durable result |
| --- | --- | --- |
| Matching | Automatic pair matching | Earned/possible |
| Order Steps | Automatic ordering | Earned/possible |
| Arithmetic Input | Automatic numeric/text checking | Earned/possible |
| Multiple Choice | Automatic exact selected-set checking | Earned/possible |
| Fill Gap | Automatic bank/typed checking | Earned/possible |
| Category Sort | Automatic placements | Earned/possible |
| Sentence Builder | Automatic accepted construction | Earned/possible |
| Spot Mistake | Automatic identification/correction; explanation unscored | Core earned/possible plus explanation pending |
| Short Written Response | Manual review | Response, null score/maximum, pending |
| Explain Thinking | Manual review | Response, null score/maximum, pending |
| Comprehension | Hybrid MCQ automatic / written manual | Automatic aggregate plus per-question work/review flags |

There is no discrepancy with the expected families. Spot Mistake remains registry
`automatic` for its core interaction; explanation quality is never auto-marked.
Comprehension keeps each question's response type and review-required flag, while
its existing scorer returns an aggregate for the automatic portion. The UI labels
that portion explicitly; it does not present a whole-activity percentage or grade
written work. No model responses, hidden answers or private feedback are copied.

**10–12. Completion and legacy coexistence.** A durable submission is the learner's
completion evidence. Manual and hybrid pending review do not block completion.
A nonempty session's approved practice is complete iff every approved assignment
has a submission; an unfinished sibling keeps it incomplete. Empty sessions are
not declared complete. Completion is derived from durable rows rather than a
second mutable status flag. Legacy `activities`, `activity_results`, imported-MCQ
attempts, session flags and legacy plan percentages are not modified. The legacy
15-slot header therefore still shows its own unfinished state. The separate
"Assigned practice progress" count is authoritative for these approved packages.

**13–14. Tutor view.** The owning tutor sees session status, submitted counts,
automatic score, Spot Mistake identification/correction, submitted written text,
and pending review. Learners see saved results and can navigate onward. The minimum
manual-review workflow is visibility of the work and pending state; no review
resolution action, numeric rubric, AI marking or teacher comments were invented.

**15. Privacy/security evidence.** RS requests have only `packageId`, `integrity`
and `responses`. No PL identity, names, emails, plan/session/student IDs, profile
or notes are sent. Learner-entered text necessarily crosses for checking; this
contract cannot prevent a learner voluntarily typing personal data, so the live
proof uses fictional educational text only. The integration bearer remains on
servers; the iframe only gets the existing separate expiring delivery capability.
PL validates messages against the exact iframe window and RS origin, then
reauthenticates submission server-side. Safe DTO tests reject private fields;
actual saved response/result keys were audited for answers/provenance. Learner
chosen answers are stored as work, not copied authoritative answer sheets. Normal
tutor/learner proof pages contained no provider labels, source URLs, attribution,
licence or provenance. Cross-learner/tutor access, inactive mappings, wrong IDs,
service-only writes and immutable binding are covered by regression tests.
Final private-value and secret-pattern scan covered 126 checkpoint/bundle/log
files: zero known integration/service/password matches and zero secret-pattern
matches in checkpoint files. Temporary credential-copy and test-helper files were
removed. The running local test servers retain only process-injected credentials.

**16–18. Validation.** Focused PL tests cover safe results, malformed/unauthorized
requests, first-wins retries, transient checking failure, manual/hybrid display,
completion, browser Origin/Host, and database authorization/immutability. PGlite
runs the real migration history and persists representative checked results for
all 11 types. Actual response validation/private scoring is exercised by RS tests,
not claimed from the PL mock fixture. Full PL suite: **274 passed**. Typecheck,
lint and production build passed. Both repositories' diff/secret checks are part
of the final commit review. No hosted migration or production traffic.

**19–20. Commit/status.** Local checkpoint title:
`Persist learner practice results and progress`. Resolve its exact hash using
`git log -1 --format="%H %s" -- lib/practice-submissions.ts`; the final task report
records the hash and status. Stage only checkpoint files. No push authorized.

## Resource Studio (21–27)

**21–24. Changes and boundary.** Added the development-only, server-bearer-authenticated
`POST /api/integrations/practice-loop/package-submission`. It verifies the immutable
package and integrity, strictly validates the complete response, reuses canonical
private registry scorers, and returns a safe `submission-1` envelope. Existing
package loading/view/check logic is shared with ephemeral delivery; no parallel
scoring engine was created. Human-readable review items contain learner-visible
prompts and chosen/typed responses, never model guidance or correct-answer payloads.
There is no learner identifier in the input contract and no RS attempt storage.
Existing 11-type renderers capture responses through a shared context and expose
"Submit activity" to PL via the validated frame bridge. Existing ephemeral
checks remain explicitly unsaved. No source orchestration/provenance logic changed.

**25. Validation.** New package-submission tests exercise all 11 actual scorer
families, correct and incorrect responses, manual null scores, hybrid written
review, Spot Mistake pending explanations, malformed/missing/oversized/foreign
IDs, extra identity/score, integrity mismatch, bearer separation and no-store
responses. Full RS suite: **1,239 tests in 74 files passed**. Typecheck, lint and
production build passed. Existing learner projection/privacy tests remain green.

**26–27. Commit/status.** Local checkpoint title:
`Add trusted package submission checking`, commit
`8fe8d7d01709bf52ab5e2b9f3df82d1797e06178`.
Only the pre-existing unstaged `.env.example` change remains. It was not inspected,
modified, staged or reverted. No credential/environment/private source files are
part of either checkpoint. No push.

## Live learner and restart proof (28–34)

**28. Subject.** Existing synthetic learner Supabase account, admin-linked to
**Fictional Student — Local Lab**, existing five-session weekly plan. Existing
account credentials were used privately; no real/remote account was created.
Local canonical PL runs at 127.0.0.1:3100 with synthetic Supabase 56321; canonical
RS runs at 127.0.0.1:3101 with synthetic Supabase 57321. Credentials were injected
only in process environments after verifying the container names/ports. Neither
service-role key was copied into source, docs or a tracked environment file.

**29–32. Actual embedded learner submissions.**

| Session | Activity | Persisted result | Learner completion |
| --- | --- | --- | --- |
| 2: Build confidence | Arithmetic Input | 5/6, including a deliberately wrong response | Complete |
| 2: Build confidence | Spot Mistake | 4/4 identification/correction; two explanations pending | Complete |
| 3: Mixed retrieval | Arithmetic Input | 6/6 | Complete |
| 3: Mixed retrieval | Spot Mistake | 4/4 identification/correction; two explanations pending | Complete |
| 4: Independent practice | Short Written Response | Written explanation saved; null score; pending | Complete |

Session 2 and Session 3 each showed "Session complete — 2 of 2 assigned activities
submitted". Session 4 showed 1 of 1 complete with written review outstanding.
All submissions used the embedded RS renderer inside authenticated PL. Automation
used keyboard controls because direct iframe clicks were unavailable.

The extra manual fixture was deliberately controlled: an original synthetic RS
registry activity with an equivalent-fractions prompt was materialised through
canonical package functions and approved through the canonical service RPC into
Session 4. No final assignment row was manually inserted. This provisioning is
separate from the normal Session 3 full-loop demonstration. Its default checklist
still includes a reading-oriented item; this is fixture polish, not marking logic.
Live Comprehension was not added; robust automated hybrid coverage passed.

**33. Restart.** Both canonical apps were stopped, production builds completed,
and both restarted with verified local configuration. The tutor report retained
all five results and pending review states. The learner reopened saved practice
and completion pages after fresh login. Saved pages read PL records directly and
do not mint an RS capability or consult expired proposal/review caches.

**34. Database audit.** Before/after counts and row digests were recorded privately
as `durable-db-before.json` / `durable-db-after.json` in the task artifact directory.
No private content was printed. Expected additions comprise two normally approved
Session 3 packages plus one controlled manual fixture and five submissions:

| Table/evidence | Before | After |
| --- | ---: | ---: |
| PL durable submissions | 0 | 5 |
| PL package references | 4 | 7 |
| PL approval batches | 1 | 3 |
| PL approved session assignments | 2 | 5 |
| RS private packages / provenance rows | 4 / 4 | 7 / 7 |
| PL legacy activities / results | 15 / 0 | 15 / 0 |
| PL old imported assignments / attempts | 0 / 0 | 0 / 0 |
| PL weekly plans / sessions | 1 / 5 | 1 / 5 |
| RS public activities / versions | 2 / 10 | 2 / 10 |

Whole-row hashes matched for all unchanged tables and the original subsets of
packages, provenance, approval batches, references and assignments. Thus no
existing package content/provenance or public publication changed. Source files
were not edited; no unrelated learner data was modified. The new submission rows
contain learner work and safe results, including null manual scores; no copied
answer/scorer/provenance fields were found.

## Tutor return and full MVP demonstration (35–47)

**35–38. Tutor return.** Real sign-out/sign-in returned the tutor to `/dashboard`.
The existing weekly plan showed 5/5 approved activities submitted, three completed
assigned-practice sessions, Arithmetic 5/6 and 6/6, both Spot Mistake results 4/4,
all four explanation texts pending, and the manual response pending with no score.
The tutor saw no source/provider/provenance metadata. The same report persisted
after both apps restarted. Screenshot evidence was saved in the task artifacts.

**39–46. Primary flow, all exercised through the real UI:**

1. Tutor authenticated and opened the fictional learner's existing weekly plan.
2. Selected the stored equivalent-fractions need and requested 10 minutes of
   fluency plus misconception practice.
3. RS chose the activities and sourcing/generation path automatically. A ready
   proposal contained Arithmetic Input and Spot Mistake; no manual library search
   or browser content authoring was used.
4. Tutor previewed both real activities in PL.
5. Tutor selected Session 3 and approved the complete proposal. Ordered immutable
   packages/assignments appeared through the normal approval flow.
6. Tutor signed out; the mapped learner signed in through the shared login.
7. Learner opened Session 3, completed Arithmetic then Spot Mistake in order,
   submitted responses, saw saved results and genuine session completion.
8. Tutor signed in again and saw the durable scores, response text, completion
   and pending review in the weekly-plan report.

**47. Intervention distinction.** The Session 3 demonstration used no developer
database intervention. Initial app configuration is still a prerequisite: an old
restricted synthetic RS launcher had generation disabled and produced partial
proposals. Restarting the canonical RS app with verified local DB overrides and
its normal generation configuration allowed the complete proposal. No provider
or orchestration source code was changed. The extra manual fixture used controlled
canonical service provisioning, as explicitly allowed; it is not presented as a
browser-created proposal. Future fresh demos must approve a fresh proposal or
use unsubmitted assignments because first submissions are intentionally immutable.

## Remaining work and conclusion (48–49)

**Private-demo blockers:** No remaining core functional blocker for a supervised,
local, fictional-data demonstration using the verified setup. It needs the two
canonical development servers, the isolated databases, server-only integration/
service configuration, the existing synthetic accounts, and working RS generation
configuration if proposing new material. There is no hosted external-demo deployment
in scope; remote audience access must be arranged separately. A fresh end-to-end
run needs fresh approved assignments, not a hidden reset of completed work.

**Pilot/production hardening:** Explicitly enable and secure a production delivery
boundary (current integration/submit routes are development-only), operational
configuration/deployment, learner onboarding/account lifecycle, abuse/rate controls,
monitoring/backups, retention/deletion policy, capability revocation policy, and
licensing/required acknowledgements/media delivery beyond the text-only scope.
Existing admin-managed learner mapping is a minimal foundation. Typed responses
need an appropriate real-world data policy. No production-readiness claim.

**Later enhancements:** Review resolution action, deliberate retry/reset policy,
clearer combined weekly UI, retirement of legacy slot assumptions, visual/accessibility
polish and richer safe question-level feedback. None is required to prove durable
learner completion and tutor visibility.

**49. Yes:** the core Practice Loop + Resource Studio loop is demonstrable end-to-end
with fictional data: tutor need → automatic content proposal → real preview →
approval → authenticated learner response → private trusted checking → durable
completion → tutor evidence, including manual-review semantics and restart persistence.
