"use server";
import { createHash } from "node:crypto";
import { requireTutor } from "@/lib/auth";
import { assertOwnedResourcePlan } from "./resource-studio/plan-ownership";
import { requestPracticeProposal, proposalOrigin } from "./resource-studio/proposal-client";
import { materializeProposalActivity, materializationKey } from "./resource-studio/package-client";
import { packageServiceClient } from "./resource-studio/package-service";
import { buildWeeklyPracticePlan, validateWeeklyPracticePlan, type WeeklyObjectiveSelection } from "./weekly-practice-planner";
import { fulfilWeeklyPractice, rebuildWeeklySession, retainWeeklyDraft, retainedWeeklyDraft, weeklyPracticeBusy, type TutorWeeklyDraft } from "./weekly-practice";
import { listApprovedPractice } from "./resource-studio/approval-actions";
import type { AssignmentState } from "./resource-studio/approval-types";

const conflict = "This plan already has assigned practice. Create a new weekly plan; replacing learner work is not supported.";
const enabled = () => process.env.NODE_ENV === "development";
async function context(planId: string, tutor: Awaited<ReturnType<typeof requireTutor>>) {
  const plan = await assertOwnedResourcePlan(planId,tutor);
  const [objectives,sessions] = await Promise.all([
    tutor.supabase.from("extracted_objectives").select("id,updated_at,focus_for_next_week,developing_objectives,secure_objectives,suggested_retrieval_items,possible_misconceptions")
      .eq("student_id",plan.student_id).eq("lesson_reflection_id",plan.lesson_reflection_id).maybeSingle(),
    tutor.supabase.from("weekly_sessions").select("id,session_number,duration_minutes").eq("weekly_plan_id",planId).order("session_number"),
  ]);
  if (objectives.error || !objectives.data || sessions.error || !sessions.data) throw new Error();
  const row = objectives.data;
  return { row, version: createHash("sha256").update(JSON.stringify(row)).digest("hex"),
    sessions: sessions.data.map(s => ({ id: s.id as string, sessionNumber: s.session_number as number, durationMinutes: s.duration_minutes as number })) };
}
export async function buildWeeklyPractice(planId: string, selections: WeeklyObjectiveSelection[], controls: { subject: string; year: string }, confirmed: boolean): Promise<{ draft?: TutorWeeklyDraft; error?: string }> {
  if (!enabled()) return { error: "Weekly practice is available only in development." };
  const tutor = await requireTutor(); const key = `${tutor.user.id}:${planId}`;
  let locked = false;
  try {
    if (confirmed !== true) return { error: "Confirm that the educational fields contain only fictional, non-identifying data." };
    const c = await context(planId,tutor);
    const existing = await listApprovedPractice(planId);
    if (existing.error) return { error: existing.error };
    if (existing.assignments?.length) return { error: conflict };
    const plan = buildWeeklyPracticePlan(c.row,selections,c.sessions,controls.subject,controls.year);
    if (weeklyPracticeBusy.has(key)) return { error: "A week is already being prepared. Wait for it to finish." };
    weeklyPracticeBusy.add(key); locked = true;
    const draft = await fulfilWeeklyPractice(planId,c.version,plan,requestPracticeProposal);
    await assertOwnedResourcePlan(planId,tutor);
    return { draft: retainWeeklyDraft(tutor.user.id,draft) };
  } catch { return { error: "Could not build the week. Review one to five distinct stored objectives, their misconceptions and session durations. Educational requests must fit within 240 characters." }; }
  finally { if (locked) weeklyPracticeBusy.delete(key); }
}
export async function previewWeeklyPractice(planId: string, id: string, sessionId: string, needIndex: number, activityId: string, confirmed: boolean): Promise<{ url?: string; error?: string }> {
  if (!enabled()) return { error: "Practice previews are available only in development." };
  const tutor = await requireTutor();
  try {
    await assertOwnedResourcePlan(planId,tutor);
    if (confirmed !== true) throw new Error();
    const draft = retainedWeeklyDraft(tutor.user.id,planId,id);
    const a = draft?.results.find(r => r.sessionId === sessionId && r.needIndex === needIndex)?.proposal?.activities.find(a => a.id === activityId && a.status === "ready");
    if (!a?.previewToken) throw new Error();
    const url = new URL("/integrations/practice-loop/review",proposalOrigin()); url.hash = a.previewToken;
    return { url: url.toString() };
  } catch { return { error: "Preview expired or unavailable. Rebuild the week." }; }
}
export async function rebuildWeeklyPracticeSession(planId: string, id: string, sessionId: string, confirmed: boolean): Promise<{ draft?: TutorWeeklyDraft; error?: string }> {
  if (!enabled()) return { error: "Weekly practice is available only in development." };
  const tutor = await requireTutor(); const key = `${tutor.user.id}:${planId}`; let locked = false;
  try {
    const c = await context(planId,tutor);
    if (confirmed !== true) throw new Error();
    const draft = retainedWeeklyDraft(tutor.user.id,planId,id);
    if (!draft || draft.sourceVersion !== c.version) return { error: "Learning needs changed or the draft expired. Rebuild the entire week." };
    validateWeeklyPracticePlan(draft.plan,c.sessions,draft.plan.sessions.flatMap(s => s.needs.map(n => n.objectiveKey)));
    const existing = await listApprovedPractice(planId);
    if (existing.error) return existing;
    if (existing.assignments?.length) return { error: conflict };
    if (weeklyPracticeBusy.has(key)) return { error: "Practice is already being prepared. Wait for it to finish." };
    weeklyPracticeBusy.add(key); locked = true;
    const next = await rebuildWeeklySession(draft,sessionId,requestPracticeProposal);
    await assertOwnedResourcePlan(planId,tutor);
    return { draft: retainWeeklyDraft(tutor.user.id,next) };
  } catch { return { error: "Could not rebuild this session. Retry, or rebuild the entire week." }; }
  finally { if (locked) weeklyPracticeBusy.delete(key); }
}
export async function sentWeeklyPractice(planId: string): Promise<{ proposalId?: string; approvedAt?: string; error?: string }> {
  if (!enabled()) return {};
  const tutor = await requireTutor();
  try {
    await assertOwnedResourcePlan(planId,tutor);
    const { data,error } = await packageServiceClient().rpc("get_weekly_practice_approval",{ p_tutor: tutor.user.id,p_plan: planId });
    if (error) throw new Error();
    return data ? { proposalId: data.proposalId, approvedAt: data.approvedAt } : {};
  } catch { return { error: "Could not load sent-week status. Reload to retry." }; }
}
export async function approveWeeklyPractice(planId: string, id: string, confirmed: boolean): Promise<AssignmentState> {
  if (!enabled()) return { error: "Practice approval is available only in development." };
  const tutor = await requireTutor();
  try {
    await assertOwnedResourcePlan(planId,tutor);
    if (confirmed !== true) throw new Error();
    const sent = await sentWeeklyPractice(planId);
    if (sent.error) return { error: sent.error };
    if (sent.proposalId === id) return listApprovedPractice(planId);
    const existing = await listApprovedPractice(planId);
    if (existing.error) return existing;
    if (sent.proposalId || existing.assignments?.length) return { error: conflict };
    const draft = retainedWeeklyDraft(tutor.user.id,planId,id);
    if (!draft || draft.status !== "ready") return { error: "Resolve incomplete or expired practice by rebuilding the week before sending." };
    const c = await context(planId,tutor);
    if (c.version !== draft.sourceVersion) return { error: "Learning needs changed. Rebuild and review the week before sending." };
    validateWeeklyPracticePlan(draft.plan,c.sessions,draft.plan.sessions.flatMap(s => s.needs.map(n => n.objectiveKey)));
    const groups = [];
    for (const session of draft.plan.sessions) {
      for (const [needIndex,need] of session.needs.entries()) {
        const proposal = draft.results.find(r => r.sessionId === session.id && r.needIndex === needIndex)?.proposal;
        if (!proposal || proposal.status !== "ready" || !proposal.activities.length || Date.parse(proposal.expiresAt) <= Date.now()) throw new Error();
        const items = [];
        for (const activity of proposal.activities) {
          if (activity.status !== "ready" || !activity.previewToken) throw new Error();
          const ref = await materializeProposalActivity(proposal,activity);
          items.push({ proposalActivityId: activity.id, packageId: ref.packageId, activityId: ref.activityId, contentVersion: ref.contentVersion,
            activityType: ref.activityType, integrity: ref.integrity, releaseId: ref.releaseId, resourceVersion: ref.resourceVersion,
            scoringMode: ref.scoringMode, schemaVersion: ref.schemaVersion, purpose: activity.purpose, dose: activity.dose, estimatedMinutes: activity.estimatedMinutes });
        }
        groups.push({ sessionId: session.id, proposalId: materializationKey(id,`${session.id}:${needIndex}`), rsProposalId: proposal.id, objectiveKey: need.objectiveKey, items });
      }
    }
    const fresh = await context(planId,tutor);
    if (fresh.version !== draft.sourceVersion) return { error: "Learning needs changed. Rebuild and review the week before sending." };
    validateWeeklyPracticePlan(draft.plan,fresh.sessions,draft.plan.sessions.flatMap(s => s.needs.map(n => n.objectiveKey)));
    const result = await packageServiceClient().rpc("approve_weekly_practice", { p_tutor: tutor.user.id, p_plan: planId, p_proposal: id,
      p_objective_id: c.row.id, p_objective_updated_at: c.row.updated_at, p_groups: groups });
    if (result.error) return { error: result.error.code === "23505" ? conflict : "The week could not be sent. No partial week was assigned. Retry." };
    return listApprovedPractice(planId);
  } catch { return { error: "The week could not be sent. No partial week was assigned. Retry, or rebuild expired practice." }; }
}
