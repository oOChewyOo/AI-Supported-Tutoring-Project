const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite');
test('whole-week database atomicity, authorization, durable learner reads and immutability',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
 alter default privileges in schema public grant all on tables to anon,authenticated;`);
 for(const f of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8').replace('create extension if not exists pgcrypto;',''));
 const tutor=randomUUID(),other=randomUUID(),learner=randomUUID();
 await db.query('insert into auth.users values($1),($2),($3)',[tutor,other,learner]);await db.query('insert into tutors(id) values($1),($2)',[tutor,other]);
 async function role(r,id=tutor){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)",[id]);if(r)await db.exec('set role '+r);}
 await role('authenticated');
 const student=(await db.query("insert into students(name,year_group,subject_focus) values('Fictional','5','Maths') returning id")).rows[0].id;
 async function seed(){
  await role('authenticated');
  const reflection=(await db.query("insert into lesson_reflections(student_id,reflection_date,what_we_covered,what_went_well,what_needs_practice) values($1,current_date,'Fractions','Fractions','Fractions') returning id",[student])).rows[0].id;
  const objective=(await db.query("insert into extracted_objectives(student_id,lesson_reflection_id,focus_for_next_week) values($1,$2,ARRAY['Equivalent fractions']) returning id,updated_at::text",[student,reflection])).rows[0];
  const plan=(await db.query('select generate_placeholder_weekly_plan($1) id',[reflection])).rows[0].id;
  const sessions=(await db.query('select id from weekly_sessions where weekly_plan_id=$1 order by session_number',[plan])).rows.map(r=>r.id);
  return {plan,objective,sessions};
 }
 const owned=await seed(),occupied=await seed();await role(null);await db.exec('update practice_loop_private.resource_studio_settings set enabled=true');
 const item=()=>({schemaVersion:'1',proposalActivityId:'one',packageId:randomUUID(),activityId:randomUUID(),contentVersion:1,activityType:'arithmetic_input',integrity:'a'.repeat(64),releaseId:null,resourceVersion:null,purpose:'fluency',dose:'4 questions',estimatedMinutes:5,scoringMode:'automatic'});
 const groups=scope=>scope.sessions.map(sessionId=>({sessionId,proposalId:randomUUID(),rsProposalId:randomUUID(),objectiveKey:'focus_for_next_week:0',items:[item(),{...item(),proposalActivityId:'two'}]}));
 const proposal=randomUUID(),data=groups(owned);
 const approve=(g=data,p=proposal,who=tutor,s=owned)=>db.query('select approve_weekly_practice($1,$2,$3,$4,$5,$6::jsonb) v',[who,s.plan,p,s.objective.id,s.objective.updated_at,JSON.stringify(g)]).then(r=>r.rows[0].v);
 const counts=async()=>{await role(null);const result={};for(const table of ['weekly_practice_approvals','weekly_practice_batches','resource_approval_batches','resource_package_references','resource_session_assignments'])result[table]=(await db.query('select count(*)::int n from practice_loop_private.'+table)).rows[0].n;return result;};
 await t.test('client roles cannot send; service still checks tutor ownership',async()=>{
  for(const r of ['anon','authenticated']){await role(r);await assert.rejects(approve(),e=>e.code==='42501');}
  await role('service_role');await assert.rejects(approve(data,proposal,other),e=>e.code==='42501');
 });
 await t.test('invalid final session package rolls back every earlier batch/reference',async()=>{
  const bad=structuredClone(data);bad[4].items[1].integrity='invalid';await role('service_role');await assert.rejects(approve(bad));assert.ok(Object.values(await counts()).every(n=>n===0));
 });
 await t.test('mapping, objectives and time budgets are validated',async()=>{
  for(const mutate of [g=>g.pop(),g=>g[4].sessionId=g[0].sessionId,g=>g[4].sessionId=occupied.sessions[0],g=>g[4].objectiveKey='focus_for_next_week:99',g=>g[4].items[0].estimatedMinutes=25]){
   const g=structuredClone(data);mutate(g);await role('service_role');await assert.rejects(approve(g));assert.ok(Object.values(await counts()).every(n=>n===0));
  }
 });
 let initial;
 await t.test('one week, five linked batches and ten exact ordered assignments commit together',async()=>{
  await role('service_role');initial=await approve();assert.equal(initial.length,10);
  for(const g of data){const rows=initial.filter(a=>a.sessionId===g.sessionId);assert.deepEqual(rows.map(a=>a.position),[1,2]);assert.deepEqual(rows.map(a=>a.packageId),g.items.map(i=>i.packageId));}
  assert.deepEqual(await counts(),{weekly_practice_approvals:1,weekly_practice_batches:5,resource_approval_batches:5,resource_package_references:10,resource_session_assignments:10});
 });
 await t.test('same proposal idempotent even without review data; new proposal and fallback blocked',async()=>{
  await role('service_role');assert.deepEqual(await approve([]),initial);await assert.rejects(approve(data,randomUUID()),e=>e.code==='23505');
  const g=groups(owned)[0];await assert.rejects(db.query('select approve_resource_package_proposal($1,$2,$3,$4,$5,$6,$7::jsonb)',[tutor,owned.plan,g.sessionId,g.proposalId,g.rsProposalId,g.objectiveKey,JSON.stringify(g.items)]),e=>e.code==='23505');
 });
 await t.test('existing single-session assignments block whole-week replacement',async()=>{
  const g=groups(occupied);await role('service_role');await db.query('select approve_resource_package_proposal($1,$2,$3,$4,$5,$6,$7::jsonb)',[tutor,occupied.plan,g[0].sessionId,g[0].proposalId,g[0].rsProposalId,g[0].objectiveKey,JSON.stringify(g[0].items)]);
  await assert.rejects(approve(g,randomUUID(),tutor,occupied),e=>e.code==='23505');
 });
 await t.test('learner sees all five sessions with unchanged exact-package delivery',async()=>{
  await role(null);await db.query('insert into learner_accounts(auth_user_id,student_id) values($1,$2)',[learner,student]);await role('authenticated',learner);
  const plans=(await db.query('select get_learner_practice() v')).rows[0].v,p=plans.find(p=>p.id===owned.plan);assert.equal(p.sessions.length,5);
  for(const [i,s] of p.sessions.entries()){assert.equal(s.id,owned.sessions[i]);assert.equal(s.assignments.length,2);const a=s.assignments[0];const ref=(await db.query('select get_learner_delivery_reference($1,$2,$3) v',[owned.plan,s.id,a.id])).rows[0].v;assert.equal(ref.packageId,data[i].items[0].packageId);}
  assert.doesNotMatch(JSON.stringify(plans),/packageId|integrity|source|provenance|answer/);
 });
 await t.test('sent-week records cannot be updated/deleted, including privileged writes',async()=>{
  await role(null);for(const table of ['weekly_practice_approvals','weekly_practice_batches'])await assert.rejects(db.query('delete from practice_loop_private.'+table),e=>e.code==='42501');
  assert.equal((await db.query('select count(*)::int n from activity_results')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from activities')).rows[0].n,30);
 });
});
