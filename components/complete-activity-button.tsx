"use client";

import { useActionState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { setActivityCompletionAction } from "@/lib/actions";

export function CompleteActivityButton({
  activityId,
  studentId,
  planId,
  completed,
}: {
  activityId: string;
  studentId: string;
  planId: string;
  completed: boolean;
}) {
  const action = setActivityCompletionAction.bind(null, activityId, studentId, planId, !completed);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="complete-activity-form">
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {completed && <span className="completion-badge"><Check size={15} /> Activity complete</span>}
      <button className={`button ${completed ? "button-secondary" : ""}`} type="submit" disabled={pending}>
        {completed ? <RotateCcw size={16} /> : <Check size={16} />}
        {pending ? "Saving..." : completed ? "Mark activity incomplete" : "Mark activity complete"}
      </button>
    </form>
  );
}
