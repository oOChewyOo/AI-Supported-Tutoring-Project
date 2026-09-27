"use server";

import { requireTutor } from "@/lib/auth";
import { ResourceStudioError } from "./activity";
import { assertOwnedResourcePlan } from "./plan-ownership";
import { fetchResourceActivityVersion, ResourcePublicationUnavailableError } from "./server";
import type { ResourcePreviewState } from "./preview-types";

export async function previewResourceStudioAction(planId: string, activityId: unknown, version: unknown, fictional: unknown): Promise<ResourcePreviewState> {
  if (process.env.NODE_ENV !== "development") return { error: "Resource Studio preview is available only in development." };
  // Auth redirects must not become successful action responses.
  const tutor = await requireTutor();
  try {
    await assertOwnedResourcePlan(planId, tutor);
    if (fictional !== true) return { error: "Confirm that this is an existing fictional test student before previewing." };
    return { activity: await fetchResourceActivityVersion(activityId, version) };
  } catch (error) {
    if (error instanceof ResourcePublicationUnavailableError) return { error: error.message, unavailable: true };
    return { error: error instanceof ResourceStudioError ? error.message : "Could not load the preview. Return to the results and try again." };
  }
}
