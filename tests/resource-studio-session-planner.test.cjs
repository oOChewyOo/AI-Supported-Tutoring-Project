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
  let cursor=0, slots, context, closed=0;
  const providerSlots=[], plannerSlots=[], effects=[];
  mocks.react={...React,
    useState:initial=>{const i=cursor++, store=slots; if(!(i in store)) store[i]=typeof initial==='function'?initial():initial; return [store[i],next=>{store[i]=typeof next==='function'?next(store[i]):next;}];},
    useRef:initial=>{const i=cursor++; return slots[i]??(slots[i]={current:initial});},
    useEffect:(fn,deps)=>{const i=cursor++, store=slots, old=store[i]; if(!old||deps.some((v,n)=>v!==old.deps[n])) effects.push(()=>{old?.cleanup?.();store[i]={deps,cleanup:fn()};});},
  };
  const {PlanPageSessions}=require('../components/plan-page-sessions.tsx');
  mocks['./plan-page-sessions']={usePlanSelections:()=>context};
  const {ResourceStudioSessionPlanner,ResourceStudioSessionSelections}=require('../components/resource-studio-session-planner.tsx');
  const run=(store,fn)=>{slots=store;cursor=0;const tree=fn();while(effects.length)effects.shift()();return tree;};
  const refresh=()=>{context=run(providerSlots,()=>PlanPageSessions({planId:plan,sessions,children:null})).props.value;};
  const draw=(selected=item)=>{refresh();return run(plannerSlots,()=>ResourceStudioSessionPlanner({planId:plan,selected,onClose:()=>closed++}));};
  const controls=()=>flatten(draw()).find(n=>n.type?.name==='ResourceStudioSelectedPreview').props.selectionControls(item);
  const session=(id='session-a')=>{refresh();return ResourceStudioSessionSelections({sessionId:id,sessionNumber:id==='session-a'?1:2});};
  refresh();
  return {draw,controls,session,start:()=>{context.confirm(true);refresh();},confirm:value=>{context.confirm(value);refresh();},
    close:()=>providerSlots.forEach(slot=>slot?.cleanup?.()),closed:()=>closed};
}
const button=(tree,label)=>flatten(tree).find(n=>n.type==='button'&&n.props.children===label);

test('no automatic fictional confirmation: reads and session rows wait for the checkbox',async()=>{
  const h=harness();h.draw();await settle();
  assert.equal(calls.length,0);assert.equal(h.session(),null);
  h.start();await settle();
  assert.deepEqual(calls,[['list',plan,'session-a',true],['list',plan,'session-b',true]]);
  h.draw();h.session();assert.equal(calls.length,2);
  h.confirm(false);assert.equal(h.session(),null);
});

test('adds exact previewed ID/version to chosen card without closing search or refetching every session',async()=>{
  const h=harness();h.start();await settle();
  flatten(h.controls()).find(n=>n.type==='select').props.onChange({target:{value:'session-b'}});
  button(h.controls(),'Add to session').props.onClick();await settle();
  assert.deepEqual(calls.find(c=>c[0]==='add'),['add',plan,'session-b','mcq-a',7,true]);
  assert.ok(button(h.controls(),'Already selected').props.disabled);
  assert.equal(h.closed(),0);
  assert.equal(flatten(h.session('session-a')).filter(n=>n.type==='li').length,0);
  assert.equal(flatten(h.session('session-b')).filter(n=>n.type==='li').length,1);
  assert.equal(flatten(h.draw(null)).filter(n=>n.type==='li').length,0);
  assert.ok(flatten(h.draw()).some(n=>n.props.role==='status'&&n.props.children.includes('Selected for Session 2')));
  assert.equal(calls.filter(c=>c[0]==='list').length,2);
});

