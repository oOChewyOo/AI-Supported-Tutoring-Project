"use client";

import { useState } from "react";
import { addResourceSessionSelection, removeResourceSessionSelection } from "@/lib/resource-studio/selection-actions";
import type { ResourceSearchItem } from "@/lib/resource-studio/search-types";
import { ResourceStudioSelectedPreview } from "./resource-studio-selected-preview";
import { usePlanSelections } from "./plan-page-sessions";
import styles from "./resource-studio-search.module.css";

/** Embedded in the server-rendered session card; shares state with the preview's add controls. */
export function ResourceStudioSessionSelections({ sessionId, sessionNumber }: {
  sessionId: string; sessionNumber: number;
}) {
  const { planId, fictional, records, pending, retry, mutate } = usePlanSelections();
  if (!fictional) return null;
  const state = records[sessionId];
  return <section className={styles.inSessionResources} aria-label={`Resource Studio selections for Session ${sessionNumber}`} aria-busy={pending}>
    <h3>Selected resources</h3>
    <p>Planning only · not yet assigned; progress is unchanged.</p>
    {!state ? <p role="status">Loading selected resources…</p>
      : state.error ? <div role="alert"><p>{state.error}</p>
        <button type="button" className="button button-small button-secondary" disabled={pending} onClick={retry}>Retry loading selections</button>
      </div>
      : !state.selections?.length ? <p>No resources selected.</p>
        : <ul className={styles.inSessionSelections}>
          {state.selections.map(row => <li key={row.id} className={styles.inSessionSelection}>
            <div className={styles.inSessionSelectionMeta}>
              <span className={styles.inSessionSelectionBadge}>Resource Studio · MCQ</span>
              <strong>{row.title}</strong>
              <span className={styles.inSessionSelectionVersion}>Version {row.source_version}</span>
            </div>
            <button type="button" className="button button-small button-secondary" disabled={pending}
              aria-label={`Remove ${row.title} from Session ${sessionNumber}`}
              onClick={() => void mutate(() => removeResourceSessionSelection(planId, sessionId, row.id, true), sessionId,
                `Removed from Session ${sessionNumber}.`)}>Remove</button>
          </li>)}
        </ul>}
  </section>;
}

/** Add controls use the same records as the session cards; no second list or fetch. */
export function ResourceStudioSessionPlanner({ planId, selected, onClose }: {
  planId: string; selected: ResourceSearchItem | null; onClose: () => void;
}) {
  const { sessions, records, pending, notice, retry, mutate } = usePlanSelections();
  const [sessionId, setSessionId] = useState(sessions[0]?.id || "");
  const existing = selected && records[sessionId]?.selections?.find(row => row.source_activity_id === selected.id);
  const already = Boolean(existing && existing.source_version === selected?.contentVersion);
  const conflict = Boolean(existing && !already);
  return <div className={styles.planner} aria-busy={pending}>
    {selected && <ResourceStudioSelectedPreview key={`${planId}:${selected.id}:${selected.contentVersion}`}
      planId={planId} activityId={selected.id} version={selected.contentVersion} fictional onClose={onClose}
      selectionControls={activity => <div className={styles.selectionControls}>
        <label>Weekly session<select value={sessionId} disabled={pending || !sessions.length} onChange={event => setSessionId(event.target.value)}>
          {sessions.map(session => <option key={session.id} value={session.id}>Session {session.session_number}: {session.title}</option>)}
        </select></label>
        <button type="button" className="button button-small" disabled={pending || !sessionId || !records[sessionId]?.selections || already || conflict}
          onClick={() => void mutate(() => addResourceSessionSelection(planId, sessionId, activity.id, activity.contentVersion, true), sessionId,
            `Selected for Session ${sessions.find(s => s.id === sessionId)?.session_number}. Planning reference only.`)}>
          {pending ? "Saving…" : already ? "Already selected" : "Add to session"}
        </button>
        {!sessions.length && <p>No sessions in this plan.</p>}
        {sessionId && !records[sessionId] && <p role="status">Loading selections…</p>}
        {records[sessionId]?.error && <p role="alert">{records[sessionId].error}</p>}
        {conflict && <p role="status">Version {existing?.source_version} is already selected. Remove it from the session card before adding this version.</p>}
      </div>} />}
    {notice && <p role={notice.error ? "alert" : "status"}>{notice.text}</p>}
    {Object.values(records).some(state => state.error) && <button type="button" className="button button-small button-secondary" disabled={pending}
      onClick={retry}>Retry loading selections</button>}
  </div>;
}
