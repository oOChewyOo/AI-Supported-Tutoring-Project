"use client";

import { useRef, useState } from "react";
import { buildPracticeProposalAction, previewPracticeProposalAction } from "@/lib/resource-studio/proposal-actions";
import { proposalIntents, type ObjectiveChoice } from "@/lib/resource-studio/proposal-contract";
import type { TutorProposal } from "@/lib/resource-studio/proposal-store";
import styles from "./resource-studio-search.module.css";

const label = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ");
export function ProposalReview({ proposal, onPreview, pending }: { proposal: TutorProposal; onPreview: (id: string) => void; pending: boolean }) {
  return <div><h3>Resource Studio proposal</h3>
    <p><strong>Review only — not assigned to learner.</strong></p>
    <p>{proposal.objective}</p>
    <p>{proposal.requestedMinutes} minutes requested · {proposal.plannedMinutes} planned including transitions · {proposal.headroomMinutes} minutes headroom · {proposal.activities.length} activities</p>
    <p>Status: {proposal.status} · Planning: {label(proposal.planningMode)}</p>
    <ol className={styles.results}>{proposal.activities.map(activity => <li key={activity.id}>
      <h4>{label(activity.activityType)}</h4><p>{label(activity.purpose)} · {activity.dose} · {activity.estimatedMinutes} minutes</p>
      {activity.status === "failed" ? <p role="alert">Failed to prepare — {activity.failureReason}</p> : <>
        <p>Ready for review</p><button className="button button-small button-secondary" type="button" disabled={pending || !activity.previewAvailable}
          onClick={() => onPreview(activity.id)}>Preview {label(activity.activityType)}</button></>}
    </li>)}</ol>
    <p>Review expires after 30 minutes or an app restart. Rebuild to request a fresh proposal.</p>
  </div>;
}
export function ResourceStudioProposals({ planId, objectives, subject: initialSubject, year: initialYear }: {
  planId: string; objectives: ObjectiveChoice[]; subject: string; year: string;
}) {
  const [objective, setObjective] = useState(objectives[0]?.key ?? "");
  const [subject, setSubject] = useState(initialSubject), [year, setYear] = useState(initialYear);
  const [duration, setDuration] = useState("");
  const [intents, setIntents] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false), [pending, setPending] = useState(false);
  const [proposal, setProposal] = useState<TutorProposal>(), [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const revision = useRef(0);
  async function build() {
    const current = ++revision.current; setPending(true); setError(""); setPreview("");
    try {
      const state = await buildPracticeProposalAction(planId, objective, { subject, year, durationMinutes: Number(duration), intents }, confirmed);
      if (current !== revision.current) return;
      if (state.proposal) setProposal(state.proposal);
      setError(state.error ?? "");
    } catch { if (current === revision.current) setError("Could not build practice. Try again."); }
    finally { if (current === revision.current) setPending(false); }
  }
  async function openPreview(id: string) {
    if (!proposal) return;
    const current = revision.current; setPending(true); setError("");
    try {
      const state = await previewPracticeProposalAction(planId, proposal.id, id, confirmed);
      if (current !== revision.current) return;
      setPreview(state.url ?? ""); setError(state.error ?? "");
    } catch { if (current === revision.current) setError("Preview unavailable. Try again."); }
    finally { if (current === revision.current) setPending(false); }
  }
  return <section className={styles.search} aria-label="Automatic practice proposal" aria-busy={pending}>
    <h2>Build practice from a learning need</h2>
    <p>Resource Studio chooses activities and sources automatically. Review the proposal before any future assignment.</p>
    {!objectives.length ? <p>Extract and review objectives for this plan&apos;s reflection first.</p> : <>
      <fieldset disabled={pending}><legend>Practice need</legend>
        <label>Stored objective <select value={objective} onChange={event => { setObjective(event.target.value); setConfirmed(false); setProposal(undefined); setPreview(""); }}>
          {objectives.map(choice => <option key={choice.key} value={choice.key}>{choice.label}: {choice.objective}</option>)}
        </select></label>
        <div className={styles.filters}>
          <label>Subject<input value={subject} maxLength={240} onChange={event => setSubject(event.target.value)} /></label>
          <label>Year<input value={year} maxLength={240} onChange={event => setYear(event.target.value)} /></label>
          <label>Duration in minutes<input type="number" min="3" max="30" value={duration} onChange={event => setDuration(event.target.value)} /></label>
        </div>
        <fieldset><legend>Practice intents</legend>{proposalIntents.map(intent => <label key={intent} className={styles.confirm}>
          <input type="checkbox" checked={intents.includes(intent)} onChange={event => setIntents(values => event.target.checked ? [...values, intent] : values.filter(value => value !== intent))} />{label(intent)}
        </label>)}</fieldset>
      </fieldset>
      <p>Only subject, year, the selected objective, duration and intents are sent. Review the educational text for names or personal details; edit stored objectives on the reflection if needed.</p>
      <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={event => {
        setConfirmed(event.target.checked); revision.current++; setPending(false); setProposal(undefined); setPreview(""); setError("");
      }} />This is fictional test data and these educational fields contain no personal information. I permit automatic source use and generation for this review.</label>
      <button type="button" className="button" disabled={pending || !confirmed || !objective || !subject.trim() || !year.trim() || !intents.length || Number(duration) < 3 || Number(duration) > 30}
        onClick={() => void build()}>{pending ? "Preparing practice…" : proposal ? "Rebuild practice" : "Build practice proposal"}</button>
      {pending && <p role="status">Preparing review. This may take up to four minutes.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
    {confirmed && proposal && <ProposalReview proposal={proposal} pending={pending} onPreview={id => void openPreview(id)} />}
    {confirmed && preview && <div><button type="button" className="button button-secondary" onClick={() => setPreview("")}>Close preview</button>
      <iframe key={preview} title="Resource Studio activity review" src={preview} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin"
        style={{ width: "100%", height: "700px", border: "1px solid var(--line)", marginTop: "1rem" }} />
    </div>}
  </section>;
}
