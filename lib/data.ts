import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { LessonReflection, Student } from "@/lib/types";

type StudentRow = {
  id: string;
  name: string;
  year_group: string;
  subject_focus: string;
  interests: string[];
  strengths: string[];
  needs_practice: string[];
};

type LessonReflectionRow = {
  id: string;
  student_id: string;
  reflection_date: string;
  what_we_covered: string;
  what_went_well: string;
  what_needs_practice: string;
  notes_for_next_time: string | null;
  created_at: string;
};

function toStudent(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    yearGroup: row.year_group,
    subjectFocus: row.subject_focus,
    interests: row.interests,
    strengths: row.strengths,
    needsPractice: row.needs_practice,
  };
}

function toLessonReflection(row: LessonReflectionRow): LessonReflection {
  return {
    id: row.id,
    studentId: row.student_id,
    date: row.reflection_date,
    whatWeCovered: row.what_we_covered,
    whatWentWell: row.what_went_well,
    whatNeedsPractice: row.what_needs_practice,
    notesForNextTime: row.notes_for_next_time ?? "",
    createdAt: row.created_at,
  };
}

export async function listStudents(): Promise<Student[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await createSupabaseServerClient()
    .from("students")
    .select("*")
    .order("name");

  if (error) throw new Error(`Could not load students: ${error.message}`);
  return ((data ?? []) as StudentRow[]).map(toStudent);
}

export async function getStudent(id: string): Promise<Student | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await createSupabaseServerClient()
    .from("students")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load student: ${error.message}`);
  return data ? toStudent(data as StudentRow) : null;
}

export async function listLessonReflections(studentId: string): Promise<LessonReflection[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await createSupabaseServerClient()
    .from("lesson_reflections")
    .select("*")
    .eq("student_id", studentId)
    .order("reflection_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load lesson reflections: ${error.message}`);
  return ((data ?? []) as LessonReflectionRow[]).map(toLessonReflection);
}
