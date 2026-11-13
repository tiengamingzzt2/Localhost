import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,scryptSync,timingSafeEqual,randomUUID} from 'node:crypto';
import {exams,examQuestions,hydratedQuestion,questions} from './questions.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = process.env.VERCEL ? path.join('/tmp', 'toeic-data') : path.join(root, 'data');
const dataDir = process.env.DATA_DIR || defaultDataDir;
try { mkdirSync(dataDir, { recursive: true }); } catch {}
const dbFile = path.join(dataDir, 'database.json');
const seedFile = path.join(root, 'data', 'database.json');

function initDb() {
  if (existsSync(dbFile)) {
    try { return JSON.parse(readFileSync(dbFile, 'utf8')); } catch {}
  }
  if (existsSync(seedFile)) {
    try { return JSON.parse(readFileSync(seedFile, 'utf8')); } catch {}
  }
  return { users: [], sessions: [], attempts: [] };
}
const db = initDb();
function save() {
  try {
    writeFileSync(dbFile + '.tmp', JSON.stringify(db, null, 2));
    renameSync(dbFile + '.tmp', dbFile);
  } catch (err) {
    console.error('Không thể ghi file database:', err.message);
  }
}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function publicUser(u){return {id:u.id,name:u.name,email:u.email,target:u.target||650};}
function passwordHash(password,salt){return scryptSync(password,salt,64);}
function examFor(a){return exams.find(e=>e.id===a.examId);}
function qsFor(a){return (a.questionIds||examFor(a).questionIds).map(id=>questions.find(q=>q.id===id));}
function closeAttempt(a,reason='manual'){
 if(a.status==='completed')return;
 a.status='completed';a.completedAt=reason==='timeout'?a.deadline:Date.now();a.reason=reason;
 a.reviewAt=a.completedAt+(a.mode==='practice'?0:examFor(a).releaseDelay);save();
}
function refresh(a){if(a.status==='active'&&a.deadline&&Date.now()>=a.deadline)closeAttempt(a,'timeout');return a;}
function stats(a){
 const qs=qsFor(a); const correct=qs.filter(q=>a.answers[q.id]===q.correct).length;
 const answered=qs.filter(q=>Number.isInteger(a.answers[q.id])).length;
 const parts=[...new Set(qs.map(q=>q.part))].map(part=>{const items=qs.filter(q=>q.part===part);return {part,total:items.length,correct:items.filter(q=>a.answers[q.id]===q.correct).length};});
 const section=name=>{const items=qs.filter(q=>q.section===name);return {total:items.length,correct:items.filter(q=>a.answers[q.id]===q.correct).length};};
 return {total:qs.length,correct,wrong:answered-correct,unanswered:qs.length-answered,accuracy:Math.round(correct/qs.length*100),parts,listening:section('listening'),reading:section('reading')};
}
function safeAttempt(a,withQuestions=true){
 refresh(a);const e=examFor(a);const unlocked=a.status==='completed'&&Date.now()>=a.reviewAt;
 const result={...a,title:e.title,questionCount:qsFor(a).length,reviewUnlocked:unlocked};
 if(a.status==='completed')result.stats=stats(a);
 if(withQuestions)result.questions=qsFor(a).map(item=>{
  const q=hydratedQuestion(item);
  if(!unlocked){delete q.correct;delete q.explanation;delete q.transcript;}
  return q;
 });
 return result;
}
async function body(req){
 if(req.body!==undefined&&req.body!==null){
  if(typeof req.body==='object')return req.body;
  if(typeof req.body==='string'){try{return JSON.parse(req.body);}catch{fail('Dữ liệu không hợp lệ.');}}
 }
 let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>65536)fail('Dữ liệu gửi lên quá lớn.',413);}
 try{return raw?JSON.parse(raw):{};}catch{fail('Dữ liệu không hợp lệ.');}
}
function loginUser(res,user){
 const token=randomBytes(32).toString('hex');
 db.sessions=db.sessions.filter(s=>s.expiresAt>Date.now());
 db.sessions.push({token,userId:user.id,expiresAt:Date.now()+7*86400000});save();
 res.setHeader('Set-Cookie',`toeic_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`);
 return {user:publicUser(user)};
}
const authTries=new Map();
async function api(req,res,url){
 const method=req.method;const route=url.pathname;
 if(method!=='GET'&&req.headers.origin){
  try{
   const originHost=new URL(req.headers.origin).host;
   if(originHost!==req.headers.host)fail('Nguồn yêu cầu không hợp lệ.',403);
  }catch{fail('Nguồn yêu cầu không hợp lệ.',403);}
 }
 if(route==='/api/auth/register'&&method==='POST'){
  const b=await body(req);const email=String(b.email||'').trim().toLowerCase();const name=String(b.name||'').trim();
  if(!name||name.length>60)fail('Tên phải có từ 1 đến 60 ký tự.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>150)fail('Vui lòng nhập email hợp lệ.');
  if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)fail('Mật khẩu cần từ 8 đến 128 ký tự.');
  if(db.users.some(u=>u.email===email))fail('Email này đã được đăng ký.',409);
  const salt=randomBytes(16).toString('hex');const user={id:randomUUID(),name,email,salt,password:passwordHash(b.password,salt).toString('hex'),target:650};
  db.users.push(user);return loginUser(res,user);
 }
 if(route==='/api/auth/login'&&method==='POST'){
  const key=req.socket.remoteAddress;const record=authTries.get(key)||{count:0,reset:Date.now()+60000};
  if(record.reset<Date.now()){record.count=0;record.reset=Date.now()+60000;}record.count++;authTries.set(key,record);
  if(record.count>20)fail('Bạn thử quá nhiều lần. Vui lòng đợi một phút.',429);
  const b=await body(req);const u=db.users.find(u=>u.email===String(b.email||'').trim().toLowerCase());
  if(typeof b.password!=='string'||b.password.length>128||!u?.password||!timingSafeEqual(passwordHash(b.password,u.salt),Buffer.from(u.password,'hex')))fail('Email hoặc mật khẩu chưa đúng.',401);
  return loginUser(res,u);
 }
 if(route==='/api/auth/demo'&&method==='POST'){
  const user={id:randomUUID(),name:'Bạn học',email:`demo-${randomBytes(4).toString('hex')}@local.demo`,target:650,demo:true};
  db.users.push(user);return loginUser(res,user);
 }
 const token=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('toeic_session='))?.split('=')[1];
 const session=db.sessions.find(s=>s.token===token&&s.expiresAt>Date.now());
 const user=session&&db.users.find(u=>u.id===session.userId);
 if(route==='/api/session'&&method==='GET')return {user:user?publicUser(user):null};
 if(!user)fail('Vui lòng đăng nhập để tiếp tục.',401);
 if(route==='/api/auth/logout'&&method==='POST'){
  db.sessions=db.sessions.filter(s=>s.token!==token);save();res.setHeader('Set-Cookie','toeic_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return {ok:true};
 }
 if(route==='/api/profile'&&method==='PATCH'){
  const b=await body(req);const target=Number(b.target);const name=String(b.name||'').trim();
  if(!name||name.length>60||!Number.isInteger(target)||target<10||target>990)fail('Tên hoặc mục tiêu điểm chưa hợp lệ.');
  user.name=name;user.target=target;save();return {user:publicUser(user)};
 }
 if(route==='/api/dashboard'&&method==='GET')return {user:publicUser(user),exams:exams.map(e=>({...e,questionIds:undefined,questionCount:e.questionIds.length,parts:[...new Set(examQuestions(e).map(q=>q.part))]})),attempts:db.attempts.filter(a=>a.userId===user.id).map(a=>safeAttempt(a,false)).reverse()};
 if(route==='/api/attempts'&&method==='POST'){
  const b=await body(req);const exam=exams.find(e=>e.id===b.examId);if(!exam||!exam.access)fail('Đề thi chưa được mở.',403);
  if(!['exam','practice'].includes(b.mode))fail('Chế độ làm bài không hợp lệ.');
  const active=db.attempts.find(a=>a.userId===user.id&&a.examId===exam.id&&a.mode===b.mode&&refresh(a).status==='active'&&!b.retryFrom);
  if(active)return safeAttempt(active);
  let questionIds;
  if(b.retryFrom){
   const prev=db.attempts.find(a=>a.id===b.retryFrom&&a.userId===user.id&&a.examId===exam.id);
   if(!prev||!safeAttempt(prev,false).reviewUnlocked||b.mode!=='practice')fail('Chưa thể luyện lại bài này.',403);
   questionIds=qsFor(prev).filter(q=>prev.answers[q.id]!==q.correct).map(q=>q.id);if(!questionIds.length)fail('Bạn đã trả lời đúng tất cả các câu.');
  }
  const now=Date.now();const a={id:randomUUID(),userId:user.id,examId:exam.id,mode:b.mode,status:'active',answers:{},flags:[],startedAt:now,savedAt:now,deadline:b.mode==='exam'?now+exam.minutes*60000:null,listeningDeadline:b.mode==='exam'&&exam.listeningMinutes?now+exam.listeningMinutes*60000:null,...(questionIds?{questionIds}:{} )};
  db.attempts.push(a);save();return safeAttempt(a);
 }
 const match=route.match(/^\/api\/attempts\/([\w-]+)(?:\/(answers|submit))?$/);
 if(match){
  const a=db.attempts.find(a=>a.id===match[1]&&a.userId===user.id);if(!a)fail('Không tìm thấy lượt làm bài.',404);refresh(a);
  if(method==='GET'&&!match[2])return safeAttempt(a);
  if(method==='PATCH'&&match[2]==='answers'){
   if(a.status!=='active')fail('Lượt thi đã kết thúc. Đáp án đã được khóa.',409);
   const b=await body(req);const items=qsFor(a);
   if(!b.answers||typeof b.answers!=='object'||Array.isArray(b.answers))fail('Đáp án không hợp lệ.');
   for(const [id,answer] of Object.entries(b.answers)){
    const q=items.find(q=>q.id===Number(id));if(!q||!Number.isInteger(answer)||answer<0||answer>=q.options.length)fail('Đáp án không hợp lệ.');
    if(a.mode==='exam'&&q.section==='listening'&&a.listeningDeadline<=Date.now()&&a.answers[id]!==answer)fail('Phần Listening đã kết thúc. Đáp án mới chưa được chấp nhận.',409);
    if(a.mode==='exam'&&q.section==='reading'&&a.listeningDeadline&&Date.now()<a.listeningDeadline)fail('Phần Reading chưa bắt đầu.',409);
   }
   if(!Array.isArray(b.flags)||b.flags.some(id=>!items.some(q=>q.id===id)))fail('Câu đánh dấu không hợp lệ.');
   Object.assign(a.answers,b.answers);a.flags=[...new Set(b.flags)];a.savedAt=Date.now();save();return safeAttempt(a);
  }
  if(method==='POST'&&match[2]==='submit'){closeAttempt(a);return safeAttempt(a);}
 }
 fail('Không tìm thấy chức năng.',404);
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
export async function handleRequest(req, res) {
 res.setHeader('X-Content-Type-Options', 'nosniff');
 res.setHeader('Referrer-Policy', 'same-origin');
 try {
  const host = req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const url = new URL(req.url, `${proto}://${host}`);
  if (url.pathname.startsWith('/api/')) {
   res.setHeader('Content-Type', 'application/json; charset=utf-8');
   res.setHeader('Cache-Control', 'no-store');
   const result = await api(req, res, url);
   res.end(JSON.stringify(result));
   return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') fail('Phương thức không hợp lệ.', 405);
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
  const file = path.resolve(root, 'public', relative);
  const publicRoot = path.join(root, 'public') + path.sep;
  if (!file.startsWith(publicRoot) || !types[path.extname(file)] || !existsSync(file)) fail('Không tìm thấy trang.', 404);
  res.setHeader('Content-Type', types[path.extname(file)]);
  res.setHeader('Cache-Control', 'no-cache');
  res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
 } catch (err) {
  res.statusCode = err.status || 500;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: err.status ? err.message : 'Có lỗi hệ thống. Vui lòng thử lại.' }));
  if (!err.status) console.error(err);
 }
}

export const server = http.createServer(handleRequest);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const port = Number(process.env.PORT || 3000);
 server.listen(port, '127.0.0.1', () => console.log(`TOEIC Studio đang chạy tại http://localhost:${server.address().port}`));
 server.on('error', err => {
  console.error(err.code === 'EADDRINUSE' ? `Cổng ${port} đang được sử dụng. Đổi PORT rồi chạy lại.` : err.message);
  process.exit(1);
 });
}
