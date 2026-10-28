import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminUserService } from '../src/services/AdminUserService.js';
import { migrateUserModeration, assertUserModerationSchemaReady } from '../src/database/migrateUserModeration.js';

const actor={id:1,rol:'ADMIN',sessionVersion:0,exp:Math.floor(Date.now()/1000)+3600};
const row={id:2,nombre:'QA',apellido:'Ciudadano',email:'qa@example.test',rol:'USUARIO',status:'SUSPENDIDO',denouncedReportCount:'0',moderationVersion:1};
test('HU7: motivo obligatorio, observación opcional y revisión de pantalla estricta',async()=>{
 const seen=[];const service=new AdminUserService({transition:async(...args)=>{seen.push(args);return row;}});
 await service.transition(actor,'2',{}, {reason:'  Motivo revisado  ',expectedVersion:0},'SUSPEND');
 assert.deepEqual(seen[0][2],{action:'SUSPEND',reason:'Motivo revisado',expectedVersion:0});
 await service.transition(actor,'2',{}, {expectedVersion:1},'REACTIVATE');assert.equal(seen[1][2].reason,null);
 for(const body of [{},{reason:' ',expectedVersion:0},{reason:'a'.repeat(501),expectedVersion:0},{reason:'a\0',expectedVersion:0},
  {reason:'OK',expectedVersion:'0'},{reason:'OK',expectedVersion:-1},{reason:'OK',expectedVersion:2147483648},
  {reason:'OK',expectedVersion:0,rol:'ADMIN'},{reason:['x'],expectedVersion:0}]){
  await assert.rejects(service.transition(actor,'2',{},body,'SUSPEND'),{code:'MODERATION_INPUT_INVALID'});
 }
 await assert.rejects(service.transition({...actor,rol:'USUARIO'},'2',{}, {reason:'OK',expectedVersion:0},'SUSPEND'),{code:'ADMIN_REQUIRED'});
 await assert.rejects(service.transition(actor,'2',{extra:'x'}, {reason:'OK',expectedVersion:0},'SUSPEND'),{code:'ADMIN_QUERY_INVALID'});
});
test('HU7: historial paginado con BIGINT textual y DTO explícito',async()=>{
 const rows=Array.from({length:21},(_,index)=>({id:String(30-index),action:'SUSPEND',reason:'QA',previousStatus:'ACTIVO',newStatus:'SUSPENDIDO',createdAt:new Date('2026-10-28T05:00:00Z'),adminId:1,adminName:'Admin QA',moderationVersion:1,passwordHash:'private'}));
 const service=new AdminUserService({history:async()=>rows});
 const result=await service.history(actor,'2',{});assert.equal(result.data.length,20);assert.equal(result.pagination.nextBefore,'11');
 assert.equal(result.data[0].createdAt,'2026-10-28T05:00:00.000Z');assert.ok(!('passwordHash' in result.data[0]));
 for(const query of [{page:'1'},{before:'0'},{before:['1','2']},{before:'9223372036854775808'},{before:'01'}]) await assert.rejects(service.history(actor,'2',query),{code:'ADMIN_QUERY_INVALID'});
});
test('HU7: migración008 transaccional, aditiva e idempotente; guard de arranque solo lee',async()=>{
 let applied=false;const statements=[];const transaction={};
 const db={transaction:async fn=>fn(transaction),query:async(sql,options)=>{
  assert.equal(options.transaction,transaction);statements.push(sql);
  if(sql.startsWith('SELECT name')) return [{name:'007-report-validation'},...(applied?[{name:'008-user-moderation'}]:[])];
  if(sql.startsWith('INSERT INTO public.crowdradar_migrations')) applied=true;
  return [];
 }};
 assert.equal(await migrateUserModeration(db),true);assert.equal(await migrateUserModeration(db),false);
 assert.equal(statements.filter(s=>s.startsWith('ALTER TABLE')).length,1);
 assert.ok(statements.every(s=>!/\b(DROP|DELETE|TRUNCATE)\b/.test(s)));
 const guard=[];await assertUserModerationSchemaReady({query:async sql=>{guard.push(sql);return [{name:'008-user-moderation'}];}});
 assert.ok(guard.every(s=>s.startsWith('SELECT')));
 await assert.rejects(assertUserModerationSchemaReady({query:async()=>[]}),{code:'SCHEMA_NOT_READY'});
});
