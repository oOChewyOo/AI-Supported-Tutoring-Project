-- Phase 4A: prepare activities to store structured generated content.
-- Existing placeholder activities remain valid because both fields are nullable.

alter table public.activities
  add column if not exists template_id text,
  add column if not exists content_json jsonb;
