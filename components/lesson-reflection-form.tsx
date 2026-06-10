"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { createLessonReflectionAction } from "@/lib/actions";

export function LessonReflectionForm({ studentId }: { studentId: string }) {
  const action = createLessonReflectionAction.bind(null, studentId);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form className="student-form" action={formAction}>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <label>
        Date
        <input name="date" type="date" required />
      </label>
      <label>
        What we covered
        <textarea name="what_we_covered" placeholder="Topics, skills, and questions from the lesson..." required />
      </label>
      <label>
        What went well
        <textarea name="what_went_well" placeholder="Wins, confident moments, and strengths..." required />
      </label>
      <label>
        What needs practice
        <textarea name="what_needs_practice" placeholder="Specific skills or misconceptions to revisit..." required />
      </label>
      <label>
        Notes for next time
        <textarea name="notes_for_next_time" placeholder="Anything to pick up in the next lesson..." />
      </label>
      <div className="form-footer">
        <p>This reflection will be linked directly to the student.</p>
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Saving reflection..." : "Save reflection"} <ArrowRight size={17} />
        </button>
      </div>
    </form>
  );
}
