# Tutor-only session selection backend

This development-only backend adds planning references alongside the existing
three activity slots. It does not assign activities or create learner results,
attempts, completions, or exercise routes.

The weekly plan now loads session planning references
after the existing fictional-student confirmation. A successful inline preview
offers a session picker and Add to session, passing the validated preview's ID
and exact version to the existing add action. The server still re-fetches the
publication before saving. Existing identical selections show Already selected;
another selected version requires removal first. Action failures retain the
current list and show a sanitized error.

Selected resources appear inside the matching main weekly-session cards, with
title, version and Remove, alongside the unchanged three legacy activity slots.
There is no separate five-session planning-reference display. These are still
planning references and do not create learner assignments or affect progress.
The server-rendered page supplies minimal session options to one client provider;
cards and preview controls share selection records. Existing list actions run
only after fictional confirmation. Successful add/remove responses update the
affected session directly; list errors offer a working retry. Reload requires
confirmation again before persisted selections are shown.
Closing the preview preserves search filters, pagination and results. No extra
confirmation dialog is added. The existing session-options action remains
available, but the page no longer needs an additional options fetch. Its owned
plan loader supplies identifiers, numbers and titles; list/add/remove continue
using the unchanged authenticated selection actions.

`listResourceSessionSelections`, `addResourceSessionSelection`, and
`removeResourceSessionSelection` require a fresh active tutor session, an owned
plan, a session belonging to that plan, and explicit fictional-student
confirmation. The new RPCs independently enforce the same hierarchy and the
existing disabled-by-default Resource Studio database setting. No service-role
client is used. The migration depends on the existing tutor-ownership and
Resource Studio assignment migrations. It has been exercised in the isolated
synthetic local database, but not deployed to a real hosted/production database.

Add re-fetches the exact published version through the existing authenticated,
server-only integration adapter. Only its ID, version and validated title are
passed to persistence; the type is fixed to `multiple_choice`. The exact-version
adapter does not expose subject/year-group metadata, so those fields are not
invented or copied from a client. Neither pupil information nor plan/session IDs
are sent upstream. Complete content and answer keys remain transient server data.

The private table has forced RLS, no client policies or direct privileges, and
narrow authenticated definer RPCs with empty search paths. Session row locks
serialize mutation; shared locks hold the ownership chain stable through commit.
A unique session/source constraint permits only one version per source/session.
Same-version retries preserve the original metadata, tutor and timestamp; another
version requires removal first. Lists are ordered by selection time and ID.
Removal is idempotent and constrained to the authorized session.

List and remove do not contact Resource Studio, so withdrawn/unavailable
references remain visible and removable. Add always revalidates publication,
including retries; a withdrawn retry fails without changing the saved reference.
Publication can change after validation. These records are planning references,
not publication certificates or approval for learner delivery. As with existing
integration RPCs, the database cannot attest external publication: a direct
authenticated RPC caller can submit bounded metadata for their own session.
Future learner assignment must independently validate publication and content.

Validation uses synthetic mocked HTTP/authentication plus disposable in-memory
PGlite PostgreSQL tests of the migration, permissions, constraints, ownership,
idempotence and isolation from learner tables. No external integration or live
Supabase instance is used. Real Supabase JWT/PostgREST behavior, deployment
privileges, multi-connection lock contention/deadlocks and concurrent transaction
retries still require a disposable Supabase environment. No hosted migrations or
real student data should be used for those checks.
