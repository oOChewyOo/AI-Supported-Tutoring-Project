const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const ts=require('typescript');
const mocks={};const original=Module._load;
Module._load=function(id,...args){if(Object.hasOwn(mocks,id))return mocks[id];if(id==='server-only')return {};if(id.startsWith('@/'))return original.call(this,path.resolve(id.slice(2)),...args);return original.call(this,id,...args);};
require.extensions['.tsx']=require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
const plan={id:ids[0],title:'Practice week',sessions:[{id:ids[1],number:2,title:'Build confidence',assignments:[{id:ids[2],activityType:'arithmetic_input',dose:'6 questions',position:1},{id:ids[3],activityType:'spot_mistake',dose:'2 examples',position:2}]}]};
const env={...process.env};const fetch=global.fetch;
afterEach(()=>{process.env={...env};global.fetch=fetch;for(const k of Object.keys(mocks))delete mocks[k];for(const k of Object.keys(require.cache))if(!k.includes('node_modules')&&(/[/\\](app|lib)[/\\]/).test(k))delete require.cache[k];});
function setup(denied=false){
 const calls=[];mocks['next/navigation']={notFound(){throw Error('not found');}};
 mocks['@/lib/auth']={requireLearner:async()=>({studentId:'mapped-only',supabase:{rpc:async(name,args)=>{calls.push({name,args});return denied?{data:null,error:{code:'42501'}}:{data:name==='get_learner_practice'?[plan]:{packageId:ids[3],integrity:'a'.repeat(64)},error:null};}}})};
 mocks['@/lib/resource-studio/learner-client']={learnerPackageDelivery:async(...args)=>{calls.push({remote:args});return 'http://127.0.0.1:3101/integrations/practice-loop/learn#synthetic';}};
 return calls;
}
test('delivery resolves only verified assignment, never accepts a browser package/student',async()=>{
 const calls=setup();await require('../lib/learner-practice.ts').learnerDelivery(...ids.slice(0,3),'foreign-student');
 assert.deepEqual(calls,[{name:'get_learner_delivery_reference',args:{p_plan:ids[0],p_session:ids[1],p_assignment:ids[2]}},{remote:[ids[3],'a'.repeat(64)]}]);
});
test('denied assignment produces no upstream request',async()=>{
 const calls=setup(true);await assert.rejects(()=>require('../lib/learner-practice.ts').learnerDelivery(...ids.slice(0,3)),/not found/);assert.equal(calls.length,1);
});
test('foreign and fabricated session/assignment IDs cannot enter navigation',async()=>{
 setup();const lib=require('../lib/learner-practice.ts');await assert.rejects(()=>lib.learnerSession(ids[3],ids[1]),/not found/);
 await assert.rejects(()=>lib.learnerSession(ids[0],ids[3]),/not found/);await assert.rejects(()=>lib.learnerDelivery(ids[0],ids[1],'fake'),/not found/);
});
const render=e=>require('react-dom/server').renderToStaticMarkup(e);
test('session lists educational metadata in approved order',async()=>{
 setup();const page=require('../app/learn/[planId]/[sessionId]/page.tsx').default;
 const html=render(await page({params:Promise.resolve({planId:ids[0],sessionId:ids[1]})}));
 assert.ok(html.indexOf('arithmetic input')<html.indexOf('spot mistake'));assert.doesNotMatch(html,/packageId|integrity|provenance|Oak|Twinkl|sourceUrl|licen[cs]e/);
});
test('activity next/back links stay within session; end state performs reads only',async()=>{
 const calls=setup();const page=require('../app/learn/[planId]/[sessionId]/[assignmentId]/page.tsx').default;
 let html=render(await page({params:Promise.resolve({planId:ids[0],sessionId:ids[1],assignmentId:ids[2]})}));
 assert.match(html,/Next activity/);assert.ok(html.includes('/'+ids[3]));assert.doesNotMatch(html,/Previous activity/);
 html=render(await page({params:Promise.resolve({planId:ids[0],sessionId:ids[1],assignmentId:ids[3]})}));assert.match(html,/Previous activity|End of assigned practice/);
 const end=require('../app/learn/[planId]/[sessionId]/end/page.tsx').default;
 html=render(await end({params:Promise.resolve({planId:ids[0],sessionId:ids[1]})}));assert.match(html,/reached the end/);assert.doesNotMatch(html,/completed/i);
 assert.ok(calls.every(c=>c.remote||['get_learner_practice','get_learner_delivery_reference'].includes(c.name)));
});
test('delivery client sends only package/integrity using server bearer and validates capability purpose',async()=>{
 process.env.NODE_ENV='development';process.env.PRACTICE_LOOP_INTEGRATION_KEY='synthetic-secret';process.env.RESOURCE_STUDIO_BASE_URL='http://127.0.0.1:3101';
 let returned='ld1_'+'a'.repeat(43);global.fetch=async(url,init)=>{assert.equal(new URL(url).pathname,'/api/integrations/practice-loop/learner-delivery');assert.deepEqual(JSON.parse(init.body),{packageId:ids[3],integrity:'a'.repeat(64)});assert.equal(init.headers.Authorization,'Bearer synthetic-secret');assert.equal(init.redirect,'error');return {ok:true,json:async()=>({token:returned})};};
 const {learnerPackageDelivery}=require('../lib/resource-studio/learner-client.ts');assert.equal(new URL(await learnerPackageDelivery(ids[3],'a'.repeat(64))).hash,'#'+returned);
 returned='tutor-preview';await assert.rejects(()=>learnerPackageDelivery(ids[3],'a'.repeat(64)),/unavailable/);
});
