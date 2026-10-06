/** Version 1 metadata contract. Activity schemas/content remain exclusively in RS. */
export const proposalIntents = ["retrieval", "fluency", "classification", "sequencing", "vocabulary", "misconception_check", "application", "reasoning", "reading_comprehension"] as const;
export const proposalActivityTypes = ["drag_drop_matching", "order_steps", "arithmetic_input", "multiple_choice", "fill_gap", "category_sort", "sentence_builder", "spot_mistake", "short_written_response", "explain_thinking", "comprehension"] as const;
export type PracticeNeed = { subject: string; year: string; objective: string; durationMinutes: number; intents: string[] };
export type ProposalActivity = { id: string; activityType: string; purpose: string; dose: string; estimatedMinutes: number;
  fulfilmentMode: string; sourceLabel: string; status: "ready" | "failed"; previewToken?: string; failureReason?: string };
export type PracticeProposal = { schemaVersion: "1"; id: string; reviewOnly: true; objective: string; requestedMinutes: number;
  plannedMinutes: number; headroomMinutes: number; planningMode: string; status: "ready" | "partial" | "failed";
  expiresAt: string; activities: ProposalActivity[] };
export const objectiveGroups = ["focus_for_next_week", "developing_objectives", "secure_objectives", "suggested_retrieval_items"] as const;
export type ObjectiveChoice = { key: string; label: string; objective: string };
const invalid = (): never => { throw new Error("Invalid practice proposal contract."); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function str(value: unknown, max = 240): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) return invalid();
  return value.trim();
}
function num(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return invalid();
  return value;
}
function one<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) return invalid();
  return value as T;
}
export function parsePracticeNeed(raw: unknown): PracticeNeed {
  const value = object(raw);
  if (Object.keys(value).some(key => !["subject", "year", "objective", "durationMinutes", "intents"].includes(key))) invalid();
  if (!Array.isArray(value.intents) || !value.intents.length || value.intents.length > 9 || new Set(value.intents).size !== value.intents.length) return invalid();
  return { subject: str(value.subject), year: str(value.year), objective: str(value.objective),
    durationMinutes: num(value.durationMinutes, 3, 30), intents: value.intents.map(intent => one(intent, proposalIntents)) };
}
export function objectiveChoices(row: unknown): ObjectiveChoice[] {
  const value = object(row);
  return objectiveGroups.flatMap(group => Array.isArray(value[group]) ? (value[group] as unknown[]).flatMap((text, index) =>
    typeof text === "string" && text.trim() ? [{ key: `${group}:${index}`, label: group.replaceAll("_", " "), objective: text }] : []) : []);
}
/** Pick one stored objective; never spread student/reflection records into the wire object. */
export function buildPracticeNeed(row: unknown, key: string, controls: unknown): PracticeNeed {
  const choice = objectiveChoices(row).find(choice => choice.key === key);
  if (!choice) return invalid();
  const fields = object(controls);
  if (Object.keys(fields).some(key => !["subject", "year", "durationMinutes", "intents"].includes(key))) invalid();
  return parsePracticeNeed({ subject: fields.subject, year: fields.year, objective: choice.objective,
    durationMinutes: fields.durationMinutes, intents: fields.intents });
}
export function parsePracticeProposal(raw: unknown): PracticeProposal {
  const value = object(raw);
  if (value.schemaVersion !== "1" || value.reviewOnly !== true || !Array.isArray(value.activities) || !value.activities.length || value.activities.length > 20) return invalid();
  const id = str(value.id);
  if (!/^[0-9a-f-]{36}$/i.test(id)) invalid();
  const activities = value.activities.map((raw): ProposalActivity => {
    const item = object(raw); const status = one(item.status, ["ready", "failed"]);
    const previewToken = status === "ready" ? str(item.previewToken) : undefined;
    if (previewToken && !/^[a-f0-9]{64}$/.test(previewToken)) invalid();
    if (status === "failed" && item.previewToken !== undefined) invalid();
    return { id: str(item.id), activityType: one(item.activityType, proposalActivityTypes), purpose: one(item.purpose, proposalIntents),
      dose: str(item.dose, 1000), estimatedMinutes: num(item.estimatedMinutes, 1, 30),
      fulfilmentMode: one(item.fulfilmentMode, ["reuse", "source-converted", "evidence-generated", "original-generated"]),
      sourceLabel: one(item.sourceLabel, ["Existing Resource Studio resource", "Oak", "Twinkl", "Math Salamanders", "Original Resource Studio generation"]),
      status, ...(previewToken ? { previewToken } : { failureReason: "This activity could not be prepared. Rebuild the proposal to try again." }) };
  });
  if (new Set(activities.map(item => item.id)).size !== activities.length) invalid();
  const requestedMinutes = num(value.requestedMinutes, 3, 30), plannedMinutes = num(value.plannedMinutes, 0, 30), headroomMinutes = num(value.headroomMinutes, 0, 30);
  if (plannedMinutes + headroomMinutes !== requestedMinutes || activities.reduce((sum, item) => sum + item.estimatedMinutes, 0) > plannedMinutes) invalid();
  const ready = activities.filter(item => item.status === "ready").length;
  const status = one(value.status, ["ready", "partial", "failed"]);
  if (status !== (ready === activities.length ? "ready" : ready ? "partial" : "failed")) invalid();
  const expiresAt = str(value.expiresAt);
  if (!Number.isFinite(Date.parse(expiresAt))) invalid();
  return { schemaVersion: "1", id, reviewOnly: true, objective: str(value.objective), requestedMinutes, plannedMinutes, headroomMinutes,
    planningMode: one(value.planningMode, ["ai", "ai-repaired", "deterministic", "deterministic-fallback"]), status, expiresAt, activities };
}
