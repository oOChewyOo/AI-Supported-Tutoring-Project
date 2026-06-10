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

export type ActivityType =
  | "Quick quiz"
  | "Sort & match"
  | "Flashcards"
  | "Fill the gap"
  | "Mini read"
  | "Fluency check";

export type PracticeActivity = {
  id?: string;
  title: string;
  type: ActivityType;
  minutes: number;
  description: string;
};

export type PracticeSession = {
  id?: string;
  day: string;
  title: string;
  focus: string;
  activities: PracticeActivity[];
};

export type WeeklyPlan = {
  id: string;
  student: Student;
  reflection: LessonReflection;
  weekStart: string;
  primaryFocus: string;
  sessions: PracticeSession[];
};
