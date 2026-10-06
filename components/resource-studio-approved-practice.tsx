"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { listApprovedPractice, previewApprovedPractice } from "@/lib/resource-studio/approval-actions";
import type { SessionPackageAssignment } from "@/lib/resource-studio/approval-types";

const Context = createContext<{ assignments: SessionPackageAssignment[]; update: (rows: SessionPackageAssignment[]) => void; error: string }>(
  { assignments: [], update: () => {}, error: "" });
export const useApprovedPractice = () => useContext(Context);
export function ApprovedPracticeProvider({ planId, children, enabled = true }: { planId: string; children: ReactNode; enabled?: boolean }) {
  const [assignments, setAssignments] = useState<SessionPackageAssignment[]>([]), [error, setError] = useState("");
  const generation = useRef(0);
  const update = (rows: SessionPackageAssignment[]) => { generation.current++; setAssignments(rows); setError(""); };
  const [revision, retry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let current = true; const started = generation.current;
    listApprovedPractice(planId).then(result => {
      if (!current || started !== generation.current) return;
      if (result.assignments) setAssignments(result.assignments);
      setError(result.error ?? "");
    }).catch(() => { if (current && started === generation.current) setError("Could not load approved practice."); });
    return () => { current = false; };
  }, [planId, revision, enabled]);
  return <Context.Provider value={{ assignments, update, error }}>
    {error && <p role="alert">{error} <button type="button" onClick={() => retry(n => n + 1)}>Retry</button></p>}{children}
  </Context.Provider>;
}
const label = (s: string) => s.replaceAll("_", " ");
export function ApprovedSessionPractice({ planId, sessionId }: { planId: string; sessionId: string }) {
  const { assignments } = useApprovedPractice();
  const [url, setUrl] = useState(""), [error, setError] = useState(""), [pending, setPending] = useState(false);
  const rows = assignments.filter(row => row.sessionId === sessionId);
  async function preview(id: string) {
    setPending(true); setError(""); setUrl("");
    try { const result = await previewApprovedPractice(planId, id); setUrl(result.url ?? ""); setError(result.error ?? ""); }
    catch { setError("Could not open approved practice. Try again."); }
    finally { setPending(false); }
  }
  if (!rows.length) return null;
  return <section aria-label="Approved practice"><h3>Approved practice</h3><ol>
    {rows.map(row => <li key={row.id}><strong>{label(row.activityType)}</strong>
      <p>{label(row.purpose)} · {row.dose} · {row.estimatedMinutes} minutes</p>
      <p>Assigned — learner delivery pending</p>
      <button type="button" className="button button-small button-secondary" disabled={pending} onClick={() => void preview(row.id)}>Preview {label(row.activityType)}</button>
    </li>)}
  </ol>{error && <p role="alert">{error}</p>}{url && <div>
    <button type="button" onClick={() => setUrl("")}>Close preview</button>
    <iframe title="Approved practice preview" src={url} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin"
      style={{ width: "100%", height: "700px", border: "1px solid var(--line)" }} />
  </div>}</section>;
}
