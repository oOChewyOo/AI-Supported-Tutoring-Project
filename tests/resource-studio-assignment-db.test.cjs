const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { parseResourceActivity } = require('../lib/resource-studio/activity.ts');
const fixture = require('./fixtures/resource-studio-activity.json');

test('Resource Studio private snapshots and server scoring in real PostgreSQL', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
    alter default privileges in schema public grant all on tables to anon,authenticated;
  `);
  for (const f of fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8').replace('create extension if not exists pgcrypto;', ''));
  }
  const a = randomUUID(), b = randomUUID(), unapproved = randomUUID();
  await db.query('insert into auth.users values ($1),($2),($3)', [a,b,unapproved]);
  await db.query('insert into tutors(id) values ($1),($2)', [a,b]);
  async function as(id, anonymous = false, role = 'authenticated') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [id ?? '', JSON.stringify({ is_anonymous: anonymous })]);
    if (role) await db.exec('set role ' + role);
  }
  async function seed(id) {
    await as(id);
    const student = (await db.query("insert into students(name,year_group,subject_focus) values ('Fictional','Test','Maths') returning id")).rows[0].id;
    const reflection = (await db.query("insert into lesson_reflections(student_id,reflection_date,what_we_covered,what_went_well,what_needs_practice) values ($1,current_date,'Test','Test','Fractions') returning id", [student])).rows[0].id;
    const plan = (await db.query('select generate_placeholder_weekly_plan($1) id',[reflection])).rows[0].id;
    const activities = (await db.query('select a.id from activities a join weekly_sessions s on s.id=a.weekly_session_id where s.weekly_plan_id=$1 order by s.session_number,a.position',[plan])).rows.map(r => r.id);
    return { student, plan, activities };
  }
  const owned = await seed(a), foreign = await seed(b);
  const snapshot = parseResourceActivity(fixture);
  const assign = (id, value = snapshot) => db.query('select assign_resource_studio_activity($1,$2::jsonb)', [id,JSON.stringify(value)]);
  const read = async id => (await db.query('select get_resource_studio_exercise($1) v',[id])).rows[0].v;
  const check = async (id, answers) => (await db.query('select check_resource_studio_answers($1,$2::jsonb) v',[id,JSON.stringify(answers)])).rows[0].v;
  const rejects = (promise, code) => assert.rejects(promise, e => e.code === code);

  await t.test('disabled by default; ordinary tutors cannot enable the integration', async () => {
    await as(a);
    await rejects(assign(owned.activities[0]), '55000');
    await rejects(db.query('update practice_loop_private.resource_studio_settings set enabled=true'), '42501');
    await as(null,false,null);
    await db.exec('update practice_loop_private.resource_studio_settings set enabled=true');
  });
  await t.test('foreign, unapproved, anonymous and absent identities cannot assign, read or score', async () => {
    for (const [id, anonymous, role] of [[b,false,'authenticated'],[unapproved,false,'authenticated'],[a,true,'authenticated'],['',false,'authenticated'],['',false,'anon']]) {
      await as(id,anonymous,role);
      await rejects(assign(owned.activities[0]), '42501');
      await rejects(read(owned.activities[0]), '42501');
      await rejects(check(owned.activities[0],{}), '42501');
    }
  });
  await t.test('invalid content is rejected without consuming the placeholder', async () => {
    await as(a);
    for (const mutate of [s => { s.id='wrong'; },s => { s.contentVersion=1.5; },s => { s.questions[0].correctOptionIds=['unknown']; },s => { s.questions[0].options=[]; },s => { s.questions[0].correctOptionIds=['q1-a','q1-a']; },s => { delete s.instructions; }]) {
      const invalid=structuredClone(snapshot); mutate(invalid);
      await rejects(assign(owned.activities[0],invalid),'22023');
    }
    assert.equal(await read(owned.activities[0]),null);
  });
  await t.test('assignment affects one slot, keeps private keys, and preserves its source version', async () => {
    await as(a);
    await assign(owned.activities[0]);
    const view=await read(owned.activities[0]);
    assert.equal(view.id,snapshot.id); assert.equal(view.contentVersion,1);
    assert.equal(view.questions[2].multiple,true);
    assert.equal(view.questions[0].multiple,false);
    assert.doesNotMatch(JSON.stringify(view), /correctOptionIds|correctFeedback|incorrectFeedback|generalCorrect|explanation/);
    const rows=(await db.query('select resource_studio_assigned,content_json,template_id from activities')).rows;
    assert.equal(rows.filter(r=>r.resource_studio_assigned).length,1);
    assert.ok(rows.every(r=>r.content_json===null && r.template_id===null));
    for (const sql of ['select snapshot from practice_loop_private.resource_studio_assignments','delete from practice_loop_private.resource_studio_assignments','update practice_loop_private.resource_studio_assignments set source_version=2']) await rejects(db.query(sql),'42501');
    const later=structuredClone(snapshot);later.contentVersion=2;later.title='Later publication';
    await rejects(assign(owned.activities[0],later),'23505');
    assert.deepEqual(await read(owned.activities[0]),view);
    await rejects(db.query('update activities set resource_studio_assigned=false where id=$1',[owned.activities[0]]),'23514');
    await rejects(db.query("update activities set content_json='{}' where id=$1",[owned.activities[0]]),'23514');
    await as(b);
    await rejects(read(owned.activities[0]),'42501');
    await rejects(assign(owned.activities[0]),'42501');
    assert.equal(await read(foreign.activities[0]),null);
    await as(null,false,null);
    const saved=(await db.query('select source_activity_id,source_version,snapshot from practice_loop_private.resource_studio_assignments')).rows[0];
    assert.equal(saved.source_activity_id,snapshot.id);assert.equal(Number(saved.source_version),1);assert.deepEqual(saved.snapshot,snapshot);
    await rejects(db.query('update practice_loop_private.resource_studio_assignments set source_version=2'),'42501');
  });
  await t.test('generated content and completion records are not overwritten', async () => {
    await as(a);
    await db.query("update activities set content_json='{}' where id=$1",[owned.activities[1]]);
    await rejects(assign(owned.activities[1]),'23514');
    await db.query('insert into activity_results(activity_id,student_id) values ($1,$2)',[owned.activities[2],owned.student]);
    await rejects(assign(owned.activities[2]),'23514');
  });
  await t.test('scoring is exact, uses the saved version and does not persist answers or completion', async () => {
    await as(a);
    const answers=Object.fromEntries(snapshot.questions.map(q=>[q.id,[...q.correctOptionIds].reverse()]));
    const count=Number((await db.query('select count(*) n from activity_results')).rows[0].n);
    const result=await check(owned.activities[0],answers);
    assert.equal(result.score,5);assert.equal(result.total,5);
    assert.doesNotMatch(JSON.stringify(result),/correctOptionIds/);
    for(const incorrect of [[],['q3-a'],['q3-a','q3-b','q3-c'],['q3-a','q3-a'],['unknown']]) {
      assert.equal((await check(owned.activities[0],{...answers,q3:incorrect})).score,4);
    }
    await rejects(check(owned.activities[0],{forged:['q1-a']}),'22023');
    await rejects(check(owned.activities[0],{q1:'q1-a'}),'22023');
    assert.equal(Number((await db.query('select count(*) n from activity_results')).rows[0].n),count);
    await as(b);await rejects(check(owned.activities[0],answers),'42501');
  });
  await t.test('deactivation denies all new RPCs despite a valid session', async () => {
    await as(null,false,null);await db.query('update tutors set active=false where id=$1',[a]);
    await as(a);await rejects(read(owned.activities[0]),'42501');await rejects(check(owned.activities[0],{}),'42501');await rejects(assign(owned.activities[3]),'42501');
  });
});
