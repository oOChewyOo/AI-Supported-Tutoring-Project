-- Review before applying to a LOCAL development database only, after tutor ownership.
-- No existing learner rows are changed. Disabled until an administrator opts in locally.
begin;

-- Safe public metadata only; the snapshot and keys never enter activities.content_json.
alter table public.activities add column resource_studio_assigned boolean not null default false;

create schema practice_loop_private;
revoke all on schema practice_loop_private from public, anon, authenticated;

create table practice_loop_private.resource_studio_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into practice_loop_private.resource_studio_settings default values;

create table practice_loop_private.resource_studio_assignments (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  source_activity_id text not null check (source_activity_id = 'activity-equivalent-fractions-mcq'),
  source_version bigint not null check (source_version between 1 and 9007199254740991),
  snapshot_format text not null default 'resource-studio-mcq-v1' check (snapshot_format = 'resource-studio-mcq-v1'),
  snapshot jsonb not null,
  assigned_by uuid not null references public.tutors(id) on delete restrict,
  assigned_at timestamptz not null default now()
);
alter table practice_loop_private.resource_studio_settings enable row level security;
alter table practice_loop_private.resource_studio_settings force row level security;
alter table practice_loop_private.resource_studio_assignments enable row level security;
alter table practice_loop_private.resource_studio_assignments force row level security;
revoke all on all tables in schema practice_loop_private from public, anon, authenticated;

-- Used only inside the narrowly granted definer functions below. Check claims and
-- the entire hierarchy explicitly: a definer must not depend on invoker RLS.
create function practice_loop_private.assert_resource_owner(p_activity_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from practice_loop_private.resource_studio_settings where enabled) then
    raise exception 'Resource Studio assignments disabled' using errcode = '55000';
  end if;
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'false'
    or not exists (
      select 1 from public.activities a
      join public.weekly_sessions ws on ws.id = a.weekly_session_id
      join public.weekly_plans p on p.id = ws.weekly_plan_id
      join public.students s on s.id = p.student_id
      join public.lesson_reflections r on r.id = p.lesson_reflection_id and r.student_id = s.id
      join public.tutors t on t.id = s.owner_tutor_id and t.active
      where a.id = p_activity_id and s.owner_tutor_id = auth.uid()
    ) then
    raise exception 'Activity not found or access denied' using errcode = '42501';
  end if;
end;
$$;

-- Defense in depth for direct RPC calls. The app additionally validates the
-- published Resource Studio envelope before adapting it into this snapshot.
create function practice_loop_private.valid_resource_snapshot(v jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare q jsonb; o jsonb; k jsonb; field text;
begin
  if jsonb_typeof(v) is distinct from 'object' or pg_column_size(v) > 1000000
    or v->>'id' is distinct from 'activity-equivalent-fractions-mcq'
    or jsonb_typeof(v->'contentVersion') is distinct from 'number'
    or (v->>'contentVersion')::numeric <> trunc((v->>'contentVersion')::numeric)
    or (v->>'contentVersion')::numeric not between 1 and 9007199254740991 then return false; end if;
  foreach field in array array['title','instructions'] loop
    if jsonb_typeof(v->field) is distinct from 'string' or length(trim(v->>field)) = 0 then return false; end if;
  end loop;
  foreach field in array array['generalCorrect','generalIncorrect'] loop
    if jsonb_typeof(v->'feedback'->field) is distinct from 'string' then return false; end if;
  end loop;
  if jsonb_typeof(v->'questions') is distinct from 'array' then return false; end if;
  if jsonb_array_length(v->'questions') not between 1 and 100 then return false; end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(v->'questions') x) <> jsonb_array_length(v->'questions') then return false; end if;
  for q in select value from jsonb_array_elements(v->'questions') loop
    foreach field in array array['id','prompt','supportingText','hint','correctFeedback','incorrectFeedback','explanation'] loop
      if jsonb_typeof(q->field) is distinct from 'string' then return false; end if;
    end loop;
    if length(trim(q->>'id')) = 0 or length(trim(q->>'prompt')) = 0 then return false; end if;
    if jsonb_typeof(q->'options') is distinct from 'array' or jsonb_typeof(q->'correctOptionIds') is distinct from 'array' then return false; end if;
    if jsonb_array_length(q->'options') not between 2 and 30
      or jsonb_array_length(q->'correctOptionIds') not between 1 and jsonb_array_length(q->'options') then return false; end if;
    if (select count(distinct x->>'id') from jsonb_array_elements(q->'options') x) <> jsonb_array_length(q->'options') then return false; end if;
    if (select count(distinct x) from jsonb_array_elements(q->'correctOptionIds') x) <> jsonb_array_length(q->'correctOptionIds') then return false; end if;
    for o in select value from jsonb_array_elements(q->'options') loop
      if jsonb_typeof(o->'id') is distinct from 'string' or jsonb_typeof(o->'text') is distinct from 'string'
        or length(trim(o->>'id')) = 0 or length(trim(o->>'text')) = 0 then return false; end if;
    end loop;
    for k in select value from jsonb_array_elements(q->'correctOptionIds') loop
      if jsonb_typeof(k) is distinct from 'string' or not exists (select 1 from jsonb_array_elements(q->'options') x where x->'id' = k) then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;

