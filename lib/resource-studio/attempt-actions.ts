"use server";

import { revalidatePath } from "next/cache";
import { requireTutor } from "@/lib/auth";
import { getOwnedResourceSlot, requireResourceDevelopment } from "./assignments";
import { attemptError } from "./attempts";
import type { ResourceAttempt, ResourceAttemptState } from "./exercise-types";

export async function submitResourceStudioAttempt(activityId: string, _state: ResourceAttemptState, form: FormData): Promise<ResourceAttemptState> {
  requireResourceDevelopment();
  await requireTutor();
  const answers: Record<string, string[]> = Object.create(null);
  let count = 0;
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("answer:")) continue;
    if (++count > 3000 || typeof value !== "string" || value.length > 20000 || key.length > 20007) return { error: attemptError("22023") };
    (answers[key.slice(7)] ??= []).push(value);
  }
  try {
    const slot = await getOwnedResourceSlot(activityId);
    const { data, error } = await slot.supabase.rpc("submit_resource_studio_attempt", { p_activity_id: activityId, p_answers: answers });
    if (error) return { error: attemptError(error.code) };
    if (!data) return { error: attemptError() };
    revalidatePath(`/activities/${activityId}`);
    revalidatePath(`/plans/${slot.plan.id}`);
    revalidatePath(`/students/${slot.student.id}`);
    return { attempt: data as ResourceAttempt };
  } catch {
    // Includes transport failures where the commit may have succeeded. Retrying
    // the RPC returns the original result; never guess success from local state.
    return { error: attemptError() };
  }
}
