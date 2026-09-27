-- Additive, LOCAL development only. Reuses the disabled-by-default integration
-- setting. These are planning references, never evidence for learner delivery.
begin;

create table practice_loop_private.resource_session_selections (
  id uuid primary key default gen_random_uuid(),
  weekly_session_id uuid not null references public.weekly_sessions(id) on delete cascade,
  source_activity_id text not null check (source_activity_id ~ '^[A-Za-z0-9_-]{1,160}$'),
  source_version integer not null check (source_version > 0),
  title text not null check (length(btrim(title)) > 0 and length(title) <= 20000),
  activity_type text not null default 'multiple_choice' check (activity_type = 'multiple_choice'),
  selected_by uuid not null references public.tutors(id) on delete restrict,
  selected_at timestamptz not null default clock_timestamp(),
  unique (weekly_session_id, source_activity_id)
);
alter table practice_loop_private.resource_session_selections enable row level security;
alter table practice_loop_private.resource_session_selections force row level security;
-- No direct client policies or privileges: only the checked definer RPCs below.
revoke all on practice_loop_private.resource_session_selections from public, anon, authenticated;

create function practice_loop_private.assert_resource_session_owner(p_plan_id uuid, p_session_id uuid, p_fictional boolean)
returns void language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from practice_loop_private.resource_studio_settings where enabled) then
    raise exception 'Resource Studio disabled' using errcode = '55000';
  end if;
  if p_fictional is distinct from true or auth.uid() is null
    or coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'false' then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  -- Serialize mutations per session; hold parent ownership/link rows stable
  -- until commit so authorization cannot become stale during the write.
  perform 1 from public.weekly_sessions ws
    join public.weekly_plans p on p.id = ws.weekly_plan_id
    join public.students s on s.id = p.student_id
    join public.lesson_reflections r on r.id = p.lesson_reflection_id and r.student_id = s.id
    join public.tutors t on t.id = s.owner_tutor_id and t.active
    where ws.id = p_session_id and p.id = p_plan_id and s.owner_tutor_id = auth.uid()
    for update of ws for share of p, s, r, t;
  if not found then
    raise exception 'Session not found or access denied' using errcode = '42501';
  end if;
end;
$$;
revoke all on function practice_loop_private.assert_resource_session_owner(uuid,uuid,boolean) from public, anon, authenticated;

create function public.list_resource_session_selections(p_plan_id uuid, p_session_id uuid, p_fictional boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform practice_loop_private.assert_resource_session_owner(p_plan_id,p_session_id,p_fictional);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'weekly_session_id',weekly_session_id,'source_activity_id',source_activity_id,
    'source_version',source_version,'title',title,'activity_type',activity_type,
    'selected_by',selected_by,'selected_at',selected_at) order by selected_at,id),'[]'::jsonb)
    into result from practice_loop_private.resource_session_selections where weekly_session_id = p_session_id;
  return result;
end;
$$;

create function public.add_resource_session_selection(p_plan_id uuid, p_session_id uuid, p_fictional boolean,
  p_source_id text, p_version integer, p_title text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing_version integer;
begin
  perform practice_loop_private.assert_resource_session_owner(p_plan_id,p_session_id,p_fictional);
  if p_source_id is null or p_source_id !~ '^[A-Za-z0-9_-]{1,160}$'
    or p_version is null or p_version < 1 or p_title is null
    or length(btrim(p_title)) = 0 or length(p_title) > 20000 then
    raise exception 'Invalid selection' using errcode = '22023';
  end if;
  select source_version into existing_version from practice_loop_private.resource_session_selections
    where weekly_session_id = p_session_id and source_activity_id = p_source_id;
  if found then
    if existing_version <> p_version then
      raise exception 'Remove the existing version first' using errcode = '23505';
    end if;
    -- Idempotence preserves the original title, selecting tutor and timestamp.
  else
    insert into practice_loop_private.resource_session_selections(weekly_session_id,source_activity_id,source_version,title,selected_by)
      values(p_session_id,p_source_id,p_version,p_title,auth.uid());
  end if;
  return public.list_resource_session_selections(p_plan_id,p_session_id,p_fictional);
end;
$$;

create function public.remove_resource_session_selection(p_plan_id uuid, p_session_id uuid, p_selection_id uuid, p_fictional boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform practice_loop_private.assert_resource_session_owner(p_plan_id,p_session_id,p_fictional);
  -- Idempotent and session-scoped; another session's ID cannot delete its row.
  delete from practice_loop_private.resource_session_selections
    where id = p_selection_id and weekly_session_id = p_session_id;
  return public.list_resource_session_selections(p_plan_id,p_session_id,p_fictional);
end;
$$;

revoke all on function public.list_resource_session_selections(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.add_resource_session_selection(uuid,uuid,boolean,text,integer,text) from public, anon, authenticated;
revoke all on function public.remove_resource_session_selection(uuid,uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.list_resource_session_selections(uuid,uuid,boolean) to authenticated;
grant execute on function public.add_resource_session_selection(uuid,uuid,boolean,text,integer,text) to authenticated;
grant execute on function public.remove_resource_session_selection(uuid,uuid,uuid,boolean) to authenticated;
commit;
