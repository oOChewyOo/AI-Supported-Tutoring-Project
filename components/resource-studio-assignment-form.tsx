"use client";
import { useActionState } from "react";
import { assignResourceStudioAction } from "@/lib/resource-studio/assignment-actions";
import styles from "./resource-studio-preview.module.css";

export function ResourceStudioAssignmentForm({ activityId }: { activityId: string }) {
  const [state, action, pending] = useActionState(assignResourceStudioAction.bind(null, activityId), {});
  return <form action={action} className={styles.preview}>
    <label className={styles.option}><input type="checkbox" name="fictional" value="confirmed" required /> This is an existing fictional test student.</label>
    <p>This assigns the currently published equivalent-fractions exercise to this slot once. Later Resource Studio edits will not change it.</p>
    {state.error && <p role="alert">{state.error}</p>}
    <button className="button" type="submit" disabled={pending}>{pending ? "Assigning…" : "Assign equivalent-fractions activity"}</button>
  </form>;
}
