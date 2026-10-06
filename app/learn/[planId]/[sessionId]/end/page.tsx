import Link from "next/link";
import { learnerSession } from "@/lib/learner-practice";
import {learnerSubmissions} from "@/lib/practice-submissions";
export default async function EndPage({ params }: { params: Promise<{ planId: string; sessionId: string }> }) {
  const { planId, sessionId } = await params;
  const {session}=await learnerSession(planId, sessionId);
  const results=(await learnerSubmissions(planId)).filter(r=>r.sessionId===sessionId);
  const complete=session.assignments.length>0&&session.assignments.every(a=>results.some(r=>r.assignmentId===a.id&&r.attemptId));
  return <main className="page-shell"><h1>{complete?"Session complete":"Practice still to submit"}</h1>
    <p>{results.filter(r=>r.attemptId).length} of {session.assignments.length} assigned activities submitted.</p>
    {results.some(r=>r.result?.reviewStatus==="pending")&&<p>Your written responses are saved for tutor review.</p>}
    <Link href={`/learn/${planId}/${sessionId}`}>Back to session</Link></main>;
}
