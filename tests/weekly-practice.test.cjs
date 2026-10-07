const {test,beforeEach,afterEach}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),{randomUUID}=require('node:crypto');
const mocks={},load=Module._load;
Module._load=function(id,...args){if(Object.hasOwn(mocks,id))return mocks[id];if(id==='server-only')return {};if(id.endsWith('.css'))return {default:{}};if(id.startsWith('@/'))return load.call(this,path.resolve(id.slice(2)),...args);return load.call(this,id,...args);};
require.extensions['.tsx']=require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
const env={...process.env};
const planId=randomUUID(),tutorId=randomUUID(),sessions=Array.from({length:5},(_,i)=>({id:randomUUID(),session_number:i+1,duration_minutes:15}));
let row,requests,assignments,sent,writes,materialized,failAt,failDb,owned,active,maxActive,failRequest;
const state=()=>require('../lib/weekly-practice.ts'),actions=()=>require('../lib/weekly-practice-actions.ts');
const selection=[{key:'focus_for_next_week:0',priority:'high',misconceptionIndexes:[0]}];
const build=()=>actions().buildWeeklyPractice(planId,selection,{subject:'Maths',year:'5'},true);
beforeEach(()=>{
 process.env.NODE_ENV='development';requests=[];assignments=[];sent=null;writes=0;materialized=[];failAt=0;failDb=false;owned=true;active=0;maxActive=0;failRequest=-1;
 row={id:randomUUID(),updated_at:'2026-10-07T00:00:00Z',focus_for_next_week:['Equivalent fractions'],developing_objectives:['Equivalent fractions'],possible_misconceptions:['changes only numerator']};
 const q=table=>({select(){return this},eq(){return this},order:async()=>({data:sessions}),maybeSingle:async()=>({data:row})});
 mocks['@/lib/auth']={requireTutor:async()=>({user:{id:tutorId},supabase:{from:q}})};
 mocks['./resource-studio/plan-ownership']={assertOwnedResourcePlan:async()=>{if(!owned)throw Error();return {student_id:'PRIVATE',lesson_reflection_id:'PRIVATE'};}};
 mocks['./resource-studio/approval-actions']={listApprovedPractice:async()=>({assignments})};
 mocks['./resource-studio/proposal-client']={proposalOrigin:()=>new URL('http://localhost:3101'),requestPracticeProposal:async need=>{
  const index=requests.length;requests.push(need);active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,5));active--;if(index===failRequest)throw Error('private provider');
  return {schemaVersion:'1',id:randomUUID(),reviewOnly:true,objective:need.objective,requestedMinutes:need.durationMinutes,plannedMinutes:need.durationMinutes-1,headroomMinutes:1,planningMode:'deterministic',status:'ready',expiresAt:new Date(Date.now()+600000).toISOString(),activities:[{id:'one',activityType:'arithmetic_input',purpose:need.intents[0],dose:'4 questions',estimatedMinutes:5,status:'ready',previewToken:'a'.repeat(64)}]};
 }};
 // Keep real deterministic package-key helper; replace only materialisation transport.
 const client=require('../lib/resource-studio/package-client.ts');
 mocks['./resource-studio/package-client']={...client,materializeProposalActivity:async(p,a)=>{const key=client.materializationKey(p.id,a.id);materialized.push(key);if(materialized.length===failAt)throw Error();return {packageId:key,activityId:key,contentVersion:1,activityType:a.activityType,integrity:'b'.repeat(64),releaseId:null,resourceVersion:null,scoringMode:'automatic',schemaVersion:'1'};}};
 mocks['./resource-studio/package-service']={packageServiceClient:()=>({rpc:async(name,args)=>{if(name==='get_weekly_practice_approval')return {data:sent};writes++;if(failDb)return {error:{code:'test'}};if(!sent){sent={proposalId:args.p_proposal,approvedAt:'now'};assignments=args.p_groups.flatMap(g=>g.items.map((item,i)=>({id:randomUUID(),sessionId:g.sessionId,position:i+1,activityType:item.activityType})));}return {data:assignments};}})};
});
afterEach(()=>{process.env={...env};for(const k of Object.keys(mocks))delete mocks[k];for(const k of Object.keys(require.cache))if(!k.includes('node_modules')&&['lib','components'].some(d=>k.includes(path.sep+d+path.sep)))delete require.cache[k];global.weeklyPracticeDrafts?.clear();global.weeklyPracticeBusy?.clear();});
test('whole week calls all needs with bounded concurrency, ordered safe results and fresh rebuild identity',async()=>{
 const a=await build();assert.ok(a.draft);assert.equal(requests.length,5);assert.equal(maxActive,2);assert.deepEqual(a.draft.sessions.map(s=>s.id),sessions.map(s=>s.id));assert.equal(a.draft.status,'ready');assert.equal(writes,0);assert.equal(materialized.length,0);
 assert.doesNotMatch(JSON.stringify(a),/PRIVATE|previewToken|source|provider|integrity|packageId/);for(const r of requests)assert.deepEqual(Object.keys(r),['subject','year','objective','durationMinutes','intents']);
 const b=await build();assert.notEqual(a.draft.id,b.draft.id);
 const p=await actions().previewWeeklyPractice(planId,a.draft.id,sessions[0].id,0,'one',true);assert.match(p.url,/review#a{64}$/);
});
test('failed sibling retains other sessions and prevents send',async()=>{
 failRequest=2;const {draft}=await build();assert.equal(draft.status,'partial');assert.equal(draft.sessions[2].needs[0].activities.length,0);assert.equal(draft.sessions[4].needs[0].activities.length,1);
 assert.ok((await actions().approveWeeklyPractice(planId,draft.id,true)).error);assert.equal(materialized.length,0);assert.equal(writes,0);
});
test('session rebuild retries only its original need, preserves siblings and gives a new week identity',async()=>{
 failRequest=4;const {draft}=await build();failRequest=-1;
 const result=await actions().rebuildWeeklyPracticeSession(planId,draft.id,sessions[4].id,true);assert.ok(result.draft);assert.equal(result.draft.status,'ready');assert.notEqual(result.draft.id,draft.id);assert.equal(requests.length,6);assert.deepEqual(requests[5],requests[4]);assert.deepEqual(result.draft.sessions.slice(0,4),draft.sessions.slice(0,4));assert.equal(writes,0);assert.equal(materialized.length,0);
 assert.ok((await actions().rebuildWeeklyPracticeSession(planId,result.draft.id,randomUUID(),true)).error);
 assignments=[{id:'existing'}];assert.match((await actions().rebuildWeeklyPracticeSession(planId,result.draft.id,sessions[0].id,true)).error,/already/);
});
test('all five sessions materialise before one transaction; durable retries work without cache',async()=>{
 const {draft}=await build();const first=await actions().approveWeeklyPractice(planId,draft.id,true);assert.equal(first.assignments.length,5);assert.equal(materialized.length,5);assert.equal(writes,1);
 global.weeklyPracticeDrafts.clear();assert.deepEqual(await actions().approveWeeklyPractice(planId,draft.id,true),first);assert.equal(writes,1);assert.equal(materialized.length,5);
});
test('double approval uses identical package keys and returns one durable set',async()=>{
 const {draft}=await build();const results=await Promise.all([actions().approveWeeklyPractice(planId,draft.id,true),actions().approveWeeklyPractice(planId,draft.id,true)]);
 assert.deepEqual(results[0],results[1]);assert.equal(new Set(materialized).size,5);assert.equal(assignments.length,5);
});
test('materialisation failure creates no assignments; retry reuses keys',async()=>{
 const {draft}=await build();failAt=3;assert.ok((await actions().approveWeeklyPractice(planId,draft.id,true)).error);assert.equal(writes,0);assert.equal(assignments.length,0);const first=materialized[0];failAt=0;
 assert.equal((await actions().approveWeeklyPractice(planId,draft.id,true)).assignments.length,5);assert.equal(materialized[3],first);assert.equal(new Set(materialized).size,5);
});
test('transaction failure leaves draft retryable without changing packages',async()=>{
 const {draft}=await build();failDb=true;assert.ok((await actions().approveWeeklyPractice(planId,draft.id,true)).error);assert.equal(assignments.length,0);const initial=[...materialized];failDb=false;
 await actions().approveWeeklyPractice(planId,draft.id,true);assert.deepEqual(materialized.slice(5),initial);
});
test('ownership, changed objectives, withdrawn consent and foreign draft block all remote writes',async()=>{
 const {draft}=await build();owned=false;assert.ok((await actions().approveWeeklyPractice(planId,draft.id,true)).error);owned=true;
 assert.ok((await actions().approveWeeklyPractice(planId,draft.id,false)).error);assert.ok((await actions().approveWeeklyPractice(randomUUID(),draft.id,true)).error);
 row.updated_at='changed';assert.match((await actions().approveWeeklyPractice(planId,draft.id,true)).error,/changed/);assert.equal(materialized.length,0);
});
test('existing assignments block rebuild and send; expiration blocks previews/send',async()=>{
 const {draft}=await build();assignments=[{id:'existing'}];assert.match((await build()).error,/already/);assert.match((await actions().approveWeeklyPractice(planId,draft.id,true)).error,/already/);assignments=[];
 const retained=state().retainedWeeklyDraft(tutorId,planId,draft.id);retained.expiresAt='2000-01-01';assert.ok((await actions().approveWeeklyPractice(planId,draft.id,true)).error);assert.ok((await actions().previewWeeklyPractice(planId,draft.id,sessions[0].id,0,'one',true)).error);assert.equal(materialized.length,0);
});
test('review renders five sessions, educational summaries, dose and preview without source labels',async()=>{
 mocks['next/navigation']={useRouter:()=>({refresh(){}})};
 const {draft}=await build(),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {WeeklyPracticeReview}=require('../components/weekly-practice.tsx');
 const html=renderToStaticMarkup(React.createElement(WeeklyPracticeReview,{draft,pending:false,onPreview(){}}));
 for(let i=1;i<=5;i++)assert.match(html,new RegExp('Session '+i));assert.match(html,/65 minutes/);assert.match(html,/4 questions/);assert.equal((html.match(/Preview arithmetic input/g)||[]).length,5);assert.doesNotMatch(html,/Oak|Twinkl|provenance|package|materialis/);
});
