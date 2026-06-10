"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { createStudentAction } from "@/lib/actions";

export function StudentForm() {
  const [state, formAction, pending] = useActionState(createStudentAction, {});

  return (
    <form className="student-form" action={formAction}>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="form-row">
        <label>
          Student name
          <input name="name" placeholder="e.g. Maya Patel" required />
        </label>
        <label>
          Year group
          <input name="year_group" placeholder="e.g. Year 6" required />
        </label>
      </div>
      <label>
        Subject focus
        <input name="subject_focus" placeholder="e.g. English" required />
      </label>
      <label>
        Interests
        <input name="interests" placeholder="Comma-separated, e.g. space, drawing, mysteries" />
      </label>
      <label>
        Strengths
        <input name="strengths" placeholder="Comma-separated strengths" />
      </label>
      <label>
        Needs practice
        <input name="needs_practice" placeholder="Comma-separated focus areas" />
      </label>
      <div className="form-footer">
        <p>The student will be saved to Supabase and appear on the dashboard.</p>
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Saving student..." : "Add student"} <ArrowRight size={17} />
        </button>
      </div>
    </form>
  );
}
