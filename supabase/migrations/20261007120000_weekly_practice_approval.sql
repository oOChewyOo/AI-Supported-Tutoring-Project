begin;
create table practice_loop_private.weekly_practice_approvals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references public.weekly_plans(id) on delete restrict,
  proposal_id uuid not null unique,
  approved_by uuid not null references public.tutors(id) on delete restrict,
  objective_id uuid not null references public.extracted_objectives(id) on delete restrict,
  objective_updated_at timestamptz not null,
  approved_at timestamptz not null default clock_timestamp()
);
create table practice_loop_private.weekly_practice_batches (
  week_id uuid not null references practice_loop_private.weekly_practice_approvals(id) on delete restrict,
  batch_id uuid not null unique references practice_loop_private.resource_approval_batches(id) on delete restrict,
  primary key(week_id,batch_id)
);
alter table practice_loop_private.weekly_practice_approvals enable row level security;
alter table practice_loop_private.weekly_practice_approvals force row level security;
alter table practice_loop_private.weekly_practice_batches enable row level security;
alter table practice_loop_private.weekly_practice_batches force row level security;
revoke all on practice_loop_private.weekly_practice_approvals,practice_loop_private.weekly_practice_batches from public,anon,authenticated;
create trigger immutable_weekly_approval before update or delete on practice_loop_private.weekly_practice_approvals
for each row execute function practice_loop_private.protect_resource_snapshot();
create trigger immutable_weekly_batches before update or delete on practice_loop_private.weekly_practice_batches
for each row execute function practice_loop_private.protect_resource_snapshot();

-- Also block the old fallback path from appending to a sent week. The plan lock
-- is shared by both approval paths, so concurrent fallback/weekly sends serialize.
create function practice_loop_private.guard_sent_week() returns trigger language plpgsql set search_path='' as $$
begin
  perform 1 from public.weekly_plans where id=new.plan_id for update;
  if exists(select 1 from practice_loop_private.weekly_practice_approvals where plan_id=new.plan_id) then
    raise exception 'Week already sent' using errcode='23505';
  end if;
  return new;
end;
$$;
revoke all on function practice_loop_private.guard_sent_week() from public,anon,authenticated;
create trigger guard_sent_week before insert on practice_loop_private.resource_approval_batches
for each row execute function practice_loop_private.guard_sent_week();

create function public.get_weekly_practice_approval(p_tutor uuid,p_plan uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform practice_loop_private.assert_package_plan_owner(p_tutor,p_plan);
  select jsonb_build_object('proposalId',proposal_id,'approvedAt',approved_at) into result
    from practice_loop_private.weekly_practice_approvals where plan_id=p_plan;
  return result;
end;
$$;

create function public.approve_weekly_practice(p_tutor uuid,p_plan uuid,p_proposal uuid,
  p_objective_id uuid,p_objective_updated_at timestamptz,p_groups jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing uuid; week_id uuid; g jsonb; group_ids uuid[] := '{}'; objective_row public.extracted_objectives; objective_group text; objective_index integer;
begin
  perform practice_loop_private.assert_package_plan_owner(p_tutor,p_plan);
  select proposal_id into existing from practice_loop_private.weekly_practice_approvals where plan_id=p_plan;
  if found then
    if existing=p_proposal then return public.list_resource_package_assignments(p_tutor,p_plan); end if;
    raise exception 'Week already assigned' using errcode='23505';
  end if;
  if exists(select 1 from practice_loop_private.resource_approval_batches where plan_id=p_plan) then
    raise exception 'Existing assigned practice' using errcode='23505';
  end if;
  select o.* into objective_row from public.extracted_objectives o join public.weekly_plans p
    on o.lesson_reflection_id=p.lesson_reflection_id and o.student_id=p.student_id
    where p.id=p_plan and o.id=p_objective_id and o.updated_at=p_objective_updated_at for share of o;
  if not found then raise exception 'Objectives changed' using errcode='22023'; end if;
  -- MVP plans one educational need per existing session; RS may fulfil it with
  -- multiple activities. Check the complete mapping before inserting any batch.
  if jsonb_typeof(p_groups) is distinct from 'array' or jsonb_array_length(p_groups)<>5 or
    (select count(distinct value->>'sessionId') from jsonb_array_elements(p_groups))<>5 or
    (select count(*) from public.weekly_sessions where weekly_plan_id=p_plan)<>5 then
    raise exception 'Invalid weekly mapping' using errcode='22023';
  end if;
  for g in select value from jsonb_array_elements(p_groups) loop
    perform 1 from public.weekly_sessions where id=(g->>'sessionId')::uuid and weekly_plan_id=p_plan for update;
    if not found then raise exception 'Invalid session' using errcode='42501'; end if;
    if jsonb_typeof(g->'items') is distinct from 'array' or jsonb_array_length(g->'items') not between 1 and 20 or
      (select sum((value->>'estimatedMinutes')::int) from jsonb_array_elements(g->'items')) >
        (select duration_minutes-2 from public.weekly_sessions where id=(g->>'sessionId')::uuid) then
      raise exception 'Invalid duration or empty practice' using errcode='22023';
    end if;
    if (g->>'objectiveKey') is null or (g->>'objectiveKey') !~ '^(focus_for_next_week|developing_objectives|secure_objectives|suggested_retrieval_items):[0-9]+$' then
      raise exception 'Invalid objective' using errcode='22023'; end if;
    objective_group := split_part(g->>'objectiveKey',':',1); objective_index := split_part(g->>'objectiveKey',':',2)::int;
    if coalesce(to_jsonb(objective_row)->objective_group->>objective_index,'')='' then
      raise exception 'Unknown objective' using errcode='22023'; end if;
    perform public.approve_resource_package_proposal(p_tutor,p_plan,(g->>'sessionId')::uuid,
      (g->>'proposalId')::uuid,(g->>'rsProposalId')::uuid,g->>'objectiveKey',g->'items');
    group_ids := array_append(group_ids,(select id from practice_loop_private.resource_approval_batches
      where plan_id=p_plan and session_id=(g->>'sessionId')::uuid and proposal_id=(g->>'proposalId')::uuid));
  end loop;
  insert into practice_loop_private.weekly_practice_approvals(plan_id,proposal_id,approved_by,objective_id,objective_updated_at)
    values(p_plan,p_proposal,p_tutor,p_objective_id,p_objective_updated_at) returning id into week_id;
  insert into practice_loop_private.weekly_practice_batches(week_id,batch_id) select week_id,unnest(group_ids);
  return public.list_resource_package_assignments(p_tutor,p_plan);
end;
$$;
revoke all on function public.get_weekly_practice_approval(uuid,uuid) from public,anon,authenticated;
revoke all on function public.approve_weekly_practice(uuid,uuid,uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.get_weekly_practice_approval(uuid,uuid) to service_role;
grant execute on function public.approve_weekly_practice(uuid,uuid,uuid,uuid,timestamptz,jsonb) to service_role;
commit;
