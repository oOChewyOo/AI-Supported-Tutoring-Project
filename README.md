# Practice Loop

Coding agents: start with [AGENTS.md](AGENTS.md), the [current handoff](docs/AI_DEVELOPMENT_HANDOFF.md),
[roadmap](docs/ROADMAP.md), and [canonical/runtime directory rules](docs/LOCAL_DEVELOPMENT_LAYOUT.md).

An MVP for extending human tutoring sessions with short, focused practice through the week.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Implemented flow

1. Sign in with an administrator-provisioned tutor account and open the tutor dashboard.
2. Add a student.
3. See the persisted student on the dashboard.
4. Open the student profile.
5. Add a lesson reflection and see it on the student profile.
6. Generate a placeholder five-session weekly plan from a reflection.
7. Open activities and persist completion.
8. Extract structured learning objectives from a saved reflection and edit them.
9. Generate objective-specific weekly session titles, with automatic placeholder fallback.

## Supabase setup

Read [the authentication audit and manual migration plan](docs/tutor-auth-security.md)
before connecting a database. `supabase/schema.sql` is a historical insecure
snapshot, not the current setup procedure. Apply the complete ordered migration
history only after review, provision approved tutor accounts, then configure the
public Supabase URL/anon key in `.env.local`. Never configure a service-role key
for tutor requests. `OPENAI_API_KEY` is optional and server-only.

Existing records are quarantined with NULL ownership until an administrator
reviews them; signing in never claims old records. Use synthetic test data only.
No live migration or deployment is performed by the tests.

The independent [Resource Studio development preview](docs/resource-studio-preview.md)
remains available without tutor sign-in and does not access learner records.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
