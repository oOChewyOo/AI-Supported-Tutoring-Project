"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { extractObjectivesAction } from "@/lib/actions";

export function ExtractObjectivesButton({
  reflectionId,
  studentId,
}: {
  reflectionId: string;
  studentId: string;
}) {
  const action = extractObjectivesAction.bind(null, reflectionId, studentId);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="inline-action">
      {state.error && <span className="inline-error" role="alert">{state.error}</span>}
      {state.success && <span className="inline-success" role="status">{state.success}</span>}
      <button className="button button-small" type="submit" disabled={pending}>
        <Sparkles size={14} /> {pending ? "Extracting objectives..." : "Extract objectives with AI"}
      </button>
    </form>
  );
}
