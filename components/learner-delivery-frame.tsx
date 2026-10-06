"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
export function LearnerDeliveryFrame({url,submitPath}:{url:string;submitPath:string}){
 const frame=useRef<HTMLIFrameElement>(null),busy=useRef(false);const router=useRouter();const [message,setMessage]=useState("");
 const origin=new URL(url).origin;
 useEffect(()=>{
  const ready=()=>frame.current?.contentWindow?.postMessage({type:"pl-ready"},origin);
  async function receive(event:MessageEvent){
   if(event.origin!==origin||event.source!==frame.current?.contentWindow)return;
   if(event.data?.type==="rs-ready"){ready();return;}
   if(event.data?.type!=="rs-submit"||busy.current)return;
   busy.current=true;setMessage("Saving submission…");
   try{const response=await fetch(submitPath,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({responses:event.data.responses}),cache:"no-store",credentials:"same-origin"});
    if(!response.ok)throw Error();const value=await response.json();if(value.submitted!==true)throw Error();
    setMessage("Submission saved.");router.refresh();
   }catch{setMessage("Submission not confirmed. Complete all required responses and retry, or reopen to check saved status.");frame.current?.contentWindow?.postMessage({type:"pl-submit-failed"},origin);}
   finally{busy.current=false;}
  }
  window.addEventListener("message",receive);ready();return()=>window.removeEventListener("message",receive);
 },[origin,submitPath,router]);
 return <><p role="status">{message}</p><iframe ref={frame} title="Assigned practice" src={url} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" style={{width:"100%",height:"75vh",border:"1px solid #ddd"}} /></>;
}
