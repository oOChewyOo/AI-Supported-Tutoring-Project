import Link from "next/link";
import { StudentForm } from "@/components/student-form";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export default function NewStudentPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="narrow-shell">
      <div className="page-heading">
        <span className="kicker">Student records</span>
        <h1>Add a student.</h1>
        <p>Create a student profile and save it securely in Supabase.</p>
      </div>
      {!configured && (
        <div className="form-notice">
          Supabase is not configured. Add the required variables to `.env.local`, run the students migration, and restart the app.
        </div>
      )}
      {configured ? <StudentForm /> : <Link href="/dashboard" className="button">Back to dashboard</Link>}
    </main>
  );
}
