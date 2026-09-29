# Resource Studio generation handoff

Decision recorded during the Practice Loop worktree review on 2026-09-29.
This is a design handoff, not an implemented planner or generation API.

## Ownership and intended workflow

Practice Loop owns reflections, approved learning needs/objectives, automatic
weekly planning, tutor review/approval, immutable learner assignments, attempts,
scoring and progress. Resource Studio owns reusable activities, schemas/templates,
authoring/generation/editing, publication/versioning, its library and provenance.

The intended normal flow is: reflection and approved objectives -> Practice Loop
automatically proposes a week and searches Resource Studio -> requests creation
or adaptation there when needed -> tutor previews, edits/replaces/moves/removes
and approves -> learners receive immutable assignments. Manual library search is
a fallback and replacement/editor tool, not the primary way to construct a week.
The current search, preview and session-selection checkpoints are foundations;
they do not yet implement that automatic workflow or its approval transition.

Resource Studio's future sourcing may use its existing library, Oak National
Academy, authorised Twinkl retrieval and original generation, with provenance
and publication handled there. No such integration was built in this cleanup.

## Concepts worth reusing

- Planner requests should carry approved objectives, retrieval needs,
  misconceptions, year group, subject, session role and time budget. Use minimal
  educational context rather than copying whole student/reflection records.
  Respect readiness and avoid introducing unrelated new material. These are
  planning constraints; activity bodies belong to Resource Studio.
- Resource Studio should validate schema version, template/output compatibility,
  supported delivery and payload shape before publication. Reading passages,
  word banks, choices and unsorted items are useful schema concepts, not a reason
  to expand a competing Practice Loop content format. Any normalization needs
  explicit rules; arbitrary objects must not silently become strings.
- Correlate responses only with requested slots; reject unknown and duplicate
  identifiers. Account for missing/invalid items and retries explicitly. Report
  actual successful changes, including concurrent changes, rather than counting
  model output. Keep assignment snapshots immutable and separate from proposals.
- Build learner payloads from an explicit allowlist. Keep scoring keys in the
  private validated snapshot for server scoring. Test nested answer leakage and
  sorting solutions, not just fields called `answer`. Existing Resource Studio
  snapshot/scoring boundaries are the starting point.
- Test unauthenticated/unapproved access and foreign ownership before any remote
  call; malformed output, schema/template mismatches, duplicate/missing results,
  retry races, occupied slots, and learner-safe payloads need synthetic coverage.

## Findings from the discarded experiment

The unfinished action called OpenAI directly for complete activity bodies and
wrote `template_id` and `content_json` into Practice Loop activities. Its button,
renderers, action, generator and added local payload fields were removed or
restored to the committed baseline; the implementation is not retained here.

The experiment sent the student's name and free-text reflection/profile fields
and logged raw model output and rejected payloads outside production. Future
requests must minimize identifying information and logs must contain sanitized
reason codes, not prompts, learner details or raw responses. `store: false`
alone does not resolve these privacy concerns.

Its partial answer stripping was not a complete public-payload boundary; it also
discarded keys needed for scoring. Validation accepted partial results and did
not enforce uniqueness/completeness. Non-transactional updates did not verify
affected-row counts, so success reporting and the claim that placeholders were
unchanged on failure were unreliable. Preserve these as failure scenarios, not
as a pipeline to port unchanged.

The committed legacy template catalogue, nullable content storage and readers
remain for compatibility; they do not authorize new Practice Loop authoring.
Removing or migrating that committed legacy surface requires a separate review
of stored data and consumers. Objective extraction and session-title generation
remain Practice Loop planning functions. No database was inspected or migrated
as part of this worktree cleanup.
