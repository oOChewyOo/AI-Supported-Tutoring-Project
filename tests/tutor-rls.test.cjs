const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

// Real PostgreSQL RLS in an ephemeral WASM database. No network or .env is used.
const tables = ['students', 'lesson_reflections', 'extracted_objectives', 'weekly_plans', 'weekly_sessions', 'activities', 'activity_results'];
test('full migration history: tutor ownership, quarantine, grants and RPC', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
  `);
  const migrations = fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const security = '202609220001_tutor_auth_ownership.sql';
  assert.ok(migrations.includes(security));
  for (const file of migrations.filter(file => file < security)) {
    // gen_random_uuid is built in. pgcrypto extension packaging is not part of PGlite.
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8').replace('create extension if not exists pgcrypto;', ''));
  }
  const legacyId = randomUUID();
  await db.query(`insert into students(id,name,year_group,subject_focus) values ($1,'Synthetic legacy','Test','Test')`, [legacyId]);
  const legacyReflection = randomUUID();
  await db.query(`insert into lesson_reflections(id,student_id,reflection_date,what_we_covered,what_went_well,what_needs_practice) values ($1,$2,current_date,'Test','Test','Test')`, [legacyReflection, legacyId]);
  await db.query('select generate_placeholder_weekly_plan($1)', [legacyReflection]);
  // Simulate an extra permissive policy from database drift: cutover must remove it too.
  await db.exec('create policy stray_public_policy on activities for all to public using (true) with check (true)');
  await db.exec(fs.readFileSync(`supabase/migrations/${security}`, 'utf8'));
  for (const file of migrations.filter(file => file > security)) {
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }

  const a = randomUUID(), b = randomUUID(), unapproved = randomUUID();
  await db.query('insert into auth.users values ($1),($2),($3)', [a, b, unapproved]);
  await db.query('insert into tutors(id) values ($1),($2)', [a, b]);
  async function as(role, id = '', anonymous = false) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)", [id, JSON.stringify({ sub: id, is_anonymous: anonymous })]);
    if (role) await db.exec(`set role ${role}`);
  }
  const denied = (sql, params = []) => assert.rejects(db.query(sql, params), (e) => e.code === '42501');
  async function insert(table, row) {
    const keys = Object.keys(row);
    return db.query(`insert into ${table} (${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, Object.values(row));
  }
  async function seedTutor(id) {
    await as('authenticated', id);
    const student = (await insert('students', { name: 'Synthetic test', year_group: 'Test', subject_focus: 'Test' })).rows[0];
    const reflection = (await insert('lesson_reflections', { student_id: student.id, reflection_date: '2026-09-22', what_we_covered: 'Test', what_went_well: 'Test', what_needs_practice: 'Test' })).rows[0];
    const objectives = (await insert('extracted_objectives', { student_id: student.id, lesson_reflection_id: reflection.id })).rows[0];
    const planId = (await db.query('select generate_placeholder_weekly_plan($1) as id', [reflection.id])).rows[0].id;
    const plan = (await db.query('select * from weekly_plans where id=$1', [planId])).rows[0];
    const session = (await db.query('select * from weekly_sessions where weekly_plan_id=$1 order by session_number', [planId])).rows[0];
    const activity = (await db.query('select * from activities where weekly_session_id=$1 order by position', [session.id])).rows[0];
    const result = (await insert('activity_results', { student_id: student.id, activity_id: activity.id })).rows[0];
    return { students: student, lesson_reflections: reflection, extracted_objectives: objectives, weekly_plans: plan, weekly_sessions: session, activities: activity, activity_results: result };
  }
  const owned = await seedTutor(a), foreign = await seedTutor(b);

  await t.test('legacy rows retain NULL ownership and all descendants remain inaccessible', async () => {
    await as(null);
    assert.equal((await db.query('select owner_tutor_id from students where id=$1', [legacyId])).rows[0].owner_tutor_id, null);
    await as('authenticated', a);
    assert.equal((await db.query('select * from students where id=$1', [legacyId])).rows.length, 0);
    assert.equal((await db.query('select * from weekly_plans where lesson_reflection_id=$1', [legacyReflection])).rows.length, 0);
    await denied('select generate_placeholder_weekly_plan($1)', [legacyReflection]);
    assert.equal((await db.query('update students set owner_tutor_id=$1 where id=$2 returning id', [a, legacyId])).rows.length, 0);
  });

  for (const table of tables) {
    await t.test(`${table}: anonymous CRUD denied; A cannot read/update/delete/insert B's rows`, async () => {
      await as('anon');
      for (const sql of [`select * from ${table}`, `update ${table} set id=id`, `delete from ${table}`, `insert into ${table}(id) values (gen_random_uuid())`]) await denied(sql);
      await as('authenticated', a);
      assert.equal((await db.query(`select * from ${table} where id=$1`, [foreign[table].id])).rows.length, 0);
      assert.equal((await db.query(`update ${table} set id=id where id=$1 returning id`, [foreign[table].id])).rows.length, 0);
      assert.equal((await db.query(`delete from ${table} where id=$1 returning id`, [foreign[table].id])).rows.length, 0);
      assert.equal((await db.query(`select * from ${table} where id=$1`, [owned[table].id])).rows.length, 1);
      assert.equal((await db.query(`update ${table} set id=id where id=$1 returning id`, [owned[table].id])).rows.length, 1);
      const row = { ...foreign[table], id: randomUUID() };
      delete row.created_at; delete row.updated_at;
      // Convert JSON content only if needed (the placeholder fixture is null).
      await assert.rejects(insert(table, row), (e) => e.code === '42501');
      await as('authenticated', b);
      assert.equal((await db.query(`select * from ${table} where id=$1`, [owned[table].id])).rows.length, 0);
    });
  }

  await t.test('WITH CHECK blocks ownership transfer and foreign parent relinking on all tables', async () => {
    await as('authenticated', a);
    const links = {
      students: ['owner_tutor_id', b],
      lesson_reflections: ['student_id', foreign.students.id],
      extracted_objectives: ['lesson_reflection_id', foreign.lesson_reflections.id],
      weekly_plans: ['lesson_reflection_id', foreign.lesson_reflections.id],
      weekly_sessions: ['weekly_plan_id', foreign.weekly_plans.id],
      activities: ['weekly_session_id', foreign.weekly_sessions.id],
      activity_results: ['activity_id', foreign.activities.id],
    };
    for (const [table, [column, value]] of Object.entries(links)) await denied(`update ${table} set ${column}=$1 where id=$2`, [value, owned[table].id]);
    await denied('update students set owner_tutor_id=null where id=$1', [owned.students.id]);
  });

  await t.test('same-tutor mismatched student/reflection/activity links are rejected', async () => {
    await as('authenticated', a);
    const other = (await insert('students', { name: 'Synthetic other', year_group: 'Test', subject_focus: 'Test' })).rows[0];
    for (const table of ['extracted_objectives', 'weekly_plans', 'activity_results']) {
      await denied(`update ${table} set student_id=$1 where id=$2`, [other.id, owned[table].id]);
    }
    assert.equal((await db.query('delete from students where id=$1 returning id', [other.id])).rows.length, 1);
  });

  await t.test('completion UPSERT cannot overwrite another tutor result and works for the owner', async () => {
    await as('authenticated', a);
    const sql = `insert into activity_results(activity_id,student_id,completed) values ($1,$2,true)
      on conflict(activity_id,student_id) do update set completed=excluded.completed returning completed`;
    await denied(sql, [foreign.activities.id, foreign.students.id]);
    assert.equal((await db.query(sql, [owned.activities.id, owned.students.id])).rows[0].completed, true);
  });

  await t.test('RPC denies anonymous/foreign IDs, is idempotent for owner, and creates 5 sessions/15 activities', async () => {
    await as('anon');
    await denied('select generate_placeholder_weekly_plan($1)', [owned.lesson_reflections.id]);
    await as('authenticated', b);
    await denied('select generate_placeholder_weekly_plan($1)', [owned.lesson_reflections.id]);
    await as('authenticated', a);
    assert.equal((await db.query('select generate_placeholder_weekly_plan($1) as id', [owned.lesson_reflections.id])).rows[0].id, owned.weekly_plans.id);
    assert.equal((await db.query('select count(*)::int as n from weekly_sessions')).rows[0].n, 5);
    assert.equal((await db.query('select count(*)::int as n from activities')).rows[0].n, 15);
    await denied('select generate_placeholder_weekly_plan($1)', [randomUUID()]);
  });

  await t.test('unapproved, missing-identity and anonymous Auth users cannot access learner data or RPC', async () => {
    for (const [id, anonymous] of [[unapproved, false], ['', false], [a, true]]) {
      await as('authenticated', id, anonymous);
      for (const table of tables) assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
      await denied('select generate_placeholder_weekly_plan($1)', [owned.lesson_reflections.id]);
      await denied("insert into students(name,year_group,subject_focus) values ('Test','Test','Test')");
    }
  });

  await t.test('tutors cannot grant themselves membership or reactivate accounts; revocation blocks all descendants', async () => {
    await as('authenticated', a);
    await denied('insert into tutors(id) values ($1)', [unapproved]);
    await denied('update tutors set active=true where id=$1', [a]);
    assert.deepEqual((await db.query('select id from tutors')).rows, [{ id: a }]);
    await as(null);
    await db.query('update tutors set active=false where id=$1', [a]);
    await as('authenticated', a);
    for (const table of tables) assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
    await denied('select generate_placeholder_weekly_plan($1)', [owned.lesson_reflections.id]);
  });

  await t.test('catalog audit: only scoped policies remain and RPC is invoker with fixed search path', async () => {
    await as(null);
    const policies = (await db.query("select tablename, policyname, roles from pg_policies where schemaname='public'")).rows;
    assert.equal(policies.length, 8);
    assert.ok(policies.every((p) => p.roles.length === 1 && p.roles[0] === 'authenticated'));
    const rpc = (await db.query("select prosecdef, proconfig from pg_proc where proname='generate_placeholder_weekly_plan'")).rows[0];
    assert.equal(rpc.prosecdef, false);
    assert.ok(rpc.proconfig.some((value) => value.startsWith('search_path=')));
  });
});
