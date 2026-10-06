const {test,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const mocks={},load=Module._load;
Module._load=function(id,...args){
  if(Object.hasOwn(mocks,id))return mocks[id];
  if(id==='server-only')return {};
  if(id.endsWith('.css'))return {default:{}};
  if(id==='next/link')return {default:'a'};
  if(id.startsWith('@/'))return load.call(this,path.resolve(id.slice(2)),...args);
  return load.call(this,id,...args);
};
require.extensions['.tsx']=require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText,filename);
const originalEnv={...process.env};
const planId='11111111-1111-4111-8111-111111111111';
let calls,data,error,offline;
beforeEach(()=>{
  process.env.NODE_ENV='development';calls=[];data=[];error=null;offline=false;
  mocks['@/lib/auth']={requireTutor:async()=>({supabase:{rpc:async(name,args)=>{calls.push({name,args});if(offline)throw Error('private diagnostics');return {data,error};}}})};
});
afterEach(()=>{
  process.env={...originalEnv};Object.keys(mocks).forEach(k=>delete mocks[k]);
  for(const k of Object.keys(require.cache))if(!k.includes('node_modules')&&['lib','app','components'].some(d=>k.includes(path.sep+d+path.sep)))delete require.cache[k];
});
const get=()=>require('../lib/resource-studio/reports.ts').getResourceStudioPlanReport;
const components=()=>require('../components/resource-studio-plan-report.tsx');
const render=props=>require('react-dom/server').renderToStaticMarkup(components().ResourceStudioReportView(props));
const completed=()=>({activityId:'activity-a',sessionNumber:1,position:1,title:'Equivalent fractions',sourceVersion:1,attempt:{score:1,total:2,submittedAt:'2026-09-24T12:00:00Z',questions:[
  {id:'q1',prompt:'First question',supportingText:'Read this',selections:['One half'],correct:true,feedback:'Good work',explanation:'First explanation',misconceptionTags:[]},
  {id:'q2',prompt:'Second question',supportingText:'',selections:['Four sixths'],correct:false,feedback:'Check both numbers',explanation:'Multiply both parts',misconceptionTags:['changing one part only']},
]}});

test('report loader uses the authenticated plan RPC, and reload fetches fresh saved results',async()=>{
  assert.deepEqual(await get()(planId),[]);data=[completed()];assert.deepEqual(await get()(planId),data);
  assert.deepEqual(calls,[{name:'get_resource_studio_plan_report',args:{p_plan_id:planId}},{name:'get_resource_studio_plan_report',args:{p_plan_id:planId}}]);
});
test('unauthenticated report calls redirect before RPC; report component preserves that redirect',async()=>{
  mocks['@/lib/auth'].requireTutor=async()=>{throw Error('REDIRECT:/login');};
  await assert.rejects(()=>get()(planId),/REDIRECT/);
  await assert.rejects(()=>components().ResourceStudioPlanReport({planId}),/REDIRECT/);
  assert.equal(calls.length,0);
});
test('foreign plan and unavailable RPC are errors, never empty successful reports',async()=>{
  error={code:'42501',message:'private diagnostics'};
  await assert.rejects(()=>get()(planId),/tutor access/);
  error={code:'PGRST202'};await assert.rejects(()=>get()(planId),/reporting migration/);
  error={code:'500',message:'private diagnostics'};
  const element=await components().ResourceStudioPlanReport({planId});
  const markup=render(element.props);assert.match(markup,/role="alert"/);assert.doesNotMatch(markup,/private diagnostics|No Resource Studio exercises|0 of 0/);
  offline=true;await assert.rejects(()=>get()(planId),/Refresh/);
});
test('malformed IDs, malformed transport data and production are blocked',async()=>{
  await assert.rejects(()=>get()('bad-id'),/tutor access/);assert.equal(calls.length,0);
  data=null;await assert.rejects(()=>get()(planId),/Could not load/);
  process.env.NODE_ENV='production';await assert.rejects(()=>get()(planId),/only in development/);assert.equal(calls.length,1);
});
test('completed report renders accessible review, score, UTC date, saved answers and feedback',()=>{
  const markup=render({activities:[completed()]});
  for(const pattern of [/Resource Studio progress/,/1 of 1 imported activities completed/,/Completed · 1 of 2 correct/,/24 Sept 2026/,/UTC/,/<details/,/<summary/,/Saved selections:.*One half/,/Correct/,/Incorrect/,/Check both numbers/,/Multiply both parts/])assert.match(markup,pattern);
  assert.doesNotMatch(markup,/correctOptionIds|type="radio"/);
});
test('misconception tags are tentative and only linked to incorrect responses',()=>{
  const row=completed();row.attempt.questions[0].misconceptionTags=['must not display'];
  let markup=render({activities:[row]});assert.match(markup,/Possible areas to revisit/);assert.match(markup,/changing one part only/);assert.match(markup,/not a diagnosis/);assert.doesNotMatch(markup,/must not display/);
  row.attempt.questions[1].misconceptionTags=[];markup=render({activities:[row]});assert.match(markup,/No misconception tags are recorded/);
});
test('no imports and pending imports have distinct empty states with no invented score',()=>{
  assert.match(render({activities:[]}),/No Resource Studio exercises have been assigned/);
  const row=completed();row.attempt=null;
  const markup=render({activities:[row]});assert.match(markup,/No completed attempts yet/);assert.match(markup,/Not completed/);assert.match(markup,/No saved score or answers/);assert.match(markup,/Placeholder and AI-generated activities are not scored/);
  assert.doesNotMatch(markup,/of 2 correct|<details|Submitted/);
});
test('existing plan page includes report in development and refuses a missing/foreign plan',async()=>{
  const plan={id:planId,student:{id:'student',name:'Fictional'},reflection:{date:'2026-09-24',whatWeCovered:'Fractions'},sessions:[],focus:'Fractions'};
  mocks['@/lib/data']={getWeeklyPlan:async()=>plan,listExtractedObjectives:async()=>[]};
  mocks['next/navigation']={notFound:()=>{throw Error('NOT_FOUND');}};
  const page=require('../app/plans/[id]/page.tsx').default;
  const hasReport=element=>Array.isArray(element.props.children)&&element.props.children.some(c=>c?.type?.name==='ResourceStudioPlanReport');
  assert.equal(hasReport(await page({params:Promise.resolve({id:planId})})),true);
  process.env.NODE_ENV='production';assert.equal(hasReport(await page({params:Promise.resolve({id:planId})})),false);
  mocks['@/lib/data'].getWeeklyPlan=async()=>null;
  await assert.rejects(()=>page({params:Promise.resolve({id:planId})}),/NOT_FOUND/);
});
