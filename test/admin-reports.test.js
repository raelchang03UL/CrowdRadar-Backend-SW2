import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import users from '../src/repositories/UserRepository.js';
import repository from '../src/repositories/AdminReportRepository.js';
import {AdminReportService,adminReportId} from '../src/services/AdminReportService.js';
import {migrateReportModeration,assertReportModerationSchemaReady} from '../src/database/migrateReportModeration.js';
const actor={id:1,rol:'ADMIN',sessionVersion:0,exp:Math.floor(Date.now()/1000)+3600};
const row={id:'9007199254740993',placeId:1,placeName:'Parque QA',level:'SATURADO',createdAt:new Date(),authorId:2,authorName:'Bruno QA',authorRole:'USUARIO',
  denunciationCount:'3',reviewedDenunciationCount:0,isPublic:true,moderationVersion:0,reviewState:'PENDING',
  reasons:[{reason:'No coincide',count:2},{reason:null,count:1}],history:[]};
test('HU7.1: IDs BIGINT, filtros y actores estrictos',async()=>{
 assert.equal(adminReportId('9007199254740993'),'9007199254740993');
 for(const id of ['01','0','-1','9223372036854775808',1]) assert.throws(()=>adminReportId(id),{code:'ADMIN_REPORT_ID_INVALID'});
 const seen=[];const service=new AdminReportService({list:async(a,q)=>{seen.push(q);return [row];}});
 await service.list(actor,{state:'ALL',authorId:'2',before:'9007199254740994'});
 assert.deepEqual(seen[0],{state:'ALL',authorId:2,before:'9007199254740994'});
 for(const q of [{state:['PENDING']},{state:'pending'},{authorId:'0'},{authorId:'2147483648'},{before:['1','2']},{extra:'x'}]) await assert.rejects(service.list(actor,q),{code:'ADMIN_QUERY_INVALID'});
 await assert.rejects(service.list({...actor,rol:'USUARIO'},{}),{code:'ADMIN_REQUIRED'});
});
test('HU7.1: total coincide con grupos y DTO omite identidades de denunciantes',async()=>{
 const service=new AdminReportService({detail:async()=>({...row,passwordHash:'private',denouncerIds:[1,3,4]})});
 const result=await service.detail(actor,row.id,{});
 assert.equal(result.data.denunciationCount,3);assert.deepEqual(result.data.reasons,[{reason:'No coincide',count:2},{reason:null,count:1}]);
 assert.ok(!('denouncerIds' in result.data));assert.ok(!('passwordHash' in result.data));
 service.reports.detail=async()=>({...row,reasons:[{reason:'Mal',count:1}]});
 await assert.rejects(service.detail(actor,row.id,{}),/Inconsistent/);
});
test('HU7.1: decisión exige motivo, revisión y total exactos sin campos extra',async()=>{
 const seen=[];const service=new AdminReportService({decide:async(a,id,input)=>{seen.push(input);return row;}});
 const valid={decision:'REMOVE',reason:'  Revisado  ',expectedVersion:0,expectedDenunciationCount:3};
 await service.decide(actor,row.id,{},valid);assert.equal(seen[0].reason,'Revisado');
 for(const body of [{...valid,decision:'DELETE'},{...valid,reason:' '},{...valid,reason:'x'.repeat(501)},{...valid,reason:'a\0'},
  {...valid,expectedVersion:'0'},{...valid,expectedVersion:-1},{...valid,expectedDenunciationCount:0},{...valid,denouncerId:1}]) await assert.rejects(service.decide(actor,row.id,{},body),{code:'REPORT_MODERATION_INPUT_INVALID'});
});
test('HU7.1: 009 es aditiva, transaccional, idempotente; arranque sin DDL',async()=>{
 let applied=false;const statements=[],transaction={};
 const db={transaction:async f=>f(transaction),query:async(sql,options)=>{
  assert.equal(options.transaction,transaction);statements.push(sql);
  if(sql.startsWith('SELECT name'))return [{name:'008-user-moderation'},...(applied?[{name:'009-report-moderation'}]:[])];
  if(sql.startsWith('INSERT INTO public.crowdradar_migrations'))applied=true;return [];
 }};
 assert.equal(await migrateReportModeration(db),true);assert.equal(await migrateReportModeration(db),false);
 assert.equal(statements.filter(s=>s.startsWith('ALTER TABLE')).length,1);assert.ok(statements.every(s=>!/\b(DROP|DELETE|TRUNCATE)\b/.test(s)));
 const calls=[];await assertReportModerationSchemaReady({query:async sql=>{calls.push(sql);return [{name:'009-report-moderation'}];}});assert.ok(calls.every(s=>s.startsWith('SELECT')));
 await assert.rejects(assertReportModerationSchemaReady({query:async()=>[]}),{code:'SCHEMA_NOT_READY'});
});

const originals={session:users.findSessionById,list:repository.list,detail:repository.detail,decide:repository.decide};
let server,base,current,calls;const previousSecret=process.env.JWT_SECRET;
before(async()=>{process.env.JWT_SECRET='synthetic-hu7-report-test-only';await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base=`http://127.0.0.1:${server.address().port}/api/admin/reports`;});
beforeEach(()=>{current={...actor,status:'ACTIVO'};calls=0;users.findSessionById=async()=>current;repository.list=async()=>{calls++;return [row];};repository.detail=repository.decide=async()=>{calls++;return row;};});
after(async()=>{users.findSessionById=originals.session;repository.list=originals.list;repository.detail=originals.detail;repository.decide=originals.decide;if(previousSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previousSecret;await new Promise(resolve=>server.close(resolve));});
const token=()=>jwt.sign({id:1,rol:'ADMIN',sessionVersion:0},process.env.JWT_SECRET,{expiresIn:'1h'});
const call=(path='',credential=token(),body)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(credential?{Authorization:`Bearer ${credential}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
test('HU7.1 HTTP: anonimato, rol ciudadano y versión suspendida no llegan al repositorio',async()=>{
 for(const cred of ['', 'invalid'])assert.equal((await call('',cred)).status,401);
 current.rol='USUARIO';for(const [path,body] of [['',undefined],[`/${row.id}`,undefined],[`/${row.id}/decision`,{decision:'REMOVE'}]])assert.equal((await call(path,token(),body)).status,403);
 current.status='SUSPENDIDO';assert.equal((await call()).status,401);assert.equal(calls,0);
});
test('HU7.1 HTTP: totales, motivos e historial con no-store',async()=>{
 let response=await call();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).data[0].denunciationCount,3);
 response=await call('/'+row.id);const body=await response.json();assert.equal(body.data.reasons.reduce((sum,g)=>sum+g.count,0),3);assert.deepEqual(body.history,[]);
 assert.equal((await call('/'+row.id+'/decision',token(),{decision:'KEEP',reason:'Revisado',expectedVersion:0,expectedDenunciationCount:3})).status,200);
});
test('HU7.1 HTTP: entradas duplicadas/incorrectas y fallos no exponen detalles',async()=>{
 for(const path of ['?state=ALL&state=PENDING','?authorId=0','/01','/'+row.id+'?extra=x'])assert.equal((await call(path)).status,400);
 repository.detail=async()=>null;assert.equal((await call('/'+row.id)).status,404);
 repository.list=repository.decide=async()=>{throw new Error('private SQL passwordHash denouncer@example.test');};
 for(const [path,body] of [['',undefined],['/'+row.id+'/decision',{decision:'REMOVE',reason:'Revisado',expectedVersion:0,expectedDenunciationCount:3}]]){
  const response=await call(path,token(),body);assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/SQL|passwordHash|denouncer@/);
 }
});
