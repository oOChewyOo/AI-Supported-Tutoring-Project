import "server-only";
import { requireTutor } from "@/lib/auth";
import { requireResourceDevelopment } from "./assignments";
import { ResourceStudioError } from "./activity";
import type { ResourceActivityReport } from "./report-types";

export async function getResourceStudioPlanReport(planId: string): Promise<ResourceActivityReport[]> {
  requireResourceDevelopment();
  const { supabase } = await requireTutor();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId)) {
    throw new ResourceStudioError("The plan could not be found or you do not have tutor access.");
  }
  // Per-request session client already uses no-store. No shared/user-crossing cache.
  const { data, error } = await supabase.rpc("get_resource_studio_plan_report", { p_plan_id: planId })
    .then(result => result, () => { throw new ResourceStudioError("Could not load saved results. Refresh the page to try again."); });
  if (error?.code === "42501") throw new ResourceStudioError("The plan could not be found or you do not have tutor access.");
  if (["PGRST202", "42883", "55000"].includes(error?.code ?? "")) {
    throw new ResourceStudioError("Progress reporting is unavailable. Follow docs/resource-studio-progress-report.md to review the local reporting migration.");
  }
  if (error || !Array.isArray(data)) throw new ResourceStudioError("Could not load saved results. Refresh the page to try again.");
  return data as ResourceActivityReport[];
}
