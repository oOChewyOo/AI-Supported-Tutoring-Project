begin;
-- Provisioned only by a trusted administrator/service, never browser input.
create table public.learner_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  student_id uuid not null unique references public.students(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.learner_accounts enable row level security;
alter table public.learner_accounts force row level security;
revoke all on public.learner_accounts from public, anon, authenticated;
grant select on public.learner_accounts to authenticated;
grant all on public.learner_accounts to service_role;
create policy learner_reads_own_active_mapping on public.learner_accounts
for select to authenticated using (
  auth_user_id = (select auth.uid()) and active
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false'
);
-- No learner policy is added to tutor-owned tables. Learner practice will be
-- exposed through narrowly projected, identity-bound read functions.
commit;
