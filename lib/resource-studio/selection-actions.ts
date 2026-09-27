"use server";

import { requireTutor } from "@/lib/auth";
import { ResourceStudioError } from "./activity";
import { assertOwnedResourcePlan } from "./plan-ownership";
import { fetchResourceActivityVersion, ResourcePublicationUnavailableError, validateResourcePreviewSelection } from "./server";
import type { ResourceSelectionState, ResourceSessionSelection } from "./selection-types";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function databaseError(code?: string) {
  if (code === "23505") return "This activity is already selected with another version. Remove it before selecting a different version.";
  if (code === "42501") return "The session could not be found or you do not have tutor access.";
  if (["55000", "PGRST202", "42P01"].includes(code ?? "")) return "Resource Studio session selections are not enabled in this development database.";
  return "Could not update or load session selections. Please try again.";
}

async function withSession(planId: string, sessionId: string, fictional: unknown,
  operation: (tutor: Awaited<ReturnType<typeof requireTutor>>) => Promise<ResourceSessionSelection[]>,
): Promise<ResourceSelectionState> {
  if (process.env.NODE_ENV !== "development") return { error: "Resource Studio selections are available only in development." };
  const tutor = await requireTutor(); // Preserve authentication redirects.
  try {
    await assertOwnedResourcePlan(planId, tutor);
    if (fictional !== true) throw new ResourceStudioError("Confirm that this is an existing fictional test student before managing selections.");
    if (typeof sessionId !== "string" || !uuid.test(sessionId)) throw new ResourceStudioError(databaseError("42501"));
    const { data, error } = await tutor.supabase.from("weekly_sessions").select("id,weekly_plan_id")
      .eq("id", sessionId).eq("weekly_plan_id", planId).maybeSingle();
    if (error || !data || data.id !== sessionId || data.weekly_plan_id !== planId) throw new ResourceStudioError(databaseError("42501"));
    return { selections: await operation(tutor) };
  } catch (error) {
    if (error instanceof ResourcePublicationUnavailableError) return { error: error.message, unavailable: true };
    return { error: error instanceof ResourceStudioError ? error.message : databaseError() };
  }
}

async function rpc(tutor: Awaited<ReturnType<typeof requireTutor>>, name: string, args: Record<string, unknown>) {
  const { data, error } = await tutor.supabase.rpc(name, args);
  if (error) throw new ResourceStudioError(databaseError(error.code));
  return data as ResourceSessionSelection[];
}

export async function listResourceSessionSelections(planId: string, sessionId: string, fictional: unknown): Promise<ResourceSelectionState> {
  return withSession(planId, sessionId, fictional, tutor => rpc(tutor, "list_resource_session_selections", {
    p_plan_id: planId, p_session_id: sessionId, p_fictional: true,
  }));
}

export async function addResourceSessionSelection(planId: string, sessionId: string, activityId: unknown, version: unknown, fictional: unknown): Promise<ResourceSelectionState> {
  return withSession(planId, sessionId, fictional, async tutor => {
    const selection = validateResourcePreviewSelection(activityId, version);
    const scope = { p_plan_id: planId, p_session_id: sessionId, p_fictional: true };
    // Enforce the database feature flag before contacting Resource Studio.
    await rpc(tutor, "list_resource_session_selections", scope);
    const activity = await fetchResourceActivityVersion(selection.id, selection.version);
    return rpc(tutor, "add_resource_session_selection", {
      ...scope, p_source_id: activity.id, p_version: activity.contentVersion, p_title: activity.title,
    });
  });
}

export async function removeResourceSessionSelection(planId: string, sessionId: string, selectionId: string, fictional: unknown): Promise<ResourceSelectionState> {
  return withSession(planId, sessionId, fictional, async tutor => {
    if (typeof selectionId !== "string" || !uuid.test(selectionId)) throw new ResourceStudioError("Invalid session selection.");
    return rpc(tutor, "remove_resource_session_selection", {
      p_plan_id: planId, p_session_id: sessionId, p_selection_id: selectionId, p_fictional: true,
    });
  });
}
