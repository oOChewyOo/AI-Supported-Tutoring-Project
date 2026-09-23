# Resource Studio development preview

Practice Loop uses the Next.js App Router. Existing activities belong to weekly
sessions, are read through `lib/data.ts`, and store `GeneratedActivityContent`
(`schema_version`, `output_format`, `payload`) in Supabase. This preview is
independent of that model and does not call Supabase or completion actions.

## Local setup

1. Keep Resource Studio running on port 3001 with the activity published.
2. In Practice Loop's `.env.local`, set `RESOURCE_STUDIO_BASE_URL=http://localhost:3001`
   and `PRACTICE_LOOP_INTEGRATION_KEY` to the valid shared Bearer key. Neither
   variable may have a `NEXT_PUBLIC_` prefix. Do not commit the key.
3. Run `npm run dev -- --port 3000` (restart after changing environment variables).
4. Open <http://localhost:3000/dev/resource-studio/activity-equivalent-fractions-mcq>.
5. Choose answers, open hints, and select **Check my answers**. Question 3 uses
   checkboxes: both 4/6 and 6/9 must be selected. All other questions use radios.
   The published fixture's correct selections are 2/4, 1/2, both 4/6 and 6/9,
   8, and the statement that the numerator and denominator used different factors.
   These should score 5/5. A partial or extra selection scores zero for that question.
6. Change an answer and check again; reload to clear all answers. Try keyboard
   navigation (Tab, arrow keys for radios, Space for checkboxes and hints).

The server requests the fixed protected activity endpoint with a 10-second
timeout, no caching, and no redirects. Credentials and upstream error bodies
are never passed to the client. Rendering uses escaped React text. The client
receives only the validated educational preview model (including answer keys).
There is no result persistence, student identity, or production assessment use.

The observed API envelope is `{ id, title, contentVersion, activityData }`.
`contentVersion` must be a positive safe integer (published revisions may change);
`activityData.schemaVersion` must be exactly `"1.0"` and `activityType` must be
`"multiple_choice"`. Questions live in `activityData.content.questions`, with
unique IDs, at least two text options, and nonempty unique `correctOptionIds`
referencing those options. The number of correct IDs determines radio versus
checkbox inputs. Scoring requires exact set equality and gives one point per
question. Unsupported content fails closed. Optional hints, supporting text and
explanations are displayed when present; general feedback provides a fallback.
Media and teacher metadata are not included in this text-only preview.

## Checks and failure paths

- `npm test`: tests use a captured published educational fixture and mocked fetch;
  no credentials, Resource Studio process, or database are required.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Stop Resource Studio and reload to see the connection error.
- Temporarily use an invalid integration key and restart Practice Loop to see the
  authentication error; restore the key afterwards.
- `npm run build` then `npm run start -- --port 3002`: the preview URL on port 3002
  returns HTTP 404. Both the page and server loader require development mode.

The test harness transpiles the actual TypeScript modules with the installed
TypeScript compiler and stubs the Next `server-only` marker only inside the Node
test process. Next enforces that boundary in application builds.
