"use client";

import { useState } from "react";
import { isCorrectAnswer, type ResourceActivity } from "@/lib/resource-studio/activity";
import styles from "./resource-studio-preview.module.css";

export function ResourceStudioPreview({ activity, embedded = false }: { activity: ResourceActivity; embedded?: boolean }) {
  const [answers, setAnswers] = useState<ReadonlyMap<string, readonly string[]>>(() => new Map());
  const [checked, setChecked] = useState(false);
  const score = activity.questions.filter((q) => isCorrectAnswer(q, answers.get(q.id) ?? [])).length;
  const Heading = embedded ? "h3" : "h1";
  return <article className={styles.preview}>
    <p className="kicker">Development preview · Version {activity.contentVersion}</p>
    <Heading>{activity.title}</Heading>
    <p>Your answers stay on this page and are cleared when you reload.</p>
    <p className={styles.instructions}>{activity.instructions}</p>
    <form onSubmit={(event) => { event.preventDefault(); setChecked(true); }}>
      {activity.questions.map((q, index) => {
        const multiple = q.correctOptionIds.length > 1;
        const correct = isCorrectAnswer(q, answers.get(q.id) ?? []);
        const helpId = `question-help-${index}`;
        return <fieldset key={q.id} className={styles.question} aria-describedby={helpId}>
          <legend>{index + 1}. {q.prompt}</legend>
          {q.supportingText && <p>{q.supportingText}</p>}
          <p id={helpId}>{multiple ? "Choose all the answers you think are correct." : "Choose one answer."}</p>
          {q.options.map((option) => <label key={option.id} className={styles.option}>
            <input type={multiple ? "checkbox" : "radio"} name={`question-${index}`} checked={(answers.get(q.id) ?? []).includes(option.id)}
              onChange={(event) => {
                const selected = event.target.checked;
                setAnswers((previous) => new Map(previous).set(q.id, multiple
                  ? selected ? [...(previous.get(q.id) ?? []), option.id] : (previous.get(q.id) ?? []).filter((id) => id !== option.id)
                  : [option.id]));
                setChecked(false);
              }} />
            <span>{option.text}</span>
          </label>)}
          {q.hint && <details className={styles.hint}><summary>Need a hint?</summary><p>{q.hint}</p></details>}
          {checked && <div className={styles.feedback}>
            <strong>{correct ? "That's right!" : (answers.get(q.id)?.length ? "Keep practising!" : "Choose an answer and try again.")}</strong>
            <p>{correct ? q.correctFeedback || activity.feedback.generalCorrect : q.incorrectFeedback || activity.feedback.generalIncorrect}</p>
            {q.explanation && <p>{q.explanation}</p>}
          </div>}
        </fieldset>;
      })}
      <button className="button" type="submit">Check my answers</button>
      <div role="status" aria-live="polite" aria-atomic="true">
        {checked && <><h2>{score} of {activity.questions.length} correct</h2><p>{score === activity.questions.length ? activity.feedback.generalCorrect : activity.feedback.generalIncorrect}</p><p>Read the feedback under each question. You can change your answers and check again.</p></>}
      </div>
    </form>
  </article>;
}
