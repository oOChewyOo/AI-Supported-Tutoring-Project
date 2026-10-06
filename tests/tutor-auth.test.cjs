const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const mocks = {};
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  if (Object.hasOwn(mocks, id)) return mocks[id];
  if (id === 'server-only') return {};
  if (id.startsWith('@/')) return originalLoad.call(this, path.resolve(id.slice(2)), ...args);
  return originalLoad.call(this, id, ...args);
};
require.extensions['.tsx'] = require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
const redirect = (url) => { throw new Error(`REDIRECT:${url}`); };
const env = { ...process.env };
beforeEach(() => { mocks['next/cache'] = { revalidatePath() {} }; });
afterEach(() => {
  process.env = { ...env };
  for (const key of Object.keys(mocks)) delete mocks[key];
  for (const key of Object.keys(require.cache)) {
    if (['lib', 'app', 'components'].some(dir => key.includes(`${path.sep}${dir}${path.sep}`)) && !key.includes('node_modules')) delete require.cache[key];
  }
});

function mockIdentity({ user = { id: 'tutor-a', is_anonymous: false }, authError = null, tutor = { id: 'tutor-a' }, tutorError = null, configured = true } = {}) {
  let membershipQueries = 0;
  const supabase = {
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    from(table) {
      assert.ok(['tutors', 'learner_accounts'].includes(table)); membershipQueries++;
      const query = {
        select: () => query,
        eq: (field, value) => { assert.equal(value, ['id','auth_user_id'].includes(field) ? user.id : true); return query; },
        maybeSingle: async () => ({ data: table === 'tutors' ? tutor : null, error: tutorError }),
      };
      return query;
    },
  };
  mocks['next/navigation'] = { redirect };
  mocks['@/lib/supabase/server'] = { createSupabaseServerClient: async () => supabase, isSupabaseConfigured: () => configured };
  return { supabase, queries: () => membershipQueries };
}

const render = (element) => require('react-dom/server').renderToStaticMarkup(element);
const loginPage = () => require('../app/login/page.tsx').default;

for (const [name, state, signedIn] of [
  ['approved tutor', {}, true],
  ['unapproved authenticated tutor', { tutor: null }, true],
  ['signed out', { user: null }, false],
  ['expired session', { authError: new Error('expired') }, false],
  ['anonymous Auth user', { user: { id: 'anonymous', is_anonymous: true } }, false],
  ['missing configuration', { configured: false }, false],
]) {
  test(`header navigation: ${name}`, async () => {
    mockIdentity(state);
    const header = await require('../components/app-header.tsx').AppHeader();
    const html = render(header);
    assert.equal(html.includes('Tutor sign in'), !signedIn);
    assert.equal(html.includes('Sign out'), signedIn);
    assert.match(html, /aria-label="Main navigation"/);
    if (signedIn) {
      const navigation = header.props.children[1];
      assert.equal(navigation.props.children[0].props.action, require('../lib/auth-actions.ts').signOutAction);
      assert.match(html, /type="submit"/);
    } else {
      assert.match(html, /href="\/login"/);
    }
  });
}

test('login redirects an approved verified tutor instead of showing a sign-in form', async () => {
  mockIdentity();
  await assert.rejects(() => loginPage()({ searchParams: Promise.resolve({}) }), { message: 'REDIRECT:/dashboard' });
});

test('login shows credentials only when signed out', async () => {
  mockIdentity({ user: null });
  const html = render(await loginPage()({ searchParams: Promise.resolve({}) }));
  assert.match(html, /name="email"/);
  assert.match(html, /name="password"/);
  assert.doesNotMatch(html, /Sign out/);
});

for (const state of [{ tutor: null }, { tutorError: new Error('missing table') }]) {
  test('authenticated account without confirmed approval gets access guidance and a sign-out option', async () => {
    mockIdentity(state);
    const html = render(await loginPage()({ searchParams: Promise.resolve({}) }));
    assert.match(html, /Access unavailable/);
    assert.match(html, /Sign out/);
    assert.doesNotMatch(html, /name="password"/);
  });
}

test('failed sign-out remains retryable for an authenticated tutor without a login redirect loop', async () => {
  const { supabase } = mockIdentity();
  supabase.auth.signOut = async () => ({ error: new Error('upstream detail') });
  await assert.rejects(require('../lib/auth-actions.ts').signOutAction, { message: 'REDIRECT:/login?error=signout' });
  const html = render(await loginPage()({ searchParams: Promise.resolve({ error: 'signout' }) }));
  assert.match(html, /Try signing out again/);
  assert.doesNotMatch(html, /upstream detail|name="password"/);
});

