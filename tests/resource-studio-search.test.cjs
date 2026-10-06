const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const mocks = {}, originalLoad = Module._load;
Module._load = function(id, ...args) {
  if (Object.hasOwn(mocks, id)) return mocks[id];
  if (id === 'server-only') return {};
  if (id.endsWith('.css')) return { default: {} };
  if (id === 'next/link') return { default: 'a' };
  if (id.startsWith('@/')) return originalLoad.call(this, path.resolve(id.slice(2)), ...args);
  return originalLoad.call(this, id, ...args);
};
require.extensions['.tsx'] = require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
const originalEnv = { ...process.env }, originalFetch = global.fetch;
const planId = '11111111-1111-4111-8111-111111111111';
const item = () => ({ id: 'activity-fractions', title: 'Equivalent fractions', contentVersion: 7,
  activityType: 'multiple_choice', subject: 'Maths', yearGroup: 'Year 4', objectiveId: 'objective-fractions',
  objectiveTitle: 'Recognise equivalent fractions', tags: ['retrieval'] });
const result = () => ({ items: [item()], total: 1, page: 1, pageSize: 10, totalPages: 1 });
let rows, reads, fetches, payload, dbError, authCalls;
beforeEach(() => {
  process.env.NODE_ENV = 'development';
  process.env.RESOURCE_STUDIO_BASE_URL = 'http://localhost:3001';
  process.env.PRACTICE_LOOP_INTEGRATION_KEY = 'synthetic-integration-secret';
  rows = {
    weekly_plans: { id: planId, student_id: 'student-a', lesson_reflection_id: 'reflection-a' },
    students: { id: 'student-a', owner_tutor_id: 'tutor-a', name: 'Synthetic private pupil name' },
    lesson_reflections: { id: 'reflection-a', student_id: 'student-a', what_we_covered: 'Synthetic private reflection' },
  };
  reads = []; fetches = []; payload = result(); dbError = null; authCalls = 0;
  const supabase = { from(table) {
    const filters = []; let columns;
    const query = { select(value) { columns = value; return query; }, eq(key, value) { filters.push([key, value]); return query; },
      async maybeSingle() {
        reads.push({ table, columns, filters });
        return { data: rows[table] && filters.every(([k, v]) => rows[table][k] === v) ? rows[table] : null, error: dbError };
      } };
    return query;
  } };
  mocks['@/lib/auth'] = { requireTutor: async () => { authCalls++; return { supabase, user: { id: 'tutor-a' } }; } };
  global.fetch = async (url, options) => { fetches.push({ url: String(url), options }); return Response.json(payload); };
});
afterEach(() => {
  process.env = { ...originalEnv }; global.fetch = originalFetch;
  Object.keys(mocks).forEach(key => delete mocks[key]);
  for (const key of Object.keys(require.cache)) if (!key.includes('node_modules') && ['lib', 'app', 'components'].some(dir => key.includes(path.sep + dir + path.sep))) delete require.cache[key];
});
const client = () => require('../lib/resource-studio/search.ts');
const action = () => require('../lib/resource-studio/search-actions.ts').searchResourceStudioAction;
function form(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ fictional: 'confirmed', q: 'fractions', subject: 'Maths', yearGroup: 'Year 4', page: '1', ...values })) data.set(key, value);
  return data;
}

test('owned authenticated search uses metadata endpoint and sends only search parameters, with server auth and no caching', async () => {
  const state = await action()(planId, { results: { forged: true } }, form());
  assert.deepEqual(state.results, result()); assert.equal(authCalls, 1);
  assert.equal(fetches.length, 1);
  const { url, options } = fetches[0], parsed = new URL(url);
  assert.equal(parsed.pathname, '/api/integrations/practice-loop/activities');
  assert.deepEqual(Object.fromEntries(parsed.searchParams), { q: 'fractions', subject: 'Maths', yearGroup: 'Year 4', page: '1', pageSize: '10' });
  assert.equal(options.headers.Authorization, 'Bearer synthetic-integration-secret');
  assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
  assert.equal(options.body, undefined);
  assert.deepEqual(reads.map(r => r.columns), ['id,student_id,lesson_reflection_id', 'id,owner_tutor_id', 'id,student_id']);
  assert.doesNotMatch(url + JSON.stringify(state), /synthetic-integration-secret|student-a|reflection-a|Synthetic private|11111111/);
});

