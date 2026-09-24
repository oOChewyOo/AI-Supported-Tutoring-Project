/** Public display contract: intentionally no correct option IDs or answer feedback. */
export type ResourceExercise = {
  id: string;
  contentVersion: number;
  title: string;
  instructions: string;
  questions: {
    id: string;
    prompt: string;
    supportingText: string;
    hint: string;
    multiple: boolean;
    options: { id: string; text: string }[];
  }[];
};

export type ResourceCheckState = {
  error?: string;
  score?: number;
  total?: number;
  feedback?: { id: string; correct: boolean; message: string; explanation: string }[];
};

export type ResourceAssignmentState = { error?: string };