test('account transition A → signed out → B rechecks identity and replaces session-bound clients', async () => {
  let currentUser = { id: 'tutor-a', is_anonymous: false };
  const clients = [];
  mocks['next/navigation'] = { redirect };
  mocks['@/lib/supabase/server'] = {
    isSupabaseConfigured: () => true,
    createSupabaseServerClient: async () => {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: currentUser, error: null }) };
      const client = { from: () => query, auth: {
        getUser: async () => ({ data: { user: currentUser }, error: null }),
        signOut: async () => { currentUser = null; return { error: null }; },
        signInWithPassword: async () => { currentUser = { id: 'tutor-b', is_anonymous: false }; return { data: { user: currentUser }, error: null }; },
      } };
      clients.push(client);
      return client;
    },
  };
  const { requireTutor } = require('../lib/auth.ts');
  const { AppHeader } = require('../components/app-header.tsx');
  const { signInAction, signOutAction } = require('../lib/auth-actions.ts');
  const a = await requireTutor();
  assert.equal(a.user.id, 'tutor-a');
  await assert.rejects(signOutAction, /REDIRECT:\/login$/);
  await assert.rejects(requireTutor, /REDIRECT:\/login$/);
  assert.match(render(await AppHeader()), /Tutor sign in/);
  const form = new FormData(); form.set('email', 'b@example.test'); form.set('password', 'synthetic');
  await assert.rejects(() => signInAction(form), /REDIRECT:\/dashboard$/);
  const b = await requireTutor();
  assert.equal(b.user.id, 'tutor-b');
  assert.notEqual(a.supabase, b.supabase);
  assert.equal(new Set(clients).size, clients.length);
  assert.doesNotMatch(render(await AppHeader()), /Tutor sign in/);
});

for (const [name, state, expected] of [
  ['no session', { user: null }, '/login'],
  ['invalid or expired session', { authError: new Error('expired') }, '/login'],
  ['anonymous Auth user', { user: { id: 'anonymous', is_anonymous: true } }, '/login'],
  ['unapproved tutor', { tutor: null }, '/login?error=access'],
  ['membership lookup fails', { tutorError: new Error('missing migration') }, '/login?error=access'],
  ['missing configuration', { configured: false }, '/login?error=setup'],
]) {
  test(`requireTutor fails closed: ${name}`, async () => {
    mockIdentity(state);
    const { requireTutor } = require('../lib/auth.ts');
    await assert.rejects(requireTutor, { message: `REDIRECT:${expected}` });
  });
}
test('approved tutor receives the same session-bound client after verified identity', async () => {
  const { supabase, queries } = mockIdentity();
  const result = await require('../lib/auth.ts').requireTutor();
  assert.equal(result.supabase, supabase);
  assert.equal(result.user.id, 'tutor-a');
  assert.equal(queries(), 1);
});

