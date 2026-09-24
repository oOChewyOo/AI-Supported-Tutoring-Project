# One saved Resource Studio attempt (local development)

Review `supabase/migrations/202609240002_resource_studio_attempts.sql` before
applying it manually. It follows the existing assignment migration; neither has
been applied by this task. Use fictional local data only.

## What is saved

The private `resource_studio_attempts` table holds one row per assigned activity:
student, submitting tutor, timestamp, selected option IDs per question, score,
total, and per-question correctness/feedback. Its foreign key references the
immutable assignment, which retains the exact source activity ID, version and
snapshot. No new Resource Studio request is made when submitting or reviewing.

`submit_resource_studio_attempt` takes only activity ID and selections. It verifies
the approved tutor and ownership through all parents, locks the ownership chain,
scores against the private snapshot, and inserts the attempt and the existing
`activity_results` completion marker in the same transaction. Every question must
have a valid selection. Multiple-answer questions score one point only for the
exact correct set; a partial/extra selection scores zero. An incorrect completed
exercise still counts as completed. An unanswered question does not.

The activity ID is the idempotency key. After a successful submission every repeat
returns that original attempt, even with different selections. A lost network
response can be recovered by refreshing or resending; this never creates another
attempt. A database error rolls back both inserts. The existing weekly-plan
completion calculations read the same completion table and need no new model.

The read and submit RPCs use fixed empty search paths and explicit ownership checks.
Only authenticated callers have execute grants; the approved-tutor and local
enable checks still run inside the database. The private table has forced RLS,
no access policies, and no public/anon/authenticated grants. Do not expose the
private schema through PostgREST. Ordinary requests keep using the session client,
never the service-role key. Returned data includes the tutor's saved selections
and feedback, not the answer-key array or full snapshot. These are tutor-only
development RPCs, not a future public pupil API. The previous non-persisting
check RPC remains available to approved owners; it does not create completion.

Triggers prevent direct completion forgery, changes/deletion of completed attempts
or their completion rows, and moving their activity/session/plan to another parent.
Consequently, deleting a completed imported activity or its containing plan/student
is blocked too. Ordinary placeholder/AI completion remains editable as before.
Any future erasure/retention feature needs a separately reviewed administrative
workflow; none is introduced here. Database administrators remain trusted.

## Exact manual local steps

1. Confirm the branch is `codex/tutor-auth-ownership`. Preserve the working tree.
   Stop local Practice Loop requests while applying the migration. Do not reset
   Supabase or replay historical migrations.
2. Open **local** Supabase Studio (`http://127.0.0.1:54323` with the current local
   setup). Verify this is the disposable local database, not a hosted project.
   Tutor A/B, ownership and the assignment migration must already be working.
3. In the local SQL editor, run this read-only preflight:

   ```sql
   select count(*) as imported_completion_records
   from public.activity_results r
   join practice_loop_private.resource_studio_assignments a using (activity_id);
   ```

   Expect zero before this migration. If nonzero, stop for review: these are older
   manual completion records without saved responses. Do not invent attempts or
   delete existing records to make the migration pass. The migration also checks
   this under locks and aborts rather than silently changing data.
4. Review then execute **only**
   `supabase/migrations/202609240002_resource_studio_attempts.sql` in the local SQL
   editor as one complete batch, using the trusted migration administrator. It is
   a one-time migration enclosed in BEGIN/COMMIT; an error rolls it all back. If
   the editor leaves the connection in an aborted transaction, run `ROLLBACK`
   before diagnosing. Do not rerun the already-applied assignment migration.
5. Keep the existing assignment enable flag and local Supabase environment settings.
   No new environment variables or credentials are needed. Run `npm run dev` and
   sign in as Tutor A. Open the **already imported** `/activities/<activity-id>`.
   Resource Studio can be offline; this uses the stored snapshot.
6. Check that leaving any question unanswered cannot complete the activity. On the
   imported fixture, select all correct answers except select only one correct
   choice for the multiple-answer question. Press **Submit completed attempt**.
   Expect 4/5, saved responses, question feedback and a submission timestamp. The
   submit control disappears. There is no attempt reset or change-answer control.
7. Refresh and reopen the activity: score, responses and timestamp must be unchanged.
   Return to the weekly plan: this activity is complete; the session becomes complete
   only when all its activities are complete. Other placeholders still work.
8. To exercise duplicate protection, open an unfinished imported slot in two tabs
   **before** submitting. Submit in one, then submit different answers in the second.
   Both must show the first result. Use a different unused fictional slot to test
   another score; never delete an attempt to retry it. Do not generate AI content.
9. Sign out, sign in as Tutor B, and visit Tutor A's activity URL. It must be
   inaccessible, including after refresh/back navigation. Anonymous users must be
   redirected. With ordinary authenticated Supabase requests, call
   `get_resource_studio_attempt` / `submit_resource_studio_attempt` with A's activity
   ID as B: both must deny access. Never test this using an administrator client.
10. For a transport-failure test on an unfinished test slot, stop local Supabase
    before submitting. Expect an error, never a success/completion claim. Restart
    it and reload before resubmitting; if an earlier response was lost after commit,
    the original saved attempt appears. Do not leave the local database stopped.
11. Run `npm test`, `npm run typecheck`, `npm run lint`, then `npm run build`.
    Keep typecheck/build sequential. Production imported-activity pages and actions
    remain unavailable. No hosted migrations, deployment or commits are needed.

To suspend access without deleting anything, an administrator can set the existing
private Resource Studio settings flag to false locally. There is no automatic down
migration: after attempts exist, removing these protections risks inconsistency and
data loss, so rollback requires a reviewed preservation/export plan. Do not restore
anonymous policies or drop the attempt table as a routine rollback.

## Testing limits

Automated tests use ephemeral PGlite PostgreSQL with the complete migration history,
synthetic tutor identities and the fixture snapshot. They exercise real SQL grants,
ownership, scoring, duplicate calls, immutable records and injected transaction
failures. Server-action/page tests mock the Supabase transport and Auth, including
reload and failures; rendering tests check the saved-response UI. They do not use
`.env.local`, contact local/hosted services or apply migrations to your database.
PGlite serializes calls within one engine; independent-connection races,
PostgREST schema refresh, and full browser/session behavior require the manual
local checks above. No pupil API or high-stakes assessment security is claimed.
