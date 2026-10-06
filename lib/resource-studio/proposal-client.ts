import "server-only";
import { ResourceStudioError } from "./activity";
import { parsePracticeNeed, parsePracticeProposal, type PracticeNeed } from "./proposal-contract";

export function proposalOrigin() {
  try {
    const url = new URL(process.env.RESOURCE_STUDIO_BASE_URL ?? "");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
    return url;
  } catch { throw new ResourceStudioError("Resource Studio has an invalid server address. Check the integration settings."); }
}
export async function requestPracticeProposal(raw: PracticeNeed) {
  if (process.env.NODE_ENV !== "development") throw new ResourceStudioError("Practice proposals are available only in development.");
  const need = parsePracticeNeed(raw);
  const key = process.env.PRACTICE_LOOP_INTEGRATION_KEY;
  if (!key?.trim()) throw new ResourceStudioError("Resource Studio integration is not configured.");
  const url = new URL("/api/integrations/practice-loop/practice-proposals", proposalOrigin());
  console.info("Resource Studio proposal request", { fields: Object.keys(need), subject: need.subject, year: need.year, durationMinutes: need.durationMinutes });
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(need), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(240_000) });
  } catch { throw new ResourceStudioError("Resource Studio did not respond within four minutes or could not be reached. Try rebuilding the proposal."); }
  if ([401, 403].includes(response.status)) throw new ResourceStudioError("Resource Studio authentication or development access failed. Check the server integration settings.");
  if (!response.ok) throw new ResourceStudioError("Resource Studio could not build this proposal. Try again.");
  try {
    const proposal = parsePracticeProposal(await response.json());
    if (proposal.objective !== need.objective || proposal.requestedMinutes !== need.durationMinutes) throw new Error();
    return proposal;
  } catch { throw new ResourceStudioError("Resource Studio returned an invalid proposal. Check the integration version and try again."); }
}
