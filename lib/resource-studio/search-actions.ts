"use server";

import { requireTutor } from "@/lib/auth";
import { ResourceStudioError } from "./activity";
import { parseResourceSearchQuery, searchResourceActivities } from "./search";
import type { ResourceSearchState } from "./search-types";
import { assertOwnedResourcePlan } from "./plan-ownership";

export async function searchResourceStudioAction(planId: string, _state: ResourceSearchState, form: FormData): Promise<ResourceSearchState> {
  if (process.env.NODE_ENV !== "development") return { error: "Resource Studio search is available only in development." };
  // Preserve auth redirects, and never trust bound plan IDs or previous action state.
  const tutor = await requireTutor();
  try {
    await assertOwnedResourcePlan(planId, tutor);
    if (form.getAll("fictional").length !== 1 || form.get("fictional") !== "confirmed") {
      return { error: "Confirm that this is an existing fictional test student before searching." };
    }
    const params = new URLSearchParams();
    for (const [key, value] of form) {
      if (key === "fictional" || key.startsWith("$ACTION_")) continue;
      if (typeof value !== "string") throw new ResourceStudioError("Invalid search parameters.");
      params.append(key, value);
    }
    const query = parseResourceSearchQuery(params);
    const results = await searchResourceActivities(params);
    return { query, results };
  } catch (error) {
    return { error: error instanceof ResourceStudioError ? error.message : "Could not search Resource Studio. Please try again." };
  }
}
