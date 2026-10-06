import { proposalActivityTypes } from "./proposal-contract";

/** RS owns the canonical all-11 schemas. PL validates only this opaque envelope. */
export type ResourcePackageReference = {
  schemaVersion: "1"; packageId: string; activityId: string; contentVersion: 1;
  releaseId: string | null; resourceVersion: number | null;
  activityType: typeof proposalActivityTypes[number]; integrity: string;
  scoringMode: "automatic" | "manual_review" | "hybrid_review";
  status: "prepared"; assigned: false; contentAccess: "authenticated_server_only";
  learnerDelivery: "not_implemented";
};
export function parseResourcePackageReference(raw: unknown): ResourcePackageReference {
  const fail = (): never => { throw new Error("Invalid Resource Studio package reference."); };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail();
  const value = raw as Record<string, unknown>;
  const keys = ["schemaVersion", "packageId", "activityId", "contentVersion", "releaseId", "resourceVersion", "activityType", "integrity", "scoringMode", "status", "assigned", "contentAccess", "learnerDelivery"];
  if (Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) return fail();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof value.packageId !== "string" || !uuid.test(value.packageId) || typeof value.activityId !== "string" || !/^[a-zA-Z0-9_-]{1,500}$/.test(value.activityId) ||
      typeof value.integrity !== "string" || !/^[a-f0-9]{64}$/.test(value.integrity) ||
      !proposalActivityTypes.includes(value.activityType as typeof proposalActivityTypes[number]) ||
      value.schemaVersion !== "1" || value.contentVersion !== 1 || value.status !== "prepared" || value.assigned !== false ||
      value.contentAccess !== "authenticated_server_only" || value.learnerDelivery !== "not_implemented") return fail();
  if (value.releaseId === null ? value.resourceVersion !== null :
    typeof value.releaseId !== "string" || !/^[a-zA-Z0-9_-]{1,500}$/.test(value.releaseId) || typeof value.resourceVersion !== "number" || !Number.isSafeInteger(value.resourceVersion) || value.resourceVersion < 1) return fail();
  const expected = value.activityType === "comprehension" ? "hybrid_review" :
    ["short_written_response", "explain_thinking"].includes(String(value.activityType)) ? "manual_review" : "automatic";
  if (value.scoringMode !== expected) return fail();
  return { ...value } as ResourcePackageReference;
}
