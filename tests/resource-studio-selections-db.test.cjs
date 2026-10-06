const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

test('session selections in disposable in-memory PostgreSQL (not live Supabase)', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
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
  const tutor = randomUUID(), other = randomUUID(), inactive = randomUUID();
  await db.query('insert into auth.users values ($1),($2),($3)', [tutor,other,inactive]);
  await db.query('insert into tutors(id) values ($1),($2)', [tutor,other]);
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
    const sessions = (await db.query('select id from weekly_sessions where weekly_plan_id=$1 order by session_number',[plan])).rows.map(r => r.id);
    return { plan, sessions };
  }
  const owned = await seed(tutor), foreign = await seed(other), another = await seed(tutor);
  const add = (source = 'mcq-a', version = 7, title = 'Validated title', scope = owned, fictional = true) =>
    db.query('select add_resource_session_selection($1,$2,$3,$4,$5,$6) v', [scope.plan,scope.sessions[0],fictional,source,version,title]).then(r => r.rows[0].v);
  const list = (scope = owned, fictional = true) => db.query('select list_resource_session_selections($1,$2,$3) v',[scope.plan,scope.sessions[0],fictional]).then(r => r.rows[0].v);
  const remove = (id, scope = owned, fictional = true) => db.query('select remove_resource_session_selection($1,$2,$3,$4) v',[scope.plan,scope.sessions[0],id,fictional]).then(r => r.rows[0].v);
  const rejects = (p, code) => assert.rejects(p, e => e.code === code);
  await t.test('flag disabled by default and cannot be changed by a tutor', async () => {
    await as(tutor); await rejects(list(),'55000'); await rejects(add(),'55000'); await rejects(remove(randomUUID()),'55000');
    await rejects(db.query('update practice_loop_private.resource_studio_settings set enabled=true'),'42501');
    await as(null,false,null); await db.exec('update practice_loop_private.resource_studio_settings set enabled=true');
  });
  await t.test('RPCs independently reject foreign, absent, anonymous and unapproved identities', async () => {
    for (const [id, anonymous, role] of [[other,false,'authenticated'],[inactive,false,'authenticated'],[tutor,true,'authenticated'],[null,false,'authenticated'],[null,false,'anon']]) {
      await as(id,anonymous,role);
      await rejects(list(),'42501'); await rejects(add(),'42501'); await rejects(remove(randomUUID()),'42501');
    }
    await as(null,false,null); await db.query('update tutors set active=false where id=$1',[tutor]);
    await as(tutor);
    await rejects(list(),'42501'); await rejects(add(),'42501'); await rejects(remove(randomUUID()),'42501');
    await as(null,false,null); await db.query('update tutors set active=true where id=$1',[tutor]);
  });
  await t.test('session membership and strict fictional confirmation enforced in SQL', async () => {
    await as(tutor);
    for (const scope of [{ plan: owned.plan, sessions: foreign.sessions }, { plan: owned.plan, sessions: another.sessions }, { plan: owned.plan, sessions: [randomUUID()] }]) {
      await rejects(list(scope),'42501'); await rejects(add('a',1,'Title',scope),'42501'); await rejects(remove(randomUUID(),scope),'42501');
    }
    for (const f of [false,null]) {
      await rejects(list(owned,f),'42501'); await rejects(add('a',1,'Title',owned,f),'42501'); await rejects(remove(randomUUID(),owned,f),'42501');
    }
  });
  let first;
  await t.test('metadata-only insert, idempotence, version conflict and chronological order', async () => {
    first = await add(); assert.equal(first.length,1); assert.equal(first[0].selected_by,tutor);
    assert.deepEqual(await add('mcq-a',7,'Changed client title'),first);
    await rejects(add('mcq-a',8),'23505'); assert.deepEqual(await list(),first);
    const multiple = await add('mcq-b'); assert.deepEqual(multiple.map(r => r.source_activity_id),['mcq-a','mcq-b']);
    assert.doesNotMatch(JSON.stringify(multiple),/questions|answers|snapshot|correctOptionIds/);
    assert.deepEqual(Object.keys(first[0]).sort(),['activity_type','id','selected_at','selected_by','source_activity_id','source_version','title','weekly_session_id']);
    assert.equal((await add('mcq-a',7,'Title',another)).length,1);
  });
  await t.test('malformed references and titles rejected without writes', async () => {
    for (const args of [['../bad',7],['a',0],['a',null],['a',7,''],['a',7,'x'.repeat(20001)]]) await rejects(add(...args),'22023');
    await rejects(add('a',2147483648),'22003'); assert.equal((await list()).length,2);
  });
  await t.test('no direct private reads, inserts, updates, deletes or helper calls', async () => {
    for (const sql of [
      'select * from practice_loop_private.resource_session_selections',
      'delete from practice_loop_private.resource_session_selections',
      'update practice_loop_private.resource_session_selections set source_version=8',
      'insert into practice_loop_private.resource_session_selections default values',
      `select practice_loop_private.assert_resource_session_owner('${owned.plan}','${owned.sessions[0]}',true)`,
    ]) await rejects(db.query(sql),'42501');
  });
  await t.test('removal is idempotent, scoped and permits explicit version replacement', async () => {
    assert.equal((await remove(first[0].id,another)).length,1); assert.equal((await list()).length,2);
    await remove(first[0].id); assert.equal((await remove(first[0].id)).length,1);
    const replaced = await add('mcq-a',8); assert.equal(replaced[1].source_version,8);
  });
  await t.test('selection writes leave learner slots, assignments, attempts and results untouched', async () => {
    await as(null,false,null);
    assert.equal(Number((await db.query('select count(*) n from activities')).rows[0].n),45);
    assert.equal(Number((await db.query('select count(*) n from activities where resource_studio_assigned or content_json is not null')).rows[0].n),0);
    for (const table of ['public.activity_results','practice_loop_private.resource_studio_assignments','practice_loop_private.resource_studio_attempts']) {
      assert.equal(Number((await db.query(`select count(*) n from ${table}`)).rows[0].n),0);
    }
    const flags = (await db.query("select relrowsecurity,relforcerowsecurity from pg_class where oid='practice_loop_private.resource_session_selections'::regclass")).rows[0];
    assert.deepEqual(flags,{relrowsecurity:true,relforcerowsecurity:true});
  });
  await t.test('deleting a session cascades only its planning references', async () => {
    await db.query('delete from weekly_sessions where id=$1',[owned.sessions[0]]);
    assert.equal(Number((await db.query('select count(*) n from practice_loop_private.resource_session_selections where weekly_session_id=$1',[owned.sessions[0]])).rows[0].n),0);
    assert.equal(Number((await db.query('select count(*) n from practice_loop_private.resource_session_selections')).rows[0].n),1);
  });
});
