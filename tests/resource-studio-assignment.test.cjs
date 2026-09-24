const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const mocks = {};
const originalLoad = Module._load;
Module._load = function(id, ...args) {
  if (Object.hasOwn(mocks,id)) return mocks[id];
  if (id === 'server-only' || id.endsWith('.css')) return {};
  if (id.startsWith('@/')) return originalLoad.call(this,path.resolve(id.slice(2)),...args);
  return originalLoad.call(this,id,...args);
};
require.extensions['.tsx'] = require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText,filename);
const originalEnv={...process.env}, originalFetch=global.fetch;
const fixture=require('./fixtures/resource-studio-activity.json');
const activityId='11111111-1111-4111-8111-111111111111';
let rows, calls, fetches, response, rpcError, rpcData, rpcAttempt, rpcThrows, invalidations;
beforeEach(() => {
  process.env.NODE_ENV='development';
  process.env.RESOURCE_STUDIO_BASE_URL='http://localhost:3001';
  process.env.PRACTICE_LOOP_INTEGRATION_KEY='synthetic-test-key';
  rows={
    activities:{ id:activityId, title:'Placeholder',weekly_session_id:'session',content_json:null,template_id:null,resource_studio_assigned:false },
    weekly_sessions:{ id:'session',weekly_plan_id:'plan',session_number:1 },
    weekly_plans:{ id:'plan',student_id:'student',lesson_reflection_id:'reflection',title:'Plan' },
    students:{ id:'student',owner_tutor_id:'tutor-a',name:'Fictional' },
    lesson_reflections:{ id:'reflection',student_id:'student' },
  };
  calls=[];fetches=0;response=structuredClone(fixture);rpcError=null;rpcData=null;rpcAttempt=null;rpcThrows=false;invalidations=[];
  global.fetch=async()=>{fetches++;return Response.json(response);};
  const supabase={
    from(table) {
      const filters=[];
      const query={ select:()=>query,eq:(key,value)=>{filters.push([key,value]);return query;},
        maybeSingle:async()=>({data:rows[table] && filters.every(([k,v])=>rows[table][k]===v)?rows[table]:null,error:null}) };
      return query;
    },
    rpc:async(name,args)=>{calls.push({name,args});if(rpcThrows)throw Error('private network diagnostics');return {data:name==='get_resource_studio_attempt'?rpcAttempt:rpcData,error:rpcError};},
  };
  mocks['@/lib/auth']={requireTutor:async()=>({supabase,user:{id:'tutor-a'}})};
  mocks['next/navigation']={redirect:url=>{throw Error('REDIRECT:'+url);},notFound:()=>{throw Error('NOT_FOUND');}};
  mocks['next/cache']={revalidatePath:path=>invalidations.push(path)};
});
afterEach(()=>{
  process.env={...originalEnv};global.fetch=originalFetch;
  for(const key of Object.keys(mocks))delete mocks[key];
  for(const key of Object.keys(require.cache))if(!key.includes('node_modules') && ['lib','app','components'].some(dir=>key.includes(path.sep+dir+path.sep)))delete require.cache[key];
});
function form(){const f=new FormData();f.set('fictional','confirmed');return f;}
const actions=()=>require('../lib/resource-studio/assignment-actions.ts');

