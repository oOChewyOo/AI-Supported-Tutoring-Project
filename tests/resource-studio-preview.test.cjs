const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const mocks = {}, load = Module._load;
Module._load = function(id, ...args) {
  if (Object.hasOwn(mocks, id)) return mocks[id];
  if (id === 'server-only') return {};
  if (id.endsWith('.css')) return { default: {} };
  if (id.startsWith('@/')) return load.call(this, path.resolve(id.slice(2)), ...args);
  return load.call(this, id, ...args);
};
require.extensions['.tsx'] = require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
const originalEnv = { ...process.env }, originalFetch = global.fetch;
const fixture = require('./fixtures/resource-studio-activity.json');
const planId = '11111111-1111-4111-8111-111111111111', activityId = 'another-published-mcq';
let rows, reads, calls, payload, status, dbError;
beforeEach(() => {
  process.env.NODE_ENV = 'development';
  process.env.RESOURCE_STUDIO_BASE_URL = 'http://localhost:3001';
  process.env.PRACTICE_LOOP_INTEGRATION_KEY = 'synthetic-preview-secret';
  payload = { ...structuredClone(fixture), id: activityId, contentVersion: 7 };
  status = 200; dbError = null; reads = []; calls = [];
  rows = { weekly_plans: { id: planId, student_id: 'student-a', lesson_reflection_id: 'reflection-a' },
    students: { id: 'student-a', owner_tutor_id: 'tutor-a', name: 'Synthetic confidential name' },
    lesson_reflections: { id: 'reflection-a', student_id: 'student-a', what_we_covered: 'Synthetic confidential reflection' } };
  const supabase = { from(table) {
    const filters = []; let columns;
    const query = { select(value) { columns = value; return query; }, eq(key, value) { filters.push([key, value]); return query; },
      async maybeSingle() { reads.push({ table, columns }); return { data: rows[table] && filters.every(([k, v]) => rows[table][k] === v) ? rows[table] : null, error: dbError }; } };
    return query;
  } };
  mocks['@/lib/auth'] = { requireTutor: async () => ({ supabase, user: { id: 'tutor-a' } }) };
  global.fetch = async (url, options) => { calls.push({ url: String(url), options }); return Response.json(payload, { status }); };
});
afterEach(() => {
  process.env = { ...originalEnv }; global.fetch = originalFetch;
  Object.keys(mocks).forEach(key => delete mocks[key]);
  for (const key of Object.keys(require.cache)) if (!key.includes('node_modules') && ['lib', 'app', 'components'].some(dir => key.includes(path.sep + dir + path.sep))) delete require.cache[key];
});
const preview = (...args) => require('../lib/resource-studio/preview-actions.ts').previewResourceStudioAction(...args);
const request = () => preview(planId, activityId, 7, true);
const parse = value => require('../lib/resource-studio/activity.ts').parseResourceActivity(value, activityId);
const render = element => require('react-dom/server').renderToStaticMarkup(element);
const flatten = element => Array.isArray(element) ? element.flatMap(flatten) : element?.props ? [element, ...flatten(element.props.children)] : [];

