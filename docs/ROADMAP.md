# Practice Loop current roadmap

Current direction: 2026-09-29. This describes planned work, not implemented
capabilities; see [the factual handoff](AI_DEVELOPMENT_HANDOFF.md).

2026-10-06 checkpoint: one structured PL learning need now invokes automatic RS
orchestration and returns a complete tutor-review proposal with all-type RS
previews. This does not sequence the five-session week or assign activities.
Next: tutor approval, durable source provenance/attribution and immutable
all-type learner delivery, then completion/scoring/progress. The historical order
below predates RS orchestration; do not reimplement its content engine in PL.

> Practice Loop proposes the week; the tutor reviews it.

## Shared target

With fictional data: lesson reflection / approved objectives -> Practice Loop
automatically constructs a proposed weekly practice programme -> automatically
searches Resource Studio -> Resource Studio supplies existing activities or,
once implemented, creates/adapts missing content -> tutor reviews, edits,
replaces, moves or removes -> tutor approves -> immutable learner assignments ->
fictional learner completes activities -> useful question-level and progress
evidence for the tutor.

Practice Loop owns planning, review/approval, assignment and learner evidence.
Resource Studio owns activity content and publication. Manual search is a
replacement/correction/browsing/fallback tool, not the default planning workflow.

## Short-term order

1. Unify the Practice Loop weekly-plan UI around actual planned session resources.
2. Reduce rigid three-activities-per-session assumptions, after reviewing stored
   data, progress calculations, assignment consumers and tests.
3. Implement the first automatic Practice Loop planner using existing published
   Resource Studio library content. Missing content should be an explicit gap;
   this step does not assume a generation service exists.
4. Add tutor review, replacement, move, removal and approval.
5. Convert approved planned resources through the immutable assignment pathway,
   independently validating the exact published resource/version.
6. Verify completion, server scoring and reporting end-to-end with a fictional
   learner. Browser submission acknowledgement remains part of that work.

## Medium term

7. Extend the external contract beyond MCQ across Resource Studio activity types.
8. Build Oak OpenAPI ingestion in Resource Studio.
9. Build authorised Twinkl ingestion within contractual and technical limits.
10. Build Resource Studio AI generation/adaptation for content gaps, with schema
    validation, provenance and reviewed publication.
11. Add targeted AI editing without silently changing unrelated activity content.
12. Improve adaptive/spaced retrieval from learner performance; Practice Loop
    chooses practice and Resource Studio supplies reusable activities.

## Long term

Pupil accounts/access; production privacy/security; organisations/tutor accounts;
monitoring/backups; deployment; accessibility; licensing lifecycle; admin/support
tooling; commercial operations. These do not imply present production readiness.

The discarded direct Practice Loop activity generator must not be revived; use
[the generation handoff](resource-studio-generation-handoff.md) for reusable lessons.
