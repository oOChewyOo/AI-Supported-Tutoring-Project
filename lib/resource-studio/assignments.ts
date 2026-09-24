import "server-only";
import { requireTutor } from "@/lib/auth";
import type { ResourceExercise } from "./exercise-types";
import { ResourceStudioError } from "./activity";

export function requireResourceDevelopment() {
  if (process.env.NODE_ENV !== "development") throw new ResourceStudioError("Resource Studio assignment is available only in development.");
}

export function resourceDatabaseError(code?: string) {
  if (code === "23505") return "This activity already has an imported snapshot. Choose another placeholder.";
  if (code === "23514") return "Choose an unused placeholder with no generated content or completion record.";
  if (code === "42501") return "The activity could not be found or you do not have tutor access.";
  if (code === "22023") return "The resource content or submitted answers are invalid.";
  if (["PGRST202", "42703", "55000"].includes(code ?? "")) return "Resource Studio assignments are not enabled. Follow docs/resource-studio-assignment.md to apply and enable the local migration.";
  return "Could not access the Resource Studio assignment. Please try again.";
}

/** Derive every parent on the server. RLS plus explicit ownership/link checks. */
export async function getOwnedResourceSlot(activityId: string) {
  requireResourceDevelopment();
  const { supabase, user } = await requireTutor();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityId)) throw new ResourceStudioError("The activity could not be found.");
  const missing = () => new ResourceStudioError("The activity could not be found or you do not have tutor access.");
  const { data: activity, error: activityError } = await supabase.from("activities")
    .select("id,title,weekly_session_id,content_json,template_id,resource_studio_assigned").eq("id", activityId).maybeSingle();
  if (activityError) throw new ResourceStudioError(resourceDatabaseError(activityError.code));
  if (!activity) throw missing();
  const { data: session, error: sessionError } = await supabase.from("weekly_sessions")
    .select("id,weekly_plan_id,session_number").eq("id", activity.weekly_session_id).maybeSingle();
  if (sessionError || !session || session.id !== activity.weekly_session_id) throw missing();
  const { data: plan, error: planError } = await supabase.from("weekly_plans")
    .select("id,student_id,lesson_reflection_id,title").eq("id", session.weekly_plan_id).maybeSingle();
  if (planError || !plan || plan.id !== session.weekly_plan_id) throw missing();
  const { data: student, error: studentError } = await supabase.from("students")
    .select("id,name,owner_tutor_id").eq("id", plan.student_id).eq("owner_tutor_id", user.id).maybeSingle();
  if (studentError || !student || student.id !== plan.student_id || student.owner_tutor_id !== user.id) throw missing();
  const { data: reflection, error: reflectionError } = await supabase.from("lesson_reflections")
    .select("id,student_id").eq("id", plan.lesson_reflection_id).eq("student_id", student.id).maybeSingle();
  if (reflectionError || !reflection || reflection.id !== plan.lesson_reflection_id || reflection.student_id !== student.id) throw missing();
  return { supabase, activity, session, plan, student };
}

export async function getResourceExercise(activityId: string): Promise<ResourceExercise | null> {
  requireResourceDevelopment();
  const { supabase } = await requireTutor();
  const { data, error } = await supabase.rpc("get_resource_studio_exercise", { p_activity_id: activityId });
  if (error) throw new ResourceStudioError(resourceDatabaseError(error.code));
  return data as ResourceExercise | null;
}
