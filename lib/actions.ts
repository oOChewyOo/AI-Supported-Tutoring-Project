"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActivity, getLessonReflection } from "@/lib/data";
import { extractObjectivesWithOpenAI } from "@/lib/openai/extract-objectives";
import { generateSessionTitlesWithOpenAI } from "@/lib/openai/generate-session-titles";
import { requireTutor } from "@/lib/auth";
import { ExtractedObjectives } from "@/lib/types";

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
  const { supabase, user } = await requireTutor();

  const name = String(formData.get("name") ?? "").trim();
  const yearGroup = String(formData.get("year_group") ?? "").trim();
  const subjectFocus = String(formData.get("subject_focus") ?? "").trim();

  if (!name || !yearGroup || !subjectFocus) {
    return { error: "Name, year group, and subject focus are required." };
  }

  const { data, error } = await supabase
    .from("students")
    .insert({
      owner_tutor_id: user.id,
      name,
      year_group: yearGroup,
      subject_focus: subjectFocus,
      interests: list(formData.get("interests")),
      strengths: list(formData.get("strengths")),
      needs_practice: list(formData.get("needs_practice")),
    })
    .select("id")
    .single();

  if (error) return { error: "Could not save student. Please try again or check your tutor access." };

  revalidatePath("/dashboard");
  redirect(`/students/${data.id}`);
}

export async function createLessonReflectionAction(
  studentId: string,
  _previousState: LessonReflectionFormState,
  formData: FormData,
): Promise<LessonReflectionFormState> {
  const { supabase } = await requireTutor();

  const reflectionDate = String(formData.get("date") ?? "").trim();
  const whatWeCovered = String(formData.get("what_we_covered") ?? "").trim();
  const whatWentWell = String(formData.get("what_went_well") ?? "").trim();
  const whatNeedsPractice = String(formData.get("what_needs_practice") ?? "").trim();
  const notesForNextTime = String(formData.get("notes_for_next_time") ?? "").trim();

  if (!reflectionDate || !whatWeCovered || !whatWentWell || !whatNeedsPractice) {
    return { error: "Date, what we covered, what went well, and what needs practice are required." };
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) return { error: "Could not verify student. Please try again or check your tutor access." };
  if (!student) return { error: "The selected student could not be found." };

  const { error } = await supabase.from("lesson_reflections").insert({
    student_id: studentId,
    reflection_date: reflectionDate,
    what_we_covered: whatWeCovered,
    what_went_well: whatWentWell,
    what_needs_practice: whatNeedsPractice,
    notes_for_next_time: notesForNextTime || null,
  });

  if (error) return { error: "Could not save lesson reflection. Please try again or check your tutor access." };

  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}`);
}

export async function generateWeeklyPlanAction(
  reflectionId: string,
  _previousState: PlanActionState,
): Promise<PlanActionState> {
  const { supabase } = await requireTutor();
  void _previousState;

  const reflection = await getLessonReflection(reflectionId);
  if (!reflection) return { error: "The selected lesson reflection could not be found." };
  let generatedTitles: string[] | null = null;

  if (process.env.OPENAI_API_KEY) {
    const { data: objectives } = await supabase
      .from("extracted_objectives")
      .select("*")
      .eq("lesson_reflection_id", reflectionId)
      .maybeSingle();

    if (objectives) {
      try {
        generatedTitles = await generateSessionTitlesWithOpenAI({
          id: objectives.id,
          studentId: objectives.student_id,
          lessonReflectionId: objectives.lesson_reflection_id,
          secureObjectives: objectives.secure_objectives,
          developingObjectives: objectives.developing_objectives,
          focusForNextWeek: objectives.focus_for_next_week,
          possibleMisconceptions: objectives.possible_misconceptions,
          suggestedRetrievalItems: objectives.suggested_retrieval_items,
          createdAt: objectives.created_at,
          updatedAt: objectives.updated_at,
        } satisfies ExtractedObjectives);
      } catch {
        // Plan creation must continue with the RPC's placeholder titles.
        generatedTitles = null;
      }
    }
  }

  const { data, error } = await supabase.rpc("generate_placeholder_weekly_plan", {
    p_reflection_id: reflectionId,
  });

  if (error) return { error: "Could not generate weekly plan. Please try again or check your tutor access." };

  if (generatedTitles) {
    // Title updates are best-effort so a policy or network problem cannot block the plan.
    await Promise.all(
      generatedTitles.map((title, index) =>
        supabase
          .from("weekly_sessions")
          .update({ title })
          .eq("weekly_plan_id", data)
          .eq("session_number", index + 1),
      ),
    );
  }

  redirect(`/plans/${data}`);
}

export async function setActivityCompletionAction(
  activityId: string,
  studentId: string,
  planId: string,
  completed: boolean,
  _previousState: ActivityActionState,
): Promise<ActivityActionState> {
  const { supabase } = await requireTutor();
  void _previousState;

  const activity = await getActivity(activityId);
  if (!activity || activity.student.id !== studentId || activity.planId !== planId) {
    return { error: "The selected activity could not be found." };
  }
  const { error } = await supabase
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

  if (error) return { error: "Could not update completion. Please try again or check your tutor access." };

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
  const { supabase } = await requireTutor();
  void _previousState;
  if (!process.env.OPENAI_API_KEY) {
    return { error: "OPENAI_API_KEY is not configured on the server. Add it to .env.local and restart the app." };
  }

  try {
    const { error: tableError } = await supabase.from("extracted_objectives").select("id").limit(1);
    if (tableError?.code === "PGRST205") {
      return { error: "Run the extracted objectives Supabase migration before using AI extraction." };
    }
    if (tableError) return { error: "Could not access extracted objectives. Please try again or check your tutor access." };

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

    if (error) return { error: "Could not save extracted objectives. Please try again or check your tutor access." };
    revalidatePath(`/students/${studentId}`);
    return { success: "Objectives extracted and saved." };
  } catch {
    return { error: "Could not extract objectives. Please try again or check your tutor access." };
  }
}

export async function updateObjectivesAction(
  objectiveId: string,
  studentId: string,
  _previousState: ObjectiveActionState,
  formData: FormData,
): Promise<ObjectiveActionState> {
  const { supabase } = await requireTutor();
  void _previousState;

  const { data: updated, error } = await supabase
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
    .eq("student_id", studentId)
    .select("id")
    .maybeSingle();

  if (error) return { error: "Could not update objectives. Please try again or check your tutor access." };
  if (!updated) return { error: "The selected objectives could not be found." };
  revalidatePath(`/students/${studentId}`);
  return { success: "Objectives updated." };
}
