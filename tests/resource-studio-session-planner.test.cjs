const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const mocks = {}, load = Module._load;
Module._load = function(id, ...args) {
  if (Object.hasOwn(mocks,id)) return mocks[id];
  if (id === 'server-only') return {};
  if (id.endsWith('.css')) return { default: {} };
  if (id.startsWith('@/')) return load.call(this,path.resolve(id.slice(2)),...args);
  return load.call(this,id,...args);
};
require.extensions['.tsx'] = require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText,filename);
const React = require('react');
const flatten = value => Array.isArray(value) ? value.flatMap(flatten) : value?.props ? [value,...flatten(value.props.children)] : [];
const plan = '11111111-1111-4111-8111-111111111111';
const item = { id:'mcq-a',contentVersion:7,title:'MCQ A' };
const sessions = [{ id:'session-a',session_number:1,title:'First session' },{ id:'session-b',session_number:2,title:'Second session' }];
const row = (id, version=7) => ({ id,source_activity_id:id,source_version:version,title:id,weekly_session_id:'session-a' });
let calls, saved, failure, originalEnv;
beforeEach(() => {
  originalEnv={...process.env}; process.env.NODE_ENV='development'; calls=[]; saved={'session-a':[],'session-b':[]}; failure=null;
  mocks['@/lib/resource-studio/session-options-action']={ getResourceSessionOptions:async (...args) => { calls.push(['sessions',...args]); return {sessions}; } };
  mocks['@/lib/resource-studio/selection-actions']={
    listResourceSessionSelections:async (...args) => { calls.push(['list',...args]); return {selections:saved[args[1]]}; },
    addResourceSessionSelection:async (...args) => { calls.push(['add',...args]); if(failure) return failure; saved[args[1]]=[...saved[args[1]],row(args[2],args[3])]; return {selections:saved[args[1]]}; },
    removeResourceSessionSelection:async (...args) => { calls.push(['remove',...args]); if(failure) return failure; saved[args[1]]=saved[args[1]].filter(r=>r.id!==args[2]); return {selections:saved[args[1]]}; },
  };
});
afterEach(() => {
  process.env=originalEnv;
  Object.keys(mocks).forEach(k=>delete mocks[k]);
  for(const k of Object.keys(require.cache)) if(!k.includes('node_modules') && /[\\/](lib|components)[\\/]/.test(k)) delete require.cache[k];
});
const settle = () => new Promise(resolve=>setImmediate(resolve));
function harness() {
  let cursor=0, effect, closed=0; const values=[];
  mocks.react={...React,
    useState:initial=>{const i=cursor++; if(!(i in values)) values[i]=typeof initial==='function'?initial():initial; return [values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];},
    useRef:initial=>{const i=cursor++; return values[i]??(values[i]={current:initial});},
    useEffect:fn=>{effect=fn;},
  };
  const {ResourceStudioSessionPlanner}=require('../components/resource-studio-session-planner.tsx');
  const draw=(selected=item)=>{cursor=0; return ResourceStudioSessionPlanner({planId:plan,selected,onClose:()=>closed++});};
  const controls=()=>flatten(draw()).find(n=>n.type?.name==='ResourceStudioSelectedPreview').props.selectionControls(item);
  return {draw,controls,start:()=>effect(),closed:()=>closed};
}
const button=(tree,label)=>flatten(tree).find(n=>n.type==='button'&&n.props.children===label);

