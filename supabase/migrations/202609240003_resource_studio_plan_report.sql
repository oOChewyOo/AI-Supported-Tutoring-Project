-- Read-only reporting API. Review and apply manually; no existing data is changed.
begin;

create function public.get_resource_studio_plan_report(p_plan_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare item record; reports jsonb := '[]'::jsonb; questions jsonb;
begin
  if not exists(select 1 from practice_loop_private.resource_studio_settings where enabled) then
    raise exception 'Resource Studio assignments disabled' using errcode='55000';
  end if;
  -- Authorize the plan even when it has no imported activities. Never let an
  -- empty report mask a foreign, unapproved or anonymous request.
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
    or not exists (
      select 1 from public.weekly_plans p
      join public.students s on s.id=p.student_id
      join public.lesson_reflections r on r.id=p.lesson_reflection_id and r.student_id=s.id
      join public.tutors t on t.id=s.owner_tutor_id and t.active
      where p.id=p_plan_id and s.owner_tutor_id=auth.uid()
    ) then raise exception 'Plan not found or access denied' using errcode='42501'; end if;

  for item in
    select a.id, ws.session_number, a.position, rs.source_version, rs.snapshot,
      attempt.activity_id as completed_id, attempt.score, attempt.total,
      attempt.submitted_at, attempt.selections, attempt.feedback
    from public.weekly_sessions ws
    join public.activities a on a.weekly_session_id=ws.id
    join practice_loop_private.resource_studio_assignments rs on rs.activity_id=a.id
    left join practice_loop_private.resource_studio_attempts attempt on attempt.activity_id=a.id
    where ws.weekly_plan_id=p_plan_id
    order by ws.session_number, a.position, a.id
  loop
    perform practice_loop_private.assert_resource_owner(item.id);
    questions := null;
    if item.completed_id is not null then
      -- Explicit field allowlist: only the saved selections and feedback, never
      -- correctOptionIds, unselected options, or the full immutable snapshot.
      select jsonb_agg(jsonb_build_object(
        'id',q->'id','prompt',q->'prompt','supportingText',q->'supportingText',
        'selections',coalesce((select jsonb_agg(o->'text' order by option_number)
          from jsonb_array_elements(q->'options') with ordinality options(o,option_number)
          where (item.selections->(q->>'id')) @> jsonb_build_array(o->'id')),'[]'::jsonb),
        'correct',f->'correct','feedback',f->'message','explanation',f->'explanation',
        'misconceptionTags',case when f->'correct'='false'::jsonb
          and jsonb_typeof(q->'misconceptionTag')='string'
          and length(trim(q->>'misconceptionTag')) between 1 and 20000
          then jsonb_build_array(q->>'misconceptionTag') else '[]'::jsonb end
      ) order by question_number) into questions
      from jsonb_array_elements(item.snapshot->'questions') with ordinality qs(q,question_number)
      join lateral (select value as f from jsonb_array_elements(item.feedback) where value->>'id'=q->>'id') saved on true;
    end if;
    reports := reports || jsonb_build_array(jsonb_build_object(
      'activityId',item.id,'sessionNumber',item.session_number,'position',item.position,
      'title',item.snapshot->'title','sourceVersion',item.source_version,
      'attempt',case when item.completed_id is null then null else jsonb_build_object(
        'score',item.score,'total',item.total,'submittedAt',item.submitted_at,'questions',questions
      ) end
    ));
  end loop;
  return reports;
end;
$$;

revoke all on function public.get_resource_studio_plan_report(uuid) from public, anon, authenticated;
grant execute on function public.get_resource_studio_plan_report(uuid) to authenticated;
commit;
