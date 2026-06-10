# Practice Loop

An MVP for extending human tutoring sessions with short, focused practice through the week.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Implemented flow

1. Open the tutor dashboard.
2. Add a student.
3. See the persisted student on the dashboard.
4. Open the student profile.
5. Add a lesson reflection and see it on the student profile.
6. Generate a placeholder five-session weekly plan from a reflection.
7. Open activities and persist completion.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and add the project URL and anon key.
4. Restart the development server.

The complete non-AI MVP flow is implemented: students, lesson reflections, placeholder weekly plans, activities, and persisted completion. The schema includes temporary anonymous policies because authentication is intentionally out of scope. Replace them with tutor-owned policies before deploying for real users.

For an existing project that already has students, run migrations in order:

1. `supabase/migrations/202606100002_lesson_reflections.sql`
2. `supabase/migrations/202606100003_weekly_plans_and_activities.sql`
