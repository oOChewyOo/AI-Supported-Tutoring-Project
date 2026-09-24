# Weekly-plan Resource Studio progress report

The existing `/plans/<plan-id>` page now has a **Resource Studio progress** section
in development. It lists only imported exercises, in session/slot order. A saved
attempt shows its score, completion status and submission date (UTC). Native
`details`/`summary` controls expand the saved question responses and feedback.
Pending imports have no score; placeholders and AI-generated activities remain
in the existing weekly-plan list and are explicitly excluded from this report.

## Storage and security

Review the new `202609240003_resource_studio_plan_report.sql` migration. It adds only
one read-only RPC, `get_resource_studio_plan_report(p_plan_id uuid)`. It creates no
tables, changes no records, and does not alter scoring, snapshot immutability,
completion calculations or existing RLS policies. It is enclosed in BEGIN/COMMIT.

The RPC is SECURITY DEFINER to read the private tables. It uses an empty search
path, qualified table names and explicit authenticated/non-anonymous, approved-tutor
ownership checks across plan, student and reflection. It checks plan ownership even
for an empty plan and reuses `assert_resource_owner` for every imported activity.
The existing local integration enable flag is required. Only `authenticated` has
execute permission, and membership/ownership are checked inside the function.
Do not expose the private schema or grant access to its tables.

The response contains only activity context, source version, saved score/date and
question review fields. It returns selected option text, saved correctness and
feedback, not correct option IDs, unselected options or private snapshots. It is a
tutor development report, not a public pupil API. The server loader uses the existing
per-request session client and no-store fetch; no service-role client or shared
report cache is introduced. The existing submit action already invalidates the
plan page. Refresh reads the saved attempt again, without contacting Resource Studio.

## Misconception tags and historical snapshots

The observed Resource Studio question field is the optional singular
`misconceptionTag` string. The adapter previously discarded it. Future imports now
validate and retain it; neither existing snapshots nor attempts are rewritten.
The report shows this author-provided tag only for a question whose **saved**
correctness is false. Tags are presented as possible areas to revisit, not diagnoses.
No tags are inferred from scores, feedback or current Resource Studio content.
Malformed/non-string or blank tags in a legacy snapshot are ignored safely.

Your previously completed local exercise will still show its saved answers and
score. If its immutable snapshot lacks tags, the report explains that none are
recorded for incorrect questions. Do not modify or reimport that slot to add tags.
Use another unused fictional slot for an optional future-import tag test.

## Exact local verification order

1. Stay on `codex/tutor-auth-ownership`; preserve all current work. The assignment
   and attempt migrations are already applied locally. **Do not replay them or
   reset the database.** No migration has been applied by this reporting task.
2. Review `supabase/migrations/202609240003_resource_studio_plan_report.sql`.
   Verify that Studio at `http://127.0.0.1:54323` is your disposable local Supabase
   instance, not a hosted project. Only when ready, manually execute that one new
   migration as a complete batch in its administrator SQL editor. If the transaction
   fails, roll back the aborted transaction before diagnosing; do not partially
   rerun it. No extra environment variables or enable flags are needed.
3. Start/restart Practice Loop with `npm run dev`, using the existing local Supabase
   configuration. Sign in as approved Tutor A. Open the existing fictional student's
   weekly plan from the student page (`/plans/<owned-plan-id>`).
4. Find **Resource Studio progress**. The completed equivalent-fractions exercise
   should show exactly the previously saved score/date and “Completed”. Expand
   **Review saved answers** by keyboard (Tab then Enter/Space) and check each
   question, saved selections, correctness and feedback against its activity page.
5. Refresh. The score, selections and timestamp must remain unchanged. The existing
   overall plan completion count must also remain unchanged by reading the report.
   Resource Studio can be offline; the report uses the stored snapshot and attempt.
6. On a plan with no imports, expect the “No Resource Studio exercises…” state.
   An assigned but unsubmitted slot should say “Not completed” and “No saved score
   or answers yet”. Ordinary completed placeholders must not acquire a score.
7. Optional tag test: assign a published exercise containing `misconceptionTag` to
   another unused fictional slot using the existing assignment interface, then
   submit at least one incorrect answer. Its report should list only tags for
   incorrect questions, under “Possible areas to revisit”. Correct-question tags
   must not appear. Existing tagless attempts must remain unchanged.
8. Sign out, then sign in as Tutor B and visit Tutor A's plan URL (including after
   refresh/back navigation). No report may appear. With an ordinary Tutor B session,
   a direct RPC request to `get_resource_studio_plan_report` using A's plan ID must
   return access denied. Anonymous and unapproved sessions must also be denied.
   Do not use an administrator/service-role client for these access tests.
9. If the reporting migration is missing or Supabase is unavailable, expect a report
   error rather than a misleading empty or zero-score report. Restore connectivity
   and refresh. Other plan content is not changed by report reads.
10. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
    Typecheck/build must run sequentially. The report remains hidden in production,
    consistent with the existing imported-activity feature.

## Verification limits and rollback

Automated tests execute the full migration history in ephemeral PGlite with synthetic
tutors; they cover plan-ID ownership, empty/missing attempts, saved correctness and
feedback, optional tags, disabled access, and read-only behavior. Mocked server/UI
tests cover session enforcement, fresh loads, error states and expandable markup.
They do not access local/hosted Supabase, apply migrations there, or use real learners.
Browser/PostgREST integration and actual local data require the manual steps above.

This migration has no data backfill. A separately reviewed rollback can remove only
the new reporting RPC after disabling its UI; snapshots and attempts must stay
intact. Do not drop private tables or restore permissive learner policies.
