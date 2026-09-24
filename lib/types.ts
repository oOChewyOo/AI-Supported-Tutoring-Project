import type { GeneratedActivityContent } from "@/lib/activity-templates";

export type Student = {
  id: string;
  name: string;
  yearGroup: string;
  subjectFocus: string;
  interests: string[];
  strengths: string[];
  needsPractice: string[];
};

export type LessonReflection = {
  id: string;
  studentId: string;
  date: string;
  whatWeCovered: string;
  whatWentWell: string;
  whatNeedsPractice: string;
  notesForNextTime: string;
  createdAt: string;
};

export type ExtractedObjectives = {
  id: string;
  studentId: string;
  lessonReflectionId: string;
  secureObjectives: string[];
  developingObjectives: string[];
  focusForNextWeek: string[];
  possibleMisconceptions: string[];
  suggestedRetrievalItems: string[];
  createdAt: string;
  updatedAt: string;
};

/**
 * This currently describes an activity's role within a weekly session, not
 * the educational activity type defined by an activity template.
 */
export type ActivityType =
  | "Topic practice"
  | "Retrieval practice"
  | "Challenge and reflection";

export type PracticeActivity = {
  id: string;
  title: string;
  type: ActivityType;
  minutes: number;
  description: string;
  completed: boolean;
  templateId: string | null;
  contentJson: GeneratedActivityContent | null;
  resourceStudioAssigned: boolean;
};

export type PracticeSession = {
  id: string;
  sessionNumber: number;
  title: string;
  durationMinutes: number;
  completed: boolean;
  activities: PracticeActivity[];
};

export type WeeklyPlan = {
  id: string;
  student: Student;
  reflection: LessonReflection;
  title: string;
  focus: string;
  createdAt: string;
  sessions: PracticeSession[];
};

export type WeeklyPlanSummary = {
  id: string;
  lessonReflectionId: string;
  title: string;
  focus: string;
  createdAt: string;
  sessionsCompleted: number;
  sessionsTotal: number;
  activitiesCompleted: number;
  activitiesTotal: number;
};

export type StudentProgress = {
  plansTotal: number;
  sessionsCompleted: number;
  sessionsTotal: number;
  activitiesCompleted: number;
  activitiesTotal: number;
  percentageComplete: number;
};
