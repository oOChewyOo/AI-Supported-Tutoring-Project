-- Security cutover. Review docs/tutor-auth-security.md before applying manually.
-- Run after EVERY earlier migration, in a maintenance window. Never rerun old migrations afterwards.
-- Existing students intentionally keep NULL ownership; there is no automatic data adoption.
begin;

create table public.tutors (
  id uuid primary key references auth.users(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.tutors enable row level security;
alter table public.tutors force row level security;
revoke all on public.tutors from public, anon, authenticated;
grant select on public.tutors to authenticated;
create policy tutor_can_read_own_membership on public.tutors
  for select to authenticated using (
    id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'), 'false') = 'false'
  );

-- Invoker function: membership itself is RLS-protected; no elevated database access.
create or replace function public.is_active_tutor()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt()->>'is_anonymous'), 'false') = 'false'
    and exists (select 1 from public.tutors where id = (select auth.uid()) and active);
$$;
revoke all on function public.is_active_tutor() from public, anon;
grant execute on function public.is_active_tutor() to authenticated;

-- Add without a default first: old rows MUST NOT inherit the migration operator's identity.
alter table public.students add column owner_tutor_id uuid references public.tutors(id) on delete restrict;
alter table public.students alter column owner_tutor_id set default auth.uid();
create index students_owner_tutor_idx on public.students(owner_tutor_id);

-- Permissive policies are ORed together. Remove ALL prior policies on the seven
-- learner tables, including the later title/content UPDATE policies and local drift.
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('students', 'lesson_reflections', 'extracted_objectives', 'weekly_plans', 'weekly_sessions', 'activities', 'activity_results')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

alter table public.students enable row level security;
alter table public.students force row level security;
revoke all on public.students from public, anon, authenticated;
grant select, insert, update, delete on public.students to authenticated;
create policy tutor_owns_students on public.students
  for all to authenticated
  using ((select public.is_active_tutor()) and owner_tutor_id = (select auth.uid()))
  with check ((select public.is_active_tutor()) and owner_tutor_id = (select auth.uid()));

alter table public.lesson_reflections enable row level security;
alter table public.lesson_reflections force row level security;
revoke all on public.lesson_reflections from public, anon, authenticated;
grant select, insert, update, delete on public.lesson_reflections to authenticated;
create policy tutor_owns_lesson_reflections on public.lesson_reflections
  for all to authenticated
  using ((select public.is_active_tutor()) and exists (select 1 from public.students s where s.id = student_id and s.owner_tutor_id = (select auth.uid())))
  with check ((select public.is_active_tutor()) and exists (select 1 from public.students s where s.id = student_id and s.owner_tutor_id = (select auth.uid())));

alter table public.extracted_objectives enable row level security;
alter table public.extracted_objectives force row level security;
revoke all on public.extracted_objectives from public, anon, authenticated;
grant select, insert, update, delete on public.extracted_objectives to authenticated;
create policy tutor_owns_extracted_objectives on public.extracted_objectives
  for all to authenticated
  using ((select public.is_active_tutor()) and exists (select 1 from public.lesson_reflections r join public.students s on s.id = r.student_id where r.id = extracted_objectives.lesson_reflection_id and r.student_id = extracted_objectives.student_id and s.owner_tutor_id = (select auth.uid())))
  with check ((select public.is_active_tutor()) and exists (select 1 from public.lesson_reflections r join public.students s on s.id = r.student_id where r.id = extracted_objectives.lesson_reflection_id and r.student_id = extracted_objectives.student_id and s.owner_tutor_id = (select auth.uid())));

alter table public.weekly_plans enable row level security;
alter table public.weekly_plans force row level security;
revoke all on public.weekly_plans from public, anon, authenticated;
grant select, insert, update, delete on public.weekly_plans to authenticated;
create policy tutor_owns_weekly_plans on public.weekly_plans
  for all to authenticated
  using ((select public.is_active_tutor()) and exists (select 1 from public.lesson_reflections r join public.students s on s.id = r.student_id where r.id = weekly_plans.lesson_reflection_id and r.student_id = weekly_plans.student_id and s.owner_tutor_id = (select auth.uid())))
  with check ((select public.is_active_tutor()) and exists (select 1 from public.lesson_reflections r join public.students s on s.id = r.student_id where r.id = weekly_plans.lesson_reflection_id and r.student_id = weekly_plans.student_id and s.owner_tutor_id = (select auth.uid())));

