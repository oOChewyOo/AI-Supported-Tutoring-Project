-- Phase 2: AI-extracted learning objectives.

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
