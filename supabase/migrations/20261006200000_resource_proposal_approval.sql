begin;
create table practice_loop_private.resource_approval_batches (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.weekly_plans(id) on delete restrict,
  session_id uuid not null references public.weekly_sessions(id) on delete restrict,
  approved_by uuid not null references public.tutors(id) on delete restrict,
  proposal_id uuid not null,
  rs_proposal_id uuid not null,
  objective_key text not null check (objective_key ~ '^(focus_for_next_week|developing_objectives|secure_objectives|suggested_retrieval_items):[0-9]+$'),
  item_count integer not null check (item_count between 1 and 20),
  approved_at timestamptz not null default clock_timestamp(),
  unique(session_id,proposal_id), unique(session_id,rs_proposal_id),
  unique(id,plan_id,session_id)
);
create table practice_loop_private.resource_session_assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  plan_id uuid not null,
  session_id uuid not null,
  reference_id uuid not null references practice_loop_private.resource_package_references(id) on delete restrict,
  position integer not null check(position between 1 and 20),
  purpose text not null check(purpose in ('retrieval','fluency','classification','sequencing','vocabulary','misconception_check','application','reasoning','reading_comprehension')),
  dose text not null check(length(dose) between 1 and 1000),
  estimated_minutes integer not null check(estimated_minutes between 1 and 30),
  status text not null default 'assigned' check(status = 'assigned'),
  foreign key(batch_id,plan_id,session_id) references practice_loop_private.resource_approval_batches(id,plan_id,session_id) on delete restrict,
  unique(batch_id,position), unique(batch_id,reference_id)
);
create index resource_approval_plan on practice_loop_private.resource_approval_batches(plan_id,approved_at);
create index resource_assignment_session on practice_loop_private.resource_session_assignments(session_id);
alter table practice_loop_private.resource_approval_batches enable row level security;
alter table practice_loop_private.resource_approval_batches force row level security;
alter table practice_loop_private.resource_session_assignments enable row level security;
alter table practice_loop_private.resource_session_assignments force row level security;
revoke all on practice_loop_private.resource_approval_batches,practice_loop_private.resource_session_assignments from public,anon,authenticated;
create trigger immutable_resource_approval before update or delete on practice_loop_private.resource_approval_batches
for each row execute function practice_loop_private.protect_resource_snapshot();
create trigger immutable_resource_assignment before update or delete on practice_loop_private.resource_session_assignments
for each row execute function practice_loop_private.protect_resource_snapshot();

create function practice_loop_private.assert_package_plan_owner(p_tutor uuid,p_plan uuid,p_session uuid default null)
returns void language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from practice_loop_private.resource_studio_settings where enabled) then
    raise exception 'Integration disabled' using errcode='55000'; end if;
  perform 1 from public.weekly_plans p
    join public.students s on s.id=p.student_id
    join public.lesson_reflections r on r.id=p.lesson_reflection_id and r.student_id=s.id
    join public.tutors t on t.id=s.owner_tutor_id and t.active
    where p.id=p_plan and t.id=p_tutor for update of p for share of s,r,t;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if p_session is not null then
    perform 1 from public.weekly_sessions where id=p_session and weekly_plan_id=p_plan for update;
    if not found then raise exception 'Access denied' using errcode='42501'; end if;
  end if;
end;
$$;
revoke all on function practice_loop_private.assert_package_plan_owner(uuid,uuid,uuid) from public,anon,authenticated;

-- Internal service result; server actions explicitly project normal tutor DTOs.
create function public.list_resource_package_assignments(p_tutor uuid,p_plan uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform practice_loop_private.assert_package_plan_owner(p_tutor,p_plan);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'batchId',b.id,'proposalId',b.proposal_id,'sessionId',a.session_id,'position',a.position,
    'activityType',r.activity_type,'purpose',a.purpose,'dose',a.dose,'estimatedMinutes',a.estimated_minutes,
    'status',a.status,'approvedAt',b.approved_at,'packageId',r.package_id,'integrity',r.integrity
  ) order by b.approved_at,b.id,a.position),'[]'::jsonb) into result
  from practice_loop_private.resource_session_assignments a
  join practice_loop_private.resource_approval_batches b on b.id=a.batch_id
  join practice_loop_private.resource_package_references r on r.id=a.reference_id
  where a.plan_id=p_plan;
  return result;
