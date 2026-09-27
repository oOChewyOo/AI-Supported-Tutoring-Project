# Resource Studio library search

Milestone 3B Task 2 adds metadata-only discovery on an existing weekly plan in
development. The tutor must sign in, own the plan, and confirm an existing
fictional test student. Search does not change a plan or assign anything.
Milestone 3B Task 3A adds an inline exact-version tutor preview, described below.
The existing fixed-activity assignment flow is unchanged.

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
validate the exact discovered version. Preview now does this; assignment remains
outside this checkpoint and must independently revalidate when implemented.

## Inline tutor preview (Task 3A)

Select **Preview activity** on a result to retrieve its ID and exact
`contentVersion` from `/api/integrations/practice-loop/activities/{id}?version=N`.
The server action reauthenticates the tutor, repeats the shared plan ownership
checks, and requires fictional-student confirmation. IDs accept 1–160 ASCII
letters, digits, underscores or hyphens; versions must be numeric integers from
1 to 2147483647. Neither local pupil data nor the plan ID is sent upstream.

The existing server transport supplies server-only authentication, no-store,
no redirects and a ten-second timeout. The existing MCQ parser validates the
response and projects its allowed fields; identity and version must match the
selection. A failed exact-version request never falls back to current content.
Resource Studio is responsible for verifying its trusted publication marker.
404/410/422 responses show publication unavailable, while invalid responses and
service failures show sanitized preview errors without rendering content.

`ResourceStudioSelectedPreview` mounts the existing `ResourceStudioPreview`
outside the search form. Answer keys are returned only through the authenticated
tutor development action, to allow local preview checking; they never enter
search metadata, the pupil exercise contract or a new public route. The legacy
fixed-ID development preview route is unchanged and cannot retrieve arbitrary
searched activities. This milestone does not establish production readiness.

**Back to search results** preserves keywords, filters and pagination because
the search form remains mounted. Preview answers are discarded on close and
late requests are ignored. Reopening rechecks ownership and publication.
Nothing is assigned or saved; there are no assignment controls. Publication may
change after a preview is loaded, so a preview is not assignment authorization.

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
node --test tests/resource-studio-preview.test.cjs
npm run typecheck
npm run lint
```

Task 3A verification: 151 focused synthetic tests passed across the six suites
above (27 new preview tests), along with typecheck, lint and whitespace checks.
The preview review fixed question-ID collisions in local answer state using a
Map; a regression test checks arbitrary IDs and verifies answer checking prevents
form submission and makes no network or database calls.
Tests use mocked integration responses; no live pupil data, AI service, hosted
migration or deployment was used.
