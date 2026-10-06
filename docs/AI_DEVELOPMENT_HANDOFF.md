# Practice Loop: current AI development handoff
## Latest checkpoint — tutor approval into a selected session, 2026-10-06

Started clean on `codex/tutor-auth-ownership` at
`b4efb0e46071ddb6d41376bcaf50fb6b846719a9`, matching the requested baseline.
The earlier dated checkpoint is the direct parent; no intervening product work.

Implemented complete-proposal approval into one existing tutor-selected session.
The server resolves retained tutor/plan/objective context, materialises each RS
activity in order with deterministic idempotency, strictly validates all-11 package
references, then atomically writes prepared references, an approval batch and
ordered immutable session assignments. Partial/failed/expired proposals cannot
create an approved set. Existing committed approvals are returned before checking
the expiring proposal cache. Concurrent retries serialize in SQL and cannot
create duplicate session/proposal batches. A rebuilt proposal has a new identity.

Migration `20261006200000_resource_proposal_approval.sql` adds private
`resource_approval_batches` and `resource_session_assignments`, with ownership
checks, forced RLS, service-only RPCs, foreign keys, uniqueness and positive order.
Applied only to the existing isolated synthetic database. No hosted change.
PL stores opaque durable references and educational display metadata, never
content, answers, providers, rights or provenance. Normal tutor DTOs omit internal
integrity/reference fields; cards show type/purpose/dose/duration/Assigned/Preview.
No legacy slots, manual selections, attempts, completion or progress change.

The selected session's cards persist independently of proposal review state.
Fresh tutor authentication and ownership checks mint durable RS preview capabilities;
RS reads immutable package storage and uses its source-blind existing tutor renderer.
The server needs `SUPABASE_SERVICE_ROLE_KEY` for service-only approval persistence.
It is separate from the ordinary RLS/session client and never a browser variable.
See [full flow and retry limits](RESOURCE_STUDIO_ORCHESTRATION_INTEGRATION.md).

Validation: final full PL suite **250 passed**, zero failures/skips. Focused
approval/client, disposable PostgreSQL transaction/RLS, proposal UI/privacy,
search/report regression tests passed; typecheck and lint passed. One full run
encountered a transient Windows file-read error; the focused rerun and subsequent
full run passed. Diff/link/scope checks completed before selective local commit.
Commit title: `Approve Resource Studio proposals into weekly sessions`. Resolve
with `git log -1 --format="%H %s" -- lib/resource-studio/approval-actions.ts`.
No push.

### Live proof status: blocked on local server credential authorization

Canonical apps are running on loopback 3100/3101 against the existing isolated
synthetic databases. The real browser opened **Fictional Student — Local Lab**,
plan `08dd2f29-f49c-450d-ad92-d4089cb0e9fe`, and displayed the new proposal controls.
The PL runtime lacks a service-role credential, so the approved-practice read
correctly fails closed. Automatic approval review rejected inspecting the local
synthetic container to locate that credential; explicit user approval was requested.
No workaround was attempted. No live Build/Approve was submitted, target session
chosen, package materialised or new session assignment created in this checkpoint.
The all-11 approval, persistence, durable retry and preview-expiry behaviors are
covered offline; **real cross-app approval/restart proof remains pending**.

Before/after counts and whole-row aggregate digests are identical (after applying
only the additive schema migration):

| Synthetic table | Before → after | Unchanged content digest (MD5) |
| --- | --- | --- |
| PL weekly plans | 1 → 1 | `7e0a7d90374971e0ac05925b51c8a9dd` |
| PL weekly sessions | 5 → 5 | `b33d4fd8cfb8be69f070b7dc26efe6e2` |
| PL legacy activities | 15 → 15 | `d2238f0a3829b7dddfb47bda60dc95e4` |
| PL manual selections | 2 → 2 | `eb5c69c129c394bbe40bda44e379f934` |
| PL prepared references | 2 → 2 | `9f6d0d1427efaad74821c44040310f3e` |
| PL approval batches | 0 → 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| PL session package assignments | 0 → 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| PL legacy assignments / attempts / results (each) | 0 → 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| RS public activities | 2 → 2 | `fbe5e80b210d44a44cf860c1e3e0687a` |
| RS activity versions | 10 → 10 | `401a7cf1743433a6298d9e2c4cf9ff23` |
| RS private packages | 2 → 2 | `3c338f188cf805b299b0a3ba48bcaf14` |
| RS private provenance | 2 → 2 | `3c18c9d04a20bc283fafcbe89ae0f30f` |

