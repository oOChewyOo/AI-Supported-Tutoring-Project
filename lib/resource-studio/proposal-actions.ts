"use server";

import { requireTutor } from "@/lib/auth";
import { ResourceStudioError } from "./activity";
import { assertOwnedResourcePlan } from "./plan-ownership";
import { buildPracticeNeed } from "./proposal-contract";
import { proposalOrigin, requestPracticeProposal } from "./proposal-client";
import { proposalBusy, retainProposal, retainedProposal, type TutorProposal } from "./proposal-store";

export async function buildPracticeProposalAction(planId: string, objectiveKey: string, controls: unknown, confirmed: unknown): Promise<{ proposal?: TutorProposal; error?: string }> {
  if (process.env.NODE_ENV !== "development") return { error: "Practice proposals are available only in development." };
  const tutor = await requireTutor();
  let busyKey: string | undefined;
  try {
    const plan = await assertOwnedResourcePlan(planId, tutor);
    if (confirmed !== true) return { error: "Confirm fictional data and a non-identifying educational objective before building practice." };
    const { data, error } = await tutor.supabase.from("extracted_objectives")
      .select("focus_for_next_week,developing_objectives,secure_objectives,suggested_retrieval_items")
      .eq("student_id", plan.student_id).eq("lesson_reflection_id", plan.lesson_reflection_id).maybeSingle();
    if (error || !data) return { error: "Extract and review objectives for this plan's reflection first." };
    const need = buildPracticeNeed(data, objectiveKey, controls);
    const key = `${tutor.user.id}:${planId}`;
    if (proposalBusy.has(key)) return { error: "A proposal is already being built for this plan. Wait for it to finish." };
    proposalBusy.add(key); busyKey = key;
    const proposal = await requestPracticeProposal(need);
    // Re-check ownership after a potentially long remote call.
    await assertOwnedResourcePlan(planId, tutor);
    return { proposal: retainProposal(tutor.user.id, planId, proposal, objectiveKey) };
  } catch (error) {
    return { error: error instanceof ResourceStudioError ? error.message : "Could not build practice. Check the objective, subject, year, duration and intents, then try again." };
  } finally { if (busyKey) proposalBusy.delete(busyKey); }
}

export async function previewPracticeProposalAction(planId: string, proposalId: string, activityId: string, confirmed: unknown): Promise<{ url?: string; error?: string }> {
  if (process.env.NODE_ENV !== "development") return { error: "Practice previews are available only in development." };
  const tutor = await requireTutor();
  try {
    await assertOwnedResourcePlan(planId, tutor);
    if (confirmed !== true) return { error: "Confirm fictional data before previewing." };
    const proposal = retainedProposal(proposalId, tutor.user.id, planId);
    const activity = proposal?.activities.find(item => item.id === activityId && item.status === "ready");
    if (!activity?.previewToken) return { error: "Preview expired or unavailable. Rebuild the proposal." };
    const url = new URL("/integrations/practice-loop/review", proposalOrigin());
    url.hash = activity.previewToken;
    return { url: url.toString() };
  } catch { return { error: "Could not open this review preview. Check tutor access or rebuild the proposal." }; }
}
