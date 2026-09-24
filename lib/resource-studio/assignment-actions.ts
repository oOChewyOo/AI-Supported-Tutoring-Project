"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTutor } from "@/lib/auth";
import { fetchResourceActivity } from "./server";
import { ResourceStudioError } from "./activity";
import { getOwnedResourceSlot, requireResourceDevelopment, resourceDatabaseError } from "./assignments";
import type { ResourceAssignmentState, ResourceCheckState } from "./exercise-types";

export async function assignResourceStudioAction(activityId: string, _state: ResourceAssignmentState, form: FormData): Promise<ResourceAssignmentState> {
  requireResourceDevelopment();
  // Keep auth redirects outside error handling; direct action calls must authenticate.
  await requireTutor();
  if (form.get("fictional") !== "confirmed") return { error: "Confirm that this is an existing fictional test student." };
  let planId: string;
  try {
    const slot = await getOwnedResourceSlot(activityId);
    if (slot.activity.resource_studio_assigned) return { error: resourceDatabaseError("23505") };
    if (slot.activity.content_json !== null || slot.activity.template_id !== null) return { error: resourceDatabaseError("23514") };
    // Ownership verified before making an authenticated upstream request.
    const snapshot = await fetchResourceActivity();
    const { error } = await slot.supabase.rpc("assign_resource_studio_activity", { p_activity_id: activityId, p_snapshot: snapshot });
    if (error) return { error: resourceDatabaseError(error.code) };
    planId = slot.plan.id;
  } catch (error) {
    return { error: error instanceof ResourceStudioError ? error.message : "Could not assign the resource. Please try again." };
  }
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/activities/${activityId}`);
  redirect(`/activities/${activityId}`);
}

export async function checkResourceStudioAction(activityId: string, _state: ResourceCheckState, form: FormData): Promise<ResourceCheckState> {
  requireResourceDevelopment();
  const { supabase } = await requireTutor();
  const answers: Record<string, string[]> = Object.create(null);
  let count = 0;
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("answer:")) continue;
    if (++count > 3000 || typeof value !== "string" || value.length > 20000 || key.length > 20007) return { error: "Invalid answers." };
    const id = key.slice(7);
    (answers[id] ??= []).push(value);
  }
  // Only IDs/selections are accepted. Definitions and scores come from the private snapshot.
  const { data, error } = await supabase.rpc("check_resource_studio_answers", { p_activity_id: activityId, p_answers: answers });
  if (error) return { error: resourceDatabaseError(error.code) };
  return data as ResourceCheckState;
}
