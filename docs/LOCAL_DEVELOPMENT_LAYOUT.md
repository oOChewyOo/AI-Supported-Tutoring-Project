# Local development layout

Verified directory inventory: 2026-09-29. No services were inspected or started
for this documentation checkpoint; paths are not a live health report.

**Only the two canonical Git repositories are editable product source.**

| Application | Canonical Git repository |
| --- | --- |
| Practice Loop | `C:\Users\chris\Documents\Codex\2026-06-09\i-want-to-build-an-mvp` |
| Resource Studio | `C:\Users\chris\OneDrive\Documents\Resource Studio` |

Different canonical folders are intentional: these are separate applications,
repositories, histories and responsibilities. A task in one does not authorize
changes in the other. Explicitly scoped Git worktrees for concurrent work must
remain traceable to the appropriate canonical repository.

## Runtime and recovery material: never product source

| Known location | Purpose |
| --- | --- |
| `%LOCALAPPDATA%\PracticeLoopSyntheticCLI\` | Isolated Practice Loop official-CLI database/runtime infrastructure. |
| `%LOCALAPPDATA%\PracticeLoopSyntheticCLI\app\` | Exported committed-source Practice Loop app, typically port 3100. |
| `%LOCALAPPDATA%\Temp\resource-studio-synthetic-cli\` | Separate isolated Resource Studio environment. |
| `%LOCALAPPDATA%\Temp\resource-studio-synthetic-cli\app\` | Exported Resource Studio runtime, typically port 3101. |
| `%LOCALAPPDATA%\PracticeLoopSyntheticLab3B\` | Older superseded custom-lab remnants; not authoritative. |
| `%LOCALAPPDATA%\PracticeLoopTooling\` | Local CLI tooling, not application source. |
| `%LOCALAPPDATA%\PracticeLoopWorktreeArchive\` | Private recovery snapshots; not source or a migration history. |

Temporary browser-test directories, old `app-before-*` copies, exported archives,
and Docker/Supabase lab directories are runtime/testing infrastructure only.
Never implement a product fix there or copy an unreviewed runtime edit back into
source. Fix the canonical repository in scope, commit it, then rebuild an
explicitly requested runtime from a verified commit.

Runtime copies can be rebuilt or retired independently of product source.
That is not blanket permission to delete database volumes, recovery archives,
or in-use environments: check ownership, active use and retention first.
Do not run old lab reset/start scripts as an assumed setup procedure. Reuse only
the explicitly identified isolated environment, with synthetic data.

Runtime launch/configuration/sign-in files may contain credentials. Do not
inspect or reproduce their contents for documentation work. No credentials or
ephemeral account details belong in repository docs. Historical verification
and limitations are in [the handoff](AI_DEVELOPMENT_HANDOFF.md); detailed test
procedures remain in the existing integration guides.
