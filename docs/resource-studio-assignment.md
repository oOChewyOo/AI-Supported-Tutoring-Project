# Assign a published Resource Studio exercise locally

**Follow-on milestone:** the assigned exercise now supports one saved completed
attempt. After the assignment setup below, follow [saved-attempt setup](resource-studio-attempts.md)
and apply its additional migration manually. The original no-persistence testing
steps below describe the assignment milestone alone; the current activity page
uses **Submit completed attempt** and displays the saved result after refresh.

This milestone assigns the published equivalent-fractions MCQ to one existing,
unused placeholder owned by an approved tutor. Use an existing fictional student.
It does not create students, save answers/completion, generate AI content, or add
pupil authentication or dashboard results. Nothing here applies a hosted migration.

## Storage and access

The existing server-only Resource Studio loader validates the published envelope.
The saved snapshot is its normalized text/MCQ model, tagged `resource-studio-mcq-v1`;
it is not `GeneratedActivityContent`. The source activity ID and exact positive
integer content version are stored separately. Unsupported media/teacher metadata
are not imported, consistent with the existing text preview.

`202609240001_resource_studio_assignments.sql` runs in one transaction after the
tutor-ownership migration. It adds:

- A safe boolean marker on `public.activities`, default false for existing slots.
- A private assignment table containing the snapshot and keys, with one row per
  activity. A private settings row defaults to **disabled**. Neither table has
  any anonymous/authenticated grants; RLS is enabled and forced, with no policies.
- Three bounded authenticated RPCs: assign, get a display-only exercise, and check
  answers. Each requires the local enable flag, a non-anonymous approved tutor,
  and ownership through activity → session → plan → student, with the reflection
  belonging to the same student. No caller-supplied parent or owner IDs are trusted.
- Triggers that prevent changing a stored snapshot, forging the marker, or writing
  AI content over an imported slot. The existing learner RLS policies are unchanged.

The RPCs are **SECURITY DEFINER** solely to access the private table without exposing
answer keys through the Data API. Review them as privileged code before applying:
they use an empty search path, qualified tables, explicit caller/ownership checks,
and restricted execute grants. Apply as the trusted migration administrator
(`postgres` locally), never using a service-role key in ordinary application code.
Do not add `practice_loop_private` to exposed schemas. This follows the privilege
controls described in [Supabase's database function guidance](https://supabase.com/docs/guides/database/functions).

The read RPC uses an explicit field allowlist and returns no correct option IDs,
answer feedback or explanations before checking. The check RPC computes exact-set
scores from the stored snapshot, returning feedback only after a check; it writes
nothing. It accepts selections, never client definitions or scores. Both RPCs are
tutor-only, not a pupil API. The existing independent development preview is unchanged
and must not be repurposed as a public pupil API.

Approved tutors are trusted authors for their own development data: the assignment
RPC validates its input and ownership but does not cryptographically attest that
a direct RPC caller obtained that content from Resource Studio. The application
action always fetches and validates it server-side; no submitted snapshot is accepted.
Design separate authentication, attempts/feedback rules and provenance controls
before introducing any pupil API or high-stakes assessment.

Assignment locks the activity row and checks eligibility again inside the database.
The primary key prevents duplicate imports; generated content, a template ID or any
existing completion record disqualifies the slot. Resource Studio edits do not
update a saved snapshot. Use another unused slot for another version. Deleting an
owned activity/plan through existing permitted operations cascades deletion of its
snapshot; there is no tutor snapshot update/delete endpoint. With the follow-on
attempt migration, a completed attempt prevents that deletion to preserve its
snapshot and results; see the saved-attempt guide above.

## Exact local setup and verification

1. Keep all unfinished work. Confirm `git branch --show-current` reports
   `codex/tutor-auth-ownership`. Do not run a database reset or replay old migrations.
2. Open **local** Supabase Studio at `http://127.0.0.1:54323`. Verify its database is
   your disposable local development instance, not a hosted project. The existing
   tutor ownership migration and fictional Tutor A/B setup must already be working.
3. Review the new migration, then run **only**
   `supabase/migrations/202609240001_resource_studio_assignments.sql` in that local
   SQL editor, as a single batch. It makes no assignments and creates no learners.
   It is one-time, not idempotent. If it fails, its transaction rolls back; inspect
   before retrying. Never rerun the historical anonymous update policy afterwards.
4. Enable this feature **only in that local database**, using administrator SQL:

   ```sql
   update practice_loop_private.resource_studio_settings
   set enabled = true where singleton = true;
   ```

   The app and actions also require `NODE_ENV=development`. The disabled-by-default
   database flag prevents inadvertent use through direct RPCs in other environments.
5. Keep Resource Studio running at port 3001 with the equivalent-fractions activity
   published. Keep the existing server-only `RESOURCE_STUDIO_BASE_URL` and
   `PRACTICE_LOOP_INTEGRATION_KEY` in `.env.local`; do not copy keys into SQL or Git.
   Keep Practice Loop's public Supabase URL/key pointing at your local instance.
6. Run/restart `npm run dev`. Sign in as Tutor A, open the existing fictional
   student's weekly plan, then an **unused placeholder** (no generated content,
   template or completion record). Select **Assign Resource Studio exercise**.
   The route is `/dev/resource-studio/assign/<existing-activity-uuid>`.
