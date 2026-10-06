# Resource Studio proposals and durable session approval

## Tutor approval checkpoint — 2026-10-06

One complete successful proposal is approved into one tutor-selected existing
session. The five sessions, three legacy activity slots per session, manual
selections and existing progress calculations remain unchanged. Partial proposals
require rebuilding. No learner interaction, completion or scoring is implemented.

`approvePracticeProposal` resolves the tutor/plan-bound server proposal, including
its retained objective key. The browser supplies only plan, session, proposal and
fictional confirmation; the proposal/session identity is the approval key. It
cannot supply content, package references, ordering or rights. Ownership and
session membership are checked before RS calls and again inside SQL at commit.

Each item uses a deterministic namespaced UUID derived from the RS proposal and
item identity for authenticated materialisation. Strict all-11 package metadata is
validated. Only after every item succeeds does one service-only RPC atomically
ensure immutable prepared references, insert the approval batch and insert ordered
session assignments. A failed transaction creates no visible half-approved set.
RS packages may safely remain unassigned; retry reuses their materialisation keys.
Unique session/proposal identities prevent duplicate clicks and concurrent retries.
The durable lookup precedes proposal-cache lookup, so retry after a successful
commit works even after proposal expiry/restart. An incomplete approval still
requires the PL proposal cache and valid RS materialisation state; if unavailable,
rebuild rather than inventing lost proposal content.

Migration: `20261006200000_resource_proposal_approval.sql`. New private tables:
`resource_approval_batches` and `resource_session_assignments`. Both have forced
RLS, no client table grants, immutable rows, foreign keys and constrained positions.
The server-only RPC independently checks active tutor, student/reflection ownership,
plan/session membership and the existing development integration feature flag.
`SUPABASE_SERVICE_ROLE_KEY` is needed only by the isolated server service client;
ordinary authentication continues using the session/RLS client. Never expose or
commit this credential. No hosted database migration is implied.

PL stores exact opaque package/activity/release/version/integrity references plus
educational purpose, dose and duration. It stores no activity body, answers,
provider, source URLs, rights or provenance. Normal tutor DTOs additionally omit
package integrity and internal references; cards show type, purpose, dose, minutes,
Assigned status and Preview. New assignments do not feed legacy reports or links.

RS adds `/api/integrations/practice-loop/package-preview`: server-authenticated
POST verifies the exact package/integrity and issues a ten-minute signed capability.
GET accepts that capability and reads the immutable package from durable storage.
The `/integrations/practice-loop/package-review` shell keeps the capability in a
fragment, removes it from history and uses the existing RS renderers and source-blind
tutor projection. Educational answers/feedback are appropriate within this tutor
preview; this is not a learner-safe content API. No provenance or author notes cross
it. Restart does not invalidate a capability while the integration key remains
unchanged, and PL can request a new one without any proposal review state.

Next: authenticated learner-safe delivery for all 11 types, then completion and
scoring. Do not reuse the answer-bearing tutor renderer contract for learners.
Learner identity/access, safe per-type presentation, private answer checking,
manual/hybrid review, media access and outstanding central acknowledgements remain
separate work. No source orchestration, publication or provenance design changed.

The following sections document the earlier foundation and review-only checkpoints.

## Durable package foundation — 2026-10-06

This checkpoint starts at PL `fa6b99af4fc24b387d75da5ff27fa75ca6aa3749` and RS
`66444288d7ee782063dd797bf93cba4bac4b1da9`. Both baselines were verified pushed.
RS now owns immutable private assignment packages covering all 11 canonical
activity types, exact content integrity and internal provenance/rights snapshots.
Converted/generated packages are private and do not create public library releases.
Existing reuse pins an exact trusted release with established durable provenance.

PL validates an opaque package reference: package/activity IDs, package content
version, nullable exact published release/version, activity type, SHA-256 integrity,
scoring mode, prepared/unassigned state, server-only content access and explicit
`learnerDelivery: not_implemented`. No RS schema or activity content is copied here.
RS's learner/tutor package views are reference-only; canonical answers and rich
source lineage remain in RS. These references do not authorize browser delivery.

Migration `20261006180000_resource_package_references.sql` adds one private table
for tutor-owned prepared references: PL plan/objective key, preparer, proposal/item
identity, package/activity/release/version, type, integrity and preparation time.
No provider, source URL, licence, attribution, question or answer payload is stored.
Its only insertion RPC is service-role-only and validates the active tutor and
plan/student/reflection ownership chain. Forced RLS and revoked client grants
prevent tutor/browser writes; immutable rows cannot be edited or deleted. There is
no reference in a weekly session or learner activity, and no approval button/action.

