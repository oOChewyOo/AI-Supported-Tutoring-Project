"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateObjectivesAction } from "@/lib/actions";
import { ExtractedObjectives } from "@/lib/types";

const fields = [
  ["secure_objectives", "Secure objectives", "secureObjectives"],
  ["developing_objectives", "Developing objectives", "developingObjectives"],
  ["focus_for_next_week", "Focus for next week", "focusForNextWeek"],
  ["possible_misconceptions", "Possible misconceptions", "possibleMisconceptions"],
  ["suggested_retrieval_items", "Suggested retrieval items", "suggestedRetrievalItems"],
] as const;

export function ObjectivesEditor({
  objectives,
  studentId,
}: {
  objectives: ExtractedObjectives;
  studentId: string;
}) {
  const action = updateObjectivesAction.bind(null, objectives.id, studentId);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <details className="objectives-editor">
      <summary>Edit extracted objectives</summary>
      <form action={formAction} className="student-form">
        <p className="objectives-help">Enter one objective per line.</p>
        {fields.map(([name, label, property]) => (
          <label key={name}>
            {label}
            <textarea name={name} defaultValue={objectives[property].join("\n")} />
          </label>
        ))}
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        {state.success && <p className="form-success" role="status">{state.success}</p>}
        <button className="button" type="submit" disabled={pending}>
          <Save size={15} /> {pending ? "Saving..." : "Save objective edits"}
        </button>
      </form>
    </details>
  );
}
