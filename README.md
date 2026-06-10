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

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and add the project URL and anon key.
4. Restart the development server.

Student creation/reading and lesson reflection creation/reading are implemented. The schema includes temporary anonymous select/insert policies because authentication is intentionally out of scope. Replace them with tutor-owned policies before deploying for real users.
