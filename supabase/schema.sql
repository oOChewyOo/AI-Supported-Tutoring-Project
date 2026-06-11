-- Complete non-AI Practice Loop MVP schema.
-- Run this in the Supabase SQL editor for a new project.

create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  year_group text not null check (char_length(trim(year_group)) > 0),
  subject_focus text not null check (char_length(trim(subject_focus)) > 0),
  interests text[] not null default '{}',
  strengths text[] not null default '{}',
  needs_practice text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.students enable row level security;

drop policy if exists "Public can read students during no-auth MVP" on public.students;
create policy "Public can read students during no-auth MVP"
  on public.students for select
  to anon
  using (true);

drop policy if exists "Public can create students during no-auth MVP" on public.students;
create policy "Public can create students during no-auth MVP"
  on public.students for insert
  to anon
  with check (true);

create table if not exists public.lesson_reflections (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  reflection_date date not null,
  what_we_covered text not null check (char_length(trim(what_we_covered)) > 0),
  what_went_well text not null check (char_length(trim(what_went_well)) > 0),
  what_needs_practice text not null check (char_length(trim(what_needs_practice)) > 0),
  notes_for_next_time text,
  created_at timestamptz not null default now()
);

create index if not exists lesson_reflections_student_date_idx
  on public.lesson_reflections(student_id, reflection_date desc, created_at desc);

alter table public.lesson_reflections enable row level security;

drop policy if exists "Public can read lesson reflections during no-auth MVP" on public.lesson_reflections;
create policy "Public can read lesson reflections during no-auth MVP"
  on public.lesson_reflections for select
  to anon
  using (true);

drop policy if exists "Public can create lesson reflections during no-auth MVP" on public.lesson_reflections;
create policy "Public can create lesson reflections during no-auth MVP"
  on public.lesson_reflections for insert
  to anon
  with check (true);

create table if not exists public.extracted_objectives (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_reflection_id uuid not null references public.lesson_reflections(id) on delete cascade,
  secure_objectives text[] not null default '{}',
  developing_objectives text[] not null default '{}',
  focus_for_next_week text[] not null default '{}',
  possible_misconceptions text[] not null default '{}',
  suggested_retrieval_items text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_reflection_id)
);

create index if not exists extracted_objectives_student_idx
  on public.extracted_objectives(student_id, updated_at desc);

alter table public.extracted_objectives enable row level security;

drop policy if exists "Public can read extracted objectives during no-auth MVP" on public.extracted_objectives;
create policy "Public can read extracted objectives during no-auth MVP"
  on public.extracted_objectives for select to anon using (true);
drop policy if exists "Public can create extracted objectives during no-auth MVP" on public.extracted_objectives;
create policy "Public can create extracted objectives during no-auth MVP"
  on public.extracted_objectives for insert to anon with check (true);
drop policy if exists "Public can update extracted objectives during no-auth MVP" on public.extracted_objectives;
create policy "Public can update extracted objectives during no-auth MVP"
  on public.extracted_objectives for update to anon using (true) with check (true);

create table if not exists public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_reflection_id uuid not null references public.lesson_reflections(id) on delete cascade,
  title text not null,
  focus text not null,
  created_at timestamptz not null default now(),
  unique (lesson_reflection_id)
);