create function public.assign_resource_studio_activity(p_activity_id uuid, p_snapshot jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform practice_loop_private.assert_resource_owner(p_activity_id);
  -- Serialize duplicate imports and competing AI-content writes to this slot.
  perform 1 from public.activities where id = p_activity_id for update;
  perform practice_loop_private.assert_resource_owner(p_activity_id);
  if exists (select 1 from practice_loop_private.resource_studio_assignments where activity_id = p_activity_id) then
    raise exception 'Already assigned' using errcode = '23505';
  end if;
  if not exists (select 1 from public.activities where id = p_activity_id and content_json is null and template_id is null)
    or exists (select 1 from public.activity_results where activity_id = p_activity_id) then
    raise exception 'An unused placeholder is required' using errcode = '23514';
  end if;
  if not practice_loop_private.valid_resource_snapshot(p_snapshot) then
    raise exception 'Invalid Resource Studio snapshot' using errcode = '22023';
  end if;
  insert into practice_loop_private.resource_studio_assignments(activity_id,source_activity_id,source_version,snapshot,assigned_by)
  values (p_activity_id,p_snapshot->>'id',(p_snapshot->>'contentVersion')::numeric::bigint,p_snapshot,auth.uid());
  update public.activities set resource_studio_assigned = true where id = p_activity_id;
end;
$$;

create function public.get_resource_studio_exercise(p_activity_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform practice_loop_private.assert_resource_owner(p_activity_id);
  select snapshot into v from practice_loop_private.resource_studio_assignments where activity_id = p_activity_id;
  if v is null then return null; end if;
  -- Explicit allowlist, never pass the snapshot or pre-answer feedback to a client.
  return jsonb_build_object('id',v->'id','contentVersion',v->'contentVersion','title',v->'title','instructions',v->'instructions',
    'questions',(select jsonb_agg(jsonb_build_object('id',q->'id','prompt',q->'prompt','supportingText',q->'supportingText',
      'hint',q->'hint','multiple',jsonb_array_length(q->'correctOptionIds') > 1,
      'options',(select jsonb_agg(jsonb_build_object('id',o->'id','text',o->'text') order by n) from jsonb_array_elements(q->'options') with ordinality opt(o,n))) order by n)
      from jsonb_array_elements(v->'questions') with ordinality questions(q,n)));
end;
$$;

create function public.check_resource_studio_answers(p_activity_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb; q jsonb; selected jsonb; correct boolean; score integer := 0; feedback jsonb := '[]'::jsonb;
begin
  perform practice_loop_private.assert_resource_owner(p_activity_id);
  select snapshot into v from practice_loop_private.resource_studio_assignments where activity_id = p_activity_id;
  if v is null then raise exception 'No assignment' using errcode = '22023'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' or pg_column_size(p_answers) > 100000 then
    raise exception 'Invalid answers' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_answers) k where not exists (select 1 from jsonb_array_elements(v->'questions') x where x->>'id' = k)) then
    raise exception 'Unknown question' using errcode = '22023';
  end if;
  for q in select value from jsonb_array_elements(v->'questions') loop
    selected := coalesce(p_answers->(q->>'id'),'[]'::jsonb);
    if jsonb_typeof(selected) is distinct from 'array' then raise exception 'Invalid selections' using errcode = '22023'; end if;
    if jsonb_array_length(selected) > 30 or exists (select 1 from jsonb_array_elements(selected) x where jsonb_typeof(x) <> 'string') then
      raise exception 'Invalid selections' using errcode = '22023';
    end if;
    correct := jsonb_array_length(selected) = jsonb_array_length(q->'correctOptionIds')
      and (select count(distinct x) from jsonb_array_elements(selected) x) = jsonb_array_length(selected)
      and selected @> (q->'correctOptionIds') and selected <@ (q->'correctOptionIds');
    if correct then score := score + 1; end if;
    feedback := feedback || jsonb_build_array(jsonb_build_object('id',q->'id','correct',correct,
      'message',case when correct then coalesce(nullif(q->>'correctFeedback',''),v->'feedback'->>'generalCorrect')
        else coalesce(nullif(q->>'incorrectFeedback',''),v->'feedback'->>'generalIncorrect') end,'explanation',q->'explanation'));
  end loop;
  -- Deliberately no writes to activity_results or any response table.
  return jsonb_build_object('score',score,'total',jsonb_array_length(v->'questions'),'feedback',feedback);
end;
$$;

create function practice_loop_private.protect_resource_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Resource Studio snapshots are immutable' using errcode = '42501';
end;
$$;
create trigger immutable_resource_snapshot before update on practice_loop_private.resource_studio_assignments
for each row execute function practice_loop_private.protect_resource_snapshot();

create function practice_loop_private.protect_resource_slot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.resource_studio_assigned is distinct from exists (
    select 1 from practice_loop_private.resource_studio_assignments where activity_id = new.id
  ) then raise exception 'Assignment metadata is managed by the import function' using errcode = '23514'; end if;
  if tg_op = 'UPDATE' and (new.content_json is distinct from old.content_json or new.template_id is distinct from old.template_id)
    and exists (select 1 from practice_loop_private.resource_studio_assignments where activity_id = old.id) then
    raise exception 'Imported activity content cannot be overwritten' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger protect_resource_slot before insert or update on public.activities
for each row execute function practice_loop_private.protect_resource_slot();

revoke all on all functions in schema practice_loop_private from public, anon, authenticated;
revoke all on function public.assign_resource_studio_activity(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.get_resource_studio_exercise(uuid) from public, anon, authenticated;
revoke all on function public.check_resource_studio_answers(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.assign_resource_studio_activity(uuid,jsonb) to authenticated;
grant execute on function public.get_resource_studio_exercise(uuid) to authenticated;
grant execute on function public.check_resource_studio_answers(uuid,jsonb) to authenticated;
commit;
