import {tutorSubmissions} from "@/lib/practice-submissions";
import {PracticeResult} from "./practice-result";
export async function PracticeSubmissionReport({planId,sessions}:{planId:string;sessions:{id:string;sessionNumber:number;title:string}[]}){
 const rows=await tutorSubmissions(planId);if(!rows.length)return null;
 return <section className="card"><h2>Assigned practice progress</h2><p>{rows.filter(r=>r.attemptId).length} of {rows.length} approved activities submitted. This is separate from legacy activity progress.</p>
 {sessions.map(s=>{const assignments=rows.filter(r=>r.sessionId===s.id);if(!assignments.length)return null;const complete=assignments.every(a=>a.attemptId);
 return <section key={s.id}><h3>Session {s.sessionNumber} — {s.title}</h3><p>{complete?"Assigned practice complete":"Assigned practice in progress"}</p>
 {assignments.map((a,i)=><article key={a.assignmentId}><h4>{i+1}. {a.activityType.replaceAll("_"," ")}</h4><PracticeResult submission={a} showResponses /></article>)}</section>;})}
 </section>;
}
