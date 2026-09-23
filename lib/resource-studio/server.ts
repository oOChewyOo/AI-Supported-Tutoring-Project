import "server-only";
import { parseResourceActivity, RESOURCE_ACTIVITY_ID, ResourceStudioError } from "./activity";

export async function fetchResourceActivity() {
  if (process.env.NODE_ENV !== "development") throw new ResourceStudioError("Resource Studio preview is available only in development.");
  const base = process.env.RESOURCE_STUDIO_BASE_URL;
  const key = process.env.PRACTICE_LOOP_INTEGRATION_KEY;
  if (!base || !key?.trim()) throw new ResourceStudioError("Set RESOURCE_STUDIO_BASE_URL and PRACTICE_LOOP_INTEGRATION_KEY in Practice Loop's .env.local, then restart the development server.");
  let url: URL;
  try {
    const origin = new URL(base);
    if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") throw new Error();
    url = new URL(`/api/integrations/practice-loop/activities/${RESOURCE_ACTIVITY_ID}`, origin);
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
  if (response.status === 404) throw new ResourceStudioError("The published equivalent-fractions activity was not found in Resource Studio. Check that it is published.");
  if (!response.ok) throw new ResourceStudioError(`Resource Studio could not load the activity (HTTP ${response.status}). Try again shortly.`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ResourceStudioError("Resource Studio returned invalid JSON. Check the published activity response."); }
  return parseResourceActivity(payload);
}