test('owned tutor retrieves exact selected publication once with server-only credentials and no pupil data', async () => {
  const state = await request();
  assert.equal(state.activity.id, activityId); assert.equal(state.activity.contentVersion, 7);
  assert.equal(state.activity.questions.length, 5); assert.ok(state.activity.questions[0].correctOptionIds.length);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `http://localhost:3001/api/integrations/practice-loop/activities/${activityId}?version=7`);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer synthetic-preview-secret');
  assert.equal(calls[0].options.cache, 'no-store'); assert.equal(calls[0].options.redirect, 'error');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(calls[0].options.body, undefined);
  assert.deepEqual(reads.map(r => r.columns), ['id,student_id,lesson_reflection_id', 'id,owner_tutor_id', 'id,student_id']);
  assert.doesNotMatch(calls[0].url + JSON.stringify(state), /synthetic-preview-secret|confidential|student-a|reflection-a|11111111/);
});
for (const identity of ['signed out', 'unapproved', 'anonymous', 'expired']) test(`${identity} tutor cannot retrieve protected preview content`, async () => {
  mocks['@/lib/auth'].requireTutor = async () => { throw Error('REDIRECT:/login'); };
  await assert.rejects(request, /REDIRECT/);
  assert.equal(reads.length, 0); assert.equal(calls.length, 0);
});
for (const table of ['weekly_plans', 'students', 'lesson_reflections']) test(`inaccessible ${table} prevents upstream preview`, async () => {
  rows[table] = null;
  const state = await request(); assert.match(state.error, /tutor access/); assert.equal(state.activity, undefined); assert.equal(calls.length, 0);
});
test('foreign ownership, inconsistent reflection, database errors and invalid plan IDs fail closed', async () => {
  rows.students.owner_tutor_id = 'tutor-b'; assert.match((await request()).error, /tutor access/);
  rows.students.owner_tutor_id = 'tutor-a'; rows.lesson_reflections.student_id = 'other'; assert.match((await request()).error, /tutor access/);
  dbError = { message: 'private diagnostics' }; assert.match((await request()).error, /tutor access/);
  assert.match((await preview('invalid-plan', activityId, 7, true)).error, /tutor access/);
  assert.equal(calls.length, 0);
});
test('ownership is checked afresh even after a previous successful preview', async () => {
  assert.ok((await request()).activity); rows.students.owner_tutor_id = 'tutor-b';
  assert.match((await request()).error, /tutor access/); assert.equal(calls.length, 1);
});
test('fictional confirmation is strict and development boundary blocks direct calls', async () => {
  for (const value of [false, undefined, 'true', 1, {}]) assert.match((await preview(planId, activityId, 7, value)).error, /fictional/);
  for (const env of ['production', 'test']) {
    process.env.NODE_ENV = env;
    assert.match((await request()).error, /only in development/);
    await assert.rejects(() => require('../lib/resource-studio/server.ts').fetchResourceActivityVersion(activityId, 7), /only in development/);
  }
  assert.equal(calls.length, 0);
});
test('IDs and versions reject traversal, query injection, coercion, non-integers and out-of-range values', async () => {
  for (const id of ['', '../secret', 'a/b', '%2f', 'id?version=1', 'id#fragment', 'with space', 'a'.repeat(161), null, 42, {}]) {
    assert.ok((await preview(planId, id, 7, true)).error);
  }
  for (const version of [0, -1, 1.5, 2147483648, NaN, Infinity, '7', '07', '1e2', null, {}]) {
    assert.ok((await preview(planId, activityId, version, true)).error);
  }
  assert.equal(calls.length, 0);
});
test('identity and version mismatches never return an activity or retry without a version', async () => {
  for (const change of [p => { p.id = 'other'; }, p => { p.contentVersion = 8; }, p => { p.contentVersion = '7'; }]) {
    payload = { ...structuredClone(fixture), id: activityId, contentVersion: 7 }; change(payload);
    const state = await request(); assert.ok(state.error); assert.equal(state.activity, undefined);
  }
  assert.equal(calls.length, 3); assert.ok(calls.every(c => c.url.endsWith('?version=7')));
});
test('invalid MCQ definitions fail the reused parser and private fields are stripped', async () => {
  for (const change of [p => { p.activityData.activityType = 'essay'; }, p => { p.activityData.schemaVersion = '2'; },
    p => { p.activityData.content.questions[0].correctOptionIds = ['missing']; }, p => { p.activityData.content.questions = []; }]) {
    payload = { ...structuredClone(fixture), id: activityId, contentVersion: 7 }; change(payload);
    const state = await request(); assert.ok(state.error); assert.equal(state.activity, undefined);
  }
  payload = { ...structuredClone(fixture), id: activityId, contentVersion: 7, provenance: 'private-source' };
  payload.activityData.teacherNotes = 'private-source'; payload.activityData.content.questions[0].privateSource = 'private-source';
  assert.doesNotMatch(JSON.stringify(await request()), /private-source|teacherNotes|provenance/);
});
for (const code of [404, 410, 422]) test(`unavailable, withdrawn or invalid publication HTTP ${code} has no preview or fallback`, async () => {
  status = code; payload = { error: 'private upstream details' };
  const state = await request(); assert.equal(state.unavailable, true); assert.match(state.error, /unavailable/);
  assert.equal(state.activity, undefined); assert.doesNotMatch(state.error, /private upstream/); assert.equal(calls.length, 1);
});
test('HTTP authentication errors, service failures, timeout and invalid JSON are sanitized', async () => {
  for (const code of [401, 403, 500]) {
    status = code; payload = { error: 'synthetic-preview-secret private diagnostics' };
    const state = await request(); assert.ok(state.error); assert.equal(state.activity, undefined);
    assert.doesNotMatch(JSON.stringify(state), /synthetic-preview-secret|private diagnostics/);
  }
  global.fetch = async () => { throw Error('synthetic-preview-secret'); };
  assert.match((await request()).error, /Cannot reach/);
  global.fetch = async () => new Response('not JSON'); assert.match((await request()).error, /invalid JSON/);
});
test('fixed-activity parser and assignment fetch remain fixed and unversioned', async () => {
  const { parseResourceActivity } = require('../lib/resource-studio/activity.ts');
  assert.throws(() => parseResourceActivity(payload), /invalid content/);
  payload = fixture;
  const activity = await require('../lib/resource-studio/server.ts').fetchResourceActivity();
  assert.equal(activity.id, fixture.id); assert.ok(!calls[0].url.includes('?'));
  assert.ok(calls[0].url.endsWith('/' + fixture.id));
});

