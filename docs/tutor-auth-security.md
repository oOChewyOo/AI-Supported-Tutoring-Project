# Tutor authentication: audit, review and manual rollout

Status: implementation and local review only. No hosted database migration,
Auth account creation, data assignment, or deployment has been performed.
Feature branch: `codex/tutor-auth-ownership`. The completed Resource Studio preview is independent.
Unreviewed AI activity-generation work is excluded from this checkpoint.

## Repository audit

The audit read `supabase/schema.sql`, **every** migration below, all of
`lib/actions.ts` and `lib/data.ts`, both database clients, all tutor routes,
and the Resource Studio server loader. The historical snapshot alone was not
treated as authoritative. Actual hosted database drift has not been inspected.

| Migration | Existing behavior and risk |
| --- | --- |
| `202606100001_students.sql` | Students with unrestricted anonymous SELECT/INSERT; no ownership. |
| `202606100002_lesson_reflections.sql` | Unrestricted anonymous SELECT/INSERT, linked to students. |
| `202606100003_weekly_plans_and_activities.sql` | Anonymous SELECT/INSERT for plans, sessions, activities and results, plus result UPDATE. Plan RPC is SECURITY DEFINER, executable by anon, with no caller/ownership check; accepts guessed reflection IDs and returns existing plan IDs. |
| `202606100004_extracted_objectives.sql` | Anonymous SELECT/INSERT/UPDATE of objectives. Student and reflection references can disagree. |
| `202606110001_ai_session_titles.sql` | Adds unrestricted anonymous UPDATE on sessions. Must be removed too. |
| `202606110002_activity_content_storage.sql` | Adds nullable template/content columns; no authentication. |

The prior server client discarded sessions and used the anonymous key for every
request. The browser client was unused and did not share SSR cookies. Data
loaders and six learner server actions had no identity guard. Checking IDs
against public tables was not authorization. Completion accepted a student and
plan ID supplied by the caller; objective updates could report success on zero
updated rows. No learner-response JSON storage is introduced in this milestone;
`activity_results` remains the existing completion table.

## Security design and reviewed migration

`202609220001_tutor_auth_ownership.sql` runs in one transaction after all earlier
migrations. Its relevant security properties were reviewed against both the
historical migrations and executable PostgreSQL tests:

- Only administrator-provisioned, active rows in `public.tutors` permit learner
  access. It references `auth.users`. Tutors may read their own membership but
  cannot create, update or delete memberships. Supabase anonymous Auth identities
  are explicitly rejected as well as the unauthenticated `anon` database role.
- `students.owner_tutor_id` is added **without** a default first. Existing rows
  remain NULL. Only subsequent inserts default to the caller's `auth.uid()`.
  The application also supplies the verified user ID, ignoring submitted owners.
- ALL policies on the seven learner tables are removed, so later or stray
  permissive policies cannot remain ORed with the ownership checks. RLS is enabled
  and forced. PUBLIC/anon grants are revoked; authenticated receives only CRUD,
  governed by both USING and WITH CHECK (no TRUNCATE or REFERENCES grant).
- Ownership follows student → reflection → plan → session → activity. Objectives
  must reference the same student as their reflection. Plans have the same check.
  Results must reference the student belonging to their activity's plan. Parent
  lookups themselves obey RLS; callers cannot reparent a row into another tutor's
  hierarchy. NULL-owned or inconsistent legacy rows are not tutor-visible.
- The RPC becomes SECURITY INVOKER with an empty search path, fully qualified
  application tables, an active-tutor guard, and a reflection lookup under RLS.
  It locks the reflection before checking/creating a plan to serialize competing
  calls. It cannot reveal another tutor's existing plan ID. PUBLIC/anon execute
  privileges are revoked. Only authenticated callers receive execute permission.
- The membership helper is also SECURITY INVOKER, not an elevated RLS bypass.
  Tutor deletion and account deletion are restricted while ownership references
  exist; deactivation is the immediate access-revocation mechanism.

SSR uses `@supabase/ssr` cookie adapters and a fresh client per request with the
public anon key. `auth.getUser()` validates identity with Auth. No authorization
decision uses an unverified cookie user from `getSession()`. Middleware refreshes
cookies and sets private/no-store response headers on tutor/auth routes. Layouts,
data loaders and all six learner actions independently require approved tutor
access. RLS is the authoritative cross-tutor boundary, including direct REST/RPC
calls. Completion checks the activity/student/plan relationship before writing.
Objective updates distinguish an inaccessible row from a successful update.

No service-role/secret key is read by application code. No learner or tutor
session is cached globally. Sign-in is email/password for provisioned tutors;
sign-out is a POST server action. Next's same-origin Server Action checks remain
enabled. There is no public signup, pupil login, or learner-response capture.
The home page, login page and development-only Resource Studio preview stay
outside the tutor layouts. The preview still fetches only its published content,
never Supabase data, and still returns 404 in production.

