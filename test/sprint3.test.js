import test from "node:test";
import assert from "node:assert/strict";
import {period,hourlyBlocks,quietHours,summary} from "../src/services/PlaceHistoryService.js";
import {reliability,parseReportId} from "../src/services/ReportValidationService.js";
import {assertValidationSchemaReady} from "../src/database/migrateValidation.js";

test("S3: fechas reales, Lima,31 días máximo y días inclusivos",()=>{
    assert.equal(period('2026-10-12','2026-10-12').start,'2026-10-12T05:00:00.000Z');
    assert.equal(period('2026-10-12','2026-10-12').end,'2026-10-13T05:00:00.000Z');
    assert.doesNotThrow(()=>period('2026-10-01','2026-10-31'));
    for(const [from,to] of [['2026-02-30','2026-03-01'],['2026-10-01','2026-11-01'],['2026-10-02','2026-10-01'],['2026-1-1','2026-01-01'],[['2026-10-01'],'2026-10-02']]) assert.throws(()=>period(from,to),{code:'PERIOD_INVALID'});
});
test("S3: reportId BIGINT conserva precisión y rechaza formato/rango",()=>{
    assert.equal(parseReportId('9007199254740993'),'9007199254740993');
    for(const id of ['0','-1','1e2','1;DROP','9223372036854775808',1]) assert.throws(()=>parseReportId(id),{code:'REPORT_ID_INVALID'});
});
test("S3: confiabilidad ponderada aprobada, mínimo3 y límites exactos",()=>{
    assert.equal(reliability({confirmations:2,rejections:0,confirmWeight:10,rejectWeight:0}).level,null);
    assert.equal(reliability({confirmations:1,rejections:2,confirmWeight:5,rejectWeight:2}).level,'ALTO');
    assert.equal(reliability({confirmations:1,rejections:2,confirmWeight:1,rejectWeight:2}).level,'BAJO');
    assert.equal(reliability({confirmations:2,rejections:1,confirmWeight:2,rejectWeight:1}).level,'ALTO');
    assert.equal(reliability({confirmations:2,rejections:2,confirmWeight:2,rejectWeight:2}).level,'MEDIO');
});
test("S3: historial vacío es honesto y un bloque usa personas distintas/último voto",()=>{
    const range=period('2026-10-12','2026-10-12');
    const empty=hourlyBlocks(-1,range,[]); assert.equal(empty.length,24); assert.equal(summary(empty).sufficient,0);
    const rows=[1,2,3].map((id)=>({id:String(id),userId:id,level:'TRANQUILO',createdAt:'2026-10-12T15:10:00Z',bucketStart:'2026-10-12T15:00:00Z'}));
    rows.push({id:'4',userId:1,level:'MODERADO',createdAt:'2026-10-12T15:20:00Z',bucketStart:'2026-10-12T15:00:00Z'});
    const blocks=hourlyBlocks(-1,range,rows); assert.equal(blocks[10].level,'TRANQUILO'); assert.equal(blocks[10].reportCount,3);
    assert.equal(blocks[0].level,null); assert.throws(()=>hourlyBlocks(-1,range,Array(10001).fill({})),{code:'PERIOD_TOO_DENSE'});
});
test("S3: recomendaciones requieren3 días, conservan empates y no inventan horarios tranquilos",()=>{
    const block=(date,hour,level)=>({start:`2026-10-${date}T${hour}:00:00Z`,level});
    assert.equal(quietHours([block('12','15','TRANQUILO')]).reason,'INSUFFICIENT_HISTORY');
    const blocks=['12','13','14'].flatMap((date)=>[block(date,'15','TRANQUILO'),block(date,'16','TRANQUILO')]);
    assert.deepEqual(quietHours(blocks).recommendations.map(({hour,rank})=>[hour,rank]),[[10,1],[11,1]]);
    assert.equal(quietHours(blocks.map((item)=>({...item,level:'SATURADO'}))).reason,'NO_QUIET_HOURS');
    const mixed = blocks.concat(['12','13','14'].map(date=>block(date,'18','SATURADO')));
    assert.deepEqual(quietHours(mixed).recommendations.map(item=>item.hour),[10,11]);
    assert.throws(()=>period('0000-01-01','0000-01-01'),{code:'PERIOD_INVALID'});
});
test("S3: guard007 soloSELECT y falla cerrado sin esquema",async()=>{
    const calls=[];
    await assertValidationSchemaReady({query:async(sql)=>{calls.push(sql);assert.match(sql,/^SELECT /);return[{name:'007-report-validation'}];}});
    assert.equal(calls.length,3);
    await assert.rejects(assertValidationSchemaReady({query:async()=>[]}),{code:'SCHEMA_NOT_READY'});
});
