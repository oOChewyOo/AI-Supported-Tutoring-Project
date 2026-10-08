# Mixed English and phonics checkpoint — 2026-10-08

Started clean at `067eef4b3fe2b2c918ceac6036d559e0f75d96fe` on
`codex/tutor-auth-ownership`. Scope is the canonical PL and RS repositories;
no hosted changes, migration, reset/reseed, Twinkl/Math Salamanders retrieval or push.

PL still owns reflection/objectives, five-session sequencing, tutor review and
atomic approval. Its existing five-field educational request remains unchanged:
subject, year, objective, durationMinutes and intents. No name, raw reflection,
profile, source choice or activity-type choice is added.

The planner now recognises inflected inference words and textual-clue objectives.
Reading interpretation retains reading_comprehension + reasoning instead of
falling through to fluency. Spelling uses retrieval/vocabulary or application
according to the objective and repeated exposure. Existing allocation rules and
privacy/ownership checks remain in place. RS normalizes mixed English labels and
owns bounded Oak discovery, source selection, generation and learner-safe packages.

The synthetic launcher now imports only RS database/integration/demo overrides
from the historical private runtime file. It no longer overrides canonical real
generation settings with the old mock provider. See [startup](LOCAL_SYNTHETIC_STARTUP.md).

## Live normal-workflow proof

Existing Fictional Student — Local Lab; new fictional reflection on 2026-10-08;
AI objective extraction; five reviewed focus objectives from the task; subject
English and phonics / Year 6. Stored legacy student profile was not changed.
Plan: `2db5176e-c231-4fba-a131-abe0ee36d9fc`.

| Session | Activities | Minutes |
| --- | --- | --- |
| 1 | Sentence Builder (competition), five spelling MCQs | 9 |
| 2 | Inference comprehension, 115-word passage, four questions | 9 |
| 3 | Five spelling MCQs, five root/noun matches | 10 |
| 4 | Simple-inference comprehension, 109-word passage, four questions | 9 |
| 5 | Evidence-use comprehension, 163-word passage, four questions | 9 |

Total: seven activities, 46 activity minutes, 65-minute preparation budget across
five 15-minute sessions. No source/type selection or downloads. All tutor previews
opened. Normal Approve & send week succeeded and showed all five sessions assigned.
RS private audit confirms four Oak-grounded spelling packages and three original
reading packages. Bounded live Oak inspection did not find a cleared standalone
Year 6 reading passage; the permitted original fallback supplied complete texts.
Quiz evidence/answers and provenance remain private in RS.

This was not a clean first-pass proof. Initial runs exposed historical mock
configuration and RS validation/generation issues. Ordinary rebuild controls
retained successful siblings. The final build needed one Session 5 retry for an
underlength passage; validation was not weakened. Generated language still needs
tutor review. Existing legacy session titles are unchanged, even where the new
weekly allocation has a different focus; approved activity details are authoritative.

Tests: 302 passing; focused planner 9 passing; typecheck, lint and production build
passed. The generated next-env path change was restored. Final learner proof and
checkpoint status are recorded below.

Detailed Oak endpoint audit and RS changes: `docs/OAK_MIXED_ENGLISH_CHECKPOINT.md`
in the canonical Resource Studio repository named in [local layout](LOCAL_DEVELOPMENT_LAYOUT.md).

## Final verification and limitation

RS full suite passed 1,254 tests in 75 files; both repos passed typecheck, lint and
production builds. RS's final compatible multiline safety fix passed another 30
focused checks. The existing unrelated RS .env.example was not inspected/staged.
Checkpoint secret-pattern scans and local documentation links pass.

The approved week survives the RS restart. The existing active learner mapping
for the fictional student was verified after explicit user authorization. No
recoverable learner password was found in the checked private synthetic setup;
the browser sign-in reached the tutor account. No new account, credential reset,
admin impersonation or alternative login was used. Actual learner opening of this
new week remains unverified. Automated learner access/projection tests are green,
but this is an outstanding live-proof step, not a completed end-to-end claim.
