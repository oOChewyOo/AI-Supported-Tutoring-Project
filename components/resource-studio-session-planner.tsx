"use client";

import { useEffect, useRef, useState } from "react";
import { getResourceSessionOptions } from "@/lib/resource-studio/session-options-action";
import { addResourceSessionSelection, listResourceSessionSelections, removeResourceSessionSelection } from "@/lib/resource-studio/selection-actions";
import type { ResourceSessionOption } from "@/lib/resource-studio/session-options";
import type { ResourceSelectionState } from "@/lib/resource-studio/selection-types";
import type { ResourceSearchItem } from "@/lib/resource-studio/search-types";
import { ResourceStudioSelectedPreview } from "./resource-studio-selected-preview";
import styles from "./resource-studio-search.module.css";

const failure = "Could not update session selections. Please try again.";

/** Mounted only after fictional confirmation; never replaces ordinary activities. */
export function ResourceStudioSessionPlanner({ planId, selected, onClose }: {
  planId: string; selected: ResourceSearchItem | null; onClose: () => void;
}) {
  const [sessions, setSessions] = useState<ResourceSessionOption[] | null>(null);
  const [records, setRecords] = useState<Record<string, ResourceSelectionState>>({});
  const [sessionId, setSessionId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [reload, setReload] = useState(0);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let active = true;
    getResourceSessionOptions(planId, true).then(async result => {
      if (!active) return;
      if (result.error || !result.sessions) { setLoadError(result.error || failure); return; }
      setLoadError(""); setSessions(result.sessions);
      setSessionId(previous => result.sessions!.some(s => s.id === previous) ? previous : result.sessions![0]?.id || "");
      await Promise.all(result.sessions.map(async session => {
        let state: ResourceSelectionState;
        try { state = await listResourceSessionSelections(planId, session.id, true); }
        catch { state = { error: "Could not load selections. Please try again." }; }
        if (active) setRecords(previous => ({ ...previous, [session.id]: state }));
      }));
    }, () => { if (active) setLoadError("Could not load sessions. Please try again."); });
    return () => { active = false; alive.current = false; };
  }, [planId, reload]);

  async function mutate(operation: () => Promise<ResourceSelectionState>, targetSession: string, message: string) {
    if (busy.current) return;
    busy.current = true; setPending(true); setNotice(null);
    try {
      const result = await operation();
      if (!alive.current) return;
      if (result.error || !result.selections) setNotice({ text: result.error || failure, error: true });
      else {
        setRecords(previous => ({ ...previous, [targetSession]: result }));
        setNotice({ text: message });
      }
    } catch { if (alive.current) setNotice({ text: failure, error: true }); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  }

  const existing = selected && records[sessionId]?.selections?.find(row => row.source_activity_id === selected.id);
  const already = existing?.source_version === selected?.contentVersion && Boolean(existing);
  const conflict = Boolean(existing && !already);
  return <div className={styles.planner} aria-busy={pending}>
    {selected && <ResourceStudioSelectedPreview key={`${planId}:${selected.id}:${selected.contentVersion}`}
      planId={planId} activityId={selected.id} version={selected.contentVersion} fictional onClose={onClose}
      selectionControls={activity => <div className={styles.selectionControls}>
        <label>Weekly session<select value={sessionId} disabled={pending || !sessions?.length} onChange={event => { setSessionId(event.target.value); setNotice(null); }}>
          {sessions?.map(session => <option key={session.id} value={session.id}>Session {session.session_number}: {session.title}</option>)}
        </select></label>
        <button type="button" className="button button-small" disabled={pending || !sessionId || !records[sessionId]?.selections || already || conflict}
          onClick={() => void mutate(() => addResourceSessionSelection(planId, sessionId, activity.id, activity.contentVersion, true), sessionId,
            `Selected for Session ${sessions?.find(s => s.id === sessionId)?.session_number}. Planning reference only.`)}>
          {pending ? "Saving…" : already ? "Already selected" : "Add to session"}
        </button>
        {conflict && <p role="status">Version {existing?.source_version} is already selected. Remove it below before adding this version.</p>}
      </div>} />}
    {notice && <p role={notice.error ? "alert" : "status"}>{notice.text}</p>}
    <h3>Session planning references</h3>
    <p>These resources are not pupil assignments and do not affect progress. Availability is checked again when adding.</p>
    {loadError ? <p role="alert">{loadError}</p> : !sessions ? <p role="status">Loading weekly sessions…</p> : !sessions.length ? <p>No sessions in this plan.</p> : sessions.map(session => {
      const state = records[session.id];
      return <section key={session.id} className={styles.sessionSelections} aria-label={`Session ${session.session_number} planning references`}>
        <h4>Session {session.session_number}: {session.title}</h4>
        {!state ? <p role="status">Loading selections…</p> : state.error ? <p role="alert">{state.error}</p> : !state.selections?.length ? <p>No resources selected.</p> :
          <ul>{state.selections.map(row => <li key={row.id}>
            <span>{row.title} · Version {row.source_version}</span>
            <button type="button" className="button button-small button-secondary" disabled={pending} aria-label={`Remove ${row.title} from Session ${session.session_number}`}
              onClick={() => void mutate(() => removeResourceSessionSelection(planId, session.id, row.id, true), session.id, "Planning reference removed.")}>Remove</button>
          </li>)}</ul>}
      </section>;
    })}
    {(loadError || Object.values(records).some(state => state.error)) && <button type="button" className="button button-small button-secondary" disabled={pending}
      onClick={() => { setSessions(null); setRecords({}); setLoadError(""); setReload(value => value + 1); }}>Retry loading selections</button>}
  </div>;
}
