import Link from "next/link";
import { notFound } from "next/navigation";
import { learnerDelivery, learnerSession } from "@/lib/learner-practice";
import {learnerSubmissions} from "@/lib/practice-submissions";
import {PracticeResult} from "@/components/practice-result";
import {LearnerDeliveryFrame} from "@/components/learner-delivery-frame";
export default async function ActivityPage({ params }: { params: Promise<{ planId: string; sessionId: string; assignmentId: string }> }) {
  const { planId, sessionId, assignmentId } = await params;
  const { session } = await learnerSession(planId, sessionId);
  const index = session.assignments.findIndex(a => a.id === assignmentId);
  if (index < 0) notFound();
  const submission = (await learnerSubmissions(planId)).find(r=>r.assignmentId===assignmentId);
  const url = submission?.attemptId ? null : await learnerDelivery(planId, sessionId, assignmentId);
  const base = `/learn/${planId}/${sessionId}`;
  return <main className="page-shell"><Link href={base}>Back to session</Link><h1>Activity {index + 1} of {session.assignments.length}</h1>
    {url ? <><p>Complete all responses, then choose Submit activity to save your work. Your first submitted response is kept.</p>
      <LearnerDeliveryFrame url={url} submitPath={`/api/learn/${planId}/${sessionId}/${assignmentId}`} /></> : submission && <PracticeResult submission={submission} showResponses />}
    <nav aria-label="Assigned activity navigation">
      {index > 0 && <Link href={`${base}/${session.assignments[index - 1].id}`}>Previous activity</Link>}
      <Link className="button" href={index + 1 < session.assignments.length ? `${base}/${session.assignments[index + 1].id}` : `${base}/end`}>
        {index + 1 < session.assignments.length ? "Next activity" : "End of assigned practice"}</Link>
    </nav>
  </main>;
}
