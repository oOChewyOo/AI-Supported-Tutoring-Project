# Practice Loop: current AI development handoff

Updated 2026-09-30. Read [AGENTS.md](../AGENTS.md), [ROADMAP.md](ROADMAP.md)
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
