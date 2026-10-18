import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomBytes} from "node:crypto";
import dotenv from "dotenv";
import {QueryTypes} from "sequelize";
import {assertIsolatedConsolidationDatabase} from "../src/database/databaseSafety.js";
import {migrateValidation,assertValidationSchemaReady} from "../src/database/migrateValidation.js";
const input=dotenv.parse(readFileSync(process.env.CROWDRADAR_QA_ENV_FILE));
assert.ok(!input.DATABASE_URL && ['localhost','127.0.0.1','::1'].includes(input.DB_HOST),'Solo DB_* local.');
Object.assign(process.env,{DB_HOST:input.DB_HOST,DB_PORT:input.DB_PORT??'5432',DB_USER:input.DB_USER,DB_PASSWORD:input.DB_PASSWORD,
    DB_NAME:'crowdradar_consolidacion_fresh_20261017',DATABASE_URL:'',DB_SSL:'false',NODE_ENV:'test',JWT_SECRET:randomBytes(48).toString('hex')});
for(const key of ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','MAIL_FROM','PASSWORD_RESET_URL']) delete process.env[key];
const {default:db}=await import('../src/config/database.js');
assertIsolatedConsolidationDatabase(db);
const select=(sql,replacements={})=>db.query(sql,{replacements,type:QueryTypes.SELECT});
let server;let blocks=0;
const pass=(text)=>console.log(`PASS ${++blocks}: ${text}`);
try{
    const [identity]=await select('SELECT current_database() AS name');assert.equal(identity.name,'crowdradar_consolidacion_fresh_20261017');
    const baseline=await select('SELECT * FROM public.users ORDER BY id');
    await Promise.all([migrateValidation(db),migrateValidation(db)]);assert.equal(await migrateValidation(db),false);await assertValidationSchemaReady(db);
    pass('007 aditiva, idempotente/concurrente; destino QA identificado, sin datos históricos alterados.');
    const {default:app}=await import('../app.js');
    await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});
    const root=`http://127.0.0.1:${server.address().port}`;
    const call=(path,{token,body,method='GET'}={})=>fetch(root+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    const runId=randomBytes(6).toString('hex'),password=randomBytes(24).toString('hex');const accounts=[];
    for(let i=0;i<4;i++){
        const email=`qa-s03-${runId}-${i}@example.invalid`;
        assert.equal((await call('/api/auth/register',{method:'POST',body:{nombre:'QA',apellido:'SprintTres',email,password}})).status,201);
        const response=await call('/api/auth/login',{method:'POST',body:{email,password}});assert.equal(response.status,200);accounts.push((await response.json()).data);
    }
    const [author,a,b,c]=accounts,placeId=-(100000+Math.floor(Math.random()*100000000));
    await db.query("INSERT INTO public.places(id,nombre,categoria,latitud,longitud,activo,demostrativo) VALUES(:id,'QA Sprint 3','Prueba',-12,-77,TRUE,TRUE)",{replacements:{id:placeId}});
    const created=await call(`/api/places/${placeId}/reports`,{token:author.token,method:'POST',body:{level:'TRANQUILO'}});assert.equal(created.status,201);
    const id=String((await created.json()).data.id),path=`/api/reports/${id}`;
    const vote=(account,decision)=>call(path+'/validations',{token:account.token,method:'POST',body:{decision}});
    assert.equal((await vote(author,'CONFIRM')).status,403);
    assert.equal((await call(path+'/denunciations',{token:author.token,method:'POST',body:{}})).status,403);
    assert.equal((await call(path+'/own-validation',{token:a.token})).status,403);
    assert.equal((await call(path+'/own-validation',{token:author.token})).status,200);
    assert.equal((await call(path)).status,401);
    pass('autorización: sesión, recursos propios, autovoto y autodenuncia rechazados.');
    await db.query('UPDATE public.users SET karma_points=40 WHERE id=:id',{replacements:{id:a.user.id}});
    const simultaneous=await Promise.all([vote(a,'CONFIRM'),vote(a,'REJECT')]);assert.deepEqual(simultaneous.map(r=>r.status).sort(),[201,409]);
    const winning=(await (await call(path,{token:a.token})).json()).data.ownDecision;assert.ok(['CONFIRM','REJECT'].includes(winning));
    // Los dos votos restantes apoyan la misma decisión para que el resultado sea independiente del ganador concurrente.
    assert.equal((await vote(b,winning)).status,201);assert.equal((await vote(c,winning)).status,201);
    const detail=(await (await call(path,{token:a.token})).json()).data;
    assert.equal(detail.confirmations+detail.rejections,3);assert.equal(detail.ownDecision,winning);
    assert.equal(detail.reliability.level,winning==='CONFIRM'?'ALTO':'BAJO');assert.equal(detail.reliability.totalWeight,7);
    await db.query('UPDATE public.users SET karma_points=0 WHERE id=:id',{replacements:{id:a.user.id}});
    assert.equal((await (await call(path,{token:a.token})).json()).data.reliability.totalWeight,7);
    pass('voto único concurrente201/409; elección persistida y peso1..5 fijado al votar, sin premios.');
    const denounce=()=>call(path+'/denunciations',{token:a.token,method:'POST',body:{reason:'QA sintética de concurrencia'}});
    assert.deepEqual((await Promise.all([denounce(),denounce()])).map(r=>r.status).sort(),[201,409]);
    assert.equal((await (await call(path,{token:a.token})).json()).data.alreadyDenounced,true);
    assert.equal((await select('SELECT COUNT(*) AS count FROM public.saturation_reports WHERE id=:id',{id}))[0].count,'1');
    pass('denuncia única concurrente, confirmación persistida; no oculta ni elimina el reporte.');
    assert.equal((await call(path+'/validations',{token:b.token,method:'POST',body:{decision:'CONFIRM',userId:author.user.id}})).status,400);
    assert.equal((await call(path+'/denunciations',{token:b.token,method:'POST',body:{reason:'a'.repeat(501)}})).status,400);
    assert.equal((await call('/api/reports/9223372036854775808',{token:a.token})).status,400);
    const invalid=await fetch(root+path+'/validations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"broken"'});assert.equal(invalid.status,400);assert.equal((await invalid.json()).code,'INVALID_JSON');
    const oversized=await call(path+'/denunciations',{token:b.token,method:'POST',body:{reason:'x'.repeat(34000)}});assert.equal(oversized.status,413);
    pass('entrada inválida, suplantación, rango BIGINT, JSON malformado y cuerpo excesivo con errores públicos.');
    // Observaciones históricas SINTÉTICAS, únicamente en esta base QA: no son visitas reales ni generan karma.
    for(const date of ['12','13','14'])for(const [hour,level] of [['15','TRANQUILO'],['18','MODERADO']])for(const user of [a,b,c]){
        await db.query('INSERT INTO public.saturation_reports(user_id,place_id,level,created_at) VALUES(:userId,:placeId,:level,:time)',{replacements:{userId:user.user.id,placeId,level,time:`2026-10-${date}T${hour}:10:00Z`}});
    }
    const analytics=`/api/places/${placeId}`,range='from=2026-10-12&to=2026-10-14';
    const history=await call(analytics+'/history?'+range,{token:a.token});assert.equal(history.status,200);const h=(await history.json()).data;
    assert.equal(h.blocks.length,72);assert.equal(h.counts.TRANQUILO,3);assert.equal(h.counts.MODERADO,3);assert.equal(h.sufficient,6);
    assert.equal(h.blocks[10].level,'TRANQUILO');assert.equal(h.period.timezone,'America/Lima');
    const rec=await call(analytics+'/quiet-hours?'+range,{token:a.token});assert.equal(rec.status,200);const q=(await rec.json()).data;
    assert.equal(q.recommendations[0].hour,10);assert.equal(q.recommendations[0].quietDays,3);
    const compare=await call(analytics+'/comparison?'+range+'&compareFrom=2026-10-01&compareTo=2026-10-02',{token:a.token});assert.equal(compare.status,200);assert.equal((await compare.json()).data.comparable,false);
    const empty=await call(analytics+'/history?from=2026-09-01&to=2026-09-01',{token:a.token});assert.equal((await empty.json()).data.hasReports,false);
    assert.equal((await call(analytics+'/history?from=2026-02-31&to=2026-03-01',{token:a.token})).status,400);
    assert.equal((await call(analytics+'/history?'+range)).status,401);
    pass('SQL real:72 bloques Lima, conteos cronológicos, comparación insuficiente, recomendación3 días y vacíos honestos.');
    const after=await select('SELECT * FROM public.users ORDER BY id');
    for(const original of baseline)assert.deepEqual(after.find(row=>row.id===original.id),original);
    pass('usuarios preexistentes QA conservados; solo nuevas cuentas/observaciones sintéticas de esta ejecución.');
    console.log(`Resultado:${blocks}/${blocks} bloques S3 PostgreSQL/HTTP reales. Sin SMTP, SQL remoto ni moderación.`);
}catch(error){
    console.error(`FAIL S3 QA (${error.code??error.name}); sin SQL ni secretos.`);
    if(error instanceof assert.AssertionError){
        console.error(String(error.stack).split('\n').find(line=>line.includes('verify-sprint3-db.js:'))??'Aserción no satisfecha.');
        if(['number','boolean'].includes(typeof error.actual)) console.error(`Actual:${error.actual};esperado:${error.expected}`);
    }
    process.exitCode=1;
}
finally{if(server)await new Promise(resolve=>server.close(resolve));await db.close();}