7. Confirm the displayed student, plan, session and slot. Check the fictional-data
   confirmation and assign. You are redirected to the existing `/activities/<uuid>`
   page showing the saved exercise and version. No other slot is changed.
8. Test radios, checkboxes, hints and **Check my answers**, using keyboard navigation
   too. For the supplied published fixture, the correct answers are 2/4, 1/2,
   both 4/6 and 6/9, 8, and the explanation that different multipliers were used.
   Expect 5/5; a partial/extra multi-selection is incorrect. Refresh clears answers.
   Completion totals must not change, and there is no imported-slot completion button.
9. Reopen the assignment URL: it must reject another import. If a newer resource
   is subsequently published, reload the assigned exercise: its saved version and
   content stay unchanged. It also continues working when Resource Studio is offline.
10. Sign out and sign in as Tutor B. A's activity/assignment URLs and direct RPC
    calls must not reveal A's data or allow writes. Signed-out requests must redirect
    to login or be denied. Test with ordinary sessions, not administrator credentials.
11. On another unused slot, an offline Resource Studio or invalid integration key
    should produce a useful error without making an assignment. Restore any local
    test configuration immediately. Existing placeholders must still work.
12. Run `npm test`, `npm run typecheck`, `npm run lint`, then `npm run build`.
    Run typecheck and build sequentially because they generate Next route types.
    Production-mode assignment pages and imported activity pages are unavailable.

Do not run the unfinished AI generator on assigned plans. This milestone does not
change that generator's slot-selection logic; the database rejects its attempts
to overwrite imported slots. Its remaining uncommitted code is preserved.

To disable without deleting data, set the private settings row's `enabled` to false
in the local administrator SQL editor. Snapshots remain saved and immutable. There
is no automatic down migration; dropping objects or deleting data needs separate
review. Do not restore permissive policies as a rollback.

## Automated coverage and limits

Node tests exercise the actual server actions/loader with mocked Auth, fetch and
Supabase transport. PGlite tests execute the complete SQL history in an ephemeral
database with synthetic accounts: cross-tutor/anonymous denial, private-table
permissions, disabled defaults, validation, duplicate rejection, version preservation,
immutable snapshots, AI-overwrite protection and exact scoring without persistence.
The old ownership suite also runs all migrations after its legacy-data setup.

These tests do not contact your Supabase or Resource Studio servers, use `.env.local`,
or modify any real student. Actual Supabase/PostgREST behavior, browser sessions and
simultaneous requests across database connections still need the local checks above.
