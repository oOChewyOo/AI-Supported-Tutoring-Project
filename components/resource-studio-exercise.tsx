"use client";
import { useActionState, useState } from "react";
import { checkResourceStudioAction } from "@/lib/resource-studio/assignment-actions";
import type { ResourceExercise } from "@/lib/resource-studio/exercise-types";
import styles from "./resource-studio-preview.module.css";

export function ResourceStudioExercise({ activityId, exercise }: { activityId: string; exercise: ResourceExercise }) {
  const [state, action, pending] = useActionState(checkResourceStudioAction.bind(null, activityId), {});
  const [dirty, setDirty] = useState(false);
  return <article className={styles.preview}>
    <p className="kicker">Tutor development exercise · Saved version {exercise.contentVersion}</p>
    <h1>{exercise.title}</h1>
    <p className={styles.instructions}>{exercise.instructions}</p>
    <p>Answers are checked on the server but are not saved. Reload to start again.</p>
    <form action={action} onChange={() => setDirty(true)} onSubmit={() => setDirty(false)}>
      {exercise.questions.map((q, index) => {
        const feedback = !dirty && state.feedback?.find((item) => item.id === q.id);
        return <fieldset className={styles.question} key={q.id} disabled={pending}>
          <legend>{index + 1}. {q.prompt}</legend>
          {q.supportingText && <p>{q.supportingText}</p>}
          <p>{q.multiple ? "Choose all the correct answers." : "Choose one answer."}</p>
          {q.options.map((option) => <label className={styles.option} key={option.id}>
            <input type={q.multiple ? "checkbox" : "radio"} name={`answer:${q.id}`} value={option.id} />
            <span>{option.text}</span>
          </label>)}
          {q.hint && <details className={styles.hint}><summary>Need a hint?</summary><p>{q.hint}</p></details>}
          {feedback && <div className={styles.feedback}><strong>{feedback.correct ? "That's right!" : "Keep practising!"}</strong><p>{feedback.message}</p><p>{feedback.explanation}</p></div>}
        </fieldset>;
      })}
      <button className="button" type="submit" disabled={pending}>{pending ? "Checking…" : "Check my answers"}</button>
      {!dirty && <div role="status" aria-live="polite">{state.error ?? (state.score !== undefined ? `${state.score} of ${state.total} correct` : "")}</div>}
    </form>
  </article>;
}
