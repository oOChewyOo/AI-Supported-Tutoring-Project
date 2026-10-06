import "server-only";
import { notFound } from "next/navigation";
import { requireLearner } from "@/lib/auth";
import { learnerPackageDelivery } from "@/lib/resource-studio/learner-client";

export type LearnerAssignment = { id: string; activityType: string; dose: string; position: number };
export type LearnerSession = { id: string; number: number; title: string; assignments: LearnerAssignment[] };
export type LearnerPlan = { id: string; title: string; sessions: LearnerSession[] };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function learnerPractice(): Promise<LearnerPlan[]> {
  const { supabase } = await requireLearner();
  const { data, error } = await supabase.rpc("get_learner_practice");
  if (error || !Array.isArray(data)) throw Error("Assigned practice is unavailable.");
  return data;
}
export async function learnerSession(planId: string, sessionId: string) {
  if (!uuid.test(planId) || !uuid.test(sessionId)) notFound();
  const plans = await learnerPractice();
  const plan = plans.find(p => p.id === planId);
  const session = plan?.sessions.find(s => s.id === sessionId);
  if (!plan || !session) notFound();
  return { plan, session };
}
export async function learnerDelivery(planId: string, sessionId: string, assignmentId: string) {
  const { supabase } = await requireLearner();
  if (![planId,sessionId,assignmentId].every(id => uuid.test(id))) notFound();
  const { data, error } = await supabase.rpc("get_learner_delivery_reference", {
    p_plan: planId, p_session: sessionId, p_assignment: assignmentId,
  });
  if (error || !data) notFound();
  // No student/name/profile nor browser-supplied package reference crosses to RS.
  return learnerPackageDelivery(data.packageId, data.integrity);
}
