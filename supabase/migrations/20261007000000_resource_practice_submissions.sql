begin;
-- One immutable submitted attempt per durable assignment. Legacy attempts stay separate.
create table practice_loop_private.resource_practice_submissions (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null unique references practice_loop_private.resource_session_assignments(id) on delete restrict,
 student_id uuid not null references public.students(id) on delete restrict,
 auth_user_id uuid not null references auth.users(id) on delete restrict,
 response jsonb not null check(jsonb_typeof(response)='object' and octet_length(response::text)<=40000),
 result jsonb not null check(jsonb_typeof(result)='object' and octet_length(result::text)<=100000),
 submitted_at timestamptz not null default clock_timestamp()
);
alter table practice_loop_private.resource_practice_submissions enable row level security;
alter table practice_loop_private.resource_practice_submissions force row level security;
revoke all on practice_loop_private.resource_practice_submissions from public,anon,authenticated;
create trigger immutable_practice_submission before update or delete on practice_loop_private.resource_practice_submissions
for each row execute function practice_loop_private.protect_resource_snapshot();

create function public.get_practice_submission_report(p_plan uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if coalesce(auth.jwt()->>'is_anonymous','false')='true' or not exists(
   select 1 from public.weekly_plans p join public.students s on s.id=p.student_id
   join public.lesson_reflections f on f.id=p.lesson_reflection_id and f.student_id=s.id
   where p.id=p_plan and (
    exists(select 1 from public.learner_accounts l where l.auth_user_id=auth.uid() and l.student_id=s.id and l.active)
    or exists(select 1 from public.tutors t where t.id=auth.uid() and t.id=s.owner_tutor_id and t.active)
   )
 ) then raise exception 'Access denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'assignmentId',a.id,'sessionId',a.session_id,'activityType',r.activity_type,
  'attemptId',v.id,'submittedAt',v.submitted_at,'response',v.response,'result',v.result
 ) order by b.approved_at,b.id,a.position),'[]'::jsonb) into result
 from practice_loop_private.resource_session_assignments a
 join practice_loop_private.resource_approval_batches b on b.id=a.batch_id and b.plan_id=a.plan_id and b.session_id=a.session_id
 join practice_loop_private.resource_package_references r on r.id=a.reference_id and r.plan_id=a.plan_id
 left join practice_loop_private.resource_practice_submissions v on v.assignment_id=a.id
 where a.plan_id=p_plan;
 return result;
end; $$;
revoke all on function public.get_practice_submission_report(uuid) from public,anon;
grant execute on function public.get_practice_submission_report(uuid) to authenticated;

-- Only the trusted PL server can commit an RS-checked result. Never a browser RPC.
create function public.save_practice_submission(p_user uuid,p_plan uuid,p_session uuid,p_assignment uuid,
 p_package uuid,p_integrity text,p_checked jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare student uuid; ref practice_loop_private.resource_package_references; saved uuid; checked_result jsonb;
begin
 select l.student_id into student from public.learner_accounts l
 join public.weekly_plans p on p.student_id=l.student_id
 join public.lesson_reflections f on f.id=p.lesson_reflection_id and f.student_id=l.student_id
 join public.weekly_sessions s on s.weekly_plan_id=p.id
 join practice_loop_private.resource_session_assignments a on a.session_id=s.id and a.plan_id=p.id
 join practice_loop_private.resource_approval_batches b on b.id=a.batch_id and b.plan_id=p.id and b.session_id=s.id
 where l.auth_user_id=p_user and l.active and p.id=p_plan and s.id=p_session and a.id=p_assignment and a.status='assigned'
 for share of l,p,f,s for update of a;
 if student is null then raise exception 'Access denied' using errcode='42501'; end if;
 select r.* into ref from practice_loop_private.resource_package_references r
 join practice_loop_private.resource_session_assignments a on a.reference_id=r.id where a.id=p_assignment and r.plan_id=p_plan;
 if ref.package_id is distinct from p_package or ref.integrity is distinct from p_integrity then
  raise exception 'Invalid reference' using errcode='22023'; end if;
 -- Lock serializes concurrent submissions; the first valid commit always wins.
 select id into saved from practice_loop_private.resource_practice_submissions where assignment_id=p_assignment;
 if saved is not null then return saved; end if;
 checked_result := p_checked->'result';
 if p_checked->>'schemaVersion' is distinct from 'submission-1' or p_checked->>'activityType' is distinct from ref.activity_type
 or (p_checked->>'contentVersion')::int is distinct from ref.content_version
 or jsonb_typeof(p_checked->'responses') is distinct from 'object'
 or jsonb_typeof(checked_result) is distinct from 'object'
 or checked_result->>'mode' is distinct from (case ref.activity_type when 'comprehension' then 'hybrid' when 'short_written_response' then 'manual' when 'explain_thinking' then 'manual' else 'automatic' end)
 or checked_result->>'reviewStatus' not in ('pending','not_required')
 or jsonb_typeof(checked_result->'items') is distinct from 'array' then
  raise exception 'Invalid checked submission' using errcode='22023'; end if;
 if checked_result->>'mode'='manual' then
  if checked_result->'earned' is distinct from 'null'::jsonb or checked_result->'possible' is distinct from 'null'::jsonb or checked_result->>'reviewStatus'<>'pending' then raise exception 'Invalid manual result' using errcode='22023'; end if;
 elsif (checked_result->>'earned')::int < 0 or (checked_result->>'possible')::int < (checked_result->>'earned')::int
 or jsonb_typeof(checked_result->'earned') is distinct from 'number' or jsonb_typeof(checked_result->'possible') is distinct from 'number' then
  raise exception 'Invalid score' using errcode='22023'; end if;
 insert into practice_loop_private.resource_practice_submissions(assignment_id,student_id,auth_user_id,response,result)
 values(p_assignment,student,p_user,p_checked->'responses',checked_result) returning id into saved;
 return saved;
end; $$;
revoke all on function public.save_practice_submission(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_practice_submission(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;
commit;