alter table public.weekly_sessions enable row level security;
alter table public.weekly_sessions force row level security;
revoke all on public.weekly_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.weekly_sessions to authenticated;
create policy tutor_owns_weekly_sessions on public.weekly_sessions
  for all to authenticated
  using ((select public.is_active_tutor()) and exists (select 1 from public.weekly_plans p where p.id = weekly_sessions.weekly_plan_id))
  with check ((select public.is_active_tutor()) and exists (select 1 from public.weekly_plans p where p.id = weekly_sessions.weekly_plan_id));

alter table public.activities enable row level security;
alter table public.activities force row level security;
revoke all on public.activities from public, anon, authenticated;
grant select, insert, update, delete on public.activities to authenticated;
create policy tutor_owns_activities on public.activities
  for all to authenticated
  using ((select public.is_active_tutor()) and exists (select 1 from public.weekly_sessions s where s.id = activities.weekly_session_id))
  with check ((select public.is_active_tutor()) and exists (select 1 from public.weekly_sessions s where s.id = activities.weekly_session_id));

alter table public.activity_results enable row level security;
alter table public.activity_results force row level security;
revoke all on public.activity_results from public, anon, authenticated;
grant select, insert, update, delete on public.activity_results to authenticated;
create policy tutor_owns_activity_results on public.activity_results
  for all to authenticated
  using ((select public.is_active_tutor()) and exists (select 1 from public.activities a join public.weekly_sessions s on s.id = a.weekly_session_id join public.weekly_plans p on p.id = s.weekly_plan_id where a.id = activity_results.activity_id and p.student_id = activity_results.student_id))
  with check ((select public.is_active_tutor()) and exists (select 1 from public.activities a join public.weekly_sessions s on s.id = a.weekly_session_id join public.weekly_plans p on p.id = s.weekly_plan_id where a.id = activity_results.activity_id and p.student_id = activity_results.student_id));

create or replace function public.generate_placeholder_weekly_plan(p_reflection_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_focus text;
  v_plan_id uuid;
  v_session_id uuid;
  v_titles text[] := array['Start of week practice', 'Build confidence', 'Mixed retrieval', 'Independent practice', 'Review and check'];
  i integer;
begin
  if not public.is_active_tutor() then
    raise exception 'Tutor authentication required' using errcode = '42501';
  end if;
  -- Lock the owned reflection so concurrent calls create only one complete plan.
  -- Invoker RLS applies before the lookup and before returning an existing plan ID.
  select student_id, what_needs_practice into v_student_id, v_focus
  from public.lesson_reflections where id = p_reflection_id for update;
  if v_student_id is null then raise exception 'Lesson reflection not found or access denied' using errcode = '42501'; end if;

  select id into v_plan_id from public.weekly_plans where lesson_reflection_id = p_reflection_id;
  if v_plan_id is not null then return v_plan_id; end if;

  insert into public.weekly_plans (student_id, lesson_reflection_id, title, focus)
  values (v_student_id, p_reflection_id, 'Five-day practice plan', v_focus)
  returning id into v_plan_id;

  for i in 1..5 loop
    insert into public.weekly_sessions (weekly_plan_id, session_number, title, duration_minutes)
    values (v_plan_id, i, v_titles[i], 15) returning id into v_session_id;
    insert into public.activities (weekly_session_id, position, title, description, activity_type, minutes)
    values
      (v_session_id, 1, 'Literacy or topic practice', 'Practise the lesson topic with a short focused task about: ' || v_focus, 'Topic practice', 5),
      (v_session_id, 2, 'Fluency and retrieval practice', 'Recall key ideas and build confidence through quick retrieval.', 'Retrieval practice', 5),
      (v_session_id, 3, 'Short challenge or reflection', 'Complete a short challenge, then reflect on what feels easier now.', 'Challenge and reflection', 5);
  end loop;
  return v_plan_id;
end;
$$;

revoke all on function public.generate_placeholder_weekly_plan(uuid) from public, anon;
grant execute on function public.generate_placeholder_weekly_plan(uuid) to authenticated;

commit;