for (const role of ['unauthenticated', 'unapproved']) test(`${role} direct action stops before reads or upstream requests`, async () => {
  mocks['@/lib/auth'].requireTutor = async () => { throw Error('REDIRECT:/login'); };
  await assert.rejects(() => action()(planId, {}, form()), /REDIRECT/);
  assert.equal(reads.length, 0); assert.equal(fetches.length, 0);
});
for (const table of ['weekly_plans', 'students', 'lesson_reflections']) test(`missing or inaccessible ${table} stops search`, async () => {
  rows[table] = null;
  assert.match((await action()(planId, {}, form())).error, /tutor access/);
  assert.equal(fetches.length, 0);
});
test('foreign ownership, mismatched reflection, invalid plan IDs and database errors fail closed', async () => {
  rows.students.owner_tutor_id = 'tutor-b';
  assert.match((await action()(planId, {}, form())).error, /tutor access/);
  rows.students.owner_tutor_id = 'tutor-a'; rows.lesson_reflections.student_id = 'another-student';
  assert.match((await action()(planId, {}, form())).error, /tutor access/);
  assert.match((await action()('bad-id', {}, form())).error, /tutor access/);
  dbError = { message: 'private database diagnostics' };
  const state = await action()(planId, {}, form());
  assert.match(state.error, /tutor access/); assert.doesNotMatch(JSON.stringify(state), /diagnostics/);
  assert.equal(fetches.length, 0);
});
test('pagination reauthorizes the plan instead of trusting previous results', async () => {
  const state = await action()(planId, {}, form());
  rows.students.owner_tutor_id = 'tutor-b';
  assert.match((await action()(planId, state, form({ page: '2' }))).error, /tutor access/);
  assert.equal(fetches.length, 1); assert.equal(authCalls, 2);
});
test('fictional confirmation is mandatory and duplicate confirmation is rejected', async () => {
  for (const data of [form({ fictional: '' }), (() => { const f = form(); f.append('fictional', 'confirmed'); return f; })()]) {
    assert.match((await action()(planId, {}, data)).error, /fictional/);
  }
  assert.equal(fetches.length, 0);
});
test('production and test environments reject both action and client', async () => {
  for (const environment of ['production', 'test']) {
    process.env.NODE_ENV = environment;
    assert.match((await action()(planId, {}, form())).error, /only in development/);
    await assert.rejects(() => client().searchResourceActivities(new URLSearchParams()), /only in development/);
  }
  assert.equal(authCalls, 0); assert.equal(fetches.length, 0);
});
test('query defaults, whitespace, exact curriculum labels and maximum pagination', () => {
  const parse = client().parseResourceSearchQuery;
  assert.deepEqual(parse(new URLSearchParams()), { q: '', subject: '', yearGroup: '', page: 1, pageSize: 10 });
  assert.deepEqual(parse(new URLSearchParams({ q: '  equivalent   fractions ', subject: 'Maths', yearGroup: 'Year 4', page: '2147483647', pageSize: '20' })),
    { q: 'equivalent fractions', subject: 'Maths', yearGroup: 'Year 4', page: 2147483647, pageSize: 20 });
});
test('invalid query values, duplicate fields, private fields and files never reach upstream', async () => {
  const cases = [{ q: 'x'.repeat(121) }, { subject: 'x'.repeat(81) }, { yearGroup: 'x'.repeat(41) }, { q: 'bad\ntext' },
    { page: '0' }, { page: '-1' }, { page: '1.5' }, { page: '1e2' }, { page: '2147483648' }, { page: '' },
    { pageSize: '21' }, { pageSize: '0' }, { pupilName: 'Synthetic private pupil' }, { objective: 'not-supported-by-this-ui' }];
  for (const values of cases) assert.ok((await action()(planId, {}, form(values))).error, JSON.stringify(values));
  const duplicate = form(); duplicate.append('q', 'other');
  assert.ok((await action()(planId, {}, duplicate)).error);
  const file = form(); file.set('q', new Blob(['synthetic']), 'synthetic.txt');
  assert.ok((await action()(planId, {}, file)).error);
  assert.equal(fetches.length, 0);
});
test('pagination accepts clamped last pages and empty results without inventing entries', async () => {
  payload = { items: [item()], total: 11, page: 2, pageSize: 10, totalPages: 2 };
  assert.deepEqual((await action()(planId, {}, form({ page: '999' }))).results, payload);
  payload = { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
  assert.deepEqual((await action()(planId, {}, form())).results, payload);
});
test('upstream unknown fields and private definitions are stripped at every level', async () => {
  payload.privateSource = 'private provenance';
  Object.assign(payload.items[0], { activityData: { correctOptionIds: ['a'] }, teacherNotes: 'private notes', source: 'private provenance' });
  const state = await action()(planId, {}, form());
  assert.deepEqual(state.results, result());
  assert.doesNotMatch(JSON.stringify(state), /activityData|correctOptionIds|teacherNotes|private provenance/);
});
test('malformed or inconsistent metadata responses are rejected', () => {
  const mutate = [p => { p.items[0].activityType = 'essay'; }, p => { p.items[0].tags = [4]; }, p => { delete p.items[0].objectiveTitle; },
    p => { p.items[0].contentVersion = 0; }, p => { p.total = -1; }, p => { p.pageSize = 21; }, p => { p.page = 2; },
    p => { p.totalPages = 4; }, p => { p.items = {}; }, p => { p.items = []; }, p => { p.items.push(item()); p.total = 2; }];
  for (const change of mutate) { const value = result(); change(value); assert.throws(() => client().parseResourceSearchResults(value), /invalid search results/); }
  assert.throws(() => client().parseResourceSearchResults(null), /invalid search results/);
});
test('wrong upstream page size or page is rejected', async () => {
  payload.pageSize = 5;
  assert.ok((await action()(planId, {}, form())).error);
  payload = { items: [item()], page: 1, pageSize: 1, total: 2, totalPages: 2 };
  assert.ok((await action()(planId, {}, form({ page: '2', pageSize: '1' }))).error);
});
test('timeouts, HTTP failures, invalid JSON and unexpected transport errors stay sanitized', async () => {
  for (const status of [401, 403, 404, 500]) {
    global.fetch = async () => new Response('synthetic-integration-secret private diagnostics', { status });
    const state = await action()(planId, {}, form()); assert.ok(state.error);
    assert.doesNotMatch(JSON.stringify(state), /synthetic-integration-secret|private diagnostics/);
  }
  global.fetch = async () => { throw Error('synthetic-integration-secret'); };
  assert.match((await action()(planId, {}, form())).error, /Cannot reach/);
  global.fetch = async () => new Response('invalid JSON');
  assert.match((await action()(planId, {}, form())).error, /invalid search results/);
  mocks['@/lib/auth'].requireTutor = async () => ({ user: { id: 'tutor-a' }, supabase: { from() { throw Error('private diagnostics'); } } });
  assert.deepEqual(await action()(planId, {}, form()), { error: 'Could not search Resource Studio. Please try again.' });
});
test('missing or unsafe integration configuration fails before fetch without exposing secrets', async () => {
  for (const base of ['', 'file:///tmp/private', 'http://user:secret@localhost', 'http://localhost/path', 'http://localhost?key=secret']) {
    process.env.RESOURCE_STUDIO_BASE_URL = base;
    const state = await action()(planId, {}, form()); assert.ok(state.error); assert.doesNotMatch(state.error, /secret|user:/);
  }
  process.env.RESOURCE_STUDIO_BASE_URL = 'http://localhost:3001'; delete process.env.PRACTICE_LOOP_INTEGRATION_KEY;
  assert.match((await action()(planId, {}, form())).error, /not configured/);
  assert.equal(fetches.length, 0);
});

const component = () => require('../components/resource-studio-search.tsx');
const render = element => require('react-dom/server').renderToStaticMarkup(element);
test('metadata rendering includes curriculum, honest duration, escaped text and no interactive activity controls', () => {
  const results = result(); results.items[0].title = '<script>synthetic</script>';
  const markup = render(component().ResourceSearchResultsView({ results, pending: false }));
  for (const pattern of [/Multiple choice/, /Maths/, /Year 4/, /Recognise equivalent fractions/, /retrieval/, /Duration: not provided/, /&lt;script&gt;/]) assert.match(markup, pattern);
  assert.doesNotMatch(markup, /<script>|Assign|Preview|href=|correctOptionIds|objective-fractions/);
});
test('initial, loading, empty and error states are distinct; stale results are hidden on failure or loading', () => {
  const view = component().ResourceSearchResultsView;
  assert.match(render(view({ pending: false })), /Enter keywords/);
  const loading = render(view({ pending: true, results: result() })); assert.match(loading, /role="status".*Searching/); assert.doesNotMatch(loading, /Equivalent fractions/);
  const error = render(view({ pending: false, error: 'Search unavailable', results: result() })); assert.match(error, /role="alert"/); assert.doesNotMatch(error, /Equivalent fractions/);
  assert.match(render(view({ pending: false, results: { ...result(), items: [], total: 0 } })), /No published MCQs/);
});
function searchMarkup(state, fields = ['fractions', 'Maths', 'Year 4', true], pending = false) {
  const react = require('react'); let index = 0;
  const fictional = fields[3];
  mocks['./plan-page-sessions'] = { usePlanSelections: () => ({ fictional, confirm() {}, pending: false, sessions: [], records: {} }) };
  fields = fields.slice(0, 3);
  mocks.react = { ...react, useActionState: () => [state, () => {}, pending], useState: initial => [index < fields.length ? fields[index++] : (typeof initial === 'function' ? initial() : initial), () => {}] };
  delete require.cache[require.resolve('../components/resource-studio-search.tsx')];
  return render(component().ResourceStudioSearch({ planId }));
}
test('search form has bounded labeled inputs, fictional confirmation and working page values', () => {
  const results = { items: Array.from({ length: 10 }, (_, i) => ({ ...item(), id: String(i) })), total: 11, page: 1, pageSize: 10, totalPages: 2 };
  const markup = searchMarkup({ query: { q: 'fractions', subject: 'Maths', yearGroup: 'Year 4' }, results });
  assert.match(markup, /name="q"/); assert.match(markup, /maxLength="120"/); assert.match(markup, /required="" name="fictional"/);
  assert.match(markup, /value="1" name="page"/); assert.match(markup, /value="0" disabled/); assert.match(markup, /value="2"/);
  assert.match(markup, /do not include names or personal information/); assert.doesNotMatch(markup, /synthetic-integration-secret|Assign/);
  assert.match(markup, /Preview activity/);
});
test('changing filters hides stale results and pagination; pending disables the form', () => {
  const state = { query: { q: 'fractions', subject: 'Maths', yearGroup: 'Year 4' }, results: { ...result(), total: 11, totalPages: 2 } };
  assert.doesNotMatch(searchMarkup(state, ['new topic', 'Maths', 'Year 4', true]), /Equivalent fractions|Next page/);
  const pending = searchMarkup(state, undefined, true);
  assert.match(pending, /aria-busy="true"/); assert.match(pending, /fieldset disabled/); assert.doesNotMatch(pending, /Next page/);
});
test('plan keeps report, sessions and completion while adding only development search with plan ID', async () => {
  const plan = { id: planId, student: { id: 'student-a', name: 'Fictional' }, reflection: { date: '2026-09-27', whatWeCovered: 'Fractions' }, focus: 'Fractions',
    sessions: [{ id: 's1', sessionNumber: 1, title: 'Practice', durationMinutes: 15, completed: true,
      activities: [{ id: 'a1', title: 'Existing task', description: 'Existing description', completed: true, type: 'Topic practice', contentJson: null }] }] };
  mocks['@/lib/data'] = { getWeeklyPlan: async () => plan, listExtractedObjectives: async () => [] };
  mocks['next/navigation'] = { notFound: () => { throw Error('NOT_FOUND'); } };
  const page = require('../app/plans/[id]/page.tsx').default;
  const tree = await page({ params: Promise.resolve({ id: planId }) });
  const children = tree.props.children;
  const provider = children.find(c => c?.type?.name === 'PlanPageSessions');
  assert.deepEqual(provider.props.sessions, [{ id: 's1', session_number: 1, title: 'Practice' }]);
  assert.equal(provider.props.planId, planId);
  const search = provider.props.children.find(c => c?.type?.name === 'ResourceStudioSearch');
  assert.deepEqual(search.props, { planId });
  assert.ok(children.some(c => c?.type?.name === 'ResourceStudioPlanReport'));
  function flatten(element) { return Array.isArray(element) ? element.flatMap(flatten) : element?.props ? [element, ...flatten(element.props.children)] : []; }
  const nodes = flatten(tree);
  const card = nodes.find(n => n.type === 'article');
  const selections = flatten(card).find(n => n.type?.name === 'ResourceStudioSessionSelections');
  assert.deepEqual(selections.props, { sessionId: 's1', sessionNumber: 1 });
  assert.ok(nodes.some(n => n.props.href === '/activities/a1'));
  assert.ok(nodes.some(n => n.props.children === 'Existing task'));
  assert.ok(nodes.some(n => n.props.className === 'completion-badge'));
  process.env.NODE_ENV = 'production';
  const production = flatten(await page({ params: Promise.resolve({ id: planId }) }));
  assert.ok(!production.some(c => ['ResourceStudioSearch', 'PlanPageSessions', 'ResourceStudioSessionSelections'].includes(c.type?.name)));
  assert.ok(production.some(n => n.props.href === '/activities/a1'));
  mocks['@/lib/data'].getWeeklyPlan = async () => null;
  await assert.rejects(() => page({ params: Promise.resolve({ id: planId }) }), /NOT_FOUND/);
  assert.equal(fetches.length, 0);
});


test('five server-rendered cards retain all fifteen legacy links and map selection lists to the matching sessions', async () => {
  const sessions = Array.from({ length: 5 }, (_, i) => ({
    id: 's' + (i + 1), sessionNumber: i + 1, title: 'Session title', durationMinutes: 15, completed: false,
    activities: Array.from({ length: 3 }, (_, j) => ({ id: 'a' + i + j, title: 'Legacy task', description: 'Practice',
      completed: i === 0 && j === 0, type: 'Topic practice', contentJson: { privateSentinel: 'not-a-client-prop' } }))
  }));
  mocks['@/lib/data'] = { listExtractedObjectives: async () => [], getWeeklyPlan: async () => ({ id: planId, student: { id: 'student', name: 'Fictional' },
    reflection: { date: '2026-09-30', whatWeCovered: 'Fractions' }, focus: 'Fractions', sessions }) };
  const tree = await require('../app/plans/[id]/page.tsx').default({ params: Promise.resolve({ id: planId }) });
  const flatten = value => Array.isArray(value) ? value.flatMap(flatten) : value?.props ? [value, ...flatten(value.props.children)] : [];
  const nodes = flatten(tree), cards = nodes.filter(n => n.type === 'article');
  assert.equal(cards.length, 5);
  cards.forEach((card, i) => {
    const children = flatten(card);
    assert.equal(children.filter(n => n.props.href?.startsWith('/activities/')).length, 3);
    const lists = children.filter(n => n.type?.name === 'ResourceStudioSessionSelections');
    assert.equal(lists.length, 1); assert.deepEqual(lists[0].props, { sessionId: 's' + (i + 1), sessionNumber: i + 1 });
  });
  const completion = nodes.find(n => n.props.className === 'completion-badge');
  assert.ok(completion.props.children.includes(1)); assert.ok(completion.props.children.includes(15));
  const provider = nodes.find(n => n.type?.name === 'PlanPageSessions');
  assert.deepEqual(provider.props.sessions, sessions.map(s => ({ id: s.id, session_number: s.sessionNumber, title: s.title })));
  assert.equal(nodes.filter(n => n.type?.name === 'ResourceStudioSearch').length, 1);
  assert.ok(!nodes.some(n => n.props.children === 'Session planning references'));
});
