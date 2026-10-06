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

  await t.test('learner practice is auth-bound, ordered, read-only and rejects swapped IDs',async()=>{
    await as(null,false,null);
    const learner=randomUUID(), otherLearner=randomUUID();
    await db.query('insert into auth.users values($1),($2)',[learner,otherLearner]);
    await db.query('insert into learner_accounts(auth_user_id,student_id) select $1,student_id from weekly_plans where id=$2',[learner,owned.plan]);
    await db.query('insert into learner_accounts(auth_user_id,student_id) select $1,student_id from weekly_plans where id=$2',[otherLearner,foreign.plan]);
    const read=()=>db.query('select get_learner_practice() v').then(r=>r.rows[0].v);
    const ref=(plan=owned.plan,session=owned.sessions[0],assignment=initial[0].id)=>db.query('select get_learner_delivery_reference($1,$2,$3) v',[plan,session,assignment]).then(r=>r.rows[0].v);
    await as(learner);const plans=await read();assert.equal(plans.length,1);assert.equal(plans[0].id,owned.plan);
    assert.deepEqual(plans[0].sessions[0].assignments.map(a=>a.activityType),types);
    assert.doesNotMatch(JSON.stringify(plans),/packageId|integrity|source|provenance|expectedAnswer/);
    assert.deepEqual(await ref(),{packageId:items[0].packageId,integrity:items[0].integrity});
    await rejects(ref(foreign.plan),'42501');await rejects(ref(owned.plan,foreign.sessions[0]),'42501');
    await rejects(ref(owned.plan,owned.sessions[0],randomUUID()),'42501');
    await rejects(ref(owned.plan,owned.sessions[0],items[0].packageId),'42501');
    await rejects(db.query('select list_resource_package_assignments($1,$2)',[tutor,owned.plan]),'42501');
    assert.equal((await db.query('select * from students')).rows.length,0);
    await as(otherLearner);await rejects(ref(),'42501');
    for(const id of [tutor,inactive]){await as(id);await rejects(read(),'42501');await rejects(ref(),'42501');}
    await as(learner,true);await rejects(read(),'42501');await rejects(ref(),'42501');
    await as(null,false,null);await db.query('update learner_accounts set active=false where auth_user_id=$1',[learner]);
    await as(learner);await rejects(read(),'42501');await rejects(ref(),'42501');
    await as(null,false,null);
    assert.equal(await count('resource_studio_attempts'),0);
  });

  await t.test('durable all-type submissions: service-only, idempotent, isolated, immutable and separate from legacy',async()=>{
    await as(null,false,null);
    const learner=(await db.query('select auth_user_id from learner_accounts l join weekly_plans p on p.student_id=l.student_id where p.id=$1',[owned.plan])).rows[0].auth_user_id;
    await db.query('update learner_accounts set active=true where auth_user_id=$1',[learner]);
    const read=()=>db.query('select get_practice_submission_report($1) v',[owned.plan]).then(r=>r.rows[0].v);
    function checked(i){const type=types[i],manual=['short_written_response','explain_thinking'].includes(type),pending=manual||['spot_mistake','comprehension'].includes(type);return {schemaVersion:'submission-1',activityType:type,contentVersion:1,responses:{synthetic:'Learner response'},result:{mode:manual?'manual':type==='comprehension'?'hybrid':'automatic',earned:manual?null:1,possible:manual?null:2,reviewStatus:pending?'pending':'not_required',items:[{id:'synthetic',prompt:'Explain your choice',response:'Learner response',reviewRequired:pending}]}};}
    const save=(i=0,who=learner,session=owned.sessions[0],integrity=items[i].integrity,value=checked(i))=>db.query('select save_practice_submission($1,$2,$3,$4,$5,$6,$7::jsonb) id',[who,owned.plan,session,initial[i].id,items[i].packageId,integrity,JSON.stringify(value)]).then(r=>r.rows[0].id);
    for(const role of ['anon','authenticated']){await as(learner,false,role);await rejects(save(),'42501');await rejects(db.query('select * from practice_loop_private.resource_practice_submissions'),'42501');}
    await as(learner);assert.equal((await read()).filter(r=>r.attemptId).length,0);
    await as(other);await rejects(read(),'42501');
    await as(null,false,'service_role');await rejects(save(0,tutor),'42501');await rejects(save(0,learner,foreign.sessions[0]),'42501');await rejects(save(0,learner,owned.sessions[0],'b'.repeat(64)),'22023');
    const first=await save();assert.equal(await save(),first);const changed=checked(0);changed.responses.synthetic='Changed retry';assert.equal(await save(0,learner,owned.sessions[0],items[0].integrity,changed),first);
    await as(learner);let rows=await read();assert.equal(rows.filter(r=>r.attemptId).length,1);assert.equal(rows[0].response.synthetic,'Learner response');assert.ok(rows.some(r=>!r.attemptId));
    await as(null,false,'service_role');for(let i=1;i<types.length;i++)await save(i);
    await as(learner);rows=await read();assert.ok(rows.every(r=>r.attemptId));assert.equal(rows.length,11);assert.equal(rows.find(r=>r.activityType==='short_written_response').result.earned,null);assert.equal(rows.find(r=>r.activityType==='explain_thinking').result.reviewStatus,'pending');assert.equal(rows.find(r=>r.activityType==='comprehension').result.mode,'hybrid');
    await as(tutor);assert.deepEqual(await read(),rows);assert.doesNotMatch(JSON.stringify(rows),/provider|sourceUrl|provenance|integrity|packageId|correctOption|expectedAnswer/);
    await as(null,false,null);await rejects(db.query('update practice_loop_private.resource_practice_submissions set response=$1::jsonb',['{}']),'42501');
    assert.equal(await count('resource_practice_submissions'),11);assert.equal(await count('resource_studio_attempts'),0);assert.equal((await db.query('select count(*)::int n from activity_results')).rows[0].n,0);
    await db.query('update learner_accounts set active=false where auth_user_id=$1',[learner]);await as(learner);await rejects(read(),'42501');await as(null,false,'service_role');await rejects(save(),'42501');await as(null,false,null);
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
