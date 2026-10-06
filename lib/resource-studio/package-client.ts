import "server-only";
import { createHash } from "node:crypto";
import { proposalOrigin } from "./proposal-client";
import { parseResourcePackageReference } from "./package-reference";
import type { PracticeProposal, ProposalActivity } from "./proposal-contract";

// Namespaced deterministic UUID: retries and concurrent clicks use the same RS key.
export function materializationKey(proposalId: string, activityId: string) {
  const h = createHash("sha256").update(JSON.stringify(["pl-approval-v1", proposalId, activityId])).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
async function request(path: string, body: unknown) {
  const key = process.env.PRACTICE_LOOP_INTEGRATION_KEY;
  if (process.env.NODE_ENV !== "development" || !key) throw new Error("Integration unavailable.");
  const response = await fetch(new URL(path, proposalOrigin()), { method: "POST", headers: {
    Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("Package unavailable.");
  return response.json();
}
export async function materializeProposalActivity(proposal: PracticeProposal, activity: ProposalActivity) {
  // Dose is the only free-form display metadata persisted by approval. Fail
  // closed if an upstream response ever mixes it with source/rights details.
  if (/\b(?:Twinkl|Oak|Math Salamanders|provider|attribution|provenance|licen[cs]e|sourceItemIds|hashes)\b|sourceUrl|https?:\/\//i.test(activity.dose)) throw new Error("Invalid educational metadata.");
  const value = parseResourcePackageReference(await request("/api/integrations/practice-loop/assignment-packages", {
    proposalId: proposal.id, proposalActivityId: activity.id, previewToken: activity.previewToken,
    idempotencyKey: materializationKey(proposal.id, activity.id),
  }));
  if (value.activityType !== activity.activityType) throw new Error("Package type mismatch.");
  return value;
}
export async function durablePackagePreview(packageId: string, integrity: string) {
  const value = await request("/api/integrations/practice-loop/package-preview", { packageId, integrity });
  if (!value || typeof value.token !== "string" || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value.token) || value.token.length > 1500) throw new Error("Invalid preview.");
  const url = new URL("/integrations/practice-loop/package-review", proposalOrigin());
  url.hash = value.token;
  return url.toString();
}
