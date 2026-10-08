const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {buildWeeklyPracticePlan:build,validateWeeklyPracticePlan:validate}=require('../lib/weekly-practice-planner.ts');
const sessions=Array.from({length:5},(_,i)=>({id:`00000000-0000-4000-8000-00000000000${i}`,sessionNumber:i+1,durationMinutes:15}));
const objective='Complete and recognise equivalent fractions and avoid common errors when identifying equivalent fractions.';
const row={focus_for_next_week:[objective],developing_objectives:[objective],possible_misconceptions:['changes only numerator or denominator'],secure_objectives:['Recall multiplication facts'],suggested_retrieval_items:['Factor and multiple vocabulary'],learnerName:'PRIVATE',rawReflection:'PRIVATE'};
const pick=(key='focus_for_next_week:0',priority='normal',misconceptionIndexes=[])=>({key,priority,misconceptionIndexes});
const run=(r=row,s=[pick(undefined,'high',[0])],ss=sessions)=>build(r,s,ss,'Maths','5');
test('five existing sessions, stable ordering, deterministic educational-only requests',()=>{
 const a=run(),b=run(row,undefined,[...sessions].reverse());assert.deepEqual(a,b);assert.deepEqual(a.sessions.map(s=>s.id),sessions.map(s=>s.id));
 for(const s of a.sessions){assert.equal(s.needs.length,1);assert.equal(s.needs[0].request.durationMinutes,13);assert.deepEqual(Object.keys(s.needs[0].request),['subject','year','objective','durationMinutes','intents']);}
 assert.doesNotMatch(JSON.stringify(a),/PRIVATE|learnerName|rawReflection|source|activityType/);
});
test('fractions revisits retrieval and misconception without automatically over-progressing',()=>{
 const needs=run().sessions.flatMap(s=>s.needs).map(n=>n.request);assert.ok(new Set(needs.map(n=>JSON.stringify(n))).size>=3);
 assert.ok(needs[0].intents.includes('retrieval'));assert.ok(needs[2].intents.includes('misconception_check'));assert.match(needs[2].objective,/changes only numerator/);
 assert.ok(needs[4].intents.includes('retrieval'));assert.ok(needs.every(n=>!n.intents.includes('reasoning')&&!n.intents.includes('application')));
});
test('secure maintenance is lighter and intervenes between high priority developing exposures',()=>{
 const s=run(row,[pick(undefined,'high',[0]),pick('secure_objectives:0')]).sessions;
 assert.ok(s.filter(s=>s.needs[0].objectiveKey==='focus_for_next_week:0').length>s.filter(s=>s.needs[0].objectiveKey==='secure_objectives:0').length);
 const index=s.findIndex(s=>s.needs[0].objectiveKey==='secure_objectives:0');assert.ok(index>0&&index<4);assert.equal(s[index].needs[0].request.durationMinutes,7);
});
test('three objectives get explicit coverage and focus receives more exposures',()=>{
 const s=run(row,[pick(undefined,'high'),pick('secure_objectives:0'),pick('suggested_retrieval_items:0')]).sessions;
 assert.equal(s.filter(s=>s.needs[0].objectiveKey==='focus_for_next_week:0').length,3);assert.equal(new Set(s.map(s=>s.needs[0].objectiveKey)).size,3);
});
test('multi-objective fluency and vocabulary retain subject-appropriate intents',()=>{
 const r={developing_objectives:['Multiplication and division fluency'],suggested_retrieval_items:['Factor and multiple vocabulary']};
 const s=run(r,[pick('developing_objectives:0'),pick('suggested_retrieval_items:0')]).sessions;
 assert.ok(s.some(s=>s.needs[0].request.intents.includes('vocabulary')));assert.ok(s.some(s=>s.needs[0].request.intents.includes('fluency')));
});
test('focus with secure foundations may progress; insecure reading retains comprehension',()=>{
 assert.ok(run({focus_for_next_week:['Compare fractions']},[pick()]).sessions.some(s=>s.needs[0].request.intents.includes('application')));
 const s=run({developing_objectives:['Reading comprehension']},[pick('developing_objectives:0')]).sessions;
 assert.ok(s.every(s=>s.needs[0].request.intents.includes('reading_comprehension')));
});
test('duration derived from session metadata or central fallback, budgets enforced',()=>{
 const s=run(row,undefined,sessions.map((s,i)=>({...s,durationMinutes:i?10:undefined}))).sessions;
 assert.equal(s[0].targetMinutes,15);assert.ok(s.slice(1).every(s=>s.needs[0].request.durationMinutes===8));
 const p=run();p.sessions[0].needs[0].request.durationMinutes=15;assert.throws(()=>validate(p,sessions,['focus_for_next_week:0']));
});
test('reject unknown/duplicate objectives, sessions, bad durations and oversized educational context',()=>{
 for(const s of [[],[pick('unknown')],[pick(),pick()],[pick(),pick('developing_objectives:0')]])assert.throws(()=>run(row,s));
 for(const ss of [sessions.slice(1),[...sessions.slice(1),sessions[1]],sessions.map(s=>({...s,durationMinutes:0})),sessions.map(s=>({...s,id:'bad'}))])assert.throws(()=>run(row,undefined,ss));
 assert.throws(()=>run({...row,possible_misconceptions:['x'.repeat(240)]}));assert.throws(()=>run(row,[pick(undefined,'high',[99])]));
});

test("mixed English week preserves inference/evidence and spelling intents without identity",()=>{
 const objectives=["Spell and apply words containing the -tion pattern accurately in words and sentences.","Make simple inferences from a text and support answers with relevant evidence.","Spell longer words containing -tion accurately without relying solely on phonetic guessing.","Make simple inferences from a text.","Support inference answers with clear evidence from the text."];
 const plan=build({focus_for_next_week:objectives,learnerName:"PRIVATE",rawReflection:"PRIVATE"},objectives.map((_,i)=>pick("focus_for_next_week:"+i)),sessions,"English and phonics","Year 6");
 assert.equal(plan.sessions.length,5);
 for(const s of plan.sessions){const n=s.needs[0].request; assert.ok(!n.intents.includes("fluency"));if(/infer/i.test(n.objective)){assert.equal(n.intents[0],"reading_comprehension");assert.ok(n.intents.includes("reasoning"));}else assert.ok(n.intents.includes("application")||n.intents.includes("vocabulary"));}
 assert.doesNotMatch(JSON.stringify(plan),/PRIVATE|learnerName|rawReflection|activityType|provider/);
});
