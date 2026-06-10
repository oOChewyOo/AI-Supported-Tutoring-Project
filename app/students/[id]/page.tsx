import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenText, Brain, Heart, Plus, Target } from "lucide-react";
import { getStudent, listLessonReflections } from "@/lib/data";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [student, reflections] = await Promise.all([getStudent(id), listLessonReflections(id)]);
  if (!student) notFound();

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
      <section className="reflections-section">
        <div className="section-heading">
          <div><span className="kicker">Lesson reflections</span><h2>Session notes</h2></div>
          <span className="muted-label">{reflections.length} saved</span>
        </div>
        {reflections.length ? (
          <div className="reflections-list">
            {reflections.map((reflection) => (
              <article className="reflection-card" key={reflection.id}>
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
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><h3>No reflections yet</h3><p>Add the first lesson reflection for {student.name}.</p></div>
        )}
      </section>
    </main>
  );
}