test('successful assignment fetches the published definition only after ownership checks and saves version exactly', async()=>{
  response.contentVersion=7;
  await assert.rejects(()=>actions().assignResourceStudioAction(activityId,{},form()),/REDIRECT:\/activities\//);
  assert.equal(fetches,1);assert.equal(calls.length,1);
  assert.equal(calls[0].name,'assign_resource_studio_activity');
  assert.equal(calls[0].args.p_activity_id,activityId);
  assert.equal(calls[0].args.p_snapshot.contentVersion,7);
  assert.equal(calls[0].args.p_snapshot.id,fixture.id);
  assert.deepEqual(calls[0].args.p_snapshot.questions[2].correctOptionIds,['q3-a','q3-b']);
  assert.deepEqual(invalidations,['/plans/plan','/activities/'+activityId]);
  assert.ok(!JSON.stringify(calls).includes('synthetic-test-key'));
});
for(const table of ['activities','weekly_sessions','weekly_plans','students','lesson_reflections']) {
  test(`inaccessible ${table} prevents upstream fetch and writes`,async()=>{
    rows[table]=null;
    assert.match((await actions().assignResourceStudioAction(activityId,{},form())).error,/could not be found/);
    assert.equal(fetches,0);assert.equal(calls.length,0);
  });
}
test('Tutor B cannot assign a slot owned by Tutor A',async()=>{
  const old=mocks['@/lib/auth'].requireTutor;
  mocks['@/lib/auth'].requireTutor=async()=>({...await old(),user:{id:'tutor-b'}});
  assert.match((await actions().assignResourceStudioAction(activityId,{},form())).error,/tutor access/);
  assert.equal(fetches,0);assert.equal(calls.length,0);
});
test('duplicate assignment is rejected before fetching; a racing duplicate also fails safely',async()=>{
  rows.activities.resource_studio_assigned=true;
  assert.match((await actions().assignResourceStudioAction(activityId,{},form())).error,/already/);
  assert.equal(fetches,0);
  rows.activities.resource_studio_assigned=false;rpcError={code:'23505',message:'private diagnostics'};
  assert.match((await actions().assignResourceStudioAction(activityId,{},form())).error,/already/);
  assert.equal(invalidations.length,0);
});
test('existing generated content, including malformed AI JSON, cannot be replaced',async()=>{
  rows.activities.content_json={not:'valid AI content'};
  assert.match((await actions().assignResourceStudioAction(activityId,{},form())).error,/unused placeholder/);
  assert.equal(fetches,0);
});
test('invalid Resource Studio content and authentication failure never write a snapshot',async()=>{
  response.activityData.content.questions[0].correctOptionIds=['unknown'];
  assert.match((await actions().assignResourceStudioAction(activityId,{},form())).error,/invalid content/);
  global.fetch=async()=>new Response('private diagnostics',{status:401});
  const state=await actions().assignResourceStudioAction(activityId,{},form());
  assert.match(state.error,/authentication failed/);assert.doesNotMatch(state.error,/private diagnostics/);
  assert.equal(calls.length,0);
});
test('fictional confirmation is required and invalid IDs cannot fetch or write',async()=>{
  assert.match((await actions().assignResourceStudioAction(activityId,{},new FormData())).error,/fictional/);
  assert.match((await actions().assignResourceStudioAction('not-a-uuid',{},form())).error,/could not be found/);
  assert.equal(fetches,0);assert.equal(calls.length,0);
});
test('direct unauthenticated assignment and scoring stop before any access',async()=>{
  mocks['@/lib/auth'].requireTutor=async()=>{throw Error('REDIRECT:/login');};
  await assert.rejects(()=>actions().assignResourceStudioAction(activityId,{},form()),/REDIRECT:\/login/);
  await assert.rejects(()=>actions().checkResourceStudioAction(activityId,{},form()),/REDIRECT:\/login/);
  assert.equal(fetches,0);assert.equal(calls.length,0);
});
test('production rejects assignment, scoring and the assignment page before auth or IO',async()=>{
  process.env.NODE_ENV='production';
  mocks['@/lib/auth'].requireTutor=async()=>assert.fail('Production must stop before auth');
  await assert.rejects(()=>actions().assignResourceStudioAction(activityId,{},form()),/only in development/);
  await assert.rejects(()=>actions().checkResourceStudioAction(activityId,{},form()),/only in development/);
  await assert.rejects(()=>require('../app/dev/resource-studio/assign/[id]/page.tsx').default({params:Promise.resolve({id:activityId})}),/NOT_FOUND/);
  assert.equal(fetches,0);assert.equal(calls.length,0);
});
test('scoring accepts selections only, not a client score, answer key or resource version',async()=>{
  const f=new FormData();f.set('score','999');f.set('correctOptionIds','fake');f.set('contentVersion','999');f.append('answer:q3','q3-a');f.append('answer:q3','q3-b');
  rpcData={score:1,total:5,feedback:[]};
  assert.deepEqual(await actions().checkResourceStudioAction(activityId,{},f),rpcData);
  assert.equal(calls[0].name,'check_resource_studio_answers');
  assert.equal(JSON.stringify(calls[0].args),JSON.stringify({p_activity_id:activityId,p_answers:{q3:['q3-a','q3-b']}}));
  assert.equal(fetches,0);assert.equal(invalidations.length,0);
});
test('activity page passes only the database display model to the exercise and hides completion controls',async()=>{
  mocks['@/lib/data']={getActivity:async()=>({activity:{resourceStudioAssigned:true},planId:'plan'})};
  rpcData={id:fixture.id,contentVersion:1,title:'Saved exercise',instructions:'Choose',questions:[]};
  const page=await require('../app/activities/[id]/page.tsx').default({params:Promise.resolve({id:activityId})});
  const exercise=page.props.children[1];
  assert.equal(exercise.type.name,'ResourceStudioExercise');
  assert.deepEqual(exercise.props.exercise,rpcData);
  assert.doesNotMatch(JSON.stringify(exercise.props),/correctOptionIds|correctFeedback/);
  assert.equal(fetches,0);
});
test('imported activity page is unavailable in production',async()=>{
  process.env.NODE_ENV='production';
  mocks['@/lib/data']={getActivity:async()=>({activity:{resourceStudioAssigned:true},planId:'plan'})};
  await assert.rejects(()=>require('../app/activities/[id]/page.tsx').default({params:Promise.resolve({id:activityId})}),/NOT_FOUND/);
  assert.equal(calls.length,0);
});

const submitActions=()=>require('../lib/resource-studio/attempt-actions.ts');
const savedAttempt=()=>({score:1,total:2,selections:{q1:['a'],q2:['b']},feedback:[{id:'q1',correct:true,message:'Well done',explanation:'Explanation'},{id:'q2',correct:false,message:'Keep practising',explanation:'Explanation'}],submittedAt:'2026-09-24T12:00:00.000Z',sourceActivityId:fixture.id,sourceVersion:1});
test('final submission sends selections only and invalidates activity and existing progress pages',async()=>{
  const f=new FormData();f.set('score','999');f.set('student_id','foreign');f.set('snapshot','forged');f.append('answer:q1','a');
  rpcData=savedAttempt();
  assert.deepEqual(await submitActions().submitResourceStudioAttempt(activityId,{attempt:{score:999}},f),{attempt:rpcData});
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{name:'submit_resource_studio_attempt',args:{p_activity_id:activityId,p_answers:{q1:['a']}}});
  assert.deepEqual(invalidations,['/activities/'+activityId,'/plans/plan','/students/student']);
  assert.equal(fetches,0);
});
test('final submission and reload reject unauthenticated requests before IO',async()=>{
  mocks['@/lib/auth'].requireTutor=async()=>{throw Error('REDIRECT:/login');};
  await assert.rejects(()=>submitActions().submitResourceStudioAttempt(activityId,{},form()),/REDIRECT:\/login/);
  await assert.rejects(()=>require('../lib/resource-studio/attempts.ts').getResourceAttempt(activityId),/REDIRECT:\/login/);
  assert.equal(calls.length,0);
});
test('foreign hierarchy prevents final-submission RPC',async()=>{
  rows.students.owner_tutor_id='tutor-b';
  assert.ok((await submitActions().submitResourceStudioAttempt(activityId,{},form())).error);
  assert.equal(calls.length,0);assert.equal(invalidations.length,0);
});
test('persistence errors and uncertain transport failures never claim completion',async()=>{
  for(const code of ['42501','22023','23514','PGRST202']) {
    rpcError={code,message:'private diagnostics'};
    const state=await submitActions().submitResourceStudioAttempt(activityId,{},form());
    assert.ok(state.error);assert.equal(state.attempt,undefined);assert.doesNotMatch(state.error,/private diagnostics/);
  }
  rpcThrows=true;
  assert.match((await submitActions().submitResourceStudioAttempt(activityId,{},form())).error,/Reload.*submit again safely/);
  assert.equal(invalidations.length,0);
});
test('reload passes stored responses to the activity page and does not fetch Resource Studio',async()=>{
  mocks['@/lib/data']={getActivity:async()=>({activity:{resourceStudioAssigned:true},planId:'plan'})};
  rpcData={id:fixture.id,contentVersion:1,title:'Saved exercise',instructions:'Choose',questions:[]};
  rpcAttempt=savedAttempt();
  const page=await require('../app/activities/[id]/page.tsx').default({params:Promise.resolve({id:activityId})});
  assert.deepEqual(page.props.children[1].props.savedAttempt,rpcAttempt);
  assert.deepEqual(calls.map(c=>c.name),['get_resource_studio_attempt','get_resource_studio_exercise']);
  assert.equal(fetches,0);
});
test('failed saved-result read shows unavailable rather than a new attempt form',async()=>{
  mocks['@/lib/data']={getActivity:async()=>({activity:{resourceStudioAssigned:true},planId:'plan'})};
  rpcError={code:'PGRST202'};
  const page=await require('../app/activities/[id]/page.tsx').default({params:Promise.resolve({id:activityId})});
  assert.equal(page.props.children[1].props.children[0].props.children,'Imported exercise unavailable');
  assert.deepEqual(calls.map(c=>c.name),['get_resource_studio_attempt']);
});
test('attempt submission and saved-result reads are development-only',async()=>{
  process.env.NODE_ENV='production';
  await assert.rejects(()=>submitActions().submitResourceStudioAttempt(activityId,{},form()),/only in development/);
  await assert.rejects(()=>require('../lib/resource-studio/attempts.ts').getResourceAttempt(activityId),/only in development/);
  assert.equal(calls.length,0);
});
test('exercise renders final saved selections, score and feedback without a resubmit control',()=>{
  const React=require('react');
  mocks['./resource-studio-preview.module.css']={default:{}};
  mocks.react={...React,useActionState:()=>[{},()=>{},false],useState:()=>[{},()=>{}]};
  const {renderToStaticMarkup}=require('react-dom/server');
  const {ResourceStudioExercise}=require('../components/resource-studio-exercise.tsx');
  const exercise={id:fixture.id,contentVersion:1,title:'Fractions',instructions:'Choose',questions:[{id:'q1',prompt:'Question one',supportingText:'',hint:'Hint',multiple:false,options:[{id:'a',text:'One half'},{id:'b',text:'One third'}]}]};
  const markup=renderToStaticMarkup(ResourceStudioExercise({activityId,exercise,savedAttempt:savedAttempt()}));
  assert.match(markup,/1 of 2 correct/);assert.match(markup,/Saved response:.*One half/);assert.match(markup,/Well done/);assert.match(markup,/2026-09-24/);
  assert.doesNotMatch(markup,/Submit completed attempt|type="radio"|correctOptionIds/);
  const unfinished=renderToStaticMarkup(ResourceStudioExercise({activityId,exercise,savedAttempt:null}));
  assert.match(unfinished,/Submit completed attempt/);assert.match(unfinished,/type="radio"/);assert.doesNotMatch(unfinished,/Completed and saved/);
});
