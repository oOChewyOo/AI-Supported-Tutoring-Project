import "server-only";

import { LessonReflection } from "@/lib/types";

type ObjectiveExtraction = {
  secure_objectives: string[];
  developing_objectives: string[];
  focus_for_next_week: string[];
  possible_misconceptions: string[];
  suggested_retrieval_items: string[];
};

const objectiveArray = {
  type: "array",
  items: { type: "string" },
} as const;

export async function extractObjectivesWithOpenAI(
  reflection: LessonReflection,
): Promise<ObjectiveExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      store: false,
      instructions:
        "You extract concise, evidence-based learning objectives from a tutor's lesson reflection. Do not invent facts. Return short actionable phrases.",
      input: [
        `Lesson date: ${reflection.date}`,
        `What we covered: ${reflection.whatWeCovered}`,
        `What went well: ${reflection.whatWentWell}`,
        `What needs practice: ${reflection.whatNeedsPractice}`,
        `Notes for next time: ${reflection.notesForNextTime || "None"}`,
      ].join("\n"),
      text: {
        format: {
          type: "json_schema",
          name: "lesson_objective_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              secure_objectives: objectiveArray,
              developing_objectives: objectiveArray,
              focus_for_next_week: objectiveArray,
              possible_misconceptions: objectiveArray,
              suggested_retrieval_items: objectiveArray,
            },
            required: [
              "secure_objectives",
              "developing_objectives",
              "focus_for_next_week",
              "possible_misconceptions",
              "suggested_retrieval_items",
            ],
          },
        },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "OpenAI objective extraction failed.");
  }

  const outputText = payload.output
    ?.flatMap((item: { content?: { type?: string; text?: string }[] }) => item.content ?? [])
    .find((item: { type?: string; text?: string }) => item.type === "output_text")?.text;

  if (!outputText) throw new Error("OpenAI returned no structured objective output.");
  return JSON.parse(outputText) as ObjectiveExtraction;
}
