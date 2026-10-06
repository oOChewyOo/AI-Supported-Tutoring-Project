const {test,afterEach}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const ts=require('typescript');
const original=Module._load,mocks={},oldFetch=global.fetch,env={...process.env};
Module._load=function(id,...args){if(Object.hasOwn(mocks,id))return mocks[id];if(id==='server-only')return {};if(id.startsWith('@/'))return original.call(this,path.resolve(id.slice(2)),...args);return original.call(this,id,...args);};
require.extensions['.tsx']=require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
afterEach(()=>{global.fetch=oldFetch;process.env={...env};for(const k of Object.keys(mocks))delete mocks[k];for(const k of Object.keys(require.cache))if(k.includes('practice-submissions.ts')||k.includes('practice-result.tsx')||k.includes('practice-submission-report.tsx')||k.includes('/end/')||k.includes('\\end\\'))delete require.cache[k];});
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
function setup({denied=false,failure=false}={}){
 process.env.NODE_ENV='development';process.env.PRACTICE_LOOP_INTEGRATION_KEY='synthetic';
 let saved=null,calls=0,writes=0;
 const result={schemaVersion:'submission-1',activityType:'arithmetic_input',contentVersion:1,responses:{q:'4'},result:{mode:'automatic',earned:1,possible:2,reviewStatus:'not_required',items:[{id:'q',prompt:'Calculate',response:'4',reviewRequired:false}]}};
 const row=()=>({assignmentId:ids[2],sessionId:ids[1],activityType:result.activityType,attemptId:saved?'saved':null,submittedAt:saved?'2026-10-06T12:00:00Z':null,result:saved?.result??null,response:saved?.responses??null});
 const supabase={rpc:async(name)=>name==='get_learner_delivery_reference'?{data:denied?null:{packageId:ids[2],integrity:'a'.repeat(64)},error:denied?{}:null}:{data:[row()]}};
 mocks['@/lib/auth']={requireLearner:async()=>({supabase,authUserId:'mapped-user',studentId:'mapped-student'}),requireTutor:async()=>({supabase})};
 mocks['@/lib/resource-studio/package-service']={packageServiceClient:()=>({rpc:async(name,args)=>{writes++;assert.equal(name,'save_practice_submission');assert.equal(args.p_user,'mapped-user');saved??=args.p_checked;return {data:'saved'};}})};
 mocks['@/lib/resource-studio/proposal-client']={proposalOrigin:()=>new URL('http://127.0.0.1:3101')};
 global.fetch=async(url,init)=>{calls++;assert.deepEqual(Object.keys(JSON.parse(init.body)).sort(),['integrity','packageId','responses']);assert.equal(init.headers.Authorization,'Bearer synthetic');assert.equal(init.cache,'no-store');return {ok:!failure,json:async()=>result};};
 return {result,row,stats:()=>({calls,writes}),recover(){failure=false;}};
}
test('first checked submission persists; repeated request returns first attempt without rechecking',async()=>{
 const state=setup(),{submitPractice}=require('../lib/practice-submissions.ts');
 const first=await submitPractice(...ids,{responses:{q:'4'}});assert.equal(first.attemptId,'saved');
 assert.deepEqual(await submitPractice(...ids,{responses:{q:'different'}}),first);assert.deepEqual(state.stats(),{calls:1,writes:1});
});
test('unauthorized assignment and malformed/forged result input never reach RS or persistence',async()=>{
 const state=setup({denied:true}),{submitPractice}=require('../lib/practice-submissions.ts');
 await assert.rejects(()=>submitPractice(...ids,{responses:{q:'4'}}));await assert.rejects(()=>submitPractice(...ids,{responses:{},score:100}));await assert.rejects(()=>submitPractice(...ids,{responses:{q:'x'.repeat(40000)}}));assert.deepEqual(state.stats(),{calls:0,writes:0});
});
test('RS failure does not create completion; retry succeeds cleanly',async()=>{
 const state=setup({failure:true}),{submitPractice}=require('../lib/practice-submissions.ts');await assert.rejects(()=>submitPractice(...ids,{responses:{q:'4'}}));assert.equal(state.stats().writes,0);state.recover();assert.equal((await submitPractice(...ids,{responses:{q:'4'}})).attemptId,'saved');
});
test('RS private fields or forged numeric manual result are rejected before save',async()=>{
 const state=setup(),{submitPractice}=require('../lib/practice-submissions.ts');state.result.result.expectedAnswer='hidden';await assert.rejects(()=>submitPractice(...ids,{responses:{q:'4'}}));delete state.result.result.expectedAnswer;state.result.result.mode='manual';await assert.rejects(()=>submitPractice(...ids,{responses:{q:'4'}}));assert.equal(state.stats().writes,0);
});
test('manual and hybrid durable safe views show pending review without invented manual marks',async()=>{
 for(const mode of ['manual','hybrid']){
  delete require.cache[require.resolve('../lib/practice-submissions.ts')];
  const state=setup();state.result.activityType=mode==='manual'?'short_written_response':'comprehension';Object.assign(state.result.result,{mode,earned:mode==='manual'?null:1,possible:mode==='manual'?null:2,reviewStatus:'pending'});state.result.result.items[0].reviewRequired=true;
  const row=await require('../lib/practice-submissions.ts').submitPractice(...ids,{responses:{q:'4'}});
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const {PracticeResult}=require('../components/practice-result.tsx');
  const html=renderToStaticMarkup(React.createElement(PracticeResult,{submission:row,showResponses:true}));assert.match(html,/Review pending/);assert.match(html,mode==='manual'?/Response submitted/:/Automatic questions/);assert.doesNotMatch(html,/0%|100%|expectedAnswer|sourceUrl|provenance/);
 }
});
test('session completes only when every approved assignment is durably submitted; pending review does not block',async()=>{
 setup();const rows=[{assignmentId:ids[2],sessionId:ids[1],attemptId:'saved',result:{reviewStatus:'pending'}}];
 mocks['@/lib/practice-submissions']={learnerSubmissions:async()=>rows};mocks['@/lib/learner-practice']={learnerSession:async()=>({session:{assignments:[{id:ids[2]},{id:'sibling'}]}})};
 const end=require('../app/learn/[planId]/[sessionId]/end/page.tsx').default;const render=require('react-dom/server').renderToStaticMarkup;const props={params:Promise.resolve({planId:ids[0],sessionId:ids[1]})};
 assert.match(render(await end(props)),/Practice still to submit/);rows.push({assignmentId:'sibling',sessionId:ids[1],attemptId:'saved2',result:{reviewStatus:'pending'}});const html=render(await end(props));assert.match(html,/Session complete/);assert.match(html,/saved for tutor review/);
});
test('HTTP origin check uses actual Host despite Next internal localhost URL, and denies cross-origin',async()=>{
 let calls=0;mocks['@/lib/practice-submissions']={submitPractice:async()=>{calls++;return {attemptId:'saved'};}};
 const {NextRequest}=require('next/server');const {POST}=require('../app/api/learn/[planId]/[sessionId]/[assignmentId]/route.ts');
 const send=origin=>POST(new NextRequest('http://localhost:3100/api/learn/test',{method:'POST',headers:{host:'127.0.0.1:3100',origin,'content-type':'application/json'},body:JSON.stringify({responses:{q:'4'}})}),{params:Promise.resolve({planId:ids[0],sessionId:ids[1],assignmentId:ids[2]})});
 assert.equal((await send('http://unrelated.invalid')).status,403);assert.equal(calls,0);
 assert.equal((await send('http://127.0.0.1:3100')).status,200);assert.equal(calls,1);
});
