import "server-only";

import { ExtractedObjectives } from "@/lib/types";

type SessionTitleResponse = {
  session_titles: string[];
};

export async function generateSessionTitlesWithOpenAI(
  objectives: ExtractedObjectives,
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the server.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      store: false,
      instructions: [
        "Create exactly five short, child-friendly and tutor-friendly weekly practice session titles.",
        "Use only the supplied learning objectives.",
        "Follow this sequence: supported practice, build confidence, mixed retrieval, independent practice, review and check.",
        "Make each title specific to the learning content. Do not create activity content.",
      ].join(" "),
      input: [
        `Secure objectives: ${objectives.secureObjectives.join("; ") || "None"}`,
        `Developing objectives: ${objectives.developingObjectives.join("; ") || "None"}`,
        `Focus for next week: ${objectives.focusForNextWeek.join("; ") || "None"}`,
        `Possible misconceptions: ${objectives.possibleMisconceptions.join("; ") || "None"}`,
        `Suggested retrieval items: ${objectives.suggestedRetrievalItems.join("; ") || "None"}`,
      ].join("\n"),
      text: {
        format: {
          type: "json_schema",
          name: "weekly_session_titles",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              session_titles: {
                type: "array",
                minItems: 5,
                maxItems: 5,
                items: { type: "string", maxLength: 80 },
              },
            },
            required: ["session_titles"],
          },
        },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "OpenAI session title generation failed.");

  const outputText = payload.output
    ?.flatMap((item: { content?: { type?: string; text?: string }[] }) => item.content ?? [])
    .find((item: { type?: string; text?: string }) => item.type === "output_text")?.text;

  if (!outputText) throw new Error("OpenAI returned no structured session titles.");

  const titles = (JSON.parse(outputText) as SessionTitleResponse).session_titles.map((title) => title.trim());
  if (titles.length !== 5 || titles.some((title) => !title)) {
    throw new Error("OpenAI returned invalid session titles.");
  }
  return titles;
}
