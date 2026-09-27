# Resource Studio library search

Milestone 3B Task 2 adds metadata-only discovery on an existing weekly plan in
development. The tutor must sign in, own the plan, and confirm an existing
fictional test student. Search does not change a plan, preview content or assign
anything. The existing fixed-activity assignment flow is unchanged.

The contract was checked against Resource Studio commit
`18bc25271f7af00100896de3faf0a835319a5a64`, specifically
`docs/practice-loop-library-search.md` and
`lib/integrations/practice-loop-search.ts`.

## Configuration and workflow

Reuse the existing server-only `RESOURCE_STUDIO_BASE_URL` and
`PRACTICE_LOOP_INTEGRATION_KEY` configuration. No new configuration or Practice
Loop migration is required. Resource Studio needs its search API and metadata
search migration enabled in the separately managed environment; this task does
not apply it. Neither application is production-ready.

Open an owned weekly plan in development, find **Resource Studio library**, enter
topic keywords and optional exact curriculum labels (for example `Maths` and
`Year 4`), confirm the fictional student, and search. Blank filters browse all
eligible MCQs. Results are ten per page; Previous/Next retain the current
filters. Editing filters hides old results until a fresh search. There is no
automatic request on page load and no prefilled pupil information.

The upstream endpoint is `GET /api/integrations/practice-loop/activities` with
`q`, `subject`, `yearGroup`, `page`, and `pageSize`. This checkpoint does not expose
the upstream optional objective-ID filter or limit alias. The client validates
text limits (120/80/40), control characters and pagination (1–20 page size),
uses a ten-second timeout, refuses redirects, and disables caching. Errors never
include upstream response bodies or credentials.

Every search action authenticates the tutor and checks the plan/student/reflection
ownership chain before fetching upstream. These checks read IDs only. Only the
entered search fields are sent; names, reflections and local plan/student IDs
are not included. Enter topic terms only, never personal information.

The response is validated and rebuilt from an explicit metadata allowlist:
ID, title, current published version, MCQ type, subject, year group, objective
ID/title and tags. Definitions, answers and private source provenance are not
forwarded. The API currently has no duration field, so the UI says duration is
not provided. Search results do not prove full-content validity and are not
version-locked across pages. A later preview/assignment task must fetch and
validate the exact discovered version; this task does not do that.

## Verification

`tests/resource-studio-search.test.cjs` uses synthetic data and mocked transport
for auth/ownership, fictional confirmation, query/response validation,
pagination, sanitization, metadata rendering, loading/error/empty states and
preservation of existing plan controls. Existing Resource Studio/auth tests
remain relevant. No live Resource Studio, AI service, student database or
migration is needed for these focused tests.

Run:

```text
node --test tests/resource-studio-search.test.cjs tests/resource-studio.test.cjs tests/resource-studio-assignment.test.cjs tests/resource-studio-report.test.cjs tests/tutor-auth.test.cjs
npm run typecheck
npm run lint
```
