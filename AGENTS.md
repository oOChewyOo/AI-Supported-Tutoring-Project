# Practice Loop: agent instructions

## Responsibility and product rule

Practice Loop owns tutor lesson reflection, learning needs/approved objectives,
automatic weekly planning, tutor review/approval, learner assignment, attempts,
scoring, reporting and progress.

Resource Studio owns reusable educational activities, schemas/templates, content
creation/generation/editing, publication/versioning, searchable library and
content/source provenance. Practice Loop must not recreate a competing direct
activity-generation/content system.

The default intended workflow is reflection / approved objectives -> Practice
Loop automatically proposes a week -> automatically searches Resource Studio ->
requests creation/adaptation there if needed -> tutor reviews, previews, edits,
replaces, moves or removes -> tutor approves -> immutable learner assignments.
This is the target, not a claim that automatic planning is implemented.
The tutor should not normally search manually for every activity. Manual library
search is for replacement, correction, browsing and fallback/manual override.

## Working agreement for every coding agent

These instructions apply to OpenAI Codex, Google Antigravity and other agents.
Git and committed repository documentation are the shared source of truth.

Before any task:
1. Read this file, [the current handoff](docs/AI_DEVELOPMENT_HANDOFF.md) and
   [the roadmap](docs/ROADMAP.md).
2. Run `git branch --show-current`, `git rev-parse HEAD` and `git status --short`.
3. Compare with the handoff's dated baseline and inspect any later commits.
   A documentation checkpoint advances HEAD without changing the product baseline.
4. Stop before modifying unexpected dirty work. Preserve explicitly documented
   unrelated changes; never absorb them into your checkpoint.

After a checkpoint: run appropriate checks, review the diff, selectively stage,
commit the coherent work, and update the handoff if project state materially
changed. Report the exact commit, checks and remaining dirty state.
Do not use `git add .` or `git add -A` when unrelated work exists. Prefer small,
testable checkpoints and selective commits. Do not push unless explicitly asked.
Do not casually rewrite historical commits or migrations.

Use focused tests plus typecheck/lint as appropriate. Documentation-only work
normally needs diff, link, scope and secret checks rather than application tests.
Do not start services, apply migrations or call AI providers merely to edit docs.
Never use real pupil data or expose secrets. Never embed Oak API keys, Twinkl
credentials, Resource Studio bearer tokens, Supabase service keys or passwords
in source, documentation, URLs, client bundles or logs.

Cross-repository changes require explicit task scope. Only the two canonical
repositories are product source; see [local layout](docs/LOCAL_DEVELOPMENT_LAYOUT.md).
Never edit product code in AppData/temp runtime or lab copies.
For simultaneous agents, use separate branches AND separate registered Git
worktrees derived from the canonical repository, with explicit task scope;
never share an editable working directory. These are traceable source checkouts,
not synthetic runtime exports. For sequential agents, finish and commit one
agent's checkpoint before handing over wherever possible.
