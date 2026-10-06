begin;
-- These read-only functions derive identity from verified Auth, never a student parameter.
create function public.get_learner_practice()
returns jsonb language plpgsql security definer set search_path='' as $$
declare learner uuid; result jsonb;
begin
 if coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'Access denied' using errcode='42501'; end if;
 select student_id into learner from public.learner_accounts where auth_user_id=auth.uid() and active;
 if learner is null then raise exception 'Access denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'sessions',(
   select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'number',s.session_number,'title',s.title,'assignments',(
     select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'activityType',r.activity_type,'dose',a.dose,'position',a.position)
       order by b.approved_at,b.id,a.position),'[]'::jsonb)
     from practice_loop_private.resource_session_assignments a
     join practice_loop_private.resource_approval_batches b on b.id=a.batch_id and b.session_id=s.id and b.plan_id=p.id
     join practice_loop_private.resource_package_references r on r.id=a.reference_id and r.plan_id=p.id
     where a.session_id=s.id and a.plan_id=p.id and a.status='assigned'
   )) order by s.session_number),'[]'::jsonb) from public.weekly_sessions s where s.weekly_plan_id=p.id
 )) order by p.created_at,p.id),'[]'::jsonb) into result from public.weekly_plans p
 join public.lesson_reflections f on f.id=p.lesson_reflection_id and f.student_id=learner
 where p.student_id=learner;
 return result;
end; $$;

create function public.get_learner_delivery_reference(p_plan uuid,p_session uuid,p_assignment uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'Access denied' using errcode='42501'; end if;
 select jsonb_build_object('packageId',r.package_id,'integrity',r.integrity) into result
 from public.learner_accounts l
 join public.weekly_plans p on p.student_id=l.student_id
 join public.lesson_reflections f on f.id=p.lesson_reflection_id and f.student_id=l.student_id
 join public.weekly_sessions s on s.weekly_plan_id=p.id
 join practice_loop_private.resource_session_assignments a on a.session_id=s.id and a.plan_id=p.id
 join practice_loop_private.resource_approval_batches b on b.id=a.batch_id and b.plan_id=p.id and b.session_id=s.id
 join practice_loop_private.resource_package_references r on r.id=a.reference_id and r.plan_id=p.id
 where l.auth_user_id=auth.uid() and l.active and p.id=p_plan and s.id=p_session and a.id=p_assignment and a.status='assigned';
 if result is null then raise exception 'Access denied' using errcode='42501'; end if;
 return result;
end; $$;
revoke all on function public.get_learner_practice(),public.get_learner_delivery_reference(uuid,uuid,uuid) from public,anon;
grant execute on function public.get_learner_practice(),public.get_learner_delivery_reference(uuid,uuid,uuid) to authenticated;
commit;
