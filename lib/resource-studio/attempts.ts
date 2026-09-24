import "server-only";
import { requireTutor } from "@/lib/auth";
import { requireResourceDevelopment } from "./assignments";
import { ResourceStudioError } from "./activity";
import type { ResourceAttempt } from "./exercise-types";

export function attemptError(code?: string) {
  if (code === "42501") return "The activity could not be found or you do not have tutor access.";
  if (code === "22023") return "Choose an answer for every question, using only the available options.";
  if (["PGRST202", "42883", "55000"].includes(code ?? "")) return "Saved attempts are unavailable. Review the local setup in docs/resource-studio-attempts.md.";
  return "Could not confirm the saved attempt. Reload to check whether it was saved, or submit again safely. Your first completed submission will be kept.";
}

export async function getResourceAttempt(activityId: string): Promise<ResourceAttempt | null> {
  requireResourceDevelopment();
  const { supabase } = await requireTutor();
  const { data, error } = await supabase.rpc("get_resource_studio_attempt", { p_activity_id: activityId });
  if (error) throw new ResourceStudioError(attemptError(error.code));
  return data as ResourceAttempt | null;
}