test('multiple references display title/version; removal immediately updates duplicate controls and survives remount',async()=>{
  saved['session-a']=[row('mcq-a'),row('mcq-b',3)];
  const h=harness();h.start();await settle();
  assert.equal(flatten(h.session()).filter(n=>n.type==='li').length,2);
  assert.ok(flatten(h.session()).some(n=>n.type==='strong'&&n.props.children==='mcq-b'));
  assert.ok(flatten(h.session()).some(n=>n.type==='span'&&Array.isArray(n.props.children)&&n.props.children.includes(3)));
  assert.ok(button(h.controls(),'Already selected'));
  button(h.session(),'Remove').props.onClick();await settle();
  assert.deepEqual(calls.find(c=>c[0]==='remove'),['remove',plan,'session-a','mcq-a',true]);
  assert.equal(flatten(h.session()).filter(n=>n.type==='li').length,1);
  assert.equal(button(h.controls(),'Add to session').props.disabled,false);
  h.close();
  const fresh=harness();fresh.start();await settle();
  assert.equal(flatten(fresh.session()).filter(n=>n.type==='li').length,1);
});

test('version conflict requires card removal; failed mutations preserve existing records',async()=>{
  saved['session-a']=[row('mcq-a',6)];
  const h=harness();h.start();await settle();
  assert.ok(button(h.controls(),'Add to session').props.disabled);
  failure={error:'Publication unavailable',unavailable:true};
  flatten(h.controls()).find(n=>n.type==='select').props.onChange({target:{value:'session-b'}});
  button(h.controls(),'Add to session').props.onClick();await settle();
  assert.ok(flatten(h.draw()).some(n=>n.props.role==='alert'&&n.props.children==='Publication unavailable'));
  button(h.session(),'Remove').props.onClick();await settle();
  assert.equal(flatten(h.session()).filter(n=>n.type==='li').length,1);
  failure=null;button(h.session(),'Remove').props.onClick();await settle();
  flatten(h.controls()).find(n=>n.type==='select').props.onChange({target:{value:'session-a'}});
  assert.equal(button(h.controls(),'Add to session').props.disabled,false);
});

test('transport failure is sanitized and rapid duplicate clicks make one call',async()=>{
  const h=harness();h.start();await settle();let reject;
  mocks['@/lib/resource-studio/selection-actions'].addResourceSessionSelection=(...args)=>{calls.push(['add',...args]);return new Promise((_,r)=>{reject=r;});};
  const b=button(h.controls(),'Add to session');b.props.onClick();b.props.onClick();
  assert.equal(calls.filter(c=>c[0]==='add').length,1);
  assert.ok(button(h.controls(),'Saving…').props.disabled);
  reject(Error('private diagnostics'));await settle();
  assert.ok(flatten(h.draw()).some(n=>n.props.role==='alert'&&/try again/.test(n.props.children)));
  assert.equal(flatten(h.session()).filter(n=>n.type==='li').length,0);
});

test('list failures block adding; card retry actually reloads and recovers',async()=>{
  let fail=true;
  mocks['@/lib/resource-studio/selection-actions'].listResourceSessionSelections=async(...args)=>{calls.push(['list',...args]);return fail?{error:'Selections unavailable'}:{selections:[]};};
  const h=harness();h.start();await settle();
  assert.ok(button(h.controls(),'Add to session').props.disabled);
  assert.ok(flatten(h.session()).some(n=>n.props.role==='alert'));
  fail=false;button(h.session(),'Retry loading selections').props.onClick();h.draw();await settle();
  assert.equal(calls.filter(c=>c[0]==='list').length,4);
  assert.equal(button(h.controls(),'Add to session').props.disabled,false);
});

test('withdrawing fictional confirmation discards late list results',async()=>{
  const resolvers=[];
  mocks['@/lib/resource-studio/selection-actions'].listResourceSessionSelections=()=>new Promise(resolve=>resolvers.push(resolve));
  const h=harness();h.start();h.confirm(false);
  resolvers.forEach(resolve=>resolve({selections:[row('mcq-a')]}));await settle();
  assert.equal(h.session(),null);
  h.confirm(true);
  assert.ok(button(h.controls(),'Add to session').props.disabled);
  assert.equal(flatten(h.session()).filter(n=>n.type==='li').length,0);
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
