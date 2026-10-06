import Link from "next/link";
import { learnerSession } from "@/lib/learner-practice";
export default async function EndPage({ params }: { params: Promise<{ planId: string; sessionId: string }> }) {
  const { planId, sessionId } = await params;
  await learnerSession(planId, sessionId);
  return <main className="page-shell"><h1>End of assigned practice</h1><p>You have reached the end of the assigned activities.</p>
    <p>Your responses have not been saved.</p><Link href={`/learn/${planId}/${sessionId}`}>Back to session</Link></main>;
}