Resource Studio's narrow preview endpoint/shell checkpoint is
`42604a02cc8ba6367d4894ddd57233480738d8b0` on `main`, starting at
`95d64b68dec6d1cc00ec2558c8c1933a4b5823fb`. Its 40 focused tests, typecheck,
lint and scoped whitespace checks pass; full RS suite not rerun because shared
package/provenance code is untouched. Known unrelated `.env.example` remains dirty.
No push. No source orchestration, source adapter, rights or publication changes.

Next: finish the requested live UI approval, verify exact ordered package/assignment
IDs, restart proposal processes and prove durable previews, then repeat these
aggregate comparisons. After that, the assignment/provenance boundary supports a
separate authenticated learner-safe all-11 delivery milestone. Outstanding work:
learner identity/access, safe per-type presentation (the tutor renderer contains
educational answers), answer checking/manual/hybrid review, media access and
central acknowledgements before real delivery. No learner delivery is claimed here.


## Latest checkpoint — durable RS package references, 2026-10-06

Started on `codex/tutor-auth-ownership` at
`fa6b99af4fc24b387d75da5ff27fa75ca6aa3749`, clean; remote baseline verified.
The new [integration foundation](RESOURCE_STUDIO_ORCHESTRATION_INTEGRATION.md)
adds a strict all-11 opaque package-reference validator and a service-only,
tutor-owned prepared-reference table. It stores no source provenance or content.
Normal proposal cards/DTOs omit provider labels. RS owns immutable content and
private provenance. Owner-confirmed source permissions are recorded internally;
exact unavailable licence dates are not fabricated. No approval/learner delivery
or progress behavior is added. Existing MCQ snapshots/scoring/attempts remain.

Migration: `20261006180000_resource_package_references.sql`, applied only to the
existing synthetic local database. Two live prepared references were staged for
the fictional plan, without attaching them to activities/sessions. Final validation
and cross-app proof are recorded below in this checkpoint's verification note.

### Verification note — durable reference checkpoint

Full Practice Loop suite: **231 tests passed**. Typecheck, lint and diff checks
passed, including ownership/RLS, strict all-11 references, safe proposal DTOs and
legacy MCQ assignment/scoring regression coverage. Documentation links and scoped
secret-pattern checks passed. No production database was changed.

Live synthetic proof used the existing fictional equivalent-fractions plan.
A normal PL proposal and a controlled server integration request with the same
non-identifying learning need produced arithmetic-input and spot-mistake practice.
The controlled request materialised RS packages
`0bfc7363-b4a3-41ed-866a-7a678e83d0fd` and
`c8b36acc-60d9-48c4-bf06-588e6f325959`; PL stores two prepared references only.
Both survived an RS restart with identical content integrity and idempotent retry
results after their review capabilities became unavailable. Server inspection
confirmed private lineage/rights and safe tutor/learner reference projections.

Before/after row counts and content digests matched for weekly plans, sessions,
legacy activities/results, RS selections, assignments and attempts. No learner
assignment, attempt, completion or progress changed. RS publication counts also
remained unchanged. Approval/placement and authenticated learner presentation and
checking are future work; central acknowledgement obligations remain internal.

Resolve this local checkpoint with `git log -1 --format="%H %s" -- lib/resource-studio/package-reference.ts`.
Commit subject: `Add durable Resource Studio assignment references`. No push.
Updated 2026-10-06. Read [AGENTS.md](../AGENTS.md), [ROADMAP.md](ROADMAP.md)
and [local layout](LOCAL_DEVELOPMENT_LAYOUT.md) before work.

## Verified Git baseline

- Canonical root: `C:\Users\chris\Documents\Codex\2026-06-09\i-want-to-build-an-mvp`.
- Branch: `codex/tutor-auth-ownership`.
- HEAD before the inline-session UI checkpoint: `8ad1ae7f1134d2470d1dab4417222eda20f2998d`.
- Initial state: accepted, uncommitted Antigravity UI work, continued and reviewed
  by Codex; nothing staged. This checkpoint completes that work rather than
  treating it as an unrelated dirty tree.
- Remote `origin`: `https://github.com/oOChewyOo/AI-Supported-Tutoring-Project.git`.

