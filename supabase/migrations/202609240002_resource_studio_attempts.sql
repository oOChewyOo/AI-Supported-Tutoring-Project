-- Review and apply manually to the local development database only.
begin;

-- Close the preflight/trigger-install gap to concurrent assignment/completion writes.
lock table public.activities, public.activity_results, practice_loop_private.resource_studio_assignments in share row exclusive mode;

-- Never silently reinterpret a manually created imported completion as an attempt.
do $$ begin
  if exists (select 1 from public.activity_results r join practice_loop_private.resource_studio_assignments a using (activity_id)) then
    raise exception 'Imported completion records already exist; review them before applying attempts migration';
  end if;
end $$;

create table practice_loop_private.resource_studio_attempts (
  activity_id uuid primary key references practice_loop_private.resource_studio_assignments(activity_id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  submitted_by uuid not null references public.tutors(id) on delete restrict,
  submitted_at timestamptz not null,
  selections jsonb not null,
  score integer not null,
  total integer not null check (total > 0),
  feedback jsonb not null,
  check (score between 0 and total)
);
alter table practice_loop_private.resource_studio_attempts enable row level security;
alter table practice_loop_private.resource_studio_attempts force row level security;
revoke all on practice_loop_private.resource_studio_attempts from public, anon, authenticated;

create trigger immutable_resource_attempt before update or delete on practice_loop_private.resource_studio_attempts
for each row execute function practice_loop_private.protect_resource_snapshot();

-- Imported completion is derived only from a saved attempt. This also protects
-- direct REST writes and the existing generic completion server action.
create function practice_loop_private.protect_resource_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    if exists (select 1 from practice_loop_private.resource_studio_assignments where activity_id = old.activity_id) then
      raise exception 'Imported completion is immutable' using errcode = '42501';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    -- Serialize with assignment, including when its snapshot is not committed yet.
    -- Otherwise a concurrent generic completion insert could slip past this check.
    perform 1 from public.activities where id = new.activity_id for update;
    if exists (select 1 from practice_loop_private.resource_studio_assignments where activity_id = new.activity_id)
      and (tg_op <> 'INSERT' or not exists (
        select 1 from practice_loop_private.resource_studio_attempts t
        where t.activity_id = new.activity_id and t.student_id = new.student_id
          and new.completed and new.completed_at = t.submitted_at
      )) then
      raise exception 'Submit the imported exercise to complete it' using errcode = '42501';
    end if;
    return new;
  end if;
  return old;
end;
$$;
create trigger protect_resource_completion before insert or update or delete on public.activity_results
for each row execute function practice_loop_private.protect_resource_completion();

-- Keep completed attempts attached to their original student/plan/session.
create function practice_loop_private.protect_resource_attempt_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare affected boolean := false;
begin
  if tg_table_name = 'activities' then
    if new.weekly_session_id is distinct from old.weekly_session_id then
      select exists(select 1 from practice_loop_private.resource_studio_attempts where activity_id = old.id) into affected;
    end if;
  elsif tg_table_name = 'weekly_sessions' then
    if new.weekly_plan_id is distinct from old.weekly_plan_id then
      select exists(select 1 from practice_loop_private.resource_studio_attempts t join public.activities a on a.id=t.activity_id where a.weekly_session_id=old.id) into affected;
    end if;
  elsif tg_table_name = 'weekly_plans' then
    if new.student_id is distinct from old.student_id or new.lesson_reflection_id is distinct from old.lesson_reflection_id then
      select exists(select 1 from practice_loop_private.resource_studio_attempts t join public.activities a on a.id=t.activity_id join public.weekly_sessions s on s.id=a.weekly_session_id where s.weekly_plan_id=old.id) into affected;
    end if;
  end if;
  if affected then raise exception 'A completed imported activity cannot be moved' using errcode = '42501'; end if;
  return new;
end;
$$;
create trigger protect_resource_attempt_parent before update on public.activities
for each row execute function practice_loop_private.protect_resource_attempt_parent();
create trigger protect_resource_attempt_parent before update on public.weekly_sessions
for each row execute function practice_loop_private.protect_resource_attempt_parent();
create trigger protect_resource_attempt_parent before update on public.weekly_plans
for each row execute function practice_loop_private.protect_resource_attempt_parent();

create function public.get_resource_studio_attempt(p_activity_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform practice_loop_private.assert_resource_owner(p_activity_id);
  select jsonb_build_object('selections',t.selections,'score',t.score,'total',t.total,
    'feedback',t.feedback,'submittedAt',t.submitted_at,
    'sourceActivityId',a.source_activity_id,'sourceVersion',a.source_version)
    into result from practice_loop_private.resource_studio_attempts t
    join practice_loop_private.resource_studio_assignments a using(activity_id)
    where t.activity_id=p_activity_id;
  return result;
end;
$$;

create function public.submit_resource_studio_attempt(p_activity_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb; q jsonb; selected jsonb; scored jsonb; learner uuid; submitted timestamptz;
begin
  perform practice_loop_private.assert_resource_owner(p_activity_id);
  -- Lock the whole ownership chain against moves/deletion while authorizing and
  -- writing. Concurrent submissions serialize on these rows; the PK is a backstop.
  select p.student_id into learner from public.activities a
    join public.weekly_sessions s on s.id=a.weekly_session_id
    join public.weekly_plans p on p.id=s.weekly_plan_id
    join public.students st on st.id=p.student_id
    join public.lesson_reflections r on r.id=p.lesson_reflection_id
    join public.tutors t on t.id=st.owner_tutor_id
    where a.id=p_activity_id for update of a,s,p,st,r,t;
  perform practice_loop_private.assert_resource_owner(p_activity_id);
  -- First completed submission wins, even if a retry contains different answers.
  if exists(select 1 from practice_loop_private.resource_studio_attempts where activity_id=p_activity_id) then
    return public.get_resource_studio_attempt(p_activity_id);
  end if;
  select snapshot into v from practice_loop_private.resource_studio_assignments where activity_id=p_activity_id;
  if v is null then raise exception 'No assignment' using errcode='22023'; end if;
  -- Reuse the scorer's shape/unknown-question validation, always against storage.
  scored := public.check_resource_studio_answers(p_activity_id,p_answers);
  for q in select value from jsonb_array_elements(v->'questions') loop
    selected := coalesce(p_answers->(q->>'id'),'[]'::jsonb);
    if jsonb_array_length(selected)=0
      or (jsonb_array_length(q->'correctOptionIds')=1 and jsonb_array_length(selected)<>1)
      or (select count(distinct x) from jsonb_array_elements(selected) x)<>jsonb_array_length(selected)
      or exists(select 1 from jsonb_array_elements(selected) x where not exists(select 1 from jsonb_array_elements(q->'options') o where o->'id'=x)) then
      raise exception 'Choose valid answers for every question' using errcode='22023';
    end if;
  end loop;
  submitted := clock_timestamp();
  insert into practice_loop_private.resource_studio_attempts(activity_id,student_id,submitted_by,submitted_at,selections,score,total,feedback)
    values(p_activity_id,learner,auth.uid(),submitted,p_answers,(scored->>'score')::integer,(scored->>'total')::integer,scored->'feedback');
  insert into public.activity_results(activity_id,student_id,completed,completed_at)
    values(p_activity_id,learner,true,submitted);
  -- Either both inserts commit or neither does. No exception handler swallows errors.
  return public.get_resource_studio_attempt(p_activity_id);
end;
$$;

revoke all on all functions in schema practice_loop_private from public, anon, authenticated;
revoke all on function public.get_resource_studio_attempt(uuid) from public, anon, authenticated;
revoke all on function public.submit_resource_studio_attempt(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.get_resource_studio_attempt(uuid) to authenticated;
grant execute on function public.submit_resource_studio_attempt(uuid,jsonb) to authenticated;
commit;
