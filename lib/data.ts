import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  ActivityType,
  ExtractedObjectives,
  LessonReflection,
  PracticeActivity,
  PracticeSession,
  Student,
  StudentProgress,
  WeeklyPlan,
  WeeklyPlanSummary,
} from "@/lib/types";

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

type WeeklyPlanRow = {
  id: string;
  student_id: string;
  lesson_reflection_id: string;
  title: string;
  focus: string;
  created_at: string;
};

type WeeklySessionRow = {
  id: string;
  weekly_plan_id: string;
  session_number: number;
  title: string;
  duration_minutes: number;
};

type ActivityRow = {
  id: string;
  weekly_session_id: string;
  position: number;
  title: string;
  description: string;
  activity_type: ActivityType;
  minutes: number;
};

type ActivityResultRow = {
  activity_id: string;
  completed: boolean;
};

type ExtractedObjectivesRow = {
  id: string;
  student_id: string;
  lesson_reflection_id: string;
  secure_objectives: string[];
  developing_objectives: string[];
  focus_for_next_week: string[];
  possible_misconceptions: string[];
  suggested_retrieval_items: string[];
  created_at: string;
  updated_at: string;
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

function toExtractedObjectives(row: ExtractedObjectivesRow): ExtractedObjectives {
  return {
    id: row.id,
    studentId: row.student_id,
    lessonReflectionId: row.lesson_reflection_id,
    secureObjectives: row.secure_objectives,
    developingObjectives: row.developing_objectives,
    focusForNextWeek: row.focus_for_next_week,
    possibleMisconceptions: row.possible_misconceptions,
    suggestedRetrievalItems: row.suggested_retrieval_items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

export async function getLessonReflection(id: string): Promise<LessonReflection | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await createSupabaseServerClient()
    .from("lesson_reflections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load lesson reflection: ${error.message}`);
  return data ? toLessonReflection(data as LessonReflectionRow) : null;
}

export async function listExtractedObjectives(studentId: string): Promise<ExtractedObjectives[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createSupabaseServerClient()
    .from("extracted_objectives")
    .select("*")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });
  if (error?.code === "PGRST205") return [];
  if (error) throw new Error(`Could not load extracted objectives: ${error.message}`);
  return ((data ?? []) as ExtractedObjectivesRow[]).map(toExtractedObjectives);
}

export async function listWeeklyPlans(studentId: string): Promise<WeeklyPlanSummary[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createSupabaseServerClient();
  const { data: planData, error: planError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (planError) throw new Error(`Could not load weekly plans: ${planError.message}`);
  const plans = (planData ?? []) as WeeklyPlanRow[];
  if (!plans.length) return [];

  const { data: sessionData, error: sessionError } = await supabase
    .from("weekly_sessions")
    .select("id, weekly_plan_id")
    .in("weekly_plan_id", plans.map((plan) => plan.id));
  if (sessionError) throw new Error(`Could not load weekly sessions: ${sessionError.message}`);

  const sessions = (sessionData ?? []) as Pick<WeeklySessionRow, "id" | "weekly_plan_id">[];
  const { data: activityData, error: activityError } = sessions.length
    ? await supabase
        .from("activities")
        .select("id, weekly_session_id")
        .in("weekly_session_id", sessions.map((session) => session.id))
    : { data: [], error: null };
  if (activityError) throw new Error(`Could not load activities: ${activityError.message}`);

  const activities = (activityData ?? []) as Pick<ActivityRow, "id" | "weekly_session_id">[];
  const { data: resultData, error: resultError } = activities.length
    ? await supabase
        .from("activity_results")
        .select("activity_id, completed")
        .in("activity_id", activities.map((activity) => activity.id))
        .eq("student_id", studentId)
    : { data: [], error: null };
  if (resultError) throw new Error(`Could not load activity results: ${resultError.message}`);

  const completedIds = new Set(
    ((resultData ?? []) as ActivityResultRow[]).filter((result) => result.completed).map((result) => result.activity_id),
  );

  return plans.map((plan) => {
    const planSessions = sessions.filter((session) => session.weekly_plan_id === plan.id);
    const planActivities = activities.filter((activity) =>
      planSessions.some((session) => session.id === activity.weekly_session_id),
    );
    const sessionsCompleted = planSessions.filter((session) => {
      const sessionActivities = planActivities.filter((activity) => activity.weekly_session_id === session.id);
      return sessionActivities.length > 0 && sessionActivities.every((activity) => completedIds.has(activity.id));
    }).length;

    return {
      id: plan.id,
      lessonReflectionId: plan.lesson_reflection_id,
      title: plan.title,
      focus: plan.focus,
      createdAt: plan.created_at,
      sessionsCompleted,
      sessionsTotal: planSessions.length,
      activitiesCompleted: planActivities.filter((activity) => completedIds.has(activity.id)).length,
      activitiesTotal: planActivities.length,
    };
  });
}

export async function getWeeklyPlan(id: string): Promise<WeeklyPlan | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createSupabaseServerClient();
  const { data: planData, error: planError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (planError) throw new Error(`Could not load weekly plan: ${planError.message}`);
  if (!planData) return null;
  const plan = planData as WeeklyPlanRow;

  const [studentResult, reflectionResult, sessionsResult] = await Promise.all([
    supabase.from("students").select("*").eq("id", plan.student_id).single(),
    supabase.from("lesson_reflections").select("*").eq("id", plan.lesson_reflection_id).single(),
    supabase.from("weekly_sessions").select("*").eq("weekly_plan_id", plan.id).order("session_number"),
  ]);
  if (studentResult.error) throw new Error(`Could not load plan student: ${studentResult.error.message}`);
  if (reflectionResult.error) throw new Error(`Could not load linked reflection: ${reflectionResult.error.message}`);
  if (sessionsResult.error) throw new Error(`Could not load weekly sessions: ${sessionsResult.error.message}`);

  const sessions = (sessionsResult.data ?? []) as WeeklySessionRow[];
  const { data: activityData, error: activityError } = sessions.length
    ? await supabase
        .from("activities")
        .select("*")
        .in("weekly_session_id", sessions.map((session) => session.id))
        .order("position")
    : { data: [], error: null };
  if (activityError) throw new Error(`Could not load activities: ${activityError.message}`);

  const activities = (activityData ?? []) as ActivityRow[];
  const { data: resultData, error: resultError } = activities.length
    ? await supabase
        .from("activity_results")
        .select("activity_id, completed")
        .in("activity_id", activities.map((activity) => activity.id))
        .eq("student_id", plan.student_id)
    : { data: [], error: null };
  if (resultError) throw new Error(`Could not load activity results: ${resultError.message}`);
  const completedIds = new Set(
    ((resultData ?? []) as ActivityResultRow[]).filter((result) => result.completed).map((result) => result.activity_id),
  );

  return {
    id: plan.id,
    student: toStudent(studentResult.data as StudentRow),
    reflection: toLessonReflection(reflectionResult.data as LessonReflectionRow),
    title: plan.title,
    focus: plan.focus,
    createdAt: plan.created_at,
    sessions: sessions.map((session): PracticeSession => {
      const sessionActivities = activities
        .filter((activity) => activity.weekly_session_id === session.id)
        .map((activity): PracticeActivity => ({
          id: activity.id,
          title: activity.title,
          description: activity.description,
          type: activity.activity_type,
          minutes: activity.minutes,
          completed: completedIds.has(activity.id),
        }));
      return {
        id: session.id,
        sessionNumber: session.session_number,
        title: session.title,
        durationMinutes: session.duration_minutes,
        completed: sessionActivities.length > 0 && sessionActivities.every((activity) => activity.completed),
        activities: sessionActivities,
      };
    }),
  };
}

export async function getActivity(id: string) {
  if (!isSupabaseConfigured()) return null;

  const supabase = createSupabaseServerClient();
  const { data: activityData, error: activityError } = await supabase
    .from("activities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (activityError) throw new Error(`Could not load activity: ${activityError.message}`);
  if (!activityData) return null;
  const activity = activityData as ActivityRow;

  const { data: sessionData, error: sessionError } = await supabase
    .from("weekly_sessions")
    .select("*")
    .eq("id", activity.weekly_session_id)
    .single();
  if (sessionError) throw new Error(`Could not load activity session: ${sessionError.message}`);
  const session = sessionData as WeeklySessionRow;

  const { data: planData, error: planError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("id", session.weekly_plan_id)
    .single();
  if (planError) throw new Error(`Could not load activity plan: ${planError.message}`);
  const plan = planData as WeeklyPlanRow;

  const [studentResult, resultResult] = await Promise.all([
    supabase.from("students").select("*").eq("id", plan.student_id).single(),
    supabase
      .from("activity_results")
      .select("activity_id, completed")
      .eq("activity_id", activity.id)
      .eq("student_id", plan.student_id)
      .maybeSingle(),
  ]);
  if (studentResult.error) throw new Error(`Could not load activity student: ${studentResult.error.message}`);
  if (resultResult.error) throw new Error(`Could not load activity result: ${resultResult.error.message}`);

  return {
    activity: {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      type: activity.activity_type,
      minutes: activity.minutes,
      completed: Boolean(resultResult.data?.completed),
    } satisfies PracticeActivity,
    session: {
      id: session.id,
      sessionNumber: session.session_number,
      title: session.title,
      durationMinutes: session.duration_minutes,
    },
    planId: plan.id,
    student: toStudent(studentResult.data as StudentRow),
  };
}

export async function getStudentProgress(studentId: string): Promise<StudentProgress> {
  const plans = await listWeeklyPlans(studentId);
  const totals = plans.reduce(
    (progress, plan) => ({
      plansTotal: progress.plansTotal + 1,
      sessionsCompleted: progress.sessionsCompleted + plan.sessionsCompleted,
      sessionsTotal: progress.sessionsTotal + plan.sessionsTotal,
      activitiesCompleted: progress.activitiesCompleted + plan.activitiesCompleted,
      activitiesTotal: progress.activitiesTotal + plan.activitiesTotal,
    }),
    { plansTotal: 0, sessionsCompleted: 0, sessionsTotal: 0, activitiesCompleted: 0, activitiesTotal: 0 },
  );
  return {
    ...totals,
    percentageComplete: totals.activitiesTotal
      ? Math.round((totals.activitiesCompleted / totals.activitiesTotal) * 100)
      : 0,
  };
}