Normal tutor proposals and the PL-facing preview now omit source labels and
attribution. Internal RS diagnostics still retain them. Source permissions follow
the owner's 2026-10-06 clarification: Twinkl and Math Salamanders private delivery
authorised; Twinkl needs no normal activity attribution; Math Salamanders keeps
its 24-month term and approved platform credit internally without invented dates.
Oak's text-summary guards/credit obligations remain. No legal page is built.

### Compatibility audit of the existing MCQ path

The original development MCQ assignment stores `source_activity_id` and exact
`source_version` plus a private `resource-studio-mcq-v1` content snapshot in
`practice_loop_private.resource_studio_assignments`, keyed to a PL activity slot.
`activities.resource_studio_assigned` is the public indicator; `content_json`
does not receive the private snapshot. `get_resource_studio_exercise` projects
only safe display questions/options. SQL checks/submission score against the saved
snapshot, never the latest RS resource or a browser-supplied key/score. Attempts
reference the immutable assignment's activity ID, retain selected IDs and saved
score/feedback, and derive their exact source version through that relationship.
The fixed source ID, question/options shape and correct-option sets are MCQ-specific.
This path, its completion/reporting guards, manual selections and five-session /
legacy three-slot model are unchanged. New prepared references do not enter it.

Next: implement explicit tutor approval and weekly placement using server-verified
package references, then separate all-type learner presentation/scoring. Preserve
the reference/provenance split and satisfy pending platform acknowledgement
obligations before real delivery. A legacy published resource without inherited
durable provenance must be reviewed; published status alone is not provenance.

Implemented 2026-10-06 from Practice Loop `8ac2ebdf4bc7910516f2398616a1a853ba6c431c`
and Resource Studio `2c624098e110713e3ad7d04de14092f655a50e2c`.

## Workflow and scope

In a development weekly plan, select a stored objective from the matching
reflection's `extracted_objectives`: focus, developing, secure or retrieval.
Subject/year initially use the student's existing structured fields and remain
reviewable; the tutor supplies duration (3–30 minutes) and one or more intents.
Confirm fictional data, no personal information in the educational text, and
automatic source use/generation. Choose **Build practice proposal**.

PL rechecks approved-tutor authentication and ownership of the complete
plan/student/reflection chain before reading the selected objective or contacting
RS. It checks ownership again before returning the result. Raw reflections,
notes, profiles, learner/tutor IDs and names never enter the request builder.
The tutor must review text for identifying details: a field allowlist does not
semantically anonymize a poorly worded stored objective. The existing objective
editor remains the correction path. Misconceptions are not sent in this first
minimal contract because PL's reflection-level list is not linked to a selected
objective and RS's practice-need contract does not accept it.

One need produces one complete RS ResourcePlan, not an automatic five-session
week. RS chooses sources, activity types and dose using its existing
`orchestratePracticeRequest`. No source ranking/planning/content generation is
implemented in PL. Manual search/selection, all five sessions, three legacy slots
per session and progress/reporting remain available and unchanged.

## Version 1 wire contract

`POST /api/integrations/practice-loop/practice-proposals` on RS uses the existing
server-only `PRACTICE_LOOP_INTEGRATION_KEY` bearer authentication and
`RESOURCE_STUDIO_BASE_URL` origin configuration. Both apps must run in development.
The RS endpoint rejects unknown fields, invalid/duplicate intents, out-of-range
duration and bodies over 4 KiB (including streamed bodies). PL validates before
sending and disables redirects. No integration key enters browser props or URLs.

```json
{
  "subject": "Maths",
  "year": "5",
  "objective": "Complete and recognise equivalent fractions and avoid common errors when identifying equivalent fractions.",
  "durationMinutes": 10,
  "intents": ["fluency", "misconception_check"]
}
```

Supported intents: retrieval, fluency, classification, sequencing, vocabulary,
misconception_check, application, reasoning, reading_comprehension. Text fields
are bounded at 240 characters. There is no source or activity-type input.

RS returns `schemaVersion`, opaque `id`, `reviewOnly: true`, `objective`,
`requestedMinutes`, `plannedMinutes` (including transitions), `headroomMinutes`,
`planningMode`, `status`, `expiresAt`, and ordered `activities`.
Each activity has `id`, `activityType`, `purpose`, display `dose`,
`estimatedMinutes` and `status`.
Ready items carry an opaque `previewToken`; failed items carry a generic
`failureReason`. Source labels and fulfilment provenance are not in this contract.
No private provenance, source paths, answer sheets, rights
records, model prompts or rationale are included.

PL reconstructs validated metadata, checks request/response agreement, unique
activity IDs, duration arithmetic and status consistency, and replaces RS tokens
with `previewAvailable` in initial browser state. Legacy source fields are dropped.
The identical contract fixture in both repos is tested with every one of the 11
activity types; this does not expand the MCQ-only learner assignment contract.

## Actual previews and lifetime