The inline-session UI commit advances HEAD from this baseline.
Use `git log -1 --format="%H %s" -- docs/AI_DEVELOPMENT_HANDOFF.md` to resolve its
checkpoint; inspect subsequent history instead of assuming the baseline is HEAD.

| Verified commit | Recorded subject |
| --- | --- |
| `501795908b78a2d18b32ce9cd48af66d39d35ba3` | Add tutor-owned Resource Studio library search (Milestone 3B Task 2) |
| `341ed9b6439a52b698feef7c3ee6af42791375c5` | Add Resource Studio session selections (Milestone 3B) |
| `607b069c542367ed906ab124e9f762ef77094bf3` | Connect Resource Studio previews to weekly session selections |
| `737d7ba95de5ec82f711b13530466acc8264a727` | Document Resource Studio generation ownership and salvage lessons |
| `4e37948f90246a96a5b239ab7cf633cd3087888c` | Remove stale references to the discarded activity generator |
| `7b9e0505adc21b7723d097d5e8788df88a31ea8f` | Ignore local Supabase CLI state and environment files |
| `8ad1ae7f1134d2470d1dab4417222eda20f2998d` | Add multi-agent development handoff documentation |

## Implemented now

### Automatic practice proposal checkpoint (2026-10-06)

Started clean on `codex/tutor-auth-ownership` at
`8ac2ebdf4bc7910516f2398616a1a853ba6c431c`. Local commit title:
`Add automatic Resource Studio practice proposals`; resolve its exact hash with
`git log -1 --format="%H %s" -- lib/resource-studio/proposal-actions.ts`. No push.

The development weekly-plan page now builds one complete RS proposal from one
stored reflection objective, tutor-reviewed subject/year, duration and intents.
Only those five educational fields go server-to-server using the existing bearer
integration. Tutors review ordered all-type metadata and actual RS-rendered
previews through expiring per-activity capabilities. No learner/tutor identity,
raw reflection or profile is transmitted. Tutor ownership is checked before
requesting and previewing; personal-data review of the educational text remains
explicit. Partial success is retained and full rebuild is manual.

This is review only: no approval, publication, assignment, completion, scoring,
weekly sequencing or progress changes. Manual library search/selections and all
15 legacy activity slots remain. Process-local review state expires after
30 minutes, cache eviction or restart; PL reload loses its displayed proposal.
See [integration contract and live proof](RESOURCE_STUDIO_ORCHESTRATION_INTEGRATION.md).

Live proof used the existing fictional local plan, adding its missing synthetic
objective as test setup. The PL Build button returned a ready two-activity plan:
Twinkl-converted Arithmetic Input (6 questions, 4 minutes), Oak-generated Spot
Mistake (2 examples, 4 minutes), one transition minute and one minute headroom.
Planning used deterministic fallback, with no rebuild. Both actual previews
rendered, including Oak attribution. Iframe button automation was unavailable;
live preview scoring is not claimed. Seven database table counts/content hashes
were unchanged, including zero assignments/attempts/completions and two selections.

Automated validation: final full PL suite passed 228 tests, including the expanded
10-test proposal suite and UI loading/withdrawal coverage. Typecheck, lint and
whitespace checks passed. RS's thin API/review boundary was
tested separately (45 focused tests including orchestration/discovery regression)
with typecheck and lint. No migration, deployment or runtime-copy edit was made.

The prior checkpoint descriptions below remain historical context. Automatic
five-session planning and approval-to-assignment are still not implemented.

- Approved-tutor authentication, ownership checks and RLS isolation.
- Reflections, editable extracted objectives and five-session placeholder weekly
  plans; the ordinary legacy structure still has three activity slots per session.
- Development-only Resource Studio flows with fictional-student confirmation.
- Immutable Resource Studio assignment snapshots, server-side attempts/scoring
  and question-level/progress reporting through the existing development importer.
- Authenticated metadata search, exact-version MCQ preview, and persisted
  session-selection planning metadata with add/remove and duplicate handling.
- Selected Resource Studio resources now appear inside their matching main
  weekly-session cards, alongside the unchanged legacy slots. The separate
  five-session planning-reference display is removed; preview has a subtle border.