test('reused MCQ renderer displays questions, single/multiple choices and local checking in an embedded heading', () => {
  const React = require('react');
  const { ResourceStudioPreview } = require('../components/resource-studio-preview.tsx');
  const markup = render(React.createElement(ResourceStudioPreview, { activity: parse(payload), embedded: true }));
  assert.match(markup, /<h3>/); assert.match(markup, /type="radio"/); assert.match(markup, /type="checkbox"/);
  assert.match(markup, /Check my answers/); assert.match(markup, /Version 7/); assert.doesNotMatch(markup, /Assign|Submit completed attempt/);
});
test('arbitrary question IDs can be answered and checked entirely locally without persistence', () => {
  const React = require('react');
  const activity = parse(payload);
  activity.questions = activity.questions.slice(0, 3).map((q, i) => ({ ...q, id: ['__proto__', 'constructor', 'toString'][i] }));
  const values = []; let cursor = 0;
  mocks.react = { ...React, useState: initial => {
    const index = cursor++;
    if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
    return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
  } };
  global.fetch = () => assert.fail('Checking a preview must not make any network request');
  const { ResourceStudioPreview } = require('../components/resource-studio-preview.tsx');
  const draw = () => { cursor = 0; return ResourceStudioPreview({ activity, embedded: true }); };
  draw();
  activity.questions.forEach((question, index) => {
    question.correctOptionIds.forEach(id => {
      const fieldset = flatten(draw()).filter(n => n.type === 'fieldset')[index];
      const input = flatten(fieldset).filter(n => n.type === 'input')[question.options.findIndex(option => option.id === id)];
      input.props.onChange({ target: { checked: true } });
    });
  });
  const form = flatten(draw()).find(n => n.type === 'form');
  assert.equal(form.props.action, undefined);
  let prevented = false;
  form.props.onSubmit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.match(render(draw()), /3 of 3 correct/);
  assert.equal(calls.length, 0); assert.equal(reads.length, 0);
});
test('opening and closing an inline preview preserves search query, filters, results and pagination', () => {
  const React = require('react');
  const item = { id: activityId, title: 'Synthetic title', contentVersion: 7, activityType: 'multiple_choice', subject: 'Maths', yearGroup: 'Year 4', objectiveTitle: 'Fractions', tags: [] };
  const searchState = { query: { q: 'fractions', subject: 'Maths', yearGroup: 'Year 4' }, results: { items: [item], total: 11, page: 2, pageSize: 10, totalPages: 2 } };
  const values = ['fractions', 'Maths', 'Year 4', true, null]; let cursor = 0;
  mocks.react = { ...React, useActionState: () => [searchState, () => {}, false], useState: () => { const i = cursor++; return [values[i], value => { values[i] = value; }]; } };
  const { ResourceStudioSearch, ResourceSearchResultsView } = require('../components/resource-studio-search.tsx');
  const draw = () => { cursor = 0; return ResourceStudioSearch({ planId }); };
  let tree = draw();
  const results = flatten(tree).find(n => n.type === ResourceSearchResultsView);
  const button = flatten(ResourceSearchResultsView(results.props)).find(n => n.type === 'button');
  assert.equal(button.props.type, 'button'); button.props.onClick();
  tree = draw(); assert.equal(flatten(tree).find(n => n.type === 'form').props.hidden, true);
  const panel = flatten(tree).find(n => n.type?.name === 'ResourceStudioSessionPlanner');
  assert.equal(panel.props.selected.id, activityId); assert.equal(panel.props.selected.contentVersion, 7);
  assert.ok(!flatten(flatten(tree).find(n => n.type === 'form')).some(n => n === panel));
  const previousRAF = global.requestAnimationFrame;
  global.requestAnimationFrame = () => 0;
  try { panel.props.onClose(); } finally { global.requestAnimationFrame = previousRAF; }
  tree = draw(); assert.equal(flatten(tree).find(n => n.type === 'form').props.hidden, false);
  assert.deepEqual(values, ['fractions', 'Maths', 'Year 4', true, null]);
  assert.equal(flatten(tree).find(n => n.type === ResourceSearchResultsView).props.results, searchState.results);
  assert.ok(flatten(tree).some(n => n.type === 'button' && n.props.children === 'Previous page' && n.props.value === 1));
  assert.equal(calls.length, 0);
});

