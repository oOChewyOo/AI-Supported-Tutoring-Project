import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";
import { CompleteActivityButton } from "@/components/complete-activity-button";
import { getActivity } from "@/lib/data";
import { ResourceStudioExercise } from "@/components/resource-studio-exercise";
import { getResourceExercise } from "@/lib/resource-studio/assignments";
import { ResourceStudioError } from "@/lib/resource-studio/activity";

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getActivity(id);
  if (!data) notFound();

  if (data.activity.resourceStudioAssigned) {
    if (process.env.NODE_ENV !== "development") notFound();
    let exercise;
    let message;
    try { exercise = await getResourceExercise(id); }
    catch (error) { message = error instanceof ResourceStudioError ? error.message : "Could not load the imported exercise."; }
    return <main className="narrow-shell">
      <Link href={`/plans/${data.planId}`} className="back-link">Back to weekly plan</Link>
      {exercise ? <ResourceStudioExercise activityId={id} exercise={exercise} />
        : <><h1>Imported exercise unavailable</h1><p role="alert">{message ?? "The saved snapshot could not be found."}</p></>}
    </main>;
  }


  return (
    <main className="narrow-shell">
      <Link href={`/plans/${data.planId}`} className="back-link"><ArrowLeft size={15} /> Back to weekly plan</Link>
      <article className="activity-page-card">
        <span className="kicker">Session {data.session.sessionNumber} · {data.activity.type}</span>
        <h1>{data.activity.title}</h1>
        <p className="activity-lead">{data.activity.description}</p>
        {process.env.NODE_ENV === "development" && !data.activity.contentJson && !data.activity.templateId &&
          <Link className="button button-small" href={`/dev/resource-studio/assign/${id}`}>Assign Resource Studio exercise</Link>}
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
