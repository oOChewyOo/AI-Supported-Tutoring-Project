const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

// Execute the actual TS modules without adding a test runtime dependency.
// server-only is a Next bundler boundary; bypass its poison pill only in this Node test process.
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  if (id === 'server-only') return {};
  return originalLoad.call(this, id, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { parseResourceActivity, isCorrectAnswer } = require('../lib/resource-studio/activity.ts');
const { fetchResourceActivity } = require('../lib/resource-studio/server.ts');
const fixture = require('./fixtures/resource-studio-activity.json');
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
after(() => { global.fetch = originalFetch; process.env = originalEnv; });

function configure() {
  process.env.NODE_ENV = 'development';
  process.env.RESOURCE_STUDIO_BASE_URL = 'http://localhost:3001';
  process.env.PRACTICE_LOOP_INTEGRATION_KEY = 'test-only-secret';
}

test('retrieves and adapts the actual published envelope with server credentials and no caching', async () => {
  configure();
  global.fetch = async (url, options) => {
    assert.equal(String(url), 'http://localhost:3001/api/integrations/practice-loop/activities/activity-equivalent-fractions-mcq');
    assert.equal(options.headers.Authorization, 'Bearer test-only-secret');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(fixture);
  };
  const result = await fetchResourceActivity();
  assert.equal(result.questions.length, 5);
  assert.equal(result.contentVersion, 1);
  assert.equal(result.questions[2].correctOptionIds.length, 2);
  assert.equal(result.questions[2].misconceptionTag, fixture.activityData.content.questions[2].misconceptionTag);
  assert.equal(JSON.stringify(result).includes('test-only-secret'), false);
});

test('optional misconception tags are preserved, never invented, and must be text', () => {
  const without = structuredClone(fixture);
  delete without.activityData.content.questions[0].misconceptionTag;
  assert.equal(parseResourceActivity(without).questions[0].misconceptionTag, undefined);
  without.activityData.content.questions[0].misconceptionTag = { unsafe: 'object' };
  assert.throws(() => parseResourceActivity(without), /misconceptionTag/);
});

for (const status of [401, 403, 404, 500]) {
  test(`useful sanitized error for HTTP ${status}`, async () => {
    configure();
    global.fetch = async () => new Response('test-only-secret', { status });
    await assert.rejects(fetchResourceActivity, (error) => {
      assert.match(error.message, status === 401 || status === 403 ? /authentication failed/ : status === 404 ? /not found/ : /HTTP 500/);
      assert.ok(!error.message.includes('test-only-secret'));
      return true;
    });
  });
}
test('offline/timeout errors do not expose fetch diagnostics', async () => {
  configure();
  global.fetch = async () => { throw Error('test-only-secret'); };
  await assert.rejects(fetchResourceActivity, /Cannot reach Resource Studio/);
});
test('rejects malformed JSON and invalid retrieved content', async () => {
  configure();
  global.fetch = async () => new Response('<html>Oops</html>');
  await assert.rejects(fetchResourceActivity, /invalid JSON/);
  global.fetch = async () => Response.json({});
  await assert.rejects(fetchResourceActivity, /invalid content/);
});
test('production and test environments are blocked before fetch', async () => {
  configure();
  global.fetch = async () => { assert.fail('must not fetch'); };
  for (const env of ['production', 'test']) {
    process.env.NODE_ENV = env;
    await assert.rejects(fetchResourceActivity, /only in development/);
  }
});
test('missing configuration and unsafe base URLs fail before fetch', async () => {
  configure();
  global.fetch = async () => { assert.fail('must not fetch'); };
  delete process.env.PRACTICE_LOOP_INTEGRATION_KEY;
  await assert.rejects(fetchResourceActivity, /Set RESOURCE_STUDIO_BASE_URL/);
  configure();
  for (const url of ['file:///tmp/test', 'http://user:password@localhost:3001', 'http://localhost:3001?key=secret', 'invalid']) {
    process.env.RESOURCE_STUDIO_BASE_URL = url;
    await assert.rejects(fetchResourceActivity, /must be an HTTP/);
  }
});

const invalidCases = {
  'wrong activity ID': (f) => { f.id = 'other'; },
  'invalid content version': (f) => { f.contentVersion = 0; },
  'fractional content version': (f) => { f.contentVersion = 1.5; },
  'string content version': (f) => { f.contentVersion = '1'; },
  'unsupported schema': (f) => { f.activityData.schemaVersion = '2.0'; },
  'wrong type': (f) => { f.activityData.activityType = 'short_answer'; },
  'empty questions': (f) => { f.activityData.content.questions = []; },
  'duplicate questions': (f) => { f.activityData.content.questions.push(f.activityData.content.questions[0]); },
  'missing instructions': (f) => { delete f.activityData.instructions; },
  'missing feedback': (f) => { delete f.activityData.feedback; },
  'blank prompt': (f) => { f.activityData.content.questions[0].prompt = ' '; },
  'too few options': (f) => { f.activityData.content.questions[0].options = []; },
  'duplicate option IDs': (f) => { const q = f.activityData.content.questions[0]; q.options[1].id = q.options[0].id; },
  'unknown correct ID': (f) => { f.activityData.content.questions[0].correctOptionIds = ['unknown']; },
  'empty correct IDs': (f) => { f.activityData.content.questions[0].correctOptionIds = []; },
  'duplicate correct IDs': (f) => { f.activityData.content.questions[0].correctOptionIds = ['q1-a', 'q1-a']; },
  'invalid hint': (f) => { f.activityData.content.questions[0].hint = {}; },
};
for (const [name, mutate] of Object.entries(invalidCases)) {
  test(`rejects ${name}`, () => {
    const f = structuredClone(fixture); mutate(f);
    assert.throws(() => parseResourceActivity(f), /invalid content/);
  });
}
test('single-answer scoring rejects empty, wrong, extra, duplicate and unknown selections', () => {
  const q = parseResourceActivity(fixture).questions[0];
  assert.equal(isCorrectAnswer(q, ['q1-a']), true);
  for (const answer of [[], ['q1-b'], ['q1-a', 'q1-b'], ['q1-a', 'q1-a'], ['unknown']]) assert.equal(isCorrectAnswer(q, answer), false);
});
test('multiple-answer scoring is exact, order independent and follows imported definitions', () => {
  const q = parseResourceActivity(fixture).questions[2];
  assert.equal(isCorrectAnswer(q, ['q3-b', 'q3-a']), true);
  for (const answer of [[], ['q3-a'], ['q3-a', 'q3-c'], ['q3-a', 'q3-b', 'q3-c'], ['q3-a', 'q3-a']]) assert.equal(isCorrectAnswer(q, answer), false);
  assert.equal(isCorrectAnswer({ ...q, correctOptionIds: ['q3-d'] }, ['q3-d']), true);
});