function panelHarness(response) {
  const React = require('react'); let state = null, effect, updates = 0;
  mocks.react = { ...React, useState: () => [state, value => { state = value; updates++; }], useRef: () => ({ current: { focus() {} } }), useEffect: fn => { effect = fn; } };
  mocks['@/lib/resource-studio/preview-actions'] = { previewResourceStudioAction: (...args) => { assert.deepEqual(args, [planId, activityId, 7, true]); return response; } };
  const { ResourceStudioSelectedPreview } = require('../components/resource-studio-selected-preview.tsx');
  const draw = () => ResourceStudioSelectedPreview({ planId, activityId, version: 7, fictional: true, onClose() {} });
  return { draw, start: () => effect(), updates: () => updates };
}
test('inline preview loading and unavailable states do not render answer content', async () => {
  const harness = panelHarness(Promise.resolve({ error: 'Published version withdrawn', unavailable: true }));
  assert.match(render(harness.draw()), /role="status".*Loading/);
  harness.start(); await Promise.resolve();
  const markup = render(harness.draw()); assert.match(markup, /Publication unavailable/); assert.match(markup, /role="alert"/);
  assert.doesNotMatch(markup, /Check my answers|Assign|ready for assignment/);
});
test('successful action result mounts the reused renderer with the exact version', async () => {
  const harness = panelHarness(Promise.resolve({ activity: parse(payload) }));
  harness.draw(); harness.start(); await Promise.resolve();
  const rendered = flatten(harness.draw()).find(n => n.type?.name === 'ResourceStudioPreview');
  assert.equal(rendered.props.activity.contentVersion, 7); assert.equal(rendered.props.embedded, true);
});

test('session controls are offered only after a successful validated preview', async () => {
  const React = require('react'); let state = null, offered = null;
  mocks.react = { ...React, useState: () => [state, () => {}], useRef: () => ({ current: null }), useEffect: () => {} };
  const { ResourceStudioSelectedPreview } = require('../components/resource-studio-selected-preview.tsx');
  const draw = () => ResourceStudioSelectedPreview({ planId, activityId, version: 7, fictional: true, onClose() {},
    selectionControls: activity => { offered = activity; return React.createElement('button', { type: 'button' }, 'Add to session'); } });
  draw(); assert.equal(offered, null);
  state = { error: 'Unavailable', unavailable: true }; draw(); assert.equal(offered, null);
  state = { activity: parse(payload) }; draw(); assert.equal(offered.id, activityId); assert.equal(offered.contentVersion, 7);
});
test('closing a pending preview discards its late answer-bearing response', async () => {
  let resolve; const harness = panelHarness(new Promise(r => { resolve = r; }));
  harness.draw(); const close = harness.start(); close(); resolve({ activity: parse(payload) }); await Promise.resolve();
  assert.equal(harness.updates(), 0);
});
test('client transport errors are sanitized and do not retain an activity', async () => {
  const harness = panelHarness(Promise.reject(Error('private diagnostics')));
  harness.draw(); harness.start(); await Promise.resolve();
  const markup = render(harness.draw()); assert.match(markup, /Preview unavailable/); assert.doesNotMatch(markup, /private diagnostics|Check my answers/);
});
test('preview action is separate from pupil exercise and assignment paths; no new public route', () => {
  for (const file of ['components/resource-studio-exercise.tsx', 'lib/resource-studio/assignment-actions.ts', 'lib/resource-studio/attempt-actions.ts']) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /previewResourceStudioAction|fetchResourceActivityVersion|ResourceStudioSelectedPreview/);
  }
  const fixedRoute = fs.readFileSync('app/dev/resource-studio/activity-equivalent-fractions-mcq/page.tsx', 'utf8');
  assert.doesNotMatch(fixedRoute, /fetchResourceActivityVersion|searchParams|previewResourceStudioAction/);
});
