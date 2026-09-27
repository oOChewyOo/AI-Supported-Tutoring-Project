const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const mocks = {}, load = Module._load;
Module._load = function(id, ...args) {
  if (Object.hasOwn(mocks, id)) return mocks[id];
  if (id === 'server-only') return {};
  if (id.startsWith('@/')) return load.call(this, path.resolve(id.slice(2)), ...args);
  return load.call(this, id, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const originalEnv = { ...process.env }, originalFetch = global.fetch;
const fixture = require('./fixtures/resource-studio-activity.json');
const plan = '11111111-1111-4111-8111-111111111111', session = '22222222-2222-4222-8222-222222222222';
const selection = '33333333-3333-4333-8333-333333333333';
let rows, calls, requests, payload, status, dbCode, saved, reads;
beforeEach(() => {
  process.env.NODE_ENV = 'development';
  process.env.RESOURCE_STUDIO_BASE_URL = 'http://localhost:3001';
  process.env.PRACTICE_LOOP_INTEGRATION_KEY = 'synthetic-secret';
  payload = { ...structuredClone(fixture), id: 'selected-mcq', contentVersion: 7 };
  status = 200; dbCode = null; saved = []; calls = []; requests = []; reads = [];
  rows = {
    weekly_plans: { id: plan, student_id: 'student', lesson_reflection_id: 'reflection' },
    students: { id: 'student', owner_tutor_id: 'tutor', name: 'PRIVATE PUPIL' },
    lesson_reflections: { id: 'reflection', student_id: 'student', what_we_covered: 'PRIVATE REFLECTION' },
    weekly_sessions: { id: session, weekly_plan_id: plan },
  };
  const supabase = {
    from(table) {
      const filters = [];
      const query = { select(columns) { reads.push({ table, columns }); return query; }, eq(k, v) { filters.push([k, v]); return query; },
        async maybeSingle() { return { data: rows[table] && filters.every(([k,v]) => rows[table][k] === v) ? rows[table] : null, error: null }; } };
      return query;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      if (dbCode) return { error: { code: dbCode, message: 'PRIVATE DATABASE DETAIL' } };
      if (name === 'add_resource_session_selection') {
        if (saved.length && saved[0].source_version !== args.p_version) return { error: { code: '23505' } };
        if (!saved.length) saved.push({ id: selection, weekly_session_id: session, source_activity_id: args.p_source_id,
          source_version: args.p_version, title: args.p_title, activity_type: 'multiple_choice', selected_by: 'tutor', selected_at: '2026-09-27T00:00:00Z' });
      } else if (name === 'remove_resource_session_selection') saved = saved.filter(r => r.id !== args.p_selection_id);
      else assert.equal(name, 'list_resource_session_selections');
      return { data: structuredClone(saved), error: null };
    },
  };
  mocks['@/lib/auth'] = { requireTutor: async () => ({ supabase, user: { id: 'tutor' } }) };
  global.fetch = async (url, options) => { requests.push({ url: String(url), options }); return Response.json(payload, { status }); };
});
afterEach(() => {
  process.env = { ...originalEnv }; global.fetch = originalFetch;
  Object.keys(mocks).forEach(k => delete mocks[k]);
  for (const k of Object.keys(require.cache)) if (k.includes(path.sep + 'lib' + path.sep) && !k.includes('node_modules')) delete require.cache[k];
});
const actions = () => require('../lib/resource-studio/selection-actions.ts');
const add = () => actions().addResourceSessionSelection(plan, session, 'selected-mcq', 7, true);
const list = () => actions().listResourceSessionSelections(plan, session, true);
const remove = () => actions().removeResourceSessionSelection(plan, session, selection, true);

test('add freshly retrieves the exact version and persists only server-derived metadata', async () => {
  const result = await add();
  assert.equal(result.selections[0].title, payload.activityData.title);
  assert.equal(requests[0].url, 'http://localhost:3001/api/integrations/practice-loop/activities/selected-mcq?version=7');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer synthetic-secret');
  assert.equal(requests[0].options.body, undefined);
  assert.deepEqual(Object.keys(calls[1].args).sort(), ['p_fictional','p_plan_id','p_session_id','p_source_id','p_title','p_version']);
  assert.doesNotMatch(JSON.stringify(calls) + JSON.stringify(result), /questions|correctOptionIds|PRIVATE|synthetic-secret/);
  assert.doesNotMatch(requests[0].url, /student|reflection|11111111|22222222/);
  assert.ok(reads.every(r => !/name|what_we/.test(r.columns)));
});
test('repeat add revalidates upstream while preserving the saved reference; different version conflicts', async () => {
  const initial = await add(); assert.deepEqual(await add(), initial); assert.equal(requests.length, 2);
  payload.contentVersion = 8;
  const result = await actions().addResourceSessionSelection(plan, session, 'selected-mcq', 8, true);
  assert.match(result.error, /Remove/); assert.deepEqual((await list()).selections, initial.selections);
});
test('unavailable selections remain listable and removable without upstream requests', async () => {
  await add(); status = 410;
  assert.equal((await add()).unavailable, true);
  assert.equal((await list()).selections.length, 1);
  assert.deepEqual((await remove()).selections, []); assert.deepEqual((await remove()).selections, []);
  assert.equal(requests.length, 2);
});
for (const identity of ['unauthenticated', 'anonymous', 'inactive']) test(`${identity} rejection propagates before all operations`, async () => {
  mocks['@/lib/auth'].requireTutor = async () => { throw Error('REDIRECT'); };
  for (const operation of [add,list,remove]) await assert.rejects(operation, /REDIRECT/);
  assert.equal(calls.length + requests.length, 0);
});
for (const table of ['weekly_plans','students','lesson_reflections','weekly_sessions']) test(`missing or foreign ${table} fails before RPC or fetch`, async () => {
  rows[table] = null;
  for (const operation of [add,list,remove]) assert.ok((await operation()).error);
  assert.equal(calls.length + requests.length, 0);
});
test('wrong session-plan link and invalid IDs fail closed', async () => {
  rows.weekly_sessions.weekly_plan_id = 'other'; assert.ok((await add()).error);
  rows.weekly_sessions.weekly_plan_id = plan;
  assert.ok((await actions().addResourceSessionSelection(plan, 'bad', 'selected-mcq', 7, true)).error);
  assert.ok((await actions().removeResourceSessionSelection(plan, session, 'bad', true)).error);
  for (const [id, version] of [['../a',7],['selected-mcq',0],['selected-mcq','7'],['selected-mcq',2147483648]]) {
    assert.ok((await actions().addResourceSessionSelection(plan, session, id, version, true)).error);
  }
  assert.equal(calls.length + requests.length, 0);
});
test('fictional confirmation and development gate cover every operation', async () => {
  const invoke = f => [
    () => actions().addResourceSessionSelection(plan, session, 'selected-mcq', 7, f),
    () => actions().listResourceSessionSelections(plan, session, f),
    () => actions().removeResourceSessionSelection(plan, session, selection, f),
  ];
  for (const f of [false,undefined,'true']) for (const op of invoke(f)) assert.match((await op()).error, /fictional/);
  process.env.NODE_ENV = 'production';
  for (const op of invoke(true)) assert.match((await op()).error, /development/);
  assert.equal(calls.length + requests.length, 0);
});
test('mismatched identity/version, invalid MCQs and withdrawn publications cannot write', async () => {
  for (const mutate of [p => p.id = 'other', p => p.contentVersion = 8, p => p.activityData.activityType = 'other']) {
    const original = structuredClone(payload); mutate(payload); assert.ok((await add()).error); payload = original;
  }
  for (const code of [404,410,422]) { status = code; assert.equal((await add()).unavailable, true); }
  assert.ok(calls.every(c => c.name === 'list_resource_session_selections')); assert.equal(saved.length, 0);
});
test('database and integration failures are sanitized; disabled database blocks upstream access', async () => {
  for (const code of ['55000','42501','XX000','PGRST202']) {
    dbCode = code;
    for (const op of [add,list,remove]) { const result = await op(); assert.ok(result.error); assert.doesNotMatch(result.error, /PRIVATE/); }
  }
  assert.equal(requests.length, 0); dbCode = null;
  global.fetch = async () => { throw Error('PRIVATE SECRET'); };
  assert.doesNotMatch((await add()).error, /PRIVATE SECRET/);
  assert.equal(saved.length, 0);
});
test('a database failure after successful retrieval cannot report a saved selection', async () => {
  global.fetch = async () => { dbCode = 'XX000'; return Response.json(payload); };
  const result = await add(); assert.ok(result.error); assert.equal(result.selections, undefined); assert.equal(saved.length, 0);
});
