import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { getWeeklyPlan } from "@/lib/data";
import { ResourceStudioPlanReport } from "@/components/resource-studio-plan-report";
import { ResourceStudioSearch } from "@/components/resource-studio-search";

export default async function WeeklyPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getWeeklyPlan(id);
  if (!plan) notFound();

  const activities = plan.sessions.flatMap((session) => session.activities);
  const completedActivities = activities.filter((activity) => activity.completed).length;

  return (
    <main className="page-shell">
      <Link href={`/students/${plan.student.id}`} className="back-link"><ArrowLeft size={15} /> Back to {plan.student.name}</Link>
      <div className="plan-heading">
        <div>
          <span className="kicker">Weekly practice plan</span>
          <h1>{plan.student.name}&apos;s five-session week</h1>
          <p>Linked to the reflection from {new Date(`${plan.reflection.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.</p>
        </div>
        <span className="completion-badge"><CheckCircle2 size={15} /> {completedActivities} of {activities.length} activities complete</span>
      </div>
      <section className="plan-context">
        <div><span>Focus</span><strong>{plan.focus}</strong></div>
        <div><span>What we covered</span><strong>{plan.reflection.whatWeCovered}</strong></div>
      </section>
      {process.env.NODE_ENV === "development" && <ResourceStudioPlanReport planId={plan.id} />}
      {process.env.NODE_ENV === "development" && <ResourceStudioSearch key={plan.id} planId={plan.id} />}
      <section className="weekly-session-list">
        {plan.sessions.length ? plan.sessions.map((session) => (
          <article className={`weekly-session ${session.completed ? "is-complete" : ""}`} key={session.id}>
            <div className="weekly-session-heading">
              <span className="session-index">Session {session.sessionNumber}</span>
              <div><h2>{session.title}</h2><p><Clock3 size={14} /> {session.durationMinutes} minutes</p></div>
              {session.completed && <span className="completion-badge"><CheckCircle2 size={14} /> Complete</span>}
            </div>
            <div className="weekly-activity-list">
              {session.activities.length ? session.activities.map((activity) => (
                <Link className={`weekly-activity ${activity.completed ? "is-complete" : ""}`} href={`/activities/${activity.id}`} key={activity.id}>
                  <span>{activity.completed ? <CheckCircle2 size={16} /> : activity.type}</span>
                  <div><strong>{activity.title}</strong><p>{activity.description}</p></div>
                  <ArrowRight size={16} />
                </Link>
              )) : <div className="empty-state"><h3>No activities yet</h3><p>This session does not contain any activities.</p></div>}
            </div>
          </article>
        )) : <div className="empty-state"><h3>No sessions yet</h3><p>This weekly plan does not contain any sessions.</p></div>}
      </section>
    </main>
  );
}
