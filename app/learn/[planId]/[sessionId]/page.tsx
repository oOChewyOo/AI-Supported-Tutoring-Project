import Link from "next/link";
import { learnerSession } from "@/lib/learner-practice";
import {learnerSubmissions} from "@/lib/practice-submissions";
import {PracticeResult} from "@/components/practice-result";
export default async function SessionPage({ params }: { params: Promise<{ planId: string; sessionId: string }> }) {
  const { planId, sessionId } = await params;
  const { session } = await learnerSession(planId, sessionId);
  const results = await learnerSubmissions(planId);
  return <main className="page-shell"><Link href="/learn">Your practice</Link><h1>Session {session.number}: {session.title}</h1>
    {!session.assignments.length && <p>No activities are assigned to this session yet.</p>}
    <ol>{session.assignments.map(a => <li key={a.id}><h2>{a.activityType.replaceAll("_", " ")}</h2><p>{a.dose}</p>
      {results.find(r=>r.assignmentId===a.id)?.attemptId && <PracticeResult submission={results.find(r=>r.assignmentId===a.id)!} />}
      <Link className="button" href={`/learn/${planId}/${sessionId}/${a.id}`}>{results.find(r=>r.assignmentId===a.id)?.attemptId ? "View submission" : "Start"}</Link></li>)}</ol>
  </main>;
}
