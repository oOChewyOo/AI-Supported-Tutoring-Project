"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type StudentFormState = {
  error?: string;
};

export type LessonReflectionFormState = {
  error?: string;
};

export type PlanActionState = {
  error?: string;
};

export type ActivityActionState = {
  error?: string;
};

function list(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createStudentAction(
  _previousState: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. Add the required variables to .env.local and restart the app." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const yearGroup = String(formData.get("year_group") ?? "").trim();
  const subjectFocus = String(formData.get("subject_focus") ?? "").trim();

  if (!name || !yearGroup || !subjectFocus) {
    return { error: "Name, year group, and subject focus are required." };
  }

  const { data, error } = await createSupabaseServerClient()
    .from("students")
    .insert({
      name,
      year_group: yearGroup,
      subject_focus: subjectFocus,
      interests: list(formData.get("interests")),
      strengths: list(formData.get("strengths")),
      needs_practice: list(formData.get("needs_practice")),
    })
    .select("id")
    .single();

  if (error) return { error: `Could not save student: ${error.message}` };

  revalidatePath("/dashboard");
  redirect(`/students/${data.id}`);
}

export async function createLessonReflectionAction(
  studentId: string,
  _previousState: LessonReflectionFormState,
  formData: FormData,
): Promise<LessonReflectionFormState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. Add the required variables to .env.local and restart the app." };
  }

  const reflectionDate = String(formData.get("date") ?? "").trim();
  const whatWeCovered = String(formData.get("what_we_covered") ?? "").trim();
  const whatWentWell = String(formData.get("what_went_well") ?? "").trim();
  const whatNeedsPractice = String(formData.get("what_needs_practice") ?? "").trim();
  const notesForNextTime = String(formData.get("notes_for_next_time") ?? "").trim();

  if (!reflectionDate || !whatWeCovered || !whatWentWell || !whatNeedsPractice) {
    return { error: "Date, what we covered, what went well, and what needs practice are required." };
  }

  const supabase = createSupabaseServerClient();
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) return { error: `Could not verify student: ${studentError.message}` };
  if (!student) return { error: "The selected student could not be found." };

  const { error } = await supabase.from("lesson_reflections").insert({
    student_id: studentId,
    reflection_date: reflectionDate,
    what_we_covered: whatWeCovered,
    what_went_well: whatWentWell,
    what_needs_practice: whatNeedsPractice,
    notes_for_next_time: notesForNextTime || null,
  });

  if (error) return { error: `Could not save lesson reflection: ${error.message}` };

  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}`);
}

export async function generateWeeklyPlanAction(
  reflectionId: string,
  _previousState: PlanActionState,
): Promise<PlanActionState> {
  void _previousState;
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };

  const { data, error } = await createSupabaseServerClient().rpc("generate_placeholder_weekly_plan", {
    p_reflection_id: reflectionId,
  });

  if (error) return { error: `Could not generate weekly plan: ${error.message}` };
  redirect(`/plans/${data}`);
}

export async function setActivityCompletionAction(
  activityId: string,
  studentId: string,
  planId: string,
  completed: boolean,
  _previousState: ActivityActionState,
): Promise<ActivityActionState> {
  void _previousState;
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };

  const { error } = await createSupabaseServerClient()
    .from("activity_results")
    .upsert(
      {
        activity_id: activityId,
        student_id: studentId,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: "activity_id,student_id" },
    );

  if (error) return { error: `Could not update completion: ${error.message}` };

  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/students/${studentId}`);
  redirect(`/plans/${planId}`);
}