The existing importer remains a fixed-resource development pathway.
Search/preview/selection does not yet assign arbitrary selected resources.
The automatic programme planner and tutor approval-to-assignment transition are
not implemented. Objective extraction/session-title generation are planning
helpers, not a complete automatic resource planner.

## Verification already completed

Inline-session validation on 2026-09-30: full `npm test` passed 218 tests with
zero failures/skips. After the final async-cleanup adjustment, all 60 focused
planner/search/preview tests passed again; typecheck and lint passed without
warnings. Whitespace checks passed. Selection-action and disposable PGlite
database coverage are included in the full suite. No browser run, build,
external AI call, real pupil data or hosted migration was used for this checkpoint.

Cleanup validation on 2026-09-29: 215 tests passed, zero failures/skips; typecheck,
lint, build and whitespace checks passed. Build emitted a search-stylesheet
alignment compatibility warning and webpack cache warnings.

The project owner reports successful real-browser regression covering login,
weekly-plan rendering, fractions and multiples search, exact-version preview,
preserved search/filter state, add selection, duplicate behaviour, removal and
persistence after reload. This is prior manual evidence, not a browser run in
the inline-session checkpoint and not a complete learner-delivery/production audit.

The separate post-cleanup runtime setup exported baseline HEAD and checked only
login HTTP 200, authenticated fictional-plan HTTP 200, and authenticated Resource
Studio metadata HTTP 200 with two entries. It then stopped automated testing.
Runtime availability is transient; no services were checked in this UI task.

## Transitional UX and next work

There are still TWO data concepts within each session card: ordinary legacy
activity rows (three per session) and Resource Studio selections. Selections are planning references;
they do NOT replace activity rows or create assignments, attempts or completion.
The next product work should make each session visibly represent the resources
the learner will actually do. Before changing/removing legacy slots, review
stored data, progress calculations, assignment consumers and tests.

The inline-session checkpoint addresses the duplicate session display and preview
boundary feedback. The cards explicitly label selections as planning only, not
assigned, with progress unchanged. Manual search remains a fallback/replacement
tool; automatic planning and approval-to-assignment remain future work.

Legacy session cards and the report remain server-rendered. A small client
provider receives only plan/session identifiers and titles and shares one set of
selection records between cards and preview controls. Reads wait for the existing
fictional-student checkbox. Add/remove responses update the affected session
without refetching all sessions; duplicate/version-conflict controls update too.
Failed mutations retain saved rows, list errors can be retried, and late reads
after confirmation is withdrawn are ignored. Reload requires fictional
confirmation again before persisted selections load. Backend actions, migrations,
assignment behaviour and progress calculations are unchanged.

The session-selection migration has been exercised in the isolated synthetic
local database, not deployed to a real hosted/production database. No migration
was applied during this checkpoint. Manual browser verification of the new
inline layout remains to be performed; the prior browser results above describe
the previous layout.

The unfinished direct OpenAI activity-body generator was deliberately removed.
Useful lessons are in [resource-studio-generation-handoff.md](resource-studio-generation-handoff.md).
Resource Studio owns activity generation. Committed legacy template/storage
compatibility remains and requires a separate consumer/data review before removal.

## Existing detailed guides

- [Tutor authentication/security and manual rollout](tutor-auth-security.md).
- [Library search and inline exact-version preview](resource-studio-library-search.md).
- [Development preview](resource-studio-preview.md).
- [Session selections](resource-studio-session-selections.md).
- [Immutable assignments](resource-studio-assignment.md).
- [Attempts/server scoring](resource-studio-attempts.md).
- [Progress reports](resource-studio-progress-report.md).

Historical guide verification notes describe their own checkpoints; use this
handoff for current cross-checkpoint state. Do not infer deployment from a
committed migration or from a successful synthetic test.

## Limits and next-agent checks

Use no real student data. Pupil access/security, hosted production configuration,
production privacy/security and broader deployment are incomplete. Synthetic
tutor access is not a pupil account system. No hosted drift or production
readiness was established here.

For application work run focused suites with
`node --test tests/<suite>.test.cjs`. Existing project checks are `npm test`,
`npm run typecheck`, `npm run lint`, `npm run build`; typecheck and build run
sequentially because both generate route types. Do not call external AI or
run live database tests without explicit scope.

For subsequent UI changes, use the session-planner/selection, search and preview
suites plus appropriate offline regressions, typecheck, lint and whitespace
checks. No automatic planner or Resource Studio content authoring was added.
