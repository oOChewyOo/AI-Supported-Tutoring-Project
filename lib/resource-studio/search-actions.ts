"use server";

import { requireTutor } from "@/lib/auth";
import { ResourceStudioError } from "./activity";
import { parseResourceSearchQuery, searchResourceActivities } from "./search";
import type { ResourceSearchState } from "./search-types";

export async function searchResourceStudioAction(planId: string, _state: ResourceSearchState, form: FormData): Promise<ResourceSearchState> {
  if (process.env.NODE_ENV !== "development") return { error: "Resource Studio search is available only in development." };
  // Preserve auth redirects, and never trust bound plan IDs or previous action state.
  const { supabase, user } = await requireTutor();
  const denied = "The weekly plan could not be found or you do not have tutor access.";
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId)) return { error: denied };
    const { data: plan, error: planError } = await supabase.from("weekly_plans")
      .select("id,student_id,lesson_reflection_id").eq("id", planId).maybeSingle();
    if (planError || !plan || plan.id !== planId) return { error: denied };
    const { data: student, error: studentError } = await supabase.from("students")
      .select("id,owner_tutor_id").eq("id", plan.student_id).eq("owner_tutor_id", user.id).maybeSingle();
    if (studentError || !student || student.id !== plan.student_id || student.owner_tutor_id !== user.id) return { error: denied };
    const { data: reflection, error: reflectionError } = await supabase.from("lesson_reflections")
      .select("id,student_id").eq("id", plan.lesson_reflection_id).eq("student_id", student.id).maybeSingle();
    if (reflectionError || !reflection || reflection.id !== plan.lesson_reflection_id || reflection.student_id !== student.id) return { error: denied };
    if (form.getAll("fictional").length !== 1 || form.get("fictional") !== "confirmed") {
      return { error: "Confirm that this is an existing fictional test student before searching." };
    }
    const params = new URLSearchParams();
    for (const [key, value] of form) {
      if (key === "fictional" || key.startsWith("$ACTION_")) continue;
      if (typeof value !== "string") throw new ResourceStudioError("Invalid search parameters.");
      params.append(key, value);
    }
    const query = parseResourceSearchQuery(params);
    const results = await searchResourceActivities(params);
    return { query, results };
  } catch (error) {
    return { error: error instanceof ResourceStudioError ? error.message : "Could not search Resource Studio. Please try again." };
  }
}
