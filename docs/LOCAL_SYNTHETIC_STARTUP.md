# Start the existing synthetic development environment

Verified 2026-10-08. Run in PowerShell. These commands reuse existing containers
and data; they never initialize, reset, seed or migrate a database.

```powershell
Set-Location 'C:\Users\chris\Documents\Codex\2026-06-09\i-want-to-build-an-mvp'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-synthetic.ps1 Stack
```

Then run each application in its own PowerShell terminal, from that same directory:

```powershell
# Terminal 1: canonical Practice Loop, http://127.0.0.1:3100
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-synthetic.ps1 PracticeLoop
```

```powershell
# Terminal 2: canonical Resource Studio, http://127.0.0.1:3101
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-synthetic.ps1 ResourceStudio
```

To stop, press Ctrl+C in both app terminals, then:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-synthetic.ps1 Stop
```

The stop action stops only the eight named synthetic containers, preserving them
and their volumes. It leaves Docker Desktop and unrelated containers running.
Docker Desktop may automatically resume other existing local containers when its
engine starts. Wait for synthetic container health before signing in.

## Verified infrastructure

- PL project directory: `C:\Users\chris\AppData\Local\PracticeLoopSyntheticCLI`.
- PL container project labels: `practice-loop-synthetic-cli`; their workdir label
  matches that directory. Database volume: `supabase_db_practice-loop-synthetic-cli`.
- PL API: `http://127.0.0.1:56321`; PostgreSQL: `127.0.0.1:56322`.
- RS container project: `resource-studio-synthetic-cli`; database volume:
  `supabase_db_resource-studio-synthetic-cli`; API/database ports 57321/57322.
- RS historical workdir: `C:\Users\chris\AppData\Local\Temp\resource-studio-synthetic-cli`.
  Its Supabase config file is currently absent. Existing containers and volume are
  intact, so startup uses Docker directly and does not recreate the project.
- Canonical RS source: `C:\Users\chris\OneDrive\Documents\Resource Studio`.

The launcher reads existing private runtime configuration and local CLI status
into process memory. It overrides PL's stale default port 54321 with 56321 and
supplies the local service credential required for approvals/results. RS uses its
existing synthetic runtime environment file. Neither canonical `.env.local` is
written. Credentials are not printed or embedded in this script or documentation.
Private runtime files and the installed CLI remain prerequisites; missing
containers/configuration require investigation, not initialization.

Recovery verification: original handoff plan ID still present; 1 tutor, 1 learner
account, 2 students, 4 plans, 20 sessions, 2 week approvals and 7 submissions.
Existing fictional tutor authentication and actual multipart PL sign-in both
passed; sign-in redirected to `/dashboard` with HTTP 200 and the authenticated
dashboard remained accessible. RS homepage returned HTTP 200; integration
credentials matched in memory. No planning/generation/submission was performed.
Authentication checks naturally update auth/session bookkeeping, but no reset,
reseed, migration or educational-data mutation was performed.
