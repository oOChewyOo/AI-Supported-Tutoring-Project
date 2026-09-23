-- READ ONLY. Run manually against the intended database before approving cutover.
-- Inspect locally; do not publish database metadata or learner data.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;

select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p');

select routine_name, grantee, privilege_type
from information_schema.routine_privileges where routine_schema = 'public';

select p.oid::regprocedure as signature, p.prosecdef as security_definer,
  p.proconfig, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f';

select table_name, grantee, privilege_type
from information_schema.table_privileges where table_schema = 'public';
select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges where table_schema = 'public';
select table_name, view_definition from information_schema.views where table_schema = 'public';

-- These denormalized relationships were not constrained by the old migrations.
select 'weekly_plans' as relation, count(*) as mismatched_rows
from public.weekly_plans p join public.lesson_reflections r on r.id = p.lesson_reflection_id
where p.student_id <> r.student_id
union all
select 'extracted_objectives', count(*)
from public.extracted_objectives o join public.lesson_reflections r on r.id = o.lesson_reflection_id
where o.student_id <> r.student_id
union all
select 'activity_results', count(*)
from public.activity_results r
join public.activities a on a.id = r.activity_id
join public.weekly_sessions s on s.id = a.weekly_session_id
join public.weekly_plans p on p.id = s.weekly_plan_id
where r.student_id <> p.student_id;
