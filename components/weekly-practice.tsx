"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildWeeklyPractice, rebuildWeeklyPracticeSession, previewWeeklyPractice, approveWeeklyPractice, sentWeeklyPractice } from "@/lib/weekly-practice-actions";
import type { TutorWeeklyDraft } from "@/lib/weekly-practice";
import type { WeeklyObjectiveSelection } from "@/lib/weekly-practice-planner";
import type { ObjectiveChoice } from "@/lib/resource-studio/proposal-contract";
import { useApprovedPractice } from "./resource-studio-approved-practice";
import styles from "./resource-studio-search.module.css";
const label = (s: string) => s.replaceAll("_", " ");
export function WeeklyPracticeReview({ draft, pending, onPreview, onRebuild }: { draft: TutorWeeklyDraft; pending: boolean; onPreview: (session: string, need: number, activity: string) => void; onRebuild?: (session: string) => void }) {
  const total = draft.sessions.reduce((sum,s) => sum+s.needs.reduce((n,v) => n+v.durationMinutes,0),0);
  const activityMinutes = draft.sessions.reduce((sum,s)=>sum+s.needs.reduce((n,v)=>n+v.activities.reduce((m,a)=>m+a.estimatedMinutes,0),0),0);
  return <div><h3>Weekly practice draft</h3><p>{total} minutes budgeted across five sessions · {activityMinutes} minutes of proposed activities. Remaining time allows transitions and headroom. Review only — not yet sent.</p>
    {draft.sessions.map(s => <section key={s.id} aria-label={`Draft session ${s.sessionNumber}`}><h4>Session {s.sessionNumber}</h4>
      <p>{s.needs.reduce((sum,n)=>sum+n.durationMinutes,0)} minute budget · {s.needs.reduce((sum,n)=>sum+n.activities.reduce((m,a)=>m+a.estimatedMinutes,0),0)} minutes of activities · {s.targetMinutes} minute session target</p>
      {s.needs.map((n,i) => <div key={i}><p><strong>{n.intents.map(label).join(" + ")}</strong> · {n.objective}</p>
        {n.error && <p role="alert">{n.error}</p>}<ol>{n.activities.map(a => <li key={a.id}>
          <strong>{label(a.activityType)}</strong><p>{label(a.purpose)} · {a.dose} · {a.estimatedMinutes} minutes</p>
          {a.status === "failed" ? <p role="alert">This activity could not be prepared. Rebuild the week.</p> :
            <button type="button" className="button button-small button-secondary" disabled={pending || !a.previewAvailable} onClick={()=>onPreview(s.id,i,a.id)}>Preview {label(a.activityType)}</button>}
        </li>)}</ol></div>)}
      {onRebuild&&<button type="button" className="button button-small button-secondary" disabled={pending} onClick={()=>onRebuild(s.id)}>Rebuild Session {s.sessionNumber}</button>}
    </section>)}
    {draft.status !== "ready" && <p role="alert">The week is incomplete. Successful previews are retained; rebuild before sending.</p>}
  </div>;
}
export function WeeklyPractice({ planId, objectives, misconceptions, subject: initialSubject, year: initialYear }: {
  planId: string; objectives: ObjectiveChoice[]; misconceptions: string[]; subject: string; year: string;
}) {
  const choices = objectives.filter((o,i) => objectives.findIndex(v => v.objective.trim().toLowerCase() === o.objective.trim().toLowerCase()) === i);
  const [selections,setSelections] = useState<WeeklyObjectiveSelection[]>(choices.slice(0,5).map(c => ({ key:c.key,priority:"normal",misconceptionIndexes: choices.length===1 ? misconceptions.map((_,i)=>i) : [] })));
  const [subject,setSubject]=useState(initialSubject),[year,setYear]=useState(initialYear),[confirmed,setConfirmed]=useState(false);
  const [draft,setDraft]=useState<TutorWeeklyDraft>(),[pending,setPending]=useState(false),[error,setError]=useState(""),[preview,setPreview]=useState("");
  const [sent,setSent]=useState(false),[loading,setLoading]=useState(true),[expired,setExpired]=useState(false);
  const busy=useRef(false), revision=useRef(0); const {assignments,update}=useApprovedPractice(); const router=useRouter();
  useEffect(()=>{let active=true;sentWeeklyPractice(planId).then(r=>{if(active){setSent(Boolean(r.proposalId));setError(r.error??"");setLoading(false);}}).catch(()=>{if(active){setError("Could not load sent-week status. Reload to retry.");setLoading(false);}});return()=>{active=false;};},[planId]);
  useEffect(()=>{if(!draft)return;const check=()=>setExpired(Date.parse(draft.expiresAt)<=Date.now());check();const timer=setInterval(check,1000);return()=>clearInterval(timer);},[draft]);
  function invalidate(){revision.current++;setDraft(undefined);setPreview("");setConfirmed(false);setError("");}
  async function work(operation:()=>Promise<void>){if(busy.current)return;busy.current=true;setPending(true);setError("");try{await operation();}catch{setError("Could not complete this action. Please retry.");}finally{busy.current=false;setPending(false);}}
  async function build(){const current=revision.current;setPreview("");await work(async()=>{const r=await buildWeeklyPractice(planId,selections,{subject,year},confirmed);if(current!==revision.current)return;if(r.draft)setDraft(r.draft);setError(r.error??"");});}
  async function open(session:string,need:number,activity:string){if(!draft)return;const current=revision.current;await work(async()=>{const r=await previewWeeklyPractice(planId,draft.id,session,need,activity,confirmed);if(current===revision.current){setPreview(r.url??"");setError(r.error??"");}});}
  async function rebuildSession(session:string){if(!draft)return;const current=revision.current;setPreview("");await work(async()=>{const r=await rebuildWeeklyPracticeSession(planId,draft.id,session,confirmed);if(current!==revision.current)return;if(r.draft)setDraft(r.draft);setError(r.error??"");});}
  async function send(){if(!draft)return;setPreview("");await work(async()=>{const r=await approveWeeklyPractice(planId,draft.id,confirmed);if(r.assignments){update(r.assignments);setSent(true);router.refresh();}setError(r.error??"");});}
  if(sent)return <section className={styles.search}><h2>Week sent to learner</h2><p>All five sessions are assigned. Review the activities and learner results below. Sent practice cannot be replaced.</p></section>;
  return <section className={styles.search} aria-label="Weekly practice" aria-busy={pending}>
    <h2>Build weekly practice</h2><p>Confirm the learning needs for this week. Practice Loop plans all five sessions and prepares the activities for your review.</p>
    {loading ? <p role="status">Loading week status…</p> : assignments.length ? <p role="alert">This plan already has assigned practice. Create a new weekly plan to build a complete week.</p> : !choices.length ? <p>Extract and review objectives for this reflection before building a week.</p> : <>
      <fieldset disabled={pending}><legend>Learning needs (select up to five)</legend>
        {choices.map(c=>{const selected=selections.find(s=>s.key===c.key);return <div key={c.key}>
          <label className={styles.confirm}><input type="checkbox" checked={Boolean(selected)} onChange={e=>{invalidate();setSelections(s=>e.target.checked?[...s,{key:c.key,priority:"normal",misconceptionIndexes:[]}]:s.filter(v=>v.key!==c.key));}}/>{c.objective} ({c.label})</label>
          {selected&&<><label>Priority <select value={selected.priority} onChange={e=>{invalidate();setSelections(s=>s.map(v=>v.key===c.key?{...v,priority:e.target.value as "normal"|"high"}:v));}}><option value="normal">Normal</option><option value="high">High</option></select></label>
            {misconceptions.length>0&&<fieldset><legend>Relevant misconceptions</legend>{misconceptions.map((m,i)=><label key={i} className={styles.confirm}><input type="checkbox" checked={selected.misconceptionIndexes.includes(i)} onChange={e=>{invalidate();setSelections(s=>s.map(v=>v.key===c.key?{...v,misconceptionIndexes:e.target.checked?[...v.misconceptionIndexes,i]:v.misconceptionIndexes.filter(n=>n!==i)}:v));}}/>{m}</label>)}</fieldset>}</>}
        </div>;})}
        <div className={styles.filters}><label>Subject<input value={subject} maxLength={240} onChange={e=>{invalidate();setSubject(e.target.value);}}/></label><label>Year<input value={year} maxLength={240} onChange={e=>{invalidate();setYear(e.target.value);}}/></label></div>
        <p>Only the educational objective, selected misconception, subject, year, duration and teaching intents are shared to prepare practice. Review these fields for personal details first.</p>
        <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e=>{revision.current++;setConfirmed(e.target.checked);setDraft(undefined);setPreview("");}}/>This is fictional test data with no personal information. I permit automatic activity preparation.</label>
      </fieldset>
      <button className="button" type="button" disabled={pending||!confirmed||!selections.length||selections.length>5||!subject.trim()||!year.trim()} onClick={()=>void build()}>{pending?"Preparing…":draft?"Rebuild entire week":"Build weekly practice"}</button>
      {pending&&<p role="status">Preparing the week may take several minutes. Keep this page open.</p>}
      {confirmed&&draft&&<><WeeklyPracticeReview draft={draft} pending={pending||expired} onPreview={(s,n,a)=>void open(s,n,a)} onRebuild={s=>void rebuildSession(s)}/>
        {expired&&<p role="alert">This draft expired. Rebuild the week before sending.</p>}
        <p>Review every session before approving. Review drafts expire after 30 minutes or an app restart.</p>
        <button className="button" type="button" disabled={pending||expired||draft.status!=="ready"} onClick={()=>void send()}>Approve &amp; send week</button></>}
    </>}
    {error&&<p role="alert">{error}</p>}
    {preview&&<div><button type="button" className="button button-secondary" onClick={()=>setPreview("")}>Close preview</button><iframe title="Weekly activity preview" src={preview} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" style={{width:"100%",height:"700px",border:"1px solid var(--line)"}}/></div>}
  </section>;
}
