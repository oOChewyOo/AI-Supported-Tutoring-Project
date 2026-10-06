# Authenticated learner delivery checkpoint — 2026-10-06

## Baselines and scope

PL began clean on `codex/tutor-auth-ownership` at
`bad232fe4c60039f4506a836f84d62722fe6b0ea`. RS began on `main` at
`2bfc413bb6ce8fcd33f041b3914bfb062c8d5e70`, with only the previously documented
unrelated `.env.example` modification. Both canonical repositories required changes.
This checkpoint is local development delivery, not production onboarding or deployment.
Neither checkpoint is to be pushed before review.
RS local checkpoint: `ab12a7ea5617cc8c0a7ffd4911c1a6fd51416f92`
(`Add learner-safe assignment delivery`); final RS status contains only the
preserved unrelated `.env.example` modification. Resolve this PL checkpoint with
`git log -1 --format="%H %s" -- lib/learner-practice.ts`.

## Minimal learner authentication

Previously PL had authenticated tutors but no authenticated learner identity.
`20261006220000_learner_accounts.sql` adds `public.learner_accounts`:

| Field | Rule |
| --- | --- |
| `auth_user_id` | UUID primary key, references existing Supabase `auth.users`, cascade delete |
| `student_id` | Required unique UUID, references existing `students`, cascade delete |
| `active` | Required boolean, defaults true |
| `created_at` | Required timestamp, defaults now |

The mapping is administrator/service managed. Forced RLS permits an ordinary
authenticated, nonanonymous user to SELECT only their own active mapping.
Authenticated and anonymous users have no INSERT/UPDATE/DELETE privileges or
policies. Service/admin operations provision links; there is no account-management
UI, self-registration, invitation flow, custom password system or parallel token login.
This intentionally supports one identity per student, including inactive mappings.

The existing shared Supabase login validates the user with `auth.getUser()`.
`accessDestination()` sends an active tutor to `/dashboard`, otherwise an active
learner to `/learn`; neither role means denied access. Tutor precedence is only
login routing, not a generic role system. `requireTutor()` remains tutor-only.
`requireLearner()` independently resolves `{authUserId, studentId}` server-side.
A browser-supplied student ID is never accepted as learner identity.

`20261006221000_learner_practice_reads.sql` adds two narrowly projected read-only
SECURITY DEFINER RPCs with fixed empty search paths. Each derives the active
mapping from `auth.uid()` and rejects anonymous users. No learner SELECT policies
were added to tutor-owned tables, and existing tutor ownership policies are unchanged.
`get_learner_practice()` exposes only the mapped student's plan/session/assignment
display data. `get_learner_delivery_reference()` verifies the complete mapped
student → plan/reflection → session → approval batch/assignment → exact durable
reference relationship before returning package ID and integrity. Changing any
plan/session/assignment ID cannot select another learner's work. These IDs are
references, not delivery credentials. Both migrations were applied only to the
isolated synthetic PL database, never a hosted database.

## Delivery and privacy boundary

PL calls RS server-to-server with **only `packageId` and `integrity`**, under its
existing development integration authentication. No auth user ID, student ID,
name, email, profile, notes, plan or session identity crosses into RS.
PL does not need a service-role credential for learner reads.

RS verifies the stored immutable package, integrity, prepared status and rights
on every read/check. It never falls back to a mutable draft, publication or proposal.
An explicit `learner-1` DTO allowlist removes answers, accepted alternatives,
teacher guidance/model responses, private scoring metadata and provenance. Only
safe presentation fields survive. Text containing recognized provider/source
labels or URLs fails closed. Nonempty media also fails closed; private media
delivery is outside this text-only checkpoint. Normal learner/tutor displays have
no source/provider labels or provenance.

