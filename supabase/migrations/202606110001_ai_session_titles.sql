-- Phase 3: allow the server-side no-auth MVP flow to save AI-generated session titles.

alter table public.weekly_sessions enable row level security;

drop policy if exists "Public can update weekly session titles during no-auth MVP" on public.weekly_sessions;
create policy "Public can update weekly session titles during no-auth MVP"
  on public.weekly_sessions for update
  to anon
  using (true)
  with check (true);
