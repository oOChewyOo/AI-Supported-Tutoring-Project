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
const fixture = require('./fixtures/practice-proposal-contract.json');
const originalEnv = { ...process.env }, originalFetch = global.fetch;
const planId = '22222222-2222-4222-8222-222222222222';
let rows, calls, payload, status, controls;
beforeEach(() => {
  process.env.NODE_ENV = 'development'; process.env.RESOURCE_STUDIO_BASE_URL = 'http://localhost:3101'; process.env.PRACTICE_LOOP_INTEGRATION_KEY = 'synthetic-secret';
  payload = structuredClone(fixture.response); calls = []; status = 200;
  const { objective, ...fields } = fixture.request; controls = fields;
  rows = {
    weekly_plans: { id: planId, student_id: 'private-student-id', lesson_reflection_id: 'private-reflection-id' },
    students: { id: 'private-student-id', owner_tutor_id: 'private-tutor-id', name: 'Private Fictional Name' },
    lesson_reflections: { id: 'private-reflection-id', student_id: 'private-student-id', notes: 'private notes' },
    extracted_objectives: { student_id: 'private-student-id', lesson_reflection_id: 'private-reflection-id', focus_for_next_week: [objective], rawReflection: 'private reflection', possible_misconceptions: ['unrelated private text'] }
  };
  const supabase = { from(table) { const filters = []; const query = { select() { return query; }, eq(k,v) { filters.push([k,v]); return query; },
    async maybeSingle() { return { data: rows[table] && filters.every(([k,v]) => rows[table][k] === v) ? rows[table] : null, error: null }; } }; return query; } };
  mocks['@/lib/auth'] = { requireTutor: async () => ({ supabase, user: { id: 'private-tutor-id' } }) };
  global.fetch = async (url, options) => { calls.push({ url: String(url), options }); return Response.json(payload, { status }); };
});
afterEach(() => {
  process.env = { ...originalEnv }; global.fetch = originalFetch;
  Object.keys(mocks).forEach(key => delete mocks[key]);
  for (const key of Object.keys(require.cache)) if (!key.includes('node_modules') && ['lib','components'].some(dir => key.includes(path.sep + dir + path.sep))) delete require.cache[key];
});
const contract = () => require('../lib/resource-studio/proposal-contract.ts');
const action = () => require('../lib/resource-studio/proposal-actions.ts');
const build = () => action().buildPracticeProposalAction(planId, 'focus_for_next_week:0', controls, true);
test('normal tutor response drops source fields even from an older upstream response', () => {
  const value = structuredClone(fixture.response);
  Object.assign(value.activities[0], { sourceLabel: 'Twinkl', fulfilmentMode: 'source-converted', sourceUrl: 'https://example.invalid', provenance: { provider: 'Oak' } });
  assert.doesNotMatch(JSON.stringify(contract().parsePracticeProposal(value)), /provider|sourceLabel|sourceUrl|fulfilmentMode|Twinkl|Oak|provenance|attribution/);
});
test('all-eleven durable reference validation accepts only the opaque prepared contract', () => {
  const { parseResourcePackageReference } = require('../lib/resource-studio/package-reference.ts');
  for (const activityType of fixture.allTypes) {
    const value = { schemaVersion: '1', packageId: planId, activityId: '33333333-3333-4333-8333-333333333333', contentVersion: 1, releaseId: null, resourceVersion: null,
      activityType, integrity: 'b'.repeat(64), scoringMode: activityType === 'comprehension' ? 'hybrid_review' :
        ['short_written_response', 'explain_thinking'].includes(activityType) ? 'manual_review' : 'automatic',
      status: 'prepared', assigned: false, contentAccess: 'authenticated_server_only', learnerDelivery: 'not_implemented' };
    assert.deepEqual(parseResourcePackageReference(value), value);
    for (const key of ['provider','provenance','sourceItemIds','licence','attribution','canonicalActivity','answers']) {
      assert.throws(() => parseResourcePackageReference({ ...value, [key]: 'private' }));
    }
    for (const change of [{ assigned: true }, { status: 'assigned' }, { packageId: 'bad' }, { contentVersion: 2 }, { integrity: 'bad' }, { scoringMode: 'wrong' }]) {
      assert.throws(() => parseResourcePackageReference({ ...value, ...change }));
    }
  }
});
test('stored objective creates exact educational allowlist; identities and raw text never serialize', async () => {
  const state = await build(); assert.ok(state.proposal); assert.equal(state.proposal.status, 'partial');
  assert.deepEqual(JSON.parse(calls[0].options.body), fixture.request);
  assert.doesNotMatch(calls[0].options.body, /private|Private|student|tutor|reflection|misconceptions/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer synthetic-secret');
  assert.equal(calls[0].options.redirect, 'error'); assert.equal(calls[0].options.cache, 'no-store'); assert.ok(calls[0].options.signal);
  assert.equal(calls[0].url, 'http://localhost:3101/api/integrations/practice-loop/practice-proposals');
  assert.ok(state.proposal.activities[0].previewAvailable); assert.equal(state.proposal.activities[0].previewToken, undefined);
  assert.doesNotMatch(JSON.stringify(state), /synthetic-secret|private|aaaaaaaa/);
});
test('strict request rejects extra identity/source/type fields, invalid intent, oversized text and malformed duration', () => {
  for (const field of ['studentId','learnerName','email','source','activityType','notes']) assert.throws(() => contract().parsePracticeNeed({ ...fixture.request, [field]: 'bad' }));
  for (const change of [{ objective: 'x'.repeat(241) }, { intents: ['unknown'] }, { intents: ['fluency','fluency'] }, { durationMinutes: '10' }, { durationMinutes: 31 }]) assert.throws(() => contract().parsePracticeNeed({ ...fixture.request, ...change }));
});
test('all eleven types use the same response contract without content schemas', () => {
  for (const activityType of fixture.allTypes) {
    const value = structuredClone(fixture.response); value.activities[0].activityType = activityType;
    assert.equal(contract().parsePracticeProposal(value).activities[0].activityType, activityType);
  }
});
test('partial response retains ordered successful sibling, strips unexpected private metadata, rejects invalid contracts', () => {
  const raw = { ...fixture.response, privateProvenance: 'secret' }; raw.activities = structuredClone(raw.activities); raw.activities[0].answerSheet = 'secret';
  const parsed = contract().parsePracticeProposal(raw); assert.deepEqual(parsed.activities.map(item => item.id), ['one','two']); assert.doesNotMatch(JSON.stringify(parsed), /secret|answerSheet/);
  for (const mutate of [v => v.activities.push(v.activities[0]), v => v.activities[0].previewToken = 'bad', v => v.reviewOnly = false,
    v => v.status = 'ready', v => v.headroomMinutes = 5, v => v.activities[0].activityType = 'unknown']) {
    const bad = structuredClone(fixture.response); mutate(bad); assert.throws(() => contract().parsePracticeProposal(bad));
  }
});
test('signed out, foreign tutor, mismatched reflection, missing objective and non-development fail before remote call', async () => {
  const auth = mocks['@/lib/auth'].requireTutor;
  mocks['@/lib/auth'].requireTutor = async () => { throw Error('REDIRECT'); }; await assert.rejects(build, /REDIRECT/); mocks['@/lib/auth'].requireTutor = auth;
  rows.students.owner_tutor_id = 'other'; assert.ok((await build()).error); rows.students.owner_tutor_id = 'private-tutor-id';
  rows.lesson_reflections.student_id = 'other'; assert.ok((await build()).error); rows.lesson_reflections.student_id = 'private-student-id';
  rows.extracted_objectives = null; assert.ok((await build()).error);
  process.env.NODE_ENV = 'production'; assert.ok((await build()).error); assert.equal(calls.length, 0);
});
test('strict fictional confirmation and unknown objective prevent any remote call', async () => {
  for (const confirm of [false, 'true', undefined]) assert.ok((await action().buildPracticeProposalAction(planId, 'focus_for_next_week:0', controls, confirm)).error);
  assert.ok((await action().buildPracticeProposalAction(planId, 'focus_for_next_week:90', controls, true)).error); assert.equal(calls.length, 0);
});
test('network, authentication, provider, mismatched request and malformed response return safe errors', async () => {
  for (const code of [401,403,500]) { status = code; assert.ok((await build()).error); }
  status = 200; payload.objective = 'wrong'; assert.ok((await build()).error);
  global.fetch = async () => { throw Error('private provider diagnostics'); };
  const state = await build(); assert.ok(state.error); assert.doesNotMatch(state.error, /private provider/);
});
test('preview capability is tutor/plan bound and expires; no extra integration call', async () => {
  const { proposal } = await build();
  const preview = () => action().previewPracticeProposalAction(planId, proposal.id, 'one', true);
  assert.match((await preview()).url, /^http:\/\/localhost:3101\/integrations\/practice-loop\/review#[a-f0-9]{64}$/);
  assert.ok((await action().previewPracticeProposalAction(planId, proposal.id, 'two', true)).error);
  rows.students.owner_tutor_id = 'other'; assert.ok((await preview()).error); rows.students.owner_tutor_id = 'private-tutor-id';
  const now = Date.now; Date.now = () => now() + 31 * 60_000;
  try { assert.ok((await preview()).error); } finally { Date.now = now; }
  assert.equal(calls.length, 1);
});
test('review renders educational metadata, partial failure and preview without source labels or assignment controls', () => {
  const { retainProposal } = require('../lib/resource-studio/proposal-store.ts');
  const proposal = retainProposal('t','p',contract().parsePracticeProposal(fixture.response));
  const { ProposalReview } = require('../components/resource-studio-proposals.tsx');
  const html = require('react-dom/server').renderToStaticMarkup(require('react').createElement(ProposalReview, { proposal, pending: false, onPreview() {} }));
  for (const text of ['Review only','not assigned','6 questions','fluency','Preview arithmetic input','Failed to prepare']) assert.ok(html.includes(text));
  assert.ok(html.indexOf('arithmetic input') < html.indexOf('spot mistake'));
  assert.doesNotMatch(html, /Accept proposal|Assign to|aaaaaaaa|Twinkl|Oak|Math Salamanders|Source:|attribution/);
  assert.match(fs.readFileSync('app/plans/[id]/page.tsx','utf8'), /<ResourceStudioSearch/);
});

test('tutor form uses stored objective, shows loading, completes review, and ignores results after confirmation withdrawal', async () => {
  const react = require('react'); const slots = []; let cursor = 0; const revision = { current: 0 };
  mocks.react = { ...react, useRef: () => revision, useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; } };
  let finish, received;
  mocks['@/lib/resource-studio/proposal-actions'] = { buildPracticeProposalAction: (...args) => { received = args; return new Promise(resolve => { finish = resolve; }); } };
  const Component = require('../components/resource-studio-proposals.tsx').ResourceStudioProposals;
  const props = { planId, objectives: [{ key: 'focus_for_next_week:0', label: 'focus', objective: fixture.request.objective }], subject: 'Maths', year: '5' };
  const tree = () => { cursor = 0; return Component(props); };
  const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : node?.props ? [node, ...flatten(node.props.children)] : [];
  const nodes = () => flatten(tree());
  const html = () => require('react-dom/server').renderToStaticMarkup(tree());
  nodes().find(n => n.type === 'input' && n.props.type === 'number').props.onChange({ target: { value: '10' } });
  nodes().find(n => n.type === 'label' && n.props.children?.[1] === 'fluency').props.children[0].props.onChange({ target: { checked: true } });
  const confirm = () => nodes().find(n => n.type === 'label' && String(n.props.children?.[1]).startsWith('This is fictional'));
  confirm().props.children[0].props.onChange({ target: { checked: true } });
  const button = () => nodes().find(n => n.type === 'button' && ['Build practice proposal','Rebuild practice'].includes(n.props.children));
  assert.equal(button().props.disabled, false); button().props.onClick(); assert.match(html(), /Preparing practice|Preparing review/);
  assert.equal(received[1], 'focus_for_next_week:0'); assert.deepEqual(received[2].intents, ['fluency']);
  const proposal = require('../lib/resource-studio/proposal-store.ts').retainProposal('t','p',contract().parsePracticeProposal(fixture.response));
  finish({ proposal }); await new Promise(setImmediate); assert.match(html(), /Resource Studio proposal/); assert.match(html(), /Rebuild practice/);
  button().props.onClick(); confirm().props.children[0].props.onChange({ target: { checked: false } });
  finish({ proposal }); await new Promise(setImmediate); assert.doesNotMatch(html(), /Ready for review|Preview arithmetic/);
});
