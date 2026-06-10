import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpenText, Brain, CheckCircle2, Heart, Plus, Target } from "lucide-react";
import { ExtractObjectivesButton } from "@/components/extract-objectives-button";
import { GeneratePlanButton } from "@/components/generate-plan-button";
import { ObjectivesEditor } from "@/components/objectives-editor";
import { getStudent, getStudentProgress, listExtractedObjectives, listLessonReflections, listWeeklyPlans } from "@/lib/data";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [student, reflections, objectives, plans, progress] = await Promise.all([
    getStudent(id),
    listLessonReflections(id),
    listExtractedObjectives(id),
    listWeeklyPlans(id),
    getStudentProgress(id),
  ]);
  if (!student) notFound();
  const latestFocus = reflections[0]?.whatNeedsPractice ?? student.needsPractice[0] ?? "Not set yet";

  return (
    <main className="page-shell">
      <div className="profile-hero">
        <div className="avatar avatar-large">{student.name.split(" ").map((part) => part[0]).join("")}</div>
        <div><span className="kicker">Student profile</span><h1>{student.name}</h1><p>{student.yearGroup} · {student.subjectFocus}</p></div>
        <div className="heading-actions">
          <Link href="/dashboard" className="button button-secondary"><ArrowLeft size={17} /> Back to students</Link>
          <Link href={`/students/${student.id}/reflections/new`} className="button"><Plus size={17} /> Add reflection</Link>
        </div>
      </div>
      <section className="profile-grid">
        <article><Heart size={20} /><span>Interests</span><div className="tag-list">{student.interests.length ? student.interests.map((item) => <em key={item}>{item}</em>) : <em>Not set yet</em>}</div></article>
        <article><Brain size={20} /><span>Strengths</span><div className="tag-list">{student.strengths.length ? student.strengths.map((item) => <em key={item}>{item}</em>) : <em>Not set yet</em>}</div></article>
        <article><Target size={20} /><span>Needs practice</span><div className="tag-list">{student.needsPractice.length ? student.needsPractice.map((item) => <em key={item}>{item}</em>) : <em>Not set yet</em>}</div></article>
        <article><BookOpenText size={20} /><span>Subject focus</span><strong>{student.subjectFocus}</strong><p>Current learning path</p></article>
      </section>
      <section className="progress-grid">
        <div><span>Latest focus</span><strong>{latestFocus}</strong></div>
        <div><span>Weekly plans</span><strong>{progress.plansTotal}</strong></div>
        <div><span>Total sessions</span><strong>{progress.sessionsTotal}</strong></div>
        <div><span>Total activities</span><strong>{progress.activitiesTotal}</strong></div>
        <div><span>Activities completed</span><strong>{progress.activitiesCompleted} / {progress.activitiesTotal}</strong></div>
        <div><span>Percentage complete</span><strong>{progress.percentageComplete}%</strong></div>
      </section>
      <section className="reflections-section">
        <div className="section-heading">
          <div><span className="kicker">Lesson reflections</span><h2>Session notes</h2></div>
          <span className="muted-label">{reflections.length} saved</span>
        </div>
        {reflections.length ? (
          <div className="reflections-list">
            {reflections.map((reflection) => {
              const extracted = objectives.find((item) => item.lessonReflectionId === reflection.id);
              const objectiveGroups = extracted ? [
                ["Secure objectives", extracted.secureObjectives],
                ["Developing objectives", extracted.developingObjectives],
                ["Focus for next week", extracted.focusForNextWeek],
                ["Possible misconceptions", extracted.possibleMisconceptions],
                ["Suggested retrieval items", extracted.suggestedRetrievalItems],
              ] as const : [];

              return <article className="reflection-card" key={reflection.id}>
                <div className="reflection-card-heading">
                  <strong>{new Date(`${reflection.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</strong>
                  <span>{reflection.whatNeedsPractice}</span>
                </div>
                <dl>
                  <div><dt>What we covered</dt><dd>{reflection.whatWeCovered}</dd></div>
                  <div><dt>What went well</dt><dd>{reflection.whatWentWell}</dd></div>
                  <div><dt>Needs practice</dt><dd>{reflection.whatNeedsPractice}</dd></div>
                  {reflection.notesForNextTime && <div><dt>Next time</dt><dd>{reflection.notesForNextTime}</dd></div>}
                </dl>
                <div className="objectives-panel">
                  <div className="objectives-heading">
                    <div><span className="kicker">AI extraction</span><h3>Learning objectives</h3></div>
                    {extracted && <span className="muted-label">Saved</span>}
                  </div>
                  {extracted ? (
                    <>
                      <div className="objectives-grid">
                        {objectiveGroups.map(([label, items]) => (
                          <section key={label}>
                            <h4>{label}</h4>
                            {items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None identified.</p>}
                          </section>
                        ))}
                      </div>
                      <ObjectivesEditor objectives={extracted} studentId={student.id} />
                    </>
                  ) : (
                    <div className="objectives-empty">
                      <p>Extract a structured, editable set of objectives from this saved reflection.</p>
                      <ExtractObjectivesButton reflectionId={reflection.id} studentId={student.id} />
                    </div>
                  )}
                </div>
                <div className="reflection-actions">
                  {plans.find((plan) => plan.lessonReflectionId === reflection.id) ? (
                    <Link className="text-action" href={`/plans/${plans.find((plan) => plan.lessonReflectionId === reflection.id)!.id}`}>
                      View weekly plan <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <GeneratePlanButton reflectionId={reflection.id} />
                  )}
                </div>
              </article>;
            })}
          </div>
        ) : (
          <div className="empty-state"><h3>No reflections yet</h3><p>Add the first lesson reflection for {student.name}.</p></div>
        )}
      </section>
      <section className="reflections-section">
        <div className="section-heading">
          <div><span className="kicker">Weekly plans</span><h2>Practice weeks</h2></div>
          <span className="muted-label">{plans.length} generated</span>
        </div>
        {plans.length ? (
          <div className="plan-list">
            {plans.map((plan) => (
              <Link className="plan-list-card" href={`/plans/${plan.id}`} key={plan.id}>
                <div><strong>{plan.title}</strong><span>{plan.focus}</span></div>
                <div className="plan-list-progress">
                  <span><CheckCircle2 size={14} /> {plan.sessionsCompleted}/{plan.sessionsTotal} sessions</span>
                  <span>{plan.activitiesCompleted}/{plan.activitiesTotal} activities</span>
                </div>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state"><h3>No weekly plans yet</h3><p>Generate one from a saved lesson reflection.</p></div>
        )}
      </section>
    </main>
  );
}
