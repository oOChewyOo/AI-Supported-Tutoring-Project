-- Smallest lesson-reflection feature linked to students.

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
