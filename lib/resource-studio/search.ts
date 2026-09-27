import "server-only";
import { ResourceStudioError } from "./activity";
import type { ResourceSearchItem, ResourceSearchQuery, ResourceSearchResults } from "./search-types";

const MAX_INTEGER = 2_147_483_647;

export function parseResourceSearchQuery(params: URLSearchParams): ResourceSearchQuery {
  const allowed = new Set(["q", "subject", "yearGroup", "page", "pageSize"]);
  for (const [key, value] of params) {
    if (!allowed.has(key) || params.getAll(key).length !== 1 || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
      throw new ResourceStudioError("Invalid search parameters. Use keywords and curriculum filters only.");
    }
  }
  function text(key: string, max: number) {
    const value = params.get(key) ?? "";
    if (value.length > max) throw new ResourceStudioError(`Search ${key} must be at most ${max} characters.`);
    return value.trim().replace(/\s+/g, " ");
  }
  function integer(key: string, fallback: number, max: number) {
    const value = params.get(key);
    if (value === null) return fallback;
    if (!/^[1-9]\d*$/.test(value) || Number(value) > max) {
      throw new ResourceStudioError(`Search ${key} must be a whole number from 1 to ${max}.`);
    }
    return Number(value);
  }
  return { q: text("q", 120), subject: text("subject", 80), yearGroup: text("yearGroup", 40),
    page: integer("page", 1, MAX_INTEGER), pageSize: integer("pageSize", 10, 20) };
}

function invalid(): never {
  throw new ResourceStudioError("Resource Studio returned invalid search results. Please try again or check the integration version.");
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || value.length > 20000) invalid();
  return value;
}
function integer(value: unknown, min: number, max = MAX_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) invalid();
  return value;
}

/** Reconstruct an allowlist instead of passing through upstream objects. */
export function parseResourceSearchResults(value: unknown): ResourceSearchResults {
  const root = record(value);
  const total = integer(root.total, 0);
  const pageSize = integer(root.pageSize, 1, 20);
  const totalPages = integer(root.totalPages, 1);
  const page = integer(root.page, 1, totalPages);
  if (totalPages !== Math.max(1, Math.ceil(total / pageSize)) || !Array.isArray(root.items) ||
    root.items.length !== Math.min(pageSize, Math.max(0, total - (page - 1) * pageSize))) invalid();
  const items = root.items.map((value): ResourceSearchItem => {
    const item = record(value);
    if (item.activityType !== "multiple_choice" || !Array.isArray(item.tags) || item.tags.length > 1000) invalid();
    return {
      id: text(item.id), title: text(item.title), contentVersion: integer(item.contentVersion, 1, Number.MAX_SAFE_INTEGER),
      activityType: "multiple_choice", subject: text(item.subject), yearGroup: text(item.yearGroup),
      objectiveId: text(item.objectiveId), objectiveTitle: text(item.objectiveTitle), tags: item.tags.map(text),
    };
  });
  if (new Set(items.map(item => item.id)).size !== items.length) invalid();
  return { items, total, page, pageSize, totalPages };
}

export async function searchResourceActivities(params: URLSearchParams): Promise<ResourceSearchResults> {
  if (process.env.NODE_ENV !== "development") throw new ResourceStudioError("Resource Studio search is available only in development.");
  const query = parseResourceSearchQuery(params);
  // Same server-only configuration as the existing single-activity integration.
  const base = process.env.RESOURCE_STUDIO_BASE_URL;
  const key = process.env.PRACTICE_LOOP_INTEGRATION_KEY;
  if (!base || !key?.trim()) throw new ResourceStudioError("Resource Studio search is not configured. Check the server integration settings.");
  let url: URL;
  try {
    const origin = new URL(base);
    if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") throw new Error();
    url = new URL("/api/integrations/practice-loop/activities", origin);
  } catch {
    throw new ResourceStudioError("Resource Studio search has an invalid server address. Configure an HTTP(S) origin.");
  }
  for (const name of ["q", "subject", "yearGroup"] as const) {
    if (query[name]) url.searchParams.set(name, query[name]);
  }
  url.searchParams.set("page", String(query.page));
  url.searchParams.set("pageSize", String(query.pageSize));
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
  } catch {
    throw new ResourceStudioError("Cannot reach Resource Studio. Check that it is running and try the search again.");
  }
  if (response.status === 401 || response.status === 403) throw new ResourceStudioError("Resource Studio authentication failed. Check the server integration settings.");
  if (!response.ok) throw new ResourceStudioError("Resource Studio search is unavailable. Check that the search API and its database migration are enabled, then try again.");
  let payload: unknown;
  try { payload = await response.json(); } catch { invalid(); }
  const results = parseResourceSearchResults(payload);
  if (results.pageSize !== query.pageSize || results.page !== Math.min(query.page, results.totalPages)) invalid();
  return results;
}
