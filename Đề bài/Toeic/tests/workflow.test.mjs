import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';

test('TOEIC local workflow: authentication, saving, timing, grading and review',async t=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'toeic-workflow-'));
 process.env.DATA_DIR=dir;
 const {server}=await import('../server.mjs');
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 let cookie='';let a;let originalNow=Date.now;
 async function request(route,method='GET',data,session=cookie){
  const response=await fetch(base+'/api'+route,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session}:{})},body:data?JSON.stringify(data):undefined});
  const value=await response.json();return {status:response.status,value,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 try{
  await t.test('requires login and rejects untrusted origins',async()=>{
   assert.equal((await request('/dashboard')).status,401);
   const r=await fetch(base+'/api/auth/demo',{method:'POST',headers:{Origin:'http://untrusted.invalid'}});assert.equal(r.status,403);
  });
  await t.test('registers, hashes password and handles login/logout',async()=>{
   const r=await request('/auth/register','POST',{name:'Học viên kiểm thử',email:'test@example.com',password:'test-password-123'});assert.equal(r.status,200);cookie=r.cookie;
   assert.equal(r.value.user.name,'Học viên kiểm thử');assert.equal(r.value.user.password,undefined);
   const db=JSON.parse(readFileSync(path.join(dir,'database.json'),'utf8'));assert.notEqual(db.users[0].password,'test-password-123');
   assert.equal((await request('/auth/register','POST',{name:'Trùng',email:'test@example.com',password:'test-password-123'})).status,409);
   assert.equal((await request('/auth/login','POST',{email:'test@example.com',password:'wrong'})).status,401);
   await request('/auth/logout','POST',{});assert.equal((await request('/dashboard')).status,401);
   cookie=(await request('/auth/login','POST',{email:'test@example.com',password:'test-password-123'})).cookie;
   assert.equal((await request('/profile','PATCH',{name:'Linh',target:750})).value.user.target,750);
  });
  await t.test('separates users and checks exam access',async()=>{
   const other=await request('/auth/demo','POST',{});assert.ok(other.cookie);
   assert.equal((await request('/auth/login','POST',{email:other.value.user.email,password:'whatever'})).status,401);
   assert.equal((await request('/attempts','POST',{examId:'advanced-01',mode:'exam'})).status,403);
   a=(await request('/attempts','POST',{examId:'journey-01',mode:'practice'})).value;
   assert.equal(a.questions.length,20);assert.equal(new Set(a.questions.map(q=>q.part)).size,7);
   assert.equal(a.questions[0].correct,undefined);assert.equal(a.questions[0].explanation,undefined);assert.equal(a.questions[0].transcript,undefined);
   assert.equal((await request('/attempts/'+a.id,'GET',undefined,other.cookie)).status,404);
   assert.equal((await request('/attempts','POST',{examId:'journey-01',mode:'practice'})).value.id,a.id);
  });
  await t.test('validates the complete answer request before saving, then resumes',async()=>{
   assert.equal((await request(`/attempts/${a.id}/answers`,'PATCH',{answers:{1:1,2:99},flags:[]})).status,400);
   assert.deepEqual((await request('/attempts/'+a.id)).value.answers,{});
   const saved=await request(`/attempts/${a.id}/answers`,'PATCH',{answers:{1:1,2:0,9:0},flags:[2]});assert.equal(saved.status,200);
   const resumed=(await request('/attempts/'+a.id)).value;assert.deepEqual(resumed.answers,{'1':1,'2':0,'9':0});assert.deepEqual(resumed.flags,[2]);
  });
  await t.test('grades accepted answers, locks edits and makes submission idempotent',async()=>{
   const result=(await request(`/attempts/${a.id}/submit`,'POST',{})).value;
   assert.equal(result.stats.correct,2);assert.equal(result.stats.wrong,1);assert.equal(result.stats.unanswered,17);assert.equal(result.reviewUnlocked,true);
   assert.equal(result.questions[0].correct,1);assert.ok(result.questions[0].transcript);assert.ok(result.questions[0].explanation);
   assert.equal((await request(`/attempts/${a.id}/answers`,'PATCH',{answers:{2:2},flags:[]})).status,409);
   const repeated=(await request(`/attempts/${a.id}/submit`,'POST',{})).value;assert.equal(repeated.completedAt,result.completedAt);assert.deepEqual(repeated.stats,result.stats);
   const retry=(await request('/attempts','POST',{examId:'journey-01',mode:'practice',retryFrom:a.id})).value;assert.equal(retry.questions.length,18);assert.ok(retry.questions.every(q=>![1,9].includes(q.id)));
  });
  await t.test('enforces Listening/Reading timing on the server',async()=>{
   const timed=(await request('/attempts','POST',{examId:'journey-01',mode:'exam'})).value;
   assert.equal((await request(`/attempts/${timed.id}/answers`,'PATCH',{answers:{9:0},flags:[]})).status,409);
   assert.equal((await request(`/attempts/${timed.id}/answers`,'PATCH',{answers:{1:1},flags:[]})).status,200);
   Date.now=()=>timed.listeningDeadline+1000;
   assert.equal((await request(`/attempts/${timed.id}/answers`,'PATCH',{answers:{1:0},flags:[]})).status,409);
   assert.equal((await request(`/attempts/${timed.id}/answers`,'PATCH',{answers:{1:1,9:0},flags:[]})).status,200);
   Date.now=()=>timed.deadline+1000;
   const expired=(await request('/attempts/'+timed.id)).value;assert.equal(expired.status,'completed');assert.equal(expired.reason,'timeout');assert.equal(expired.completedAt,timed.deadline);assert.equal(expired.stats.correct,2);
   Date.now=originalNow;
  });
  await t.test('withholds review and transcript until the configured release time',async()=>{
   const assigned=(await request('/attempts','POST',{examId:'classroom-01',mode:'exam'})).value;
   const submitted=(await request(`/attempts/${assigned.id}/submit`,'POST',{})).value;
   assert.equal(submitted.reviewUnlocked,false);assert.equal(submitted.questions[0].correct,undefined);assert.equal(submitted.questions[0].transcript,undefined);
   assert.equal((await request('/attempts','POST',{examId:'classroom-01',mode:'practice',retryFrom:assigned.id})).status,403);
   Date.now=()=>submitted.reviewAt+1;
   const unlocked=(await request('/attempts/'+assigned.id)).value;assert.equal(unlocked.reviewUnlocked,true);assert.ok(unlocked.questions[0].transcript);Date.now=originalNow;
  });
  await t.test('serves local assets and blocks source/database access',async()=>{
   for(const route of ['/','/app.js','/style.css','/favicon.svg'])assert.equal((await fetch(base+route)).status,200);
   for(const route of ['/server.mjs','/questions.mjs','/data/database.json','/package.json'])assert.equal((await fetch(base+route)).status,404);
   const dash=(await request('/dashboard')).value;assert.ok(dash.attempts.length>=4);assert.equal(dash.exams[0].questionCount,20);
  });
 }finally{
  Date.now=originalNow;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  const resolved=path.resolve(dir);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('toeic-workflow-'))rmSync(resolved,{recursive:true,force:true});
 }
});
