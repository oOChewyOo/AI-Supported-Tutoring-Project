"use client";
import { useActionState, useState } from "react";
import { submitResourceStudioAttempt } from "@/lib/resource-studio/attempt-actions";
import type { ResourceAttempt, ResourceAttemptState, ResourceExercise } from "@/lib/resource-studio/exercise-types";
import styles from "./resource-studio-preview.module.css";

export function ResourceStudioExercise({ activityId, exercise, savedAttempt }: { activityId: string; exercise: ResourceExercise; savedAttempt: ResourceAttempt | null }) {
  const [state, action, pending] = useActionState<ResourceAttemptState, FormData>(submitResourceStudioAttempt.bind(null, activityId), {});
  // Controlled selections survive a failed server action/form reset.
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const attempt = savedAttempt ?? state.attempt;
  return <article className={styles.preview}>
    <p className="kicker">Tutor development exercise · Saved version {exercise.contentVersion}</p>
    <h1>{exercise.title}</h1>
    <p className={styles.instructions}>{exercise.instructions}</p>
    {attempt ? <div role="status">
      <h2>{attempt.score} of {attempt.total} correct</h2>
      <p>Completed and saved. Submitted <time dateTime={attempt.submittedAt}>{attempt.submittedAt}</time>.</p>
    </div> : <p>Answer every question, then submit once to save this fictional student&apos;s completed attempt. You cannot change answers after submission.</p>}
    <form action={action}>
      {exercise.questions.map((q, index) => {
        const feedback = attempt?.feedback.find((item) => item.id === q.id);
        return <fieldset className={styles.question} key={q.id} disabled={pending}>
          <legend>{index + 1}. {q.prompt}</legend>
          {q.supportingText && <p>{q.supportingText}</p>}
          <p>{q.multiple ? "Choose all the correct answers." : "Choose one answer."}</p>
          {attempt ? <p><strong>Saved response:</strong> {q.options.filter(option => attempt.selections[q.id]?.includes(option.id)).map(option => option.text).join("; ")}</p> : q.options.map((option) => <label className={styles.option} key={option.id}>
            <input type={q.multiple ? "checkbox" : "radio"} name={`answer:${q.id}`} value={option.id} required={!q.multiple}
              checked={selections[q.id]?.includes(option.id) ?? false}
              onChange={(event) => {
                const checked = event.target.checked;
                setSelections(previous => ({ ...previous, [q.id]: q.multiple
                  ? checked ? [...(previous[q.id] ?? []), option.id] : (previous[q.id] ?? []).filter(id => id !== option.id)
                  : [option.id] }));
              }} />
            <span>{option.text}</span>
          </label>)}
          {q.hint && <details className={styles.hint}><summary>Need a hint?</summary><p>{q.hint}</p></details>}
          {feedback && <div className={styles.feedback}><strong>{feedback.correct ? "That's right!" : "Keep practising!"}</strong><p>{feedback.message}</p><p>{feedback.explanation}</p></div>}
        </fieldset>;
      })}
      {!attempt && <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Submit completed attempt"}</button>}
      {!attempt && state.error && <p role="alert">{state.error}</p>}
    </form>
  </article>;
}
