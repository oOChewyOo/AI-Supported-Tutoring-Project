export const RESOURCE_ACTIVITY_ID = "activity-equivalent-fractions-mcq";

export type ResourceQuestion = {
  id: string;
  prompt: string;
  supportingText: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
  hint: string;
  correctFeedback: string;
  incorrectFeedback: string;
  explanation: string;
};

export type ResourceActivity = {
  id: string;
  contentVersion: number;
  title: string;
  instructions: string;
  feedback: { generalCorrect: string; generalIncorrect: string };
  questions: ResourceQuestion[];
};

export class ResourceStudioError extends Error {}

function invalid(path: string): never {
  throw new ResourceStudioError(`Resource Studio returned invalid content (${path}). Check the published activity and supported schema version 1.0.`);
}
function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(path);
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string, optional = false): string {
  if (optional && value === undefined) return "";
  if (typeof value !== "string" || value.length > 20000 || (!optional && !value.trim())) invalid(path);
  return value;
}
function list(value: unknown, path: string, min = 1, max = 100): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) invalid(path);
  return value;
}
function unique(ids: string[], path: string) {
  if (new Set(ids).size !== ids.length) invalid(path);
}

/** Adapter for the observed Resource Studio API, independent of stored Practice Loop content. */
export function parseResourceActivity(value: unknown): ResourceActivity {
  const root = record(value, "response");
  if (root.id !== RESOURCE_ACTIVITY_ID) invalid("id");
  if (typeof root.contentVersion !== "number" || !Number.isSafeInteger(root.contentVersion) || root.contentVersion < 1) invalid("contentVersion");
  text(root.title, "title");
  const data = record(root.activityData, "activityData");
  if (data.schemaVersion !== "1.0") invalid("schemaVersion");
  if (data.activityType !== "multiple_choice") invalid("activityType");
  const feedback = record(data.feedback, "feedback");
  const content = record(data.content, "content");
  const questions = list(content.questions, "questions").map((value, index): ResourceQuestion => {
    const path = `questions[${index}]`;
    const q = record(value, path);
    const options = list(q.options, `${path}.options`, 2, 30).map((value) => {
      const option = record(value, `${path}.option`);
      return { id: text(option.id, `${path}.option.id`), text: text(option.text, `${path}.option.text`) };
    });
    unique(options.map((o) => o.id), `${path}.options duplicate IDs`);
    const correctOptionIds = list(q.correctOptionIds, `${path}.correctOptionIds`, 1, options.length).map((id) => text(id, `${path}.correctOptionId`));
    unique(correctOptionIds, `${path}.correctOptionIds duplicate IDs`);
    if (correctOptionIds.some((id) => !options.some((o) => o.id === id))) invalid(`${path}.correctOptionIds references`);
    return {
      id: text(q.id, `${path}.id`), prompt: text(q.prompt, `${path}.prompt`), options, correctOptionIds,
      supportingText: text(q.supportingText, `${path}.supportingText`, true),
      hint: text(q.hint, `${path}.hint`, true),
      correctFeedback: text(q.correctFeedback, `${path}.correctFeedback`, true),
      incorrectFeedback: text(q.incorrectFeedback, `${path}.incorrectFeedback`, true),
      explanation: text(q.explanation, `${path}.explanation`, true),
    };
  });
  unique(questions.map((q) => q.id), "questions duplicate IDs");
  return {
    id: RESOURCE_ACTIVITY_ID, contentVersion: root.contentVersion,
    title: text(data.title, "activityData.title"), instructions: text(data.instructions, "instructions"),
    feedback: { generalCorrect: text(feedback.generalCorrect, "feedback.generalCorrect"), generalIncorrect: text(feedback.generalIncorrect, "feedback.generalIncorrect") },
    questions,
  };
}

/** One point per exact answer set; no partial credit or duplicate/unknown selections. */
export function isCorrectAnswer(question: ResourceQuestion, selected: readonly string[]): boolean {
  return new Set(selected).size === selected.length && selected.length === question.correctOptionIds.length &&
    selected.every((id) => question.correctOptionIds.includes(id));
}
