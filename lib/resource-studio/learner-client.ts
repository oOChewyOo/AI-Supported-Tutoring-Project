import "server-only";
import { proposalOrigin } from "./proposal-client";
export async function learnerPackageDelivery(packageId: string, integrity: string) {
  const key = process.env.PRACTICE_LOOP_INTEGRATION_KEY;
  if (process.env.NODE_ENV !== "development" || !key) throw Error("Delivery unavailable.");
  if (!/^[a-f0-9-]{36}$/i.test(packageId) || !/^[a-f0-9]{64}$/.test(integrity)) throw Error("Invalid assignment.");
  const response = await fetch(new URL("/api/integrations/practice-loop/learner-delivery", proposalOrigin()), {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ packageId, integrity }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw Error("Delivery unavailable.");
  const value = await response.json();
  if (!value || typeof value.token !== "string" || !/^ld1_[A-Za-z0-9_-]{43}$/.test(value.token)) throw Error("Delivery unavailable.");
  const url = new URL("/integrations/practice-loop/learn", proposalOrigin());
  url.hash = value.token;
  return url.toString();
}