const actionArgs = {
  createStudentAction: [{}, new FormData()],
  createLessonReflectionAction: ['foreign-student', {}, new FormData()],
  generateWeeklyPlanAction: ['foreign-reflection', {}],
  setActivityCompletionAction: ['foreign-activity', 'foreign-student', 'foreign-plan', true, {}],
  extractObjectivesAction: ['foreign-reflection', 'foreign-student', {}],
  updateObjectivesAction: ['foreign-objective', 'foreign-student', {}, new FormData()],
};
function mockActions() {
  mocks['next/navigation'] = { redirect };
  mocks['next/cache'] = { revalidatePath() {} };
  mocks['@/lib/data'] = { getLessonReflection: async () => null, getActivity: async () => null };
  for (const [file, name] of [['extract-objectives', 'extractObjectivesWithOpenAI'], ['generate-session-titles', 'generateSessionTitlesWithOpenAI']]) {
    mocks[`@/lib/openai/${file}`] = { [name]: async () => assert.fail('unauthorized AI call') };
  }
}
for (const [name, args] of Object.entries(actionArgs)) {
  test(`${name}: direct unauthenticated invocation stops before data or AI access`, async () => {
    mockActions();
    mocks['@/lib/auth'] = { requireTutor: async () => redirect('/login') };
    const actions = require('../lib/actions.ts');
    await assert.rejects(() => actions[name](...args), { message: 'REDIRECT:/login' });
  });
}
test('all exported learner actions have direct-invocation coverage', () => {
  mockActions();
  mocks['@/lib/auth'] = {};
  assert.deepEqual(Object.keys(require('../lib/actions.ts')).sort(), Object.keys(actionArgs).sort());
});
for (const name of ['generateWeeklyPlanAction', 'setActivityCompletionAction']) {
  test(`${name}: guessed foreign IDs do not trigger writes, RPC or AI calls`, async () => {
    mockActions();
    process.env.OPENAI_API_KEY = 'synthetic-not-a-key';
    mocks['@/lib/auth'] = { requireTutor: async () => ({ supabase: { from: () => assert.fail('unexpected query'), rpc: () => assert.fail('unexpected RPC') } }) };
    const result = await require('../lib/actions.ts')[name](...actionArgs[name]);
    assert.match(result.error, /could not be found/);
  });
}
test('completion action rejects tampered student and plan IDs even for an accessible activity', async () => {
  mockActions();
  mocks['@/lib/data'].getActivity = async () => ({ student: { id: 'owned-student' }, planId: 'owned-plan' });
  mocks['@/lib/auth'] = { requireTutor: async () => ({ supabase: { from: () => assert.fail('unexpected write') } }) };
  const action = require('../lib/actions.ts').setActivityCompletionAction;
  for (const [student, plan] of [['foreign-student', 'owned-plan'], ['owned-student', 'foreign-plan']]) {
    assert.match((await action('owned-activity', student, plan, true, {})).error, /could not be found/);
  }
});
test('create student uses verified tutor ID, never a submitted owner', async () => {
  mockActions();
  let inserted;
  mocks['@/lib/auth'] = { requireTutor: async () => ({ user: { id: 'tutor-a' }, supabase: {
    from: () => ({ insert: (row) => { inserted = row; return { select: () => ({ single: async () => ({ data: { id: 'new-student' }, error: null }) }) }; } }),
  } }) };
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: 'Synthetic', year_group: 'Test', subject_focus: 'Test', owner_tutor_id: 'tutor-b' })) form.set(key, value);
  await assert.rejects(() => require('../lib/actions.ts').createStudentAction({}, form), /REDIRECT:\/students\/new-student/);
  assert.equal(inserted.owner_tutor_id, 'tutor-a');
});
test('all data loader entry points reject missing sessions', async () => {
  mocks['@/lib/auth'] = { requireTutor: async () => redirect('/login') };
  const data = require('../lib/data.ts');
  for (const fn of Object.values(data)) await assert.rejects(() => fn('guessed-id'), /REDIRECT:\/login/);
});

for (const name of ['createLessonReflectionAction', 'extractObjectivesAction', 'updateObjectivesAction']) {
  test(`${name}: foreign record produces no successful write or AI call`, async () => {
    mockActions();
    process.env.OPENAI_API_KEY = 'synthetic-not-a-key';
    const query = {
      select: () => query, eq: () => query,
      limit: async () => ({ error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      // RLS UPDATE of an inaccessible row returns no rows, not a success.
      update: () => query,
      insert: () => assert.fail('foreign insert'), upsert: () => assert.fail('foreign upsert'),
    };
    mocks['@/lib/auth'] = { requireTutor: async () => ({ supabase: { from: () => query } }) };
    const args = [...actionArgs[name]];
    if (name === 'createLessonReflectionAction') {
      args[2] = new FormData();
      for (const key of ['date', 'what_we_covered', 'what_went_well', 'what_needs_practice']) args[2].set(key, 'Synthetic');
    }
    assert.match((await require('../lib/actions.ts')[name](...args)).error, /could not be found/);
  });
}

test('sign-in uses generic credential errors and refuses an unapproved account', async () => {
  mocks['next/navigation'] = { redirect };
  let signedOut = false;
  let authError = { message: 'sensitive upstream details' };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }) };
  mocks['@/lib/supabase/server'] = {
    isSupabaseConfigured: () => true,
    createSupabaseServerClient: async () => ({
      auth: {
        signInWithPassword: async (input) => { assert.deepEqual(input, { email: 'synthetic@example.test', password: 'test-password' }); return { data: { user: { id: 'unapproved' } }, error: authError }; },
        signOut: async () => { signedOut = true; return { error: null }; },
      },
      from: () => query,
    }),
  };
  const form = new FormData(); form.set('email', 'synthetic@example.test'); form.set('password', 'test-password');
  const { signInAction } = require('../lib/auth-actions.ts');
  await assert.rejects(() => signInAction(form), { message: 'REDIRECT:/login?error=credentials' });
  authError = null;
  await assert.rejects(() => signInAction(form), { message: 'REDIRECT:/login?error=access' });
  assert.equal(signedOut, true);
});

