import "server-only";
import { parseResourceActivity, RESOURCE_ACTIVITY_ID, ResourceStudioError } from "./activity";

export class ResourcePublicationUnavailableError extends ResourceStudioError {}

/** Keep the existing fixed-activity assignment caller unversioned and unchanged. */
export async function fetchResourceActivity() {
  return parseResourceActivity(await fetchResourcePayload(RESOURCE_ACTIVITY_ID));
}

export function validateResourcePreviewSelection(id: unknown, version: unknown): { id: string; version: number } {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
    throw new ResourceStudioError("Choose a valid Resource Studio activity from the search results.");
  }
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1 || version > 2_147_483_647) {
    throw new ResourceStudioError("Choose a valid published version from the search results.");
  }
  return { id, version };
}

/** Exact version only. Trusted publication status is enforced by the upstream endpoint. */
export async function fetchResourceActivityVersion(id: unknown, version: unknown) {
  const selection = validateResourcePreviewSelection(id, version);
  const activity = parseResourceActivity(await fetchResourcePayload(selection.id, selection.version), selection.id);
  if (activity.contentVersion !== selection.version) {
    throw new ResourceStudioError("Resource Studio returned a different activity version. Preview unavailable; search again.");
  }
  return activity;
}

async function fetchResourcePayload(activityId: string, version?: number): Promise<unknown> {
  if (process.env.NODE_ENV !== "development") throw new ResourceStudioError("Resource Studio preview is available only in development.");
  const base = process.env.RESOURCE_STUDIO_BASE_URL;
  const key = process.env.PRACTICE_LOOP_INTEGRATION_KEY;
  if (!base || !key?.trim()) throw new ResourceStudioError("Set RESOURCE_STUDIO_BASE_URL and PRACTICE_LOOP_INTEGRATION_KEY in Practice Loop's .env.local, then restart the development server.");
  let url: URL;
  try {
    const origin = new URL(base);
    if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") throw new Error();
    url = new URL(`/api/integrations/practice-loop/activities/${encodeURIComponent(activityId)}`, origin);
    if (version !== undefined) url.searchParams.set("version", String(version));
  } catch {
    throw new ResourceStudioError("RESOURCE_STUDIO_BASE_URL must be an HTTP(S) origin, such as http://localhost:3001.");
  }
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ResourceStudioError("Cannot reach Resource Studio. Check that it is running, verify RESOURCE_STUDIO_BASE_URL, then reload. The request may have timed out or been redirected.");
  }
  if (response.status === 401 || response.status === 403) throw new ResourceStudioError("Resource Studio authentication failed. Check PRACTICE_LOOP_INTEGRATION_KEY on both servers and restart Practice Loop.");
  if (version !== undefined && [404, 410, 422].includes(response.status)) {
    throw new ResourcePublicationUnavailableError("This published version is unavailable or no longer valid for preview. Return to the results and search again.");
  }
  if (response.status === 404) throw new ResourceStudioError("The published equivalent-fractions activity was not found in Resource Studio. Check that it is published.");
  if (!response.ok) throw new ResourceStudioError(`Resource Studio could not load the activity (HTTP ${response.status}). Try again shortly.`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ResourceStudioError("Resource Studio returned invalid JSON. Check the published activity response."); }
  return payload;
}
