"use server";

import { requireTutor } from "@/lib/auth";
import { assertOwnedResourcePlan } from "./plan-ownership";
import { retainedApprovalProposal } from "./proposal-store";
import { materializeProposalActivity, durablePackagePreview } from "./package-client";
import { packageServiceClient } from "./package-service";
import type { AssignmentState, SessionPackageAssignment } from "./approval-types";

type InternalAssignment = SessionPackageAssignment & { packageId: string; integrity: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const failure = "This practice could not be prepared for assignment. Retry, or rebuild the practice proposal.";
function project(rows: InternalAssignment[]): SessionPackageAssignment[] {
  return rows.map(r => ({ id: r.id, batchId: r.batchId, proposalId: r.proposalId, sessionId: r.sessionId, position: r.position,
    activityType: r.activityType, purpose: r.purpose, dose: r.dose, estimatedMinutes: r.estimatedMinutes, status: r.status, approvedAt: r.approvedAt }));
}
async function list(tutorId: string, planId: string) {
  const { data, error } = await packageServiceClient().rpc("list_resource_package_assignments", { p_tutor: tutorId, p_plan: planId });
  if (error || !Array.isArray(data)) throw new Error("Persistence unavailable.");
  return data as InternalAssignment[];
}
export async function listApprovedPractice(planId: string): Promise<AssignmentState> {
  if (process.env.NODE_ENV !== "development") return { error: "Practice assignments are available only in development." };
  const tutor = await requireTutor();
  try {
    await assertOwnedResourcePlan(planId, tutor);
    return { assignments: project(await list(tutor.user.id, planId)) };
  } catch { return { error: "Could not load approved practice. Try again." }; }
}
export async function approvePracticeProposal(planId: string, sessionId: string, proposalId: string, confirmed: unknown): Promise<AssignmentState> {
  if (process.env.NODE_ENV !== "development") return { error: "Practice approval is available only in development." };
  const tutor = await requireTutor();
  try {
    await assertOwnedResourcePlan(planId, tutor);
    if (confirmed !== true || !uuid.test(sessionId) || !uuid.test(proposalId)) throw new Error();
    const { data: session, error } = await tutor.supabase.from("weekly_sessions").select("id,weekly_plan_id")
      .eq("id", sessionId).eq("weekly_plan_id", planId).maybeSingle();
    if (error || session?.id !== sessionId || session.weekly_plan_id !== planId) throw new Error();
    // Durable retry lookup deliberately precedes the transient proposal lookup.
    const existing = await list(tutor.user.id, planId);
    if (existing.some(r => r.proposalId === proposalId && r.sessionId === sessionId)) return { assignments: project(existing) };
    const retained = retainedApprovalProposal(proposalId, tutor.user.id, planId);
    if (!retained || retained.proposal.status !== "ready" || !retained.proposal.activities.length ||
        retained.proposal.activities.some(a => a.status !== "ready" || !a.previewToken)) return { error: "Rebuild the proposal before assigning it." };
    const { proposal, objectiveKey } = retained;
    const items = [];
    for (const activity of proposal.activities) {
      const ref = await materializeProposalActivity(proposal, activity);
      items.push({ proposalActivityId: activity.id, packageId: ref.packageId, activityId: ref.activityId,
        contentVersion: ref.contentVersion, activityType: ref.activityType, integrity: ref.integrity,
        releaseId: ref.releaseId, resourceVersion: ref.resourceVersion, scoringMode: ref.scoringMode, schemaVersion: ref.schemaVersion,
        purpose: activity.purpose, dose: activity.dose, estimatedMinutes: activity.estimatedMinutes });
    }
    await assertOwnedResourcePlan(planId, tutor);
    const result = await packageServiceClient().rpc("approve_resource_package_proposal", {
      p_tutor: tutor.user.id, p_plan: planId, p_session: sessionId, p_proposal: proposalId,
      p_rs_proposal: proposal.id, p_objective: objectiveKey, p_items: items,
    });
    if (result.error || !Array.isArray(result.data)) throw new Error();
    return { assignments: project(result.data) };
  } catch { return { error: failure }; }
}
export async function previewApprovedPractice(planId: string, assignmentId: string): Promise<{ url?: string; error?: string }> {
  if (process.env.NODE_ENV !== "development") return { error: "Practice previews are available only in development." };
  const tutor = await requireTutor();
  try {
    await assertOwnedResourcePlan(planId, tutor);
    const row = (await list(tutor.user.id, planId)).find(r => r.id === assignmentId);
    if (!row) throw new Error();
    return { url: await durablePackagePreview(row.packageId, row.integrity) };
  } catch { return { error: "Could not open approved practice. Try again." }; }
}
