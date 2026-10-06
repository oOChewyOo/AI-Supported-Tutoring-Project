import type {PracticeSubmission} from "@/lib/practice-submissions";
export function PracticeResult({submission,showResponses=false}:{submission:PracticeSubmission;showResponses?:boolean}){
 const r=submission.result;
 if(!submission.attemptId||!r)return <p>Not submitted</p>;
 return <section aria-label="Saved submission"><p><strong>{r.mode==="manual"?"Response submitted":"Completed"}</strong> — saved {new Date(submission.submittedAt!).toLocaleString("en-GB",{timeZone:"UTC"})} UTC</p>
  {r.mode!=="manual"&&<p>{r.mode==="hybrid"?"Automatic questions":submission.activityType==="spot_mistake"?"Identification/correction":"Score"}: {r.earned} / {r.possible}</p>}
  {r.reviewStatus==="pending"&&<p>Review pending — written responses have not been marked.</p>}
  {showResponses&&r.items.map(i=><div key={i.id}><h4>{i.prompt}</h4><p style={{whiteSpace:"pre-wrap"}}>{i.response}</p>{i.reviewRequired&&<p>Review pending</p>}</div>)}
 </section>;
}