RS mints a separate opaque 256-bit `ld1_` capability, restricted to one exact
package/integrity, for 20 minutes. Only hashes are kept in the bounded process
cache. It is not a Supabase login token or a tutor-preview capability. The token
travels in the iframe fragment, is removed from the visible URL by the shell,
and is sent as a bearer header for no-store GET/PATCH. The iframe uses no-referrer.
The public shell contains no activity without a valid capability. Minting and
delivery remain development-only. Capabilities do not contain learner identity;
they expire or disappear on process restart, and authenticated PL reauthorizes
the assignment to mint a fresh one. Revoking a mapping prevents new capabilities;
an already issued capability has its bounded remaining lifetime.

Opaque HMAC-derived content IDs and independently ordered matching/sequence/bank
arrays prevent original identifiers or parallel arrays exposing the solution.
The server-private scorer uses the original canonical snapshot. Responses are
mapped back internally and passed to the existing registered scorer. Only
aggregate correctness/manual mode is returned; no correct-answer payload or
canonical scorer input is serialized to the browser.

## All 11 RS types and existing renderer reuse

PL embeds RS; it has no activity renderer or answer checker. RS's learner router
uses the existing controls through a safe presentation adapter and learner-check
context. The adapter supplies inert empty compatibility fields, never authored
answers, and is neither canonical validation nor persisted content. Learner
submissions bypass existing tutor-preview answer reveal/local scoring UI.

| Activity type | Learner controls / optional ephemeral check |
| --- | --- |
| Arithmetic Input | Numeric/accepted-text entry; server aggregate check |
| Multiple Choice | Single/multiple selection; server aggregate check |
| Drag Drop Matching | Existing matching controls; server aggregate check |
| Order Steps | Existing ordering controls; server aggregate check |
| Category Sort | Existing sorting controls; server aggregate check |
| Sentence Builder | Existing tile/tray controls; server aggregate check |
| Fill Gap | Existing bank/typed controls; server aggregate check |
| Spot Mistake | Existing segment/correction controls; server aggregate check; explanation unscored |
| Short Written Response | Local response/self-review controls; manual mode, no auto grade |
| Explain Thinking | Local response/confidence controls; manual mode, no auto grade |
| Comprehension | Passage and mixed question controls; automatic portion only, written portion unmarked |

Responses live only in the current page. Checks are request-local computations,
not saved attempts. Written responses are not submitted for later tutor review.
The existing default sentence claiming that written answers are saved is replaced
in the safe projection only; the immutable snapshot is unchanged.

## PL learner navigation

`/learn` lists the mapped learner's existing weeks and sessions. Session pages
list only approved durable assignments, ordered by approval batch timestamp/ID
then stored position. Legacy PracticeActivity slots are not replaced or edited.
Activity pages reauthorize before minting, show Activity N of M, and provide back,
previous/next and end links. The end page states only that the learner reached
the end of assigned practice; it does not claim completion or update progress.
Learners cannot use tutor dashboard, authoring, proposal/approval or preview guards.

## Validation and live evidence

PL: full suite **266 passed**, typecheck, lint and production build passed.
Focused helper and real PostgreSQL/PGlite tests prove active tutor/learner routing,
unmapped/inactive denial, server-derived identity, student-ID override rejection,
cross-student isolation, unchanged tutor ownership, no tutor-helper access, and
mapping write denial. Assignment/RPC tests cover foreign plan/session/assignment
and reference substitution. Learner routes and outbound identity-free DTO are tested.

RS: full suite **1,224 passed in 73 files** with one worker and 15-second test
timeout. An earlier run hit one unrelated document-parser five-second timeout;
the controlled full rerun passed. Afterward, one stronger immutable-materialization
regression was added and the final focused delivery/header set passed **31 tests**.
Typecheck, lint and production build passed. Coverage includes all-11 projections
and renderer SSR, actual private scorers with correct/incorrect inputs, manual and
hybrid modes, capability purpose/expiry, malformed/integrity failures, privacy,
media refusal, and delivery remaining tied to a materialized snapshot after the
source draft is edited. No new RS migration.

