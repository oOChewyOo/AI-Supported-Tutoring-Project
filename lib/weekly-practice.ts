import "server-only";
import { randomUUID } from "node:crypto";
import type { WeeklyPracticePlan } from "./weekly-practice-planner";
import { parsePracticeProposal, type PracticeNeed, type PracticeProposal } from "./resource-studio/proposal-contract";

export type WeeklyDraft = { id: string; planId: string; generatedAt: string; expiresAt: string; status: "ready" | "partial" | "failed";
  sourceVersion: string; plan: WeeklyPracticePlan; results: { sessionId: string; needIndex: number; proposal?: PracticeProposal; error?: string }[] };
type Entry = { tutorId: string; draft: WeeklyDraft };
const globals = globalThis as typeof globalThis & { weeklyPracticeDrafts?: Map<string, Entry>; weeklyPracticeBusy?: Set<string> };
const entries = globals.weeklyPracticeDrafts ??= new Map<string, Entry>();
export const weeklyPracticeBusy = globals.weeklyPracticeBusy ??= new Set<string>();

/** Two workers, stable result indices, isolated errors: no successful sibling is lost. */
export async function fulfilWeeklyPractice(planId: string, sourceVersion: string, plan: WeeklyPracticePlan, request: (need: PracticeNeed) => Promise<PracticeProposal>): Promise<WeeklyDraft> {
  const jobs = plan.sessions.flatMap(s => s.needs.map((need,needIndex) => ({ sessionId: s.id, needIndex, need })));
  const results: WeeklyDraft["results"] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(2,jobs.length) }, async () => {
    while (next < jobs.length) {
      const index = next++, job = jobs[index];
      try {
        const proposal = parsePracticeProposal(await request(job.need.request));
        if (proposal.objective !== job.need.request.objective || proposal.requestedMinutes !== job.need.request.durationMinutes ||
            proposal.activities.some(a => /\b(?:Twinkl|Oak|Math Salamanders|provider|attribution|provenance|licen[cs]e)\b|https?:\/\//i.test(a.dose))) throw new Error();
        results[index] = { sessionId: job.sessionId, needIndex: job.needIndex, proposal };
      } catch { results[index] = { sessionId: job.sessionId, needIndex: job.needIndex, error: "Practice could not be prepared. Rebuild the week to retry." }; }
    }
  }));
  const ready = results.filter(r => r.proposal?.status === "ready").length;
  const expires = Math.min(Date.now()+30*60_000, ...results.flatMap(r => r.proposal ? [Date.parse(r.proposal.expiresAt)] : []));
  return { id: randomUUID(), planId, generatedAt: new Date().toISOString(), expiresAt: new Date(expires).toISOString(), sourceVersion, plan, results,
    status: ready === results.length ? "ready" : results.some(r => r.proposal?.activities.some(a => a.status === "ready")) ? "partial" : "failed" };
}
export function retainWeeklyDraft(tutorId: string, draft: WeeklyDraft) {
  for (const [key,entry] of entries) if (Date.parse(entry.draft.expiresAt) <= Date.now()) entries.delete(key);
  while (entries.size >= 50) entries.delete(entries.keys().next().value!);
  entries.set(draft.id, { tutorId, draft });
  return tutorWeeklyDraft(draft);
}
export function retainedWeeklyDraft(tutorId: string, planId: string, id: string) {
  const entry = entries.get(id);
  return entry?.tutorId === tutorId && entry.draft.planId === planId && Date.parse(entry.draft.expiresAt) > Date.now() ? entry.draft : undefined;
}
export function tutorWeeklyDraft(draft: WeeklyDraft) {
  return { id: draft.id, planId: draft.planId, generatedAt: draft.generatedAt, expiresAt: draft.expiresAt, status: draft.status,
    sessions: draft.plan.sessions.map(s => ({ id: s.id, sessionNumber: s.sessionNumber, targetMinutes: s.targetMinutes,
      needs: s.needs.map((n,i) => {
        const result = draft.results.find(r => r.sessionId === s.id && r.needIndex === i);
        return { objective: n.objective, intents: n.request.intents, durationMinutes: n.request.durationMinutes, error: result?.error,
          activities: result?.proposal?.activities.map(({ previewToken, ...a }) => ({ ...a, previewAvailable: Boolean(previewToken) })) ?? [] };
      }) })) };
}
export type TutorWeeklyDraft = ReturnType<typeof tutorWeeklyDraft>;

/** Reuse the reviewed plan and successful siblings; rebuilding creates a new week identity. */
export async function rebuildWeeklySession(draft: WeeklyDraft, sessionId: string, request: (need: PracticeNeed) => Promise<PracticeProposal>): Promise<WeeklyDraft> {
  const session = draft.plan.sessions.find(s => s.id === sessionId);
  if (!session) throw new Error("Unknown session.");
  const fresh = await fulfilWeeklyPractice(draft.planId,draft.sourceVersion,{ sessions: [session] },request);
  const results = draft.results.map(r => r.sessionId === sessionId ? fresh.results.find(n => n.needIndex === r.needIndex)! : r);
  const ready = results.filter(r => r.proposal?.status === "ready").length;
  const expires = Math.min(Date.now()+30*60_000,...results.flatMap(r => r.proposal ? [Date.parse(r.proposal.expiresAt)] : []));
  return { ...draft, id: fresh.id, generatedAt: fresh.generatedAt, expiresAt: new Date(expires).toISOString(), results,
    status: ready === results.length ? "ready" : results.some(r => r.proposal?.activities.some(a => a.status === "ready")) ? "partial" : "failed" };
}
