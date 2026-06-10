import { LessonReflection, PracticeSession, Student } from "@/lib/types";

export async function generateWeeklyPlan(
  student: Student,
  reflection: LessonReflection,
): Promise<PracticeSession[]> {
  void student;
  void reflection;
  // TODO: Implement this in a protected server-only route using the OpenAI API.
  // The model response should be validated before sessions are saved to Supabase.
  throw new Error("AI plan generation is not enabled in the MVP.");
}