Live proof used only loopback synthetic PL Supabase 56321/56322 and RS 57321/57322,
with canonical apps on 3100/3101. Existing local configuration was privately read
and injected into process environments; canonical hosted RS configuration was not
used. A synthetic ordinary Supabase Auth learner was linked by trusted local SQL
to **Fictional Student — Local Lab**. Credentials are not recorded here or in
tracked fixtures. Shared login redirected to `/learn` with no tutor navigation.

- Plan: `08dd2f29-f49c-450d-ad92-d4089cb0e9fe`.
- Session 2 — Build confidence: `2069bdc5-9cfe-49eb-a242-1d66f6dfc19c`.
- First: Arithmetic Input, package `59eff900-4e60-4360-86a3-e540dfc95516`.
- Second: Spot Mistake, package `c40d63fb-cbac-46d4-946d-5867522442f1`.

Both exact approved packages rendered in PL. Arithmetic displayed `1/2 = ?/8`:
entering 4 returned 1/6 aggregate correct; entering 5 returned 0/6. Spot Mistake
accepted the two selected errors/corrections and explanations and returned 4/4,
with explanations explicitly unscored. No result was saved. Browser automation
could fill but could not click inside the cross-origin iframe, so interaction
checks used the same PL-issued capability in a separate RS browser tab. Embedded
rendering and PL previous/next/end navigation were verified in PL itself.

Both canonical app processes were restarted. Old Arithmetic and Spot capabilities
then returned 401; fresh PL-authorized capabilities reopened both same packages
in the same order. A fresh Arithmetic check returned 1/6 again. Proposal/review
state was not required. A genuine Next development module-reload cache bug found
in the first live run was fixed narrowly by retaining the capability map on the
process global, matching the existing proposal cache; a regression test covers it.
A separate OneDrive generated `.next` readlink failure after the production build
was resolved by moving only generated output aside before restarting dev.

Ordinary local learner REST proof returned 200 for the assigned reference and 403
for foreign plan/session and package-as-assignment substitution; direct students
read returned zero rows, and mapping mutation was denied. Client delivery DTOs
were inspected: no answer-key fields, private metadata or provenance; no-store
was present. Rendered UI showed no provider/source labels.
Private-value scanning of 170 checkpoint, generated client-bundle and test-log
files found no synthetic integration/service credential or learner password.
Temporary learner-password and delivery-capability proof files were removed after
verification; no tracked environment file or credential copy was introduced.

All following before/after row counts **and whole-row hashes** were identical
across live interaction and restarts:

| Database table | Before → after |
| --- | --- |
| PL weekly_plans / weekly_sessions | 1 → 1 / 5 → 5 |
| PL legacy activities | 15 → 15 |
| PL activity_results | 0 → 0 |
| PL private legacy RS assignments / attempts | 0 → 0 / 0 → 0 |
| PL package references / approval batches / session assignments | 4 → 4 / 1 → 1 / 2 → 2 |
| RS public activities / activity_versions | 2 → 2 / 10 → 10 |
| RS private packages / provenance | 4 → 4 / 4 → 4 |

No attempts, completions, progress, tutor reports or public RS publication were
created. Authentication/session infrastructure and the new synthetic mapping are
the only deliberate local setup writes; they are outside those content/result tables.

## Remaining boundary / next checkpoint

All 11 text-only types have safe delivery and tested rendering; only the two
already approved types were exercised interactively in the live browser. This is
not production learner onboarding, multi-instance capability infrastructure or
private-media support. There is no durable response/attempt/result/completion
endpoint. The next checkpoint can build PL-owned attempts and trusted server-side
score/manual-review receipts on these immutable assignment/package identities
without redesigning assignment or delivery. It must not trust browser aggregate
scores as durable evidence. Progress/reporting then require explicit PL semantics.
There is no remaining blocker for this scoped delivery checkpoint.
