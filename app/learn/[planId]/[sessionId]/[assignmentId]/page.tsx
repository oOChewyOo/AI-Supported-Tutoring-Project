import Link from "next/link";
import { notFound } from "next/navigation";
import { learnerDelivery, learnerSession } from "@/lib/learner-practice";
export default async function ActivityPage({ params }: { params: Promise<{ planId: string; sessionId: string; assignmentId: string }> }) {
  const { planId, sessionId, assignmentId } = await params;
  const { session } = await learnerSession(planId, sessionId);
  const index = session.assignments.findIndex(a => a.id === assignmentId);
  if (index < 0) notFound();
  const url = await learnerDelivery(planId, sessionId, assignmentId);
  const base = `/learn/${planId}/${sessionId}`;
  return <main className="page-shell"><Link href={base}>Back to session</Link><h1>Activity {index + 1} of {session.assignments.length}</h1>
    <p>Responses stay on this page and are not saved.</p>
    <iframe title="Assigned practice" src={url} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" style={{ width: "100%", height: "75vh", border: "1px solid #ddd" }} />
    <nav aria-label="Assigned activity navigation">
      {index > 0 && <Link href={`${base}/${session.assignments[index - 1].id}`}>Previous activity</Link>}
      <Link className="button" href={index + 1 < session.assignments.length ? `${base}/${session.assignments[index + 1].id}` : `${base}/end`}>
        {index + 1 < session.assignments.length ? "Next activity" : "End of assigned practice"}</Link>
    </nav>
  </main>;
}