test('adds exact previewed ID/version to chosen session without closing search; shows success and duplicate state',async()=>{
  const h=harness(); h.draw(); h.start(); await settle();
  flatten(h.controls()).find(n=>n.type==='select').props.onChange({target:{value:'session-b'}});
  button(h.controls(),'Add to session').props.onClick(); await settle();
  assert.deepEqual(calls.find(c=>c[0]==='add'),['add',plan,'session-b','mcq-a',7,true]);
  assert.ok(button(h.controls(),'Already selected').props.disabled);
  assert.equal(h.closed(),0);
  assert.ok(flatten(h.draw()).some(n=>n.props.role==='status'&&n.props.children.includes('Selected for Session 2')));
  assert.ok(flatten(h.draw(null)).some(n=>n.type==='li'));
});
test('existing multiple references display title/version and can be removed using existing action',async()=>{
  saved['session-a']=[row('mcq-a'),row('mcq-b',3)];
  const h=harness(); h.draw(); h.start(); await settle();
  assert.equal(flatten(h.draw()).filter(n=>n.type==='li').length,2);
  const labels=flatten(h.draw()).filter(n=>n.type==='span').map(n=>n.props.children);
  assert.ok(labels.some(v=>v.includes('mcq-b')&&v.includes(3)));
  button(h.draw(),'Remove').props.onClick(); await settle();
  assert.deepEqual(calls.find(c=>c[0]==='remove'),['remove',plan,'session-a','mcq-a',true]);
  assert.equal(flatten(h.draw()).filter(n=>n.type==='li').length,1);
});
test('different selected version requires removal; unavailable add and failed removal preserve records',async()=>{
  saved['session-a']=[row('mcq-a',6)];
  const h=harness(); h.draw(); h.start(); await settle();
  assert.ok(button(h.controls(),'Add to session').props.disabled);
  failure={error:'Publication unavailable',unavailable:true};
  flatten(h.controls()).find(n=>n.type==='select').props.onChange({target:{value:'session-b'}});
  button(h.controls(),'Add to session').props.onClick(); await settle();
  assert.ok(flatten(h.draw()).some(n=>n.props.role==='alert'&&n.props.children==='Publication unavailable'));
  button(h.draw(),'Remove').props.onClick(); await settle();
  assert.equal(flatten(h.draw()).filter(n=>n.type==='li').length,1);
});
test('transport failure is sanitized and rapid duplicate clicks make one call',async()=>{
  const h=harness(); h.draw(); h.start(); await settle();
  let reject;
  mocks['@/lib/resource-studio/selection-actions'].addResourceSessionSelection=(...args)=>{calls.push(['add',...args]);return new Promise((_,r)=>{reject=r;});};
  const b=button(h.controls(),'Add to session'); b.props.onClick(); b.props.onClick();
  assert.equal(calls.filter(c=>c[0]==='add').length,1);
  reject(Error('private diagnostics')); await settle();
  assert.ok(flatten(h.draw()).some(n=>n.props.role==='alert'&&/try again/.test(n.props.children)));
  assert.equal(flatten(h.draw()).filter(n=>n.type==='li').length,0);
});
test('list failures block adding and offer retry without pretending references are empty',async()=>{
  mocks['@/lib/resource-studio/selection-actions'].listResourceSessionSelections=async()=>({error:'Selections unavailable'});
  const h=harness(); h.draw(); h.start(); await settle();
  assert.ok(button(h.controls(),'Add to session').props.disabled);
  assert.ok(button(h.draw(),'Retry loading selections'));
});

test('session-options read enforces auth, owned plan and fictional development restriction',async()=>{
  delete mocks['@/lib/resource-studio/session-options-action'];
  let denied=false;
  mocks['@/lib/resource-studio/plan-ownership']={assertOwnedResourcePlan:async()=>{if(denied) throw Error('private');}};
  mocks['./plan-ownership']=mocks['@/lib/resource-studio/plan-ownership'];
  const q={select:()=>q,eq:()=>q,order:async()=>({data:sessions})};
  mocks['@/lib/auth']={requireTutor:async()=>({supabase:{from:()=>q},user:{id:'tutor'}})};
  const {getResourceSessionOptions}=require('../lib/resource-studio/session-options-action.ts');
  assert.deepEqual((await getResourceSessionOptions(plan,true)).sessions,sessions);
  assert.match((await getResourceSessionOptions(plan,false)).error,/fictional/);
  denied=true; assert.match((await getResourceSessionOptions(plan,true)).error,/tutor access/); denied=false;
  mocks['@/lib/auth'].requireTutor=async()=>{throw Error('REDIRECT');};
  await assert.rejects(()=>getResourceSessionOptions(plan,true),/REDIRECT/);
  process.env.NODE_ENV='production'; assert.match((await getResourceSessionOptions(plan,true)).error,/development/);
});
