"use server";

import { requireTutor } from "@/lib/auth";
import { assertOwnedResourcePlan } from "./plan-ownership";
import type { ResourceSessionOption } from "./session-options";

/** Read only: the protected weekly-plan page need not pass or expose pupil data. */
export async function getResourceSessionOptions(planId: string, fictional: unknown): Promise<{ sessions?: ResourceSessionOption[]; error?: string }> {
  if (process.env.NODE_ENV !== "development") return { error: "Session planning is available only in development." };
  const tutor = await requireTutor();
  try {
    await assertOwnedResourcePlan(planId, tutor);
    if (fictional !== true) return { error: "Confirm that this is an existing fictional test student." };
    const { data, error } = await tutor.supabase.from("weekly_sessions").select("id,session_number,title")
      .eq("weekly_plan_id", planId).order("session_number");
    if (error) throw error;
    return { sessions: data ?? [] };
  } catch {
    return { error: "Could not load sessions for this weekly plan. Check your tutor access and try again." };
  }
}
