import Link from "next/link";
import { learnerSession } from "@/lib/learner-practice";
export default async function SessionPage({ params }: { params: Promise<{ planId: string; sessionId: string }> }) {
  const { planId, sessionId } = await params;
  const { session } = await learnerSession(planId, sessionId);
  return <main className="page-shell"><Link href="/learn">Your practice</Link><h1>Session {session.number}: {session.title}</h1>
    {!session.assignments.length && <p>No activities are assigned to this session yet.</p>}
    <ol>{session.assignments.map(a => <li key={a.id}><h2>{a.activityType.replaceAll("_", " ")}</h2><p>{a.dose}</p>
      <Link className="button" href={`/learn/${planId}/${sessionId}/${a.id}`}>Start</Link></li>)}</ol>
  </main>;
}
