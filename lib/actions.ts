"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLessonReflection } from "@/lib/data";
import { extractObjectivesWithOpenAI } from "@/lib/openai/extract-objectives";
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

export type ObjectiveActionState = {
  error?: string;
  success?: string;
};

function list(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
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

export async function extractObjectivesAction(
  reflectionId: string,
  studentId: string,
  _previousState: ObjectiveActionState,
): Promise<ObjectiveActionState> {
  void _previousState;
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
  if (!process.env.OPENAI_API_KEY) {
    return { error: "OPENAI_API_KEY is not configured on the server. Add it to .env.local and restart the app." };
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error: tableError } = await supabase.from("extracted_objectives").select("id").limit(1);
    if (tableError?.code === "PGRST205") {
      return { error: "Run the extracted objectives Supabase migration before using AI extraction." };
    }
    if (tableError) return { error: `Could not access extracted objectives: ${tableError.message}` };

    const reflection = await getLessonReflection(reflectionId);
    if (!reflection || reflection.studentId !== studentId) {
      return { error: "The selected lesson reflection could not be found." };
    }

    const objectives = await extractObjectivesWithOpenAI(reflection);
    const { error } = await supabase
      .from("extracted_objectives")
      .upsert(
        {
          student_id: studentId,
          lesson_reflection_id: reflectionId,
          ...objectives,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lesson_reflection_id" },
      );

    if (error) return { error: `Could not save extracted objectives: ${error.message}` };
    revalidatePath(`/students/${studentId}`);
    return { success: "Objectives extracted and saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not extract objectives." };
  }
}

export async function updateObjectivesAction(
  objectiveId: string,
  studentId: string,
  _previousState: ObjectiveActionState,
  formData: FormData,
): Promise<ObjectiveActionState> {
  void _previousState;
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };

  const { error } = await createSupabaseServerClient()
    .from("extracted_objectives")
    .update({
      secure_objectives: lines(formData.get("secure_objectives")),
      developing_objectives: lines(formData.get("developing_objectives")),
      focus_for_next_week: lines(formData.get("focus_for_next_week")),
      possible_misconceptions: lines(formData.get("possible_misconceptions")),
      suggested_retrieval_items: lines(formData.get("suggested_retrieval_items")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", objectiveId)
    .eq("student_id", studentId);

  if (error) return { error: `Could not update objectives: ${error.message}` };
  revalidatePath(`/students/${studentId}`);
  return { success: "Objectives updated." };
}