end;
$$;

-- All verified references and the entire approved set commit together. A failed
-- item rolls everything back; external RS packages can safely remain unassigned.
create function public.approve_resource_package_proposal(p_tutor uuid,p_plan uuid,p_session uuid,
  p_proposal uuid,p_rs_proposal uuid,p_objective text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare batch uuid; item jsonb; ref uuid; pos integer := 0; old practice_loop_private.resource_package_references;
begin
  perform practice_loop_private.assert_package_plan_owner(p_tutor,p_plan,p_session);
  select id into batch from practice_loop_private.resource_approval_batches
    where session_id=p_session and (proposal_id=p_proposal or rs_proposal_id=p_rs_proposal);
  if found then return public.list_resource_package_assignments(p_tutor,p_plan); end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'Invalid approval' using errcode='22023'; end if;
  insert into practice_loop_private.resource_approval_batches(plan_id,session_id,approved_by,proposal_id,rs_proposal_id,objective_key,item_count)
    values(p_plan,p_session,p_tutor,p_proposal,p_rs_proposal,p_objective,jsonb_array_length(p_items)) returning id into batch;
  for item in select value from jsonb_array_elements(p_items) loop
    pos := pos+1;
    if jsonb_typeof(item) <> 'object' or (select count(*) from jsonb_object_keys(item)) <> 13 or
      exists(select 1 from jsonb_object_keys(item) k where k not in ('proposalActivityId','packageId','activityId','contentVersion','activityType','integrity','releaseId','resourceVersion','purpose','dose','estimatedMinutes','scoringMode','schemaVersion')) or
      item->>'schemaVersion' is distinct from '1' or item->>'scoringMode' is distinct from
        (case item->>'activityType' when 'comprehension' then 'hybrid_review' when 'short_written_response' then 'manual_review' when 'explain_thinking' then 'manual_review' else 'automatic' end) then
      raise exception 'Invalid reference' using errcode='22023'; end if;
    select * into old from practice_loop_private.resource_package_references where plan_id=p_plan and package_id=(item->>'packageId')::uuid;
    if found then
      if old.prepared_by <> p_tutor or old.objective_key <> p_objective or old.proposal_id <> p_rs_proposal or
        old.proposal_activity_id <> item->>'proposalActivityId' or old.rs_activity_id <> item->>'activityId' or
        old.content_version <> (item->>'contentVersion')::int or old.activity_type <> item->>'activityType' or
        old.integrity <> item->>'integrity' or old.rs_release_id is distinct from item->>'releaseId' or
        old.rs_version is distinct from (item->>'resourceVersion')::int then
        raise exception 'Reference conflict' using errcode='22023'; end if;
      ref := old.id;
    else
      ref := public.prepare_resource_package_reference(p_tutor,p_plan,p_objective,p_rs_proposal,item->>'proposalActivityId',
        (item->>'packageId')::uuid,item->>'activityId',(item->>'contentVersion')::int,item->>'activityType',item->>'integrity',
        item->>'releaseId',(item->>'resourceVersion')::int);
    end if;
    insert into practice_loop_private.resource_session_assignments(batch_id,plan_id,session_id,reference_id,position,purpose,dose,estimated_minutes)
      values(batch,p_plan,p_session,ref,pos,item->>'purpose',item->>'dose',(item->>'estimatedMinutes')::int);
  end loop;
  return public.list_resource_package_assignments(p_tutor,p_plan);
end;
$$;
revoke all on function public.list_resource_package_assignments(uuid,uuid) from public,anon,authenticated;
revoke all on function public.approve_resource_package_proposal(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.list_resource_package_assignments(uuid,uuid) to service_role;
grant execute on function public.approve_resource_package_proposal(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;
commit;
