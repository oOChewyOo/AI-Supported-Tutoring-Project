const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const { randomUUID } = require('node:crypto');
const mocks = {}, load = Module._load;
Module._load = function(id,...args) {
  if (Object.hasOwn(mocks,id)) return mocks[id];
  if (id === 'server-only') return {};
  if (id.startsWith('@/')) return load.call(this,path.resolve(id.slice(2)),...args);
  return load.call(this,id,...args);
};
require.extensions['.ts'] = (module,filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{ compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 } }).outputText,filename);
const env = {...process.env}, originalFetch = global.fetch;
const plan = randomUUID(), session = randomUUID(), tutor = randomUUID();
let proposal, assignments, requests, writes, failAt, failDb, owned, validSession, packageMap;
const ref = type => ({ schemaVersion:'1', packageId:randomUUID(),activityId:randomUUID(),contentVersion:1,releaseId:null,resourceVersion:null,
 activityType:type, integrity:'b'.repeat(64), scoringMode:type==='comprehension'?'hybrid_review':['short_written_response','explain_thinking'].includes(type)?'manual_review':'automatic',
 status:'prepared',assigned:false,contentAccess:'authenticated_server_only',learnerDelivery:'not_implemented' });
beforeEach(() => {
  process.env.NODE_ENV='development'; process.env.RESOURCE_STUDIO_BASE_URL='http://localhost:3101'; process.env.PRACTICE_LOOP_INTEGRATION_KEY='synthetic-key';
  assignments=[]; requests=[]; writes=0; failAt=0; failDb=false; owned=true; validSession=true; packageMap=new Map();
  proposal={ id:randomUUID(),schemaVersion:'1',reviewOnly:true,objective:'Fractions',requestedMinutes:10,plannedMinutes:9,headroomMinutes:1,planningMode:'deterministic',status:'ready',expiresAt:new Date(Date.now()+600000).toISOString(),
    activities:['arithmetic_input','spot_mistake'].map((type,i)=>({id:`item-${i}`,activityType:type,purpose:'fluency',dose:'2 questions',estimatedMinutes:4,status:'ready',previewToken:(i?'b':'a').repeat(64)})) };
  mocks['./plan-ownership']={assertOwnedResourcePlan:async()=>{if(!owned)throw Error();}};
  mocks['@/lib/auth']={requireTutor:async()=>({user:{id:tutor},supabase:{from(){const q={select(){return q},eq(){return q},async maybeSingle(){return {data:validSession?{id:session,weekly_plan_id:plan}:null}}};return q;}}})};
  mocks['./package-service']={packageServiceClient:()=>({rpc:async(name,args)=>{
    if(name==='list_resource_package_assignments')return {data:assignments};
    writes++; if(failDb)return {error:{code:'test'}};
    if(!assignments.some(a=>a.proposalId===args.p_proposal)) assignments.push(...args.p_items.map((item,i)=>({id:randomUUID(),batchId:'batch',proposalId:args.p_proposal,sessionId:session,position:i+1,activityType:item.activityType,purpose:item.purpose,dose:item.dose,estimatedMinutes:item.estimatedMinutes,status:'assigned',approvedAt:'now',packageId:item.packageId,integrity:item.integrity})));
    return {data:assignments};
  }})};
  global.fetch=async(url,options)=>{const body=JSON.parse(options.body);requests.push(body);if(requests.length===failAt)return Response.json({error:'private rights provider'},{status:409});
    if(String(url).endsWith('package-preview'))return Response.json({token:'abc.'+'a'.repeat(64)});
    if(!packageMap.has(body.idempotencyKey))packageMap.set(body.idempotencyKey,ref(proposal.activities.find(a=>a.id===body.proposalActivityId).activityType));
    return Response.json(packageMap.get(body.idempotencyKey));};
});
afterEach(()=>{process.env={...env};global.fetch=originalFetch;Object.keys(mocks).forEach(k=>delete mocks[k]);for(const k of Object.keys(require.cache))if(k.includes(path.sep+'lib'+path.sep)&&!k.includes('node_modules'))delete require.cache[k];});
const actions=()=>require('../lib/resource-studio/approval-actions.ts');
const retain=()=>require('../lib/resource-studio/proposal-store.ts').retainProposal(tutor,plan,proposal,'focus_for_next_week:0').id;
const approve=id=>actions().approvePracticeProposal(plan,session,id,true);
test('complete approval materialises ordered packages, stores opaque refs, returns source-blind DTO',async()=>{
 const result=await approve(retain());assert.equal(result.assignments.length,2);assert.equal(writes,1);
 assert.deepEqual(result.assignments.map(a=>a.activityType),['arithmetic_input','spot_mistake']);assert.deepEqual(result.assignments.map(a=>a.position),[1,2]);
 assert.doesNotMatch(JSON.stringify(result),/Twinkl|Oak|Math Salamanders|provider|sourceUrl|attribution|provenance|licence|license|sourceItemIds|hashes|integrity|packageId/);
 for(const request of requests)assert.deepEqual(Object.keys(request).sort(),['idempotencyKey','previewToken','proposalActivityId','proposalId']);
});
test('repeat approval and expiry return durable existing set without remote calls',async()=>{
 const id=retain();const first=await approve(id);global.practiceLoopProposals.clear();assert.deepEqual(await approve(id),first);assert.equal(requests.length,2);assert.equal(writes,1);
 const preview=await actions().previewApprovedPractice(plan,first.assignments[0].id);assert.match(preview.url,/package-review#/);assert.equal(requests.at(-1).packageId,assignments[0].packageId);
});
test('second materialisation failure leaves no visible set; retry reuses first package',async()=>{
 const id=retain();failAt=2;assert.ok((await approve(id)).error);assert.equal(writes,0);assert.equal(assignments.length,0);const key=requests[0].idempotencyKey;
 failAt=0;assert.equal((await approve(id)).assignments.length,2);assert.equal(requests[2].idempotencyKey,key);assert.equal(packageMap.size,2);
});
test('transaction failure remains unassigned; retry keeps same packages',async()=>{
 const id=retain();failDb=true;assert.ok((await approve(id)).error);assert.equal(assignments.length,0);const packages=[...packageMap.values()].map(p=>p.packageId);
 failDb=false;assert.equal((await approve(id)).assignments.length,2);assert.deepEqual(assignments.map(p=>p.packageId),packages);
});
test('double click and distinct proposals remain independent',async()=>{
 const id=retain();const results=await Promise.all([approve(id),approve(id)]);assert.equal(assignments.length,2);assert.ok(results.every(r=>r.assignments.length===2));assert.equal(packageMap.size,2);
 proposal={...proposal,id:randomUUID()};assert.equal((await approve(retain())).assignments.length,4);
});
test('ownership, wrong session, absent session, fabricated/expired/partial proposal and missing confirmation reject before RS',async()=>{
 const id=retain();owned=false;assert.ok((await approve(id)).error);owned=true;validSession=false;assert.ok((await approve(id)).error);validSession=true;
 assert.ok((await actions().approvePracticeProposal(plan,'',id,true)).error);assert.ok((await actions().approvePracticeProposal(plan,session,id,false)).error);
 assert.ok((await approve(randomUUID())).error);proposal.status='partial';proposal.activities[1].status='failed';assert.match((await approve(retain())).error,/Rebuild/);
 proposal.status='ready';proposal.activities[1].status='ready';proposal.expiresAt=new Date(0).toISOString();assert.ok((await approve(retain())).error);assert.equal(requests.length,0);
});
test('all eleven types retain exact identity/version/integrity without payload and fabricated extra client refs are ignored',async()=>{
 proposal.activities=require('../lib/resource-studio/proposal-contract.ts').proposalActivityTypes.map((type,i)=>({...proposal.activities[0],id:`all-${i}`,activityType:type}));
 const result=await actions().approvePracticeProposal(plan,session,retain(),true,{packageId:'fabricated'});assert.equal(result.assignments.length,11);assert.equal(packageMap.size,11);
 assert.ok(assignments.every(a=>a.integrity==='b'.repeat(64)&&a.packageId!=='fabricated'));
});
test('strict materialisation metadata refuses injected provenance and wrong activity type',async()=>{
 global.fetch=async()=>Response.json({...ref('arithmetic_input'),provider:'Twinkl'});assert.ok((await approve(retain())).error);assert.equal(writes,0);
 global.fetch=async()=>Response.json(ref('multiple_choice'));assert.ok((await approve(retain())).error);assert.equal(writes,0);
});

test('source-identifying display dose is refused before materialisation or persistence',async()=>{
 for (const text of ['Twinkl','Oak','Math Salamanders','provider','sourceUrl','attribution','provenance','licence','license','sourceItemIds','hashes']) {
   proposal.activities[0].dose=`2 questions ${text}`;assert.ok((await approve(retain())).error);
 }
 assert.equal(requests.length,0);assert.equal(writes,0);
});
