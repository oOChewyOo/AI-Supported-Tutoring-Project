import Link from "next/link";
import { Database, Plus, Users } from "lucide-react";
import { StudentCard } from "@/components/student-card";
import { listStudents } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const students = await listStudents();
  const databaseConnected = isSupabaseConfigured();

  return (
    <main className="page-shell">
      <div className="dashboard-heading">
        <div>
          <span className="kicker">Tuesday, 9 June</span>
          <h1>Good evening, Alex.</h1>
          <p>Here&apos;s what&apos;s happening across your students this week.</p>
        </div>
        <div className="heading-actions">
          <Link href="/dashboard/students/new" className="button"><Plus size={17} /> Add student</Link>
        </div>
      </div>

      {!databaseConnected && (
        <div className="setup-notice">
          <strong>Supabase setup required</strong>
          <p>Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`, run the students migration, then restart the app.</p>
        </div>
      )}

      <section className="stat-grid stat-grid-two">
        <article><span><Users size={18} /> Active students</span><strong>{students.length}</strong><small>Stored student profiles</small></article>
        <article><span><Database size={18} /> Database</span><strong className="stat-text">{databaseConnected ? "Connected" : "Not configured"}</strong><small>{databaseConnected ? "Supabase persistence enabled" : "Student writes are disabled"}</small></article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div><span className="kicker">Your students</span><h2>Keep each learning loop moving</h2></div>
          <span className="muted-label">{students.length} active</span>
        </div>
        {students.length > 0 ? (
          <div className="student-grid">{students.map((student) => <StudentCard student={student} key={student.id} />)}</div>
        ) : (
          <div className="empty-state"><h3>No students found</h3><p>{databaseConnected ? "Add the first student to begin." : "Connect Supabase to load and save students."}</p></div>
        )}
      </section>
    </main>
  );
}
