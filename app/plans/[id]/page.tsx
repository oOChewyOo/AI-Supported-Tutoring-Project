import { ApprovedPracticeProvider, ApprovedSessionPractice } from "@/components/resource-studio-approved-practice";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { getWeeklyPlan, listExtractedObjectives } from "@/lib/data";
import { WeeklyPractice } from "@/components/weekly-practice";
import { ResourceStudioProposals } from "@/components/resource-studio-proposals";
import { objectiveChoices } from "@/lib/resource-studio/proposal-contract";
import { ResourceStudioPlanReport } from "@/components/resource-studio-plan-report";
import {PracticeSubmissionReport} from "@/components/practice-submission-report";
import { ResourceStudioSearch } from "@/components/resource-studio-search";
import { PlanPageSessions } from "@/components/plan-page-sessions";
import { ResourceStudioSessionSelections } from "@/components/resource-studio-session-planner";

export default async function WeeklyPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getWeeklyPlan(id);
  if (!plan) notFound();

  const activities = plan.sessions.flatMap((session) => session.activities);
  const completedActivities = activities.filter((activity) => activity.completed).length;

  const isDev = process.env.NODE_ENV === "development";
  const extracted = isDev ? (await listExtractedObjectives(plan.student.id)).find(row => row.lessonReflectionId === plan.reflection.id) : undefined;
  const objectives = extracted ? objectiveChoices({ focus_for_next_week: extracted.focusForNextWeek, developing_objectives: extracted.developingObjectives,
    secure_objectives: extracted.secureObjectives, suggested_retrieval_items: extracted.suggestedRetrievalItems }) : [];
  const sessionList = (
    <section className="weekly-session-list">
      {plan.sessions.length ? plan.sessions.map((session) => (
        <article className={`weekly-session ${session.completed ? "is-complete" : ""}`} key={session.id}>
          <div className="weekly-session-heading">
            <span className="session-index">Session {session.sessionNumber}</span>
            <div><h2>{session.title}</h2><p><Clock3 size={14} /> {session.durationMinutes} minutes</p></div>
            {session.completed && <span className="completion-badge"><CheckCircle2 size={14} /> Complete</span>}
          </div>
          {isDev && <ApprovedSessionPractice planId={plan.id} sessionId={session.id} />}
          <details><summary>Legacy practice slots</summary><div className="weekly-activity-list">
            {session.activities.length ? session.activities.map((activity) => (
              <Link className={`weekly-activity ${activity.completed ? "is-complete" : ""}`} href={`/activities/${activity.id}`} key={activity.id}>
                <span>{activity.completed ? <CheckCircle2 size={16} /> : activity.type}</span>
                <div><strong>{activity.title}</strong><p>{activity.description}</p></div>
                <ArrowRight size={16} />
              </Link>
            )) : <div className="empty-state"><h3>No activities yet</h3><p>This session does not contain any activities.</p></div>}
          </div></details>
          {isDev && <ResourceStudioSessionSelections sessionId={session.id} sessionNumber={session.sessionNumber} />}
        </article>
      )) : <div className="empty-state"><h3>No sessions yet</h3><p>This weekly plan does not contain any sessions.</p></div>}
    </section>
  );

  return (
    <ApprovedPracticeProvider key={plan.id} planId={plan.id} enabled={isDev}><main className="page-shell">
      <Link href={`/students/${plan.student.id}`} className="back-link"><ArrowLeft size={15} /> Back to {plan.student.name}</Link>
      <div className="plan-heading">
        <div>
          <span className="kicker">Weekly practice plan</span>
          <h1>{plan.student.name}&apos;s five-session week</h1>
          <p>Linked to the reflection from {new Date(`${plan.reflection.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.</p>
        </div>
        <span className="completion-badge"><CheckCircle2 size={15} /> {completedActivities} of {activities.length} legacy activities complete</span>
      </div>
      <section className="plan-context">
        <div><span>Focus</span><strong>{plan.focus}</strong></div>
        <div><span>What we covered</span><strong>{plan.reflection.whatWeCovered}</strong></div>
      </section>
      {process.env.NODE_ENV === "development" && <ResourceStudioPlanReport planId={plan.id} />}
      {isDev && <PracticeSubmissionReport planId={plan.id} sessions={plan.sessions} />}
      {isDev && <WeeklyPractice planId={plan.id} objectives={objectives} misconceptions={extracted?.possibleMisconceptions ?? []} subject={plan.student.subjectFocus} year={plan.student.yearGroup} />}
      {isDev && <details><summary>Single-session fallback</summary><ResourceStudioProposals key={plan.id} planId={plan.id} sessions={plan.sessions.map(s => ({ id: s.id, sessionNumber: s.sessionNumber, title: s.title }))} objectives={objectives} subject={plan.student.subjectFocus} year={plan.student.yearGroup} /></details>}
      {isDev ? <PlanPageSessions key={plan.id} planId={plan.id}
        sessions={plan.sessions.map(session => ({ id: session.id, session_number: session.sessionNumber, title: session.title }))}>
        <details><summary>Manual activity search and replacement fallback</summary><ResourceStudioSearch planId={plan.id} /></details>
        {sessionList}
      </PlanPageSessions> : sessionList}
    </main></ApprovedPracticeProvider>
  );
}
