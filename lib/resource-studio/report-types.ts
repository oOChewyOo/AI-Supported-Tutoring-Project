/** Tutor report only: no private snapshot or correct-option IDs. */
export type ResourceActivityReport = {
  activityId: string;
  sessionNumber: number;
  position: number;
  title: string;
  sourceVersion: number;
  attempt: null | {
    score: number;
    total: number;
    submittedAt: string;
    questions: {
      id: string;
      prompt: string;
      supportingText: string;
      selections: string[];
      correct: boolean;
      feedback: string;
      explanation: string;
      misconceptionTags: string[];
    }[];
  };
};