Implementation follows [Supabase's SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
and [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

The dependency review found advisories in the existing install, including a
critical Next.js Windows-server issue. Next.js and its ESLint config were updated
within version 15 to 15.5.26. Compatible transitive fixes were applied, with
PostCSS explicitly overridden to 8.5.28 to address its remaining advisory without
a Next.js 16 migration. The override and lockfile changes are part of the review;
remove the override once the framework's own dependency is patched. The final
installation audit reported zero known vulnerabilities.

## Manual Supabase configuration (requires administrator review)

1. Use an isolated development/staging project with synthetic data. Enable email
   and password authentication. Disable public account signup and anonymous
   sign-ins. Keep email confirmation enabled. Configure Site URL for the intended
   environment (locally `http://localhost:3000`), minimal redirect allowlists, and
  Auth rate limits. Do not add wildcard production redirects.
   Production must use HTTPS; session cookies are Secure in production and
   SameSite=Lax. Do not let a CDN override private/no-store auth response headers.
2. Create confirmed test tutor accounts in Supabase Dashboard using its user
   management UI and set passwords securely. This implementation has no invite
   callback, password setup, reset or recovery UI; do not use email invite links
   as a substitute for provisioning a usable password. Never put passwords here.
3. After the reviewed migration, enroll each approved account explicitly using
   its verified Auth UUID, via administrator SQL (replace the placeholder):

   ```sql
   insert into public.tutors (id) values ('REVIEWED_AUTH_USER_UUID');
   ```

   This grants tutor membership, **not ownership of legacy records**. To revoke
   learner access immediately, an administrator sets `active = false` for that
   tutor. Users cannot change this flag themselves.
4. Configure only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (the project's public anon/publishable key). Never put a service-role or secret
   key in that variable. Restart Practice Loop and visit `/login`.
5. Keep existing server-only Resource Studio variables unchanged. Local preview:
   `http://localhost:3000/dev/resource-studio/activity-equivalent-fractions-mcq`.

## Safe migration and existing-data plan

1. Stop access to the old application and isolate the old public Data API before
   cutover. The old database remains anonymously accessible until the SQL is
   applied; changing application code alone cannot secure it. Take a tested backup
   and export the deployed migration history, policies, grants, functions and views.
2. Run `supabase/review/tutor-auth-preflight.sql` manually. Compare hosted objects
   with the complete history. Review any extra views, column grants, functions,
   triggers or exposed schemas that could bypass these policies. The migration
   deliberately replaces all policies on these seven tables; approve removal of
   any custom policies first. Unknown RPC overloads or definer views/functions
   need a separately reviewed fix before reopening access.
3. For a new database, run migrations in filename order from `202606100001` through
   `202609220001`, while access is isolated. For an existing database, establish
   which historical migrations are already installed, apply only missing earlier
   migrations, then the new cutover migration. Do not run `schema.sql` alone.
   **Never replay an old permissive migration after the cutover.** The new migration
   is intentionally a one-time migration; record it in deployment bookkeeping.
4. By default leave all existing NULL-owned students quarantined. Their descendants
   remain in place but are unreadable and unmodifiable through tutor requests.
   Do not assign rows to the first signed-in user or use a blanket UPDATE.
5. An authorized administrator must review each existing student hierarchy and
   its provenance. Prepare a one-to-one map of approved student UUID → approved
   tutor Auth UUID outside the application, with evidence and a reviewer. Review
   the preflight mismatch counts and resolve inconsistent student/reflection/result
   links before assignment. Ambiguous records remain quarantined; deletion or
   archival requires a separate data-retention decision.
6. Apply only reviewed assignments in a separate administrator transaction. Check
   affected-row counts and stop on mismatch. Example for **one approved mapping**:

   ```sql
   begin;
   select id, owner_tutor_id from public.students
     where id = 'REVIEWED_STUDENT_UUID' for update;
   update public.students set owner_tutor_id = 'REVIEWED_TUTOR_UUID'
     where id = 'REVIEWED_STUDENT_UUID' and owner_tutor_id is null
     returning id, owner_tutor_id;
   -- Reviewer must verify exactly the approved row, or ROLLBACK.
   commit;
   ```

   The sample is documentation only and has not been executed. Parent ownership
   scopes its descendants; there is no child-row mass reassignment step. NULL
   ownership remains allowed solely for quarantine. A later NOT NULL constraint
   requires an explicit decision for every remaining legacy row.
7. Deploy the compatible app only after database checks pass. Validate two isolated
   test tutor sessions plus a logged-out session. If cutover fails, keep access
   isolated and fix forward or restore an isolated backup. Do not restore public
   policies as an operational rollback.

## Verification and limits

- `npm test` includes the Resource Studio tests, direct action/auth guard tests,
  and actual PostgreSQL policy/RPC tests using ephemeral PGlite. The SQL test
  applies **all** historical migrations, creates a synthetic legacy hierarchy,
  injects a stray permissive policy, and applies the new migration. It switches to
  non-superuser anon/authenticated roles for assertions. No hosted credentials,
  learner records, or configured `.env.local` are used.
- Coverage includes anonymous CRUD denial on every learner table, A/B isolation,
  inserts and updates across parent boundaries, denied ownership transfer, NULL
  quarantine, mismatched student references, non-tutor and anonymous Auth users,
  deactivation, direct RPC denial/idempotency, and 5-session/15-activity creation.
  Auth tests invoke every exported learner action without a session, rather than
  assuming middleware protected it.
- `npm run typecheck`, `npm run lint`, `npm run build` are required alongside tests.
  Run typecheck and build sequentially: Next rebuilds generated route types.
  The typecheck script generates those types first to support a clean checkout.
  Test-only PGlite emulates Supabase's `auth.users`, `auth.uid()` and `auth.jwt()`;
  it is not the hosted Auth service, PostgREST, a reverse proxy or a connection
  pool. The pgcrypto extension statement is omitted only in that harness because
  gen_random_uuid is built in. All policy/RPC SQL is executed unchanged.
- Hosted sign-in, refresh-token rotation, actual expired-session behavior,
  PostgREST upsert behavior, concurrent RPC calls and deployed database drift
  still require staging checks. Test with A and B in separate browser profiles:
  create synthetic hierarchies, exchange guessed URLs and IDs, call REST/RPC with
  each JWT, and verify no foreign data or writes. Repeat logged out and after tutor
  deactivation. A denied page may be 404 or redirected to login as appropriate.
- Browser sign-out revokes the local refresh session; already-issued access JWTs
  can remain usable until expiry. Deactivating tutor membership blocks database
  access immediately even for an otherwise valid JWT. Review session lifetime,
  password recovery, MFA and operational audit logging before real learner use.
- Existing AI generation sends authorized tutor-entered information to OpenAI;
  it now runs after authentication and scoped lookup. Data-processing approval
  remains a separate decision before any real learner information is entered.

## Decisions needing review before rollout

Approve administrator-managed tutor enrollment (no self-signup), the policy/grant
replacement and invoker RPC, NULL quarantine and any explicit ownership map,
deactivation/account-deletion behavior, and the staged cutover/rollback procedure.
The code is ready for that review; it does not make a live database secure until
the migration and administrator configuration are completed.

## Recorded verification results

Historical verification on 2026-09-22 of the full working tree, including the
uncommitted AI-generation feature. These recorded counts predate checkpoint
separation; this checkpoint covers the six completed learner actions:

| Check | Result |
| --- | --- |
| `npm test` | 72 passed, 0 failed, 0 skipped: 28 Resource Studio, 28 auth/action/client, 16 PostgreSQL suite/subtest results. |
| `npm run typecheck` | Passed after generating route types. A parallel build/typecheck initially raced on generated files; the final sequential run passed. |
| `npm run lint` | Passed, including middleware. |
| `npm run build` | Passed on Next.js 15.5.26. Only webpack cache serialization performance warnings. |
| `npm audit` | 0 known vulnerabilities. |
| `git diff --check` | Passed; Git reported only Windows line-ending normalization notices. |
| Development HTTP/browser | Login form rendered; anonymous dashboard/new-student/student/plan/activity requests redirected to `/login`. |
| Production HTTP | Login 200; anonymous dashboard/student/plan/activity requests 307 to `/login`; Resource Studio preview 404. |
| Production client secret scan | Integration key absent from all 39 client JavaScript files. |

The Resource Studio development route returned 200 with its useful offline error
and did not redirect to tutor authentication. The configured Resource Studio
endpoint on port 3001 returned ECONNREFUSED at verification time. Its success
retrieval/validation/scoring regression tests passed; live published-content
verification requires restarting Resource Studio separately. No Resource Studio
repository files or integration settings were changed.

## Files changed in this milestone

This list excludes pre-existing activity generation and Resource Studio changes.
Those remain in the working tree unchanged, except for the auth guards added to
the shared learner actions and the configuration documentation noted below.

```text
.env.example
README.md
app/activities/layout.tsx
app/dashboard/layout.tsx
app/dashboard/page.tsx
app/dashboard/students/new/page.tsx
app/globals.css
app/login/page.tsx
app/plans/layout.tsx
app/students/layout.tsx
components/app-header.tsx
components/tutor-shell.tsx
docs/tutor-auth-security.md
lib/actions.ts
lib/auth-actions.ts
lib/auth.ts
lib/data.ts
lib/supabase/client.ts
lib/supabase/server.ts
middleware.ts
package.json
package-lock.json
supabase/schema.sql (historical-snapshot warning only)
supabase/migrations/202609220001_tutor_auth_ownership.sql
supabase/review/tutor-auth-preflight.sql
tests/tutor-auth.test.cjs
tests/tutor-rls.test.cjs
```

No `.env.local` values, historical migration bodies, Resource Studio integration
files, learner records or weekly-plan content were changed for this milestone.