create table if not exists public.weekly_sessions (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  session_number smallint not null check (session_number between 1 and 5),
  title text not null,
  duration_minutes smallint not null default 15 check (duration_minutes > 0),
  created_at timestamptz not null default now(),
  unique (weekly_plan_id, session_number)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  weekly_session_id uuid not null references public.weekly_sessions(id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  title text not null,
  description text not null,
  activity_type text not null,
  minutes smallint not null default 5 check (minutes > 0),
  created_at timestamptz not null default now(),
  unique (weekly_session_id, position)
);

create table if not exists public.activity_results (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (activity_id, student_id)
);

create index if not exists weekly_plans_student_idx on public.weekly_plans(student_id, created_at desc);
create index if not exists weekly_sessions_plan_idx on public.weekly_sessions(weekly_plan_id, session_number);
create index if not exists activities_session_idx on public.activities(weekly_session_id, position);
create index if not exists activity_results_student_idx on public.activity_results(student_id, completed);

alter table public.weekly_plans enable row level security;
alter table public.weekly_sessions enable row level security;
alter table public.activities enable row level security;
alter table public.activity_results enable row level security;

drop policy if exists "Public can read weekly plans during no-auth MVP" on public.weekly_plans;
create policy "Public can read weekly plans during no-auth MVP" on public.weekly_plans for select to anon using (true);
drop policy if exists "Public can create weekly plans during no-auth MVP" on public.weekly_plans;
create policy "Public can create weekly plans during no-auth MVP" on public.weekly_plans for insert to anon with check (true);

drop policy if exists "Public can read weekly sessions during no-auth MVP" on public.weekly_sessions;
create policy "Public can read weekly sessions during no-auth MVP" on public.weekly_sessions for select to anon using (true);
drop policy if exists "Public can create weekly sessions during no-auth MVP" on public.weekly_sessions;
create policy "Public can create weekly sessions during no-auth MVP" on public.weekly_sessions for insert to anon with check (true);
drop policy if exists "Public can update weekly session titles during no-auth MVP" on public.weekly_sessions;
create policy "Public can update weekly session titles during no-auth MVP" on public.weekly_sessions for update to anon using (true) with check (true);

drop policy if exists "Public can read activities during no-auth MVP" on public.activities;
create policy "Public can read activities during no-auth MVP" on public.activities for select to anon using (true);
drop policy if exists "Public can create activities during no-auth MVP" on public.activities;
create policy "Public can create activities during no-auth MVP" on public.activities for insert to anon with check (true);

drop policy if exists "Public can read activity results during no-auth MVP" on public.activity_results;
create policy "Public can read activity results during no-auth MVP" on public.activity_results for select to anon using (true);
drop policy if exists "Public can create activity results during no-auth MVP" on public.activity_results;
create policy "Public can create activity results during no-auth MVP" on public.activity_results for insert to anon with check (true);
drop policy if exists "Public can update activity results during no-auth MVP" on public.activity_results;
create policy "Public can update activity results during no-auth MVP" on public.activity_results for update to anon using (true) with check (true);

create or replace function public.generate_placeholder_weekly_plan(p_reflection_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_focus text;
  v_plan_id uuid;
  v_session_id uuid;
  v_titles text[] := array[
    'Start of week practice',
    'Build confidence',
    'Mixed retrieval',
    'Independent practice',
    'Review and check'
  ];
  i integer;
begin
  select student_id, what_needs_practice
    into v_student_id, v_focus
  from public.lesson_reflections
  where id = p_reflection_id;

  if v_student_id is null then
    raise exception 'Lesson reflection not found';
  end if;

  select id into v_plan_id
  from public.weekly_plans
  where lesson_reflection_id = p_reflection_id;

  if v_plan_id is not null then
    return v_plan_id;
  end if;

  insert into public.weekly_plans (student_id, lesson_reflection_id, title, focus)
  values (v_student_id, p_reflection_id, 'Five-day practice plan', v_focus)
  returning id into v_plan_id;

  for i in 1..5 loop
    insert into public.weekly_sessions (weekly_plan_id, session_number, title, duration_minutes)
    values (v_plan_id, i, v_titles[i], 15)
    returning id into v_session_id;

    insert into public.activities (weekly_session_id, position, title, description, activity_type, minutes)
    values
      (v_session_id, 1, 'Literacy or topic practice', 'Practise the lesson topic with a short focused task about: ' || v_focus, 'Topic practice', 5),
      (v_session_id, 2, 'Fluency and retrieval practice', 'Recall key ideas and build confidence through quick retrieval.', 'Retrieval practice', 5),
      (v_session_id, 3, 'Short challenge or reflection', 'Complete a short challenge, then reflect on what feels easier now.', 'Challenge and reflection', 5);
  end loop;

  return v_plan_id;
end;
$$;

revoke all on function public.generate_placeholder_weekly_plan(uuid) from public;
grant execute on function public.generate_placeholder_weekly_plan(uuid) to anon;

-- Replace these public policies with tutor-owned policies when authentication is added.
