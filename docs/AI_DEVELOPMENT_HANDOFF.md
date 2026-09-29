# Practice Loop: current AI development handoff

Recorded 2026-09-29. Read [AGENTS.md](../AGENTS.md), [ROADMAP.md](ROADMAP.md)
and [local layout](LOCAL_DEVELOPMENT_LAYOUT.md) before work.

## Verified Git baseline

- Canonical root: `C:\Users\chris\Documents\Codex\2026-06-09\i-want-to-build-an-mvp`.
- Branch: `codex/tutor-auth-ownership`.
- HEAD before this documentation checkpoint: `7b9e0505adc21b7723d097d5e8788df88a31ea8f`.
- Initial `git status --short`: empty; nothing staged.
- Remote `origin`: `https://github.com/oOChewyOo/AI-Supported-Tutoring-Project.git`.

This documentation commit advances HEAD without changing the application.
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

## Implemented now

- Approved-tutor authentication, ownership checks and RLS isolation.
- Reflections, editable extracted objectives and five-session placeholder weekly
  plans; the ordinary legacy structure still has three activity slots per session.
- Development-only Resource Studio flows with fictional-student confirmation.
- Immutable Resource Studio assignment snapshots, server-side attempts/scoring
  and question-level/progress reporting through the existing development importer.
- Authenticated metadata search, exact-version MCQ preview, and persisted
  session-selection planning metadata with add/remove and duplicate handling.

The existing importer remains a fixed-resource development pathway.
Search/preview/selection does not yet assign arbitrary selected resources.
The automatic programme planner and tutor approval-to-assignment transition are
not implemented. Objective extraction/session-title generation are planning
helpers, not a complete automatic resource planner.

## Verification already completed

Cleanup validation on 2026-09-29: 215 tests passed, zero failures/skips; typecheck,
lint, build and whitespace checks passed. Build emitted a search-stylesheet
alignment compatibility warning and webpack cache warnings.

The project owner reports successful real-browser regression covering login,
weekly-plan rendering, fractions and multiples search, exact-version preview,
preserved search/filter state, add selection, duplicate behaviour, removal and
persistence after reload. This is prior manual evidence, not a browser run in
this documentation task and not a complete learner-delivery/production audit.

The separate post-cleanup runtime setup exported baseline HEAD and checked only
login HTTP 200, authenticated fictional-plan HTTP 200, and authenticated Resource
Studio metadata HTTP 200 with two entries. It then stopped automated testing.
Runtime availability is transient; no services were checked in this docs task.

## Transitional UX and next work

There are TWO visible concepts: ordinary legacy activity rows (three per session)
and Resource Studio session selections. Selections are planning references;
they do NOT replace activity rows or create assignments, attempts or completion.
The next product work should make each session visibly represent the resources
the learner will actually do. Before changing/removing legacy slots, review
stored data, progress calculations, assignment consumers and tests.

Current owner feedback:
- Preview works but needs a subtle card/boundary showing where preview content ends.
- “Session planning references” duplicates the five-session structure and should
  not remain the dominant final UX.
- Selected resources should ultimately be planned activities inside each session.
- Manual library search is not the intended normal planning workflow.

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

This checkpoint changes documentation/process files only. Validation is scope,
links, secret-pattern review and `git diff --check`; application suites/builds,
browsers, Docker, Supabase, migrations and external services were not run.
