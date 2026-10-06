begin;
-- Prepared references are NOT assignments and do not attach to activity slots.
create table practice_loop_private.resource_package_references (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.weekly_plans(id) on delete restrict,
  prepared_by uuid not null references public.tutors(id) on delete restrict,
  objective_key text not null check (objective_key ~ '^(focus_for_next_week|developing_objectives|secure_objectives|suggested_retrieval_items):[0-9]+$'),
  proposal_id uuid not null,
  proposal_activity_id text not null check (length(proposal_activity_id) between 1 and 500),
  package_id uuid not null,
  rs_activity_id text not null check (length(rs_activity_id) between 1 and 500 and rs_activity_id ~ '^[a-zA-Z0-9_-]+$'),
  rs_release_id text,
  rs_version integer check (rs_version > 0),
  check ((rs_release_id is null) = (rs_version is null)),
  content_version integer not null check (content_version = 1),
  activity_type text not null check (activity_type in ('multiple_choice','arithmetic_input','category_sort',
    'drag_drop_matching','order_steps','sentence_builder','fill_gap','spot_mistake',
    'short_written_response','explain_thinking','comprehension')),
  integrity text not null check (integrity ~ '^[a-f0-9]{64}$'),
  status text not null default 'prepared' check (status = 'prepared'),
  prepared_at timestamptz not null default now(),
  unique (plan_id, package_id)
);
create index resource_package_references_owner on practice_loop_private.resource_package_references(prepared_by);
alter table practice_loop_private.resource_package_references enable row level security;
alter table practice_loop_private.resource_package_references force row level security;
revoke all on practice_loop_private.resource_package_references from public, anon, authenticated;
create trigger immutable_resource_package_reference before update or delete on practice_loop_private.resource_package_references
for each row execute function practice_loop_private.protect_resource_snapshot();

-- Server-only insertion. No normal tutor RPC/action can manufacture a verified
-- reference. The next approval checkpoint must retrieve and verify it from RS.
create function public.prepare_resource_package_reference(p_tutor_id uuid, p_plan_id uuid,
  p_objective_key text, p_proposal_id uuid, p_proposal_activity_id text,
  p_package_id uuid, p_rs_activity_id text, p_content_version integer, p_activity_type text, p_integrity text,
  p_rs_release_id text default null, p_rs_version integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform 1 from public.weekly_plans p
    join public.students s on s.id = p.student_id
    join public.lesson_reflections r on r.id = p.lesson_reflection_id and r.student_id = s.id
    join public.tutors t on t.id = s.owner_tutor_id and t.active
    where p.id = p_plan_id and t.id = p_tutor_id for share of p, s, r, t;
  if not found then raise exception 'Plan not found or access denied' using errcode = '42501'; end if;
  insert into practice_loop_private.resource_package_references(plan_id, prepared_by, objective_key,
    proposal_id, proposal_activity_id, package_id, rs_activity_id, content_version, activity_type, integrity, rs_release_id, rs_version)
  values (p_plan_id, p_tutor_id, p_objective_key, p_proposal_id, p_proposal_activity_id,
    p_package_id, p_rs_activity_id, p_content_version, p_activity_type, p_integrity, p_rs_release_id, p_rs_version)
  returning id into result;
  return result;
end;
$$;
revoke all on function public.prepare_resource_package_reference(uuid, uuid, text, uuid, text, uuid, text, integer, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.prepare_resource_package_reference(uuid, uuid, text, uuid, text, uuid, text, integer, text, text, text, integer) to service_role;
commit;
