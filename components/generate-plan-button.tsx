"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { generateWeeklyPlanAction } from "@/lib/actions";

export function GeneratePlanButton({ reflectionId }: { reflectionId: string }) {
  const action = generateWeeklyPlanAction.bind(null, reflectionId);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="inline-action">
      {state.error && <span className="inline-error" role="alert">{state.error}</span>}
      <button className="button button-small" type="submit" disabled={pending}>
        <Sparkles size={14} /> {pending ? "Generating..." : "Generate weekly plan"}
      </button>
    </form>
  );
}
