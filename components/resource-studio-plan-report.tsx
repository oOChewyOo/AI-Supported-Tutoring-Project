import Link from "next/link";
import { getResourceStudioPlanReport } from "@/lib/resource-studio/reports";
import { ResourceStudioError } from "@/lib/resource-studio/activity";
import type { ResourceActivityReport } from "@/lib/resource-studio/report-types";
import styles from "./resource-studio-plan-report.module.css";

export function ResourceStudioReportView({ activities, error }: { activities: ResourceActivityReport[]; error?: string }) {
  const completed = activities.filter(activity => activity.attempt !== null).length;
  return <section className={styles.report} aria-labelledby="resource-progress-heading">
    <h2 id="resource-progress-heading">Resource Studio progress</h2>
    <p>Saved results for imported exercises. Placeholder and AI-generated activities are not scored in this report.</p>
    {error ? <p role="alert">{error}</p> : <>
      <p><strong>{completed} of {activities.length} imported activities completed</strong></p>
      {!activities.length && <p>No Resource Studio exercises have been assigned to this plan yet.</p>}
      {activities.length > 0 && !completed && <p>No completed attempts yet. Results appear after an imported exercise is submitted.</p>}
      {activities.map(activity => {
        const attempt = activity.attempt;
        const tags = [...new Set(attempt?.questions.filter(q => !q.correct).flatMap(q => q.misconceptionTags) ?? [])];
        const context = `Session ${activity.sessionNumber} · Activity ${activity.position}`;
        return <article className={styles.activity} key={activity.activityId}>
          <h3>{activity.title}</h3>
          <p>{context} · Saved version {activity.sourceVersion}</p>
          {attempt ? <>
            <p><strong>Completed · {attempt.score} of {attempt.total} correct</strong></p>
            <p>Submitted <time dateTime={attempt.submittedAt}>{new Date(attempt.submittedAt).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</time></p>
            <details className={styles.review}>
              <summary>Review saved answers — {context}</summary>
              <ol className={styles.questions}>
                {attempt.questions.map(question => <li key={question.id}>
                  <h4>{question.prompt}</h4>
                  {question.supportingText && <p>{question.supportingText}</p>}
                  <p><strong>Saved selections:</strong> {question.selections.join("; ")}</p>
                  <p><strong>{question.correct ? "Correct" : "Incorrect"}</strong> — {question.feedback}</p>
                  {question.explanation && <p>{question.explanation}</p>}
                  {!question.correct && question.misconceptionTags.length > 0 && <p>Possible area to revisit: {question.misconceptionTags.join("; ")}</p>}
                </li>)}
              </ol>
              <h4>Possible areas to revisit</h4>
              <p>These are resource-author tags linked to incorrectly answered questions, not a diagnosis of the student&apos;s understanding.</p>
              {tags.length ? <ul>{tags.map(tag => <li key={tag}>{tag}</li>)}</ul>
                : <p>No misconception tags are recorded for incorrectly answered questions in this saved snapshot.</p>}
            </details>
          </> : <p><strong>Not completed</strong> · No saved score or answers yet.</p>}
          <Link href={`/activities/${activity.activityId}`}>Open exercise</Link>
        </article>;
      })}
    </>}
  </section>;
}

export async function ResourceStudioPlanReport({ planId }: { planId: string }) {
  try {
    return <ResourceStudioReportView activities={await getResourceStudioPlanReport(planId)} />;
  } catch (error) {
    if (!(error instanceof ResourceStudioError)) throw error; // Preserve Auth redirects.
    return <ResourceStudioReportView activities={[]} error={error.message} />;
  }
}
