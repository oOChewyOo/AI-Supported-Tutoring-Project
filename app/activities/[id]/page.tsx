import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";
import { CompleteActivityButton } from "@/components/complete-activity-button";
import { getActivity } from "@/lib/data";

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getActivity(id);
  if (!data) notFound();

  return (
    <main className="narrow-shell">
      <Link href={`/plans/${data.planId}`} className="back-link"><ArrowLeft size={15} /> Back to weekly plan</Link>
      <article className="activity-page-card">
        <span className="kicker">Session {data.session.sessionNumber} · {data.activity.type}</span>
        <h1>{data.activity.title}</h1>
        <p className="activity-lead">{data.activity.description}</p>
        <div className="activity-task">
          <span><Clock3 size={15} /> About {data.activity.minutes} minutes</span>
          <h2>Placeholder practice task</h2>
          <p>Complete a short piece of practice related to this activity. When you are happy with your effort, mark it complete.</p>
        </div>
        <CompleteActivityButton activityId={data.activity.id} studentId={data.student.id} planId={data.planId} completed={data.activity.completed} />
      </article>
    </main>
  );
}
