-- First real feature: persistent student records.

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