RS retains validated proposed activity content and required attribution in a
bounded process-local cache (200 activities, 30-minute expiry). A 256-bit random
capability is stored hashed and authorizes just one activity's review. Reuse
resolves the exact trusted published version and checks current publication
before creating its review snapshot. Generated and converted proposals get no
save/publication capability.

PL retains the response only in a bounded server cache (100 proposals), bound to
tutor and plan. On **Preview**, a fresh authentication/ownership check returns an
RS iframe URL with the per-activity capability in its fragment. The fragment is
not sent in HTTP URLs/referrers and RS removes it from browser history. The RS
review shell exchanges it through the authorization header at
`GET /api/integrations/practice-loop/proposal-preview`. No valid capability means
401. The public shell itself contains no activity data. Responses are no-store.
The iframe uses RS's existing `ActivityRendererRouter` across all 11 types;
internal attribution is excluded. Reviewers can inspect educational answers and
feedback; this is an authoring preview, not a learner-safe delivery endpoint.

Capabilities are bearer credentials: do not share the review iframe URL. They
cannot assign, save or publish. Expiry, either app restart, cache eviction or
closing/reloading the PL page requires rebuilding. This synchronous, single
process development design is intentionally not durable or multi-instance.

PL times out remote requests after four minutes and shows a safe error. Existing
RS provider timeouts/retries remain authoritative; a PL timeout does not cancel
already-running upstream provider work. PL allows one active request per tutor/
plan; RS allows two concurrent integration requests. There is no outer automatic
retry. **Rebuild practice** is an explicit full-plan retry. Failed items remain
visible alongside successful siblings; an unsuccessful rebuild leaves the prior
review available. Withdrawing confirmation discards UI state and late results.

Development logs contain only request field names, subject/year and duration,
never objective text, identities, tokens or provider diagnostics.

## Validation and next checkpoint

Live cross-app proof on 2026-10-06 used the canonical apps on loopback ports
3100/3101 and the existing isolated synthetic databases. The verified learner
was **Fictional Student — Local Lab**, plan
`08dd2f29-f49c-450d-ad92-d4089cb0e9fe`. This reflection initially had no extracted
objectives; one synthetic focus objective (the example above) and its structured
misconception were inserted as test setup. No existing objective was overwritten.
The misconception stayed in PL. The UI supplied stored `Mathematics`, `Year 5`,
10 minutes and fluency/misconception_check; the tutor did not retype the objective.
The outbound field-name diagnostic showed exactly the five contract fields,
with no learner name/ID, tutor ID or raw reflection. RS normalized subject/year.

The tutor clicked Build in PL, and the first request returned HTTP 200 after
about 102 seconds including initial compilation. RS planning mode was
`deterministic-fallback`. Both activities were ready:

| Activity | Purpose/dose | Minutes | Source | Fulfilment |
| --- | --- | --- | --- | --- |
| Arithmetic Input | fluency, 6 questions | 4 | Twinkl | source-converted |
| Spot Mistake | misconception check, 2 examples | 4 | Oak | evidence-generated |

The complete plan included one transition minute and one minute headroom.
No rebuild/retry was required; partial failure was covered by automated tests.
Both actual activities rendered in the PL iframe. Arithmetic showed question
1 of 6 and accepted typed input; Spot Mistake showed both examples and required
Oak attribution. Browser automation could not activate the cross-origin iframe
submit button (stale target/focus errors), so live interactive feedback/scoring
is **not** claimed. The existing renderer test coverage remains applicable.
The preview shell hides authoring navigation and the misleading persistence
indicator. No activity was saved or published.

Before/after row counts and whole-row content hashes matched for all seven
checked tables: one weekly plan, five sessions, 15 legacy activities, two manual
selections, zero assignment rows, zero attempt rows and zero completion rows.
The synthetic objective fixture is the only added educational database state.
Manual library search returned the existing Equivalent Fractions Check and both
saved session selections loaded alongside the proposal. Unauthenticated live
requests to both new API endpoints returned 401 with no-store headers.

Final checks: PL full suite 228 tests (including 10 proposal tests); RS 45 focused
tests across the new boundary and existing orchestration/discovery/review suites.
Both typechecks, lints, staged whitespace, scope and secret checks passed. The
shared fixture files have identical SHA-256 hashes. RS full suite was not rerun
because no shared orchestration/fulfilment/renderer implementation changed.

Focused tests cover request privacy, auth/ownership, malformed/excessive inputs,
safe response projection, all-type metadata, ordered partial results, provider
errors, exact-version reuse, expiring previews, UI loading and withdrawn consent.
The proposal-only checkpoint originally still needed durable provenance and
assignment packages; those are now provided by the foundation above. Next comes
tutor approval semantics, followed by
learner access/completion/scoring/progress. Nothing here auto-approves, publishes,
assigns, scores or changes the weekly-session model.