test('approved password sign-in and POST sign-out use fixed local redirects', async () => {
  mocks['next/navigation'] = { redirect };
  const invalidations = [];
  mocks['next/cache'] = { revalidatePath: (...args) => invalidations.push(args) };
  let signedOut = false;
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { id: 'tutor-a' }, error: null }) };
  mocks['@/lib/supabase/server'] = {
    isSupabaseConfigured: () => true,
    createSupabaseServerClient: async () => ({ auth: {
      signInWithPassword: async () => ({ data: { user: { id: 'tutor-a', is_anonymous: false } }, error: null }),
      signOut: async (options) => { assert.equal(options.scope, 'local'); signedOut = true; return { error: null }; },
    }, from: () => query }),
  };
  const form = new FormData(); form.set('email', 'synthetic@example.test'); form.set('password', 'test-password'); form.set('next', 'https://attacker.invalid');
  const { signInAction, signOutAction } = require('../lib/auth-actions.ts');
  await assert.rejects(() => signInAction(form), { message: 'REDIRECT:/dashboard' });
  assert.deepEqual(invalidations, [['/', 'layout']]);
  await assert.rejects(signOutAction, { message: 'REDIRECT:/login' });
  assert.equal(signedOut, true);
  assert.deepEqual(invalidations, [['/', 'layout'], ['/', 'layout']]);
});

test('middleware denies anonymous tutor routes, preserves refreshed cookies and excludes the preview', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  let user = null;
  mocks['@supabase/ssr'] = { createServerClient: (_url, _key, options) => ({ auth: {
    getUser: async () => {
      options.cookies.setAll([{ name: 'session', value: 'rotated', options: { path: '/' } }], { 'Cache-Control': 'private, no-store', 'Pragma': 'no-cache' });
      return { data: { user }, error: null };
    },
  } }) };
  const { NextRequest } = require('next/server');
  const { middleware, config } = require('../middleware.ts');
  assert.deepEqual(config.matcher, ['/login', '/learn/:path*', '/dashboard/:path*', '/students/:path*', '/plans/:path*', '/activities/:path*', '/dev/resource-studio/assign/:path*']);
  const response = await middleware(new NextRequest('http://localhost:3000/students/guessed-id'));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'http://localhost:3000/login');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.cookies.get('session').value, 'rotated');
  user = { id: 'tutor-a', is_anonymous: false };
  const allowed = await middleware(new NextRequest('http://localhost:3000/dashboard'));
  assert.equal(allowed.status, 200);
  assert.equal(allowed.cookies.get('session').value, 'rotated');
  assert.equal(allowed.headers.get('pragma'), 'no-cache');
});

test('server client reads/writes request cookies, uses public key and disables fetch caching', async () => {
  process.env.NODE_ENV = 'production';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'must-not-be-used';
  let options;
  const writes = [];
  mocks['next/headers'] = { cookies: async () => ({ getAll: () => [{ name: 'session', value: 'test' }], set: (...args) => writes.push(args) }) };
  mocks['@supabase/ssr'] = { createServerClient: (url, key, config) => { assert.equal(url, 'https://test.invalid'); assert.equal(key, 'public-test-key'); options = config; return {}; } };
  await require('../lib/supabase/server.ts').createSupabaseServerClient();
  assert.deepEqual(options.cookieOptions, { path: '/', sameSite: 'lax', secure: true });
  assert.deepEqual(options.cookies.getAll(), [{ name: 'session', value: 'test' }]);
  options.cookies.setAll([{ name: 'session', value: 'refreshed', options: { path: '/' } }]);
  assert.deepEqual(writes, [['session', 'refreshed', { path: '/' }]]);
  options.cookies.setAll([{ name: 'session', value: '', options: { path: '/', maxAge: 0 } }]);
  assert.deepEqual(writes[1], ['session', '', { path: '/', maxAge: 0 }]);
  const oldFetch = global.fetch;
  try {
    global.fetch = async (_input, init) => { assert.equal(init.cache, 'no-store'); return new Response(); };
    await options.global.fetch('https://test.invalid');
  } finally { global.fetch = oldFetch; }
});
