const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

test('atomic durable proposal assignments in disposable PostgreSQL', async t => {
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
  await as(null,false,null); await db.exec('update practice_loop_private.resource_studio_settings set enabled=true');
  const types = ['drag_drop_matching','order_steps','arithmetic_input','multiple_choice','fill_gap','category_sort','sentence_builder','spot_mistake','short_written_response','explain_thinking','comprehension'];
  const items = types.map((activityType,i)=>({schemaVersion:'1',proposalActivityId:'item-'+i,packageId:randomUUID(),activityId:randomUUID(),contentVersion:1,activityType,integrity:'a'.repeat(64),releaseId:null,resourceVersion:null,purpose:'fluency',dose:'2 questions',estimatedMinutes:2,scoringMode:activityType==='comprehension'?'hybrid_review':['short_written_response','explain_thinking'].includes(activityType)?'manual_review':'automatic'}));
  const proposal=randomUUID(), rsProposal=randomUUID();
  const approve = (data=items,who=tutor,scope=owned,p=proposal,rp=rsProposal) => db.query('select approve_resource_package_proposal($1,$2,$3,$4,$5,$6,$7::jsonb) v',[who,scope.plan,scope.sessions[0],p,rp,'focus_for_next_week:0',JSON.stringify(data)]).then(r=>r.rows[0].v);
  const list = (who=tutor,plan=owned.plan) => db.query('select list_resource_package_assignments($1,$2) v',[who,plan]).then(r=>r.rows[0].v);
  const count = async table => (await db.query('select count(*)::int n from practice_loop_private.'+table)).rows[0].n;
  const rejects=(promise,code)=>assert.rejects(promise,e=>e.code===code);
  await t.test('ordinary tutors/anonymous cannot invoke service writes, reads or access private rows',async()=>{
    for(const role of ['anon','authenticated']) {
      await as(tutor,false,role); await rejects(approve(),'42501');await rejects(list(),'42501');
      for(const table of ['resource_approval_batches','resource_session_assignments']) {
        await rejects(db.query('select * from practice_loop_private.'+table),'42501');
        await rejects(db.query('insert into practice_loop_private.'+table+' default values'),'42501');
      }
    }
  });
  await t.test('database enforces tutor ownership, active approval, plan/session membership and feature flag',async()=>{
    await as(null,false,'service_role');
    await rejects(approve(items,other),'42501');await rejects(list(other),'42501');
    await rejects(approve(items,tutor,{plan:owned.plan,sessions:foreign.sessions}),'42501');
    await rejects(approve(items,tutor,{plan:owned.plan,sessions:another.sessions}),'42501');
    await as(null,false,null); await db.query('update tutors set active=false where id=$1',[tutor]);
    await as(null,false,'service_role');await rejects(approve(),'42501');
    await as(null,false,null); await db.query('update tutors set active=true where id=$1',[tutor]);
  });
  await t.test('second invalid reference rolls back approval batch, prepared refs and assignments atomically',async()=>{
    const broken=structuredClone(items);broken[1].integrity='invalid';
    await as(null,false,'service_role');await rejects(approve(broken),'23514');
    await as(null,false,null);
    for(const table of ['resource_approval_batches','resource_session_assignments','resource_package_references']) assert.equal(await count(table),0);
  });
  let initial;
  await t.test('all eleven exact packages persist in proposal order, idempotent duplicate click returns same rows',async()=>{
    await as(null,false,'service_role');initial=await approve();assert.equal(initial.length,11);assert.deepEqual(await approve(),initial);
    assert.deepEqual(initial.map(r=>r.activityType),types);assert.deepEqual(initial.map(r=>r.position),types.map((_,i)=>i+1));
    assert.deepEqual(initial.map(r=>r.packageId),items.map(r=>r.packageId));assert.ok(initial.every(r=>r.integrity==='a'.repeat(64)));
    assert.doesNotMatch(JSON.stringify(initial),/Twinkl|Oak|provider|sourceUrl|attribution|provenance|licence|license|sourceItemIds|answers|payload/);
    await as(null,false,null);assert.equal(await count('resource_approval_batches'),1);assert.equal(await count('resource_session_assignments'),11);
    const refs=(await db.query('select * from practice_loop_private.resource_package_references')).rows;
    assert.equal(refs.length,11);assert.ok(refs.every(r=>r.content_version===1));
  });
  await t.test('assignment and reference immutability and constrained positions',async()=>{
    for(const table of ['resource_approval_batches','resource_session_assignments']) {
      await rejects(db.query('delete from practice_loop_private.'+table),'42501');
      const flags=(await db.query('select relrowsecurity,relforcerowsecurity from pg_class where oid=$1::regclass',['practice_loop_private.'+table])).rows[0];
      assert.deepEqual(flags,{relrowsecurity:true,relforcerowsecurity:true});
    }
    await rejects(db.query('update practice_loop_private.resource_session_assignments set position=2'),'42501');
    await rejects(db.query('insert into practice_loop_private.resource_session_assignments(batch_id,plan_id,session_id,reference_id,position,purpose,dose,estimated_minutes) select batch_id,plan_id,session_id,reference_id,0,purpose,dose,estimated_minutes from practice_loop_private.resource_session_assignments limit 1'),'23514');
  });
  await t.test('mismatched previously prepared package cannot be adopted into another proposal',async()=>{
    await as(null,false,'service_role');await rejects(approve(items,tutor,owned,randomUUID(),randomUUID()),'22023');
    assert.deepEqual(await list(),initial);
  });
  await t.test('a rebuilt proposal creates its own batch without changing existing assignments or legacy evidence',async()=>{
    const rebuilt=items.slice(0,2).map(i=>({...i,packageId:randomUUID()}));
    await as(null,false,'service_role');assert.equal((await approve(rebuilt,tutor,owned,randomUUID(),randomUUID())).length,13);
    await as(null,false,null);assert.equal(await count('resource_approval_batches'),2);
    assert.equal((await db.query('select count(*)::int n from activities')).rows[0].n,45);
    assert.equal((await db.query('select count(*)::int n from activities where resource_studio_assigned or content_json is not null')).rows[0].n,0);
    for(const table of ['resource_studio_assignments','resource_studio_attempts','resource_session_selections'])assert.equal(await count(table),0);
    assert.equal((await db.query('select count(*)::int n from activity_results')).rows[0].n,0);
  });
});
