import { NextRequest,NextResponse } from "next/server";
import { submitPractice } from "@/lib/practice-submissions";
export const runtime="nodejs";
export async function POST(request:NextRequest,{params}:{params:Promise<{planId:string;sessionId:string;assignmentId:string}>}){
 const reply=(data:unknown,status:number)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
 // Next's internal request URL can use localhost even when the browser uses
 // 127.0.0.1. Compare Origin with the actual HTTP Host, never forwarded headers.
 const expectedOrigin=`${request.nextUrl.protocol}//${request.headers.get("host")}`;
 if(request.headers.get("origin")!==expectedOrigin||!request.headers.get("content-type")?.startsWith("application/json"))return reply({error:"Submission unavailable."},403);
 try{
  const reader=request.body?.getReader();if(!reader)throw Error();let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>40000){await reader.cancel();throw Error();}chunks.push(value);}}finally{reader.releaseLock();}
  const {planId,sessionId,assignmentId}=await params;
  const result=await submitPractice(planId,sessionId,assignmentId,JSON.parse(Buffer.concat(chunks).toString("utf8")));
  return reply({submitted:Boolean(result.attemptId)},200);
 }catch{return reply({error:"Submission not confirmed. Complete all required responses, then retry or reopen the activity to check its saved status."},400);}
}
