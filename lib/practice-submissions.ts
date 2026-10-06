import "server-only";
import { requireLearner, requireTutor } from "@/lib/auth";
import { packageServiceClient } from "@/lib/resource-studio/package-service";
import { proposalOrigin } from "@/lib/resource-studio/proposal-client";

export type PracticeResult = {mode:"automatic"|"manual"|"hybrid";earned:number|null;possible:number|null;reviewStatus:"pending"|"not_required";items:{id:string;prompt:string;response:string;reviewRequired:boolean}[]};
export type PracticeSubmission = {assignmentId:string;sessionId:string;activityType:string;attemptId:string|null;submittedAt:string|null;response:Record<string,unknown>|null;result:PracticeResult|null};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
function exact(v:unknown,keys:string[]):v is Record<string,unknown>{return object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
/** Strict safe result envelope: no source metadata, private answers or supplied score. */
export function checkedSubmission(value:unknown){
 if(!exact(value,["schemaVersion","activityType","contentVersion","responses","result"])||value.schemaVersion!=="submission-1"||!Number.isInteger(value.contentVersion)||!object(value.responses))throw Error("Invalid result");
 const r=value.result;
 if(!exact(r,["mode","earned","possible","reviewStatus","items"])||!["automatic","manual","hybrid"].includes(String(r.mode))||!["pending","not_required"].includes(String(r.reviewStatus))||!Array.isArray(r.items)||r.items.length>200)throw Error("Invalid result");
 if(r.mode==="manual" ? r.earned!==null||r.possible!==null||r.reviewStatus!=="pending" : !Number.isInteger(r.earned)||!Number.isInteger(r.possible)||(r.earned as number)<0||(r.possible as number)<(r.earned as number))throw Error("Invalid score");
 for(const item of r.items)if(!exact(item,["id","prompt","response","reviewRequired"])||typeof item.id!=="string"||item.id.length>100||typeof item.prompt!=="string"||item.prompt.length>4000||typeof item.response!=="string"||item.response.length>8000||typeof item.reviewRequired!=="boolean")throw Error("Invalid item");
 return value;
}
async function report(planId:string,supabase:Awaited<ReturnType<typeof requireLearner>>["supabase"]):Promise<PracticeSubmission[]>{
 if(!uuid.test(planId))throw Error("Practice unavailable");
 const {data,error}=await supabase.rpc("get_practice_submission_report",{p_plan:planId});
 if(error||!Array.isArray(data))throw Error("Practice results unavailable");return data;
}
export async function learnerSubmissions(planId:string){return report(planId,(await requireLearner()).supabase);}
export async function tutorSubmissions(planId:string){return report(planId,(await requireTutor()).supabase);}
export async function submitPractice(planId:string,sessionId:string,assignmentId:string,raw:unknown){
 const {supabase,authUserId}=await requireLearner();
 if(process.env.NODE_ENV!=="development"||![planId,sessionId,assignmentId].every(id=>uuid.test(id)))throw Error("Practice unavailable");
 if(!exact(raw,["responses"])||!object(raw.responses)||JSON.stringify(raw).length>32768)throw Error("Invalid response");
 const {data:reference,error}=await supabase.rpc("get_learner_delivery_reference",{p_plan:planId,p_session:sessionId,p_assignment:assignmentId});
 if(error||!reference)throw Error("Practice unavailable");
 const previous=(await report(planId,supabase)).find(r=>r.assignmentId===assignmentId&&r.sessionId===sessionId);
 if(previous?.attemptId)return previous;
 const key=process.env.PRACTICE_LOOP_INTEGRATION_KEY;if(!key)throw Error("Checking unavailable");
 const response=await fetch(new URL("/api/integrations/practice-loop/package-submission",proposalOrigin()),{
  method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
  body:JSON.stringify({packageId:reference.packageId,integrity:reference.integrity,responses:raw.responses}),
  cache:"no-store",redirect:"error",signal:AbortSignal.timeout(30000),
 });
 if(!response.ok)throw Error("Complete every required response before submitting, then try again. No saved result has been confirmed.");
 const checked=checkedSubmission(await response.json());
 const {error:saveError}=await packageServiceClient().rpc("save_practice_submission",{p_user:authUserId,p_plan:planId,p_session:sessionId,p_assignment:assignmentId,p_package:reference.packageId,p_integrity:reference.integrity,p_checked:checked});
 if(saveError)throw Error("Could not confirm your submission. Reopen this activity or retry safely.");
 return (await report(planId,supabase)).find(r=>r.assignmentId===assignmentId)!;
}
