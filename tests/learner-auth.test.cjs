const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const original = Module._load;
let client;
Module._load = function(id,...args) {
  if(id==='server-only') return {};
  if(id==='next/navigation') return {redirect(url){throw Error('REDIRECT:'+url);}};
  if(id==='@/lib/supabase/server') return {isSupabaseConfigured:()=>true,createSupabaseServerClient:async()=>client};
  return original.call(this,id,...args);
};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {requireLearner,requireTutor,accessDestination}=require('../lib/auth.ts');
function identity({user={id:'learner-a'},mapping={auth_user_id:'learner-a',student_id:'student-a',active:true},tutor=null}={}){
  client={auth:{getUser:async()=>({data:{user},error:null})},from(table){
    const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='tutors'?tutor:mapping,error:null})};return q;
  }};
  return {supabase:client,user};
}
test('active learner resolves server-side mapping, regardless of caller-supplied identity',async()=>{
  const session=identity(); assert.equal(await accessDestination(session),'/learn');
  const learner=await requireLearner('student-b');
  assert.equal(learner.studentId,'student-a');assert.equal(learner.authUserId,'learner-a');
  await assert.rejects(requireTutor,/REDIRECT:\/login\?error=access/);
});
for(const state of [{user:null},{user:{id:'learner-a',is_anonymous:true}},{mapping:null},{mapping:{auth_user_id:'learner-a',student_id:'student-a',active:false}},{mapping:{auth_user_id:'learner-b',student_id:'student-b',active:true}}]){
  test('missing, inactive, anonymous or mismatched learner fails closed '+JSON.stringify(state),async()=>{
    identity(state);await assert.rejects(requireLearner,/REDIRECT:\/login/);
  });
}
test('tutor behavior unchanged and tutor membership is not learner membership',async()=>{
  const session=identity({user:{id:'tutor-a'},tutor:{id:'tutor-a'},mapping:null});
  assert.equal(await accessDestination(session),'/dashboard');
  assert.equal((await requireTutor()).user.id,'tutor-a');
  await assert.rejects(requireLearner,/REDIRECT:\/login\?error=access/);
});
test('unmapped authenticated identity gets no destination',async()=>{
  assert.equal(await accessDestination(identity({mapping:null})),null);
});
afterEach(()=>{client=null;});
