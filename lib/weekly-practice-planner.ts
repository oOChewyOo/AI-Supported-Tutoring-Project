import { objectiveChoices, parsePracticeNeed, type PracticeNeed } from "./resource-studio/proposal-contract";

export const DEFAULT_SESSION_MINUTES = 15;
export type WeeklyObjectiveSelection = { key: string; priority: "normal" | "high"; misconceptionIndexes: number[] };
export type WeeklySessionInput = { id: string; sessionNumber: number; durationMinutes?: number };
export type WeeklyNeed = { objectiveKey: string; objective: string; request: PracticeNeed };
export type WeeklyPracticePlan = { sessions: { id: string; sessionNumber: number; targetMinutes: number; needs: WeeklyNeed[] }[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(): never { throw new Error("Select one to five distinct stored objectives and valid session durations (5–30 minutes)."); }

/** Educational planning only: no resource, provider, content or activity-type decisions. */
export function buildWeeklyPracticePlan(row: Record<string, unknown>, selections: WeeklyObjectiveSelection[], sessions: WeeklySessionInput[], subject: string, year: string): WeeklyPracticePlan {
  if (!Array.isArray(selections) || selections.length < 1 || selections.length > 5 || new Set(selections.map(s => s.key)).size !== selections.length) invalid();
  if (sessions.length !== 5 || new Set(sessions.map(s => s.id)).size !== 5 || sessions.some(s => !uuid.test(s.id))) invalid();
  const ordered = [...sessions].sort((a,b) => a.sessionNumber - b.sessionNumber);
  if (ordered.some((s,i) => s.sessionNumber !== i+1)) invalid();
  const choices = objectiveChoices(row);
  const misconceptions = Array.isArray(row.possible_misconceptions) ? row.possible_misconceptions : [];
  const objectives = selections.map(s => {
    const choice = choices.find(c => c.key === s.key);
    if (!choice || !["normal", "high"].includes(s.priority) || !Array.isArray(s.misconceptionIndexes) || new Set(s.misconceptionIndexes).size !== s.misconceptionIndexes.length) return invalid();
    const mistakes = s.misconceptionIndexes.map(i => {
      if (!Number.isInteger(i) || typeof misconceptions[i] !== "string" || !misconceptions[i].trim()) return invalid();
      return misconceptions[i] as string;
    });
    const developing = Array.isArray(row.developing_objectives) && row.developing_objectives.includes(choice.objective);
    const insecure = developing || s.key.startsWith("developing_") || mistakes.length > 0;
    const maintenance = !developing && /^(secure_objectives|suggested_retrieval_items):/.test(s.key);
    const weight = (maintenance ? 1 : 3) + (s.priority === "high" ? 2 : 0) + (mistakes.length ? 1 : 0);
    return { ...choice, mistakes, insecure, maintenance, weight, count: 1, used: 0, last: -2 };
  }).sort((a,b) => b.weight-a.weight || a.key.localeCompare(b.key));
  if (new Set(objectives.map(o => o.objective.trim().toLowerCase())).size !== objectives.length) invalid();
  // Give every selected objective a place, then allocate remaining exposures by weighted need.
  for (let i = objectives.length; i < 5; i++) {
    const candidate = [...objectives].sort((a,b) => b.weight/(b.count+1) - a.weight/(a.count+1) || a.key.localeCompare(b.key))[0];
    candidate.count++;
  }
  const result: WeeklyPracticePlan = { sessions: ordered.map((session,index) => {
    const targetMinutes = session.durationMinutes ?? DEFAULT_SESSION_MINUTES;
    if (!Number.isInteger(targetMinutes) || targetMinutes < 5 || targetMinutes > 30) invalid();
    const remaining = objectives.filter(o => o.used < o.count);
    // Prefer an intervening objective when one exists, while reserving later spaced repeats.
    const pool = remaining.some(o => o.last !== index-1) ? remaining.filter(o => o.last !== index-1) : remaining;
    const o = [...pool].sort((a,b) => (b.count-b.used)-(a.count-a.used) || b.weight-a.weight || a.key.localeCompare(b.key))[0];
    const exposure = o.used++;
    o.last = index;
    const vocabulary = /\b(vocabulary|vocab|terminology|word meanings)\b/i.test(o.objective);
    const reading = /\b(comprehension|inference|infer|reading)\b/i.test(o.objective);
    const core = vocabulary ? "vocabulary" : reading ? "reading_comprehension" : "fluency";
    let intents = exposure === 0 || index === 4 ? ["retrieval", core] : [core];
    const checkMistake = o.mistakes.length > 0 && (exposure > 0 || o.count === 1) && (exposure % 2 === 0 || index === 4 || o.count === 1);
    if (checkMistake) intents = ["retrieval", "misconception_check"];
    else if (exposure >= 2 && !o.insecure && !o.maintenance && index !== 4) intents = ["application", "reasoning"];
    else if (exposure > 0 && exposure % 2 === 0) intents = ["retrieval", core];
    // Maintenance needs a lighter dose; reserve two minutes for transitions/headroom.
    const durationMinutes = Math.min(targetMinutes-2, o.maintenance ? 7 : 28);
    // Existing RS v1 contract has no separate misconception field. Approved educational
    // context is included explicitly in objective text; never send the reflection row.
    const objective = checkMistake ? `${o.objective} Check misconception: ${o.mistakes.join("; ")}.` : o.objective;
    const request = parsePracticeNeed({ subject, year, objective, durationMinutes, intents });
    return { id: session.id, sessionNumber: session.sessionNumber, targetMinutes, needs: [{ objectiveKey: o.key, objective: o.objective, request }] };
  }) };
  validateWeeklyPracticePlan(result, sessions, selections.map(s => s.key));
  return result;
}

export function validateWeeklyPracticePlan(plan: WeeklyPracticePlan, sessions: WeeklySessionInput[], keys: string[]) {
  if (plan.sessions.length !== 5 || sessions.length !== 5 || new Set(plan.sessions.map(s => s.id)).size !== 5) invalid();
  plan.sessions.forEach((s,i) => {
    const original = sessions.find(v => v.id === s.id && v.sessionNumber === i+1);
    if (!original || s.sessionNumber !== i+1 || s.targetMinutes !== (original.durationMinutes ?? DEFAULT_SESSION_MINUTES) || !s.needs.length) invalid();
    if (s.needs.some(n => !keys.includes(n.objectiveKey))) invalid();
    const minutes = s.needs.reduce((sum,n) => sum + parsePracticeNeed(n.request).durationMinutes, 0);
    if (minutes > s.targetMinutes-2) invalid();
  });
}
