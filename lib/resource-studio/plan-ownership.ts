import "server-only";
import type { requireTutor } from "@/lib/auth";
import { ResourceStudioError } from "./activity";

/** Call only with a freshly verified tutor session. Reads IDs, never pupil content. */
export async function assertOwnedResourcePlan(planId: string, { supabase, user }: Awaited<ReturnType<typeof requireTutor>>) {
  const deny = () => new ResourceStudioError("The weekly plan could not be found or you do not have tutor access.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId)) throw deny();
  const { data: plan, error: planError } = await supabase.from("weekly_plans")
    .select("id,student_id,lesson_reflection_id").eq("id", planId).maybeSingle();
  if (planError || !plan || plan.id !== planId) throw deny();
  const { data: student, error: studentError } = await supabase.from("students")
    .select("id,owner_tutor_id").eq("id", plan.student_id).eq("owner_tutor_id", user.id).maybeSingle();
  if (studentError || !student || student.id !== plan.student_id || student.owner_tutor_id !== user.id) throw deny();
  const { data: reflection, error: reflectionError } = await supabase.from("lesson_reflections")
    .select("id,student_id").eq("id", plan.lesson_reflection_id).eq("student_id", student.id).maybeSingle();
  if (reflectionError || !reflection || reflection.id !== plan.lesson_reflection_id || reflection.student_id !== student.id) throw deny();
}
