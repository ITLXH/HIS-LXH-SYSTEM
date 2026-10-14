import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildOpdTestVisitPersistence } from '../src/opdTestPersistence.js';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const block=(start,end)=>{const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0&&to>from);return source.slice(from,to);};
let mode='success',queries=[],auditCalls=0,auditFailure=false;
const client={from(table){const spec={table,filters:[]};return {
  update(value){spec.update=value;return this;},eq(key,value){spec.filters.push([key,value]);return this;},is(key,value){return this.eq(key,value);},select(){return this;},
  async maybeSingle(){return {data:{Visit_ID:'SYNTHETIC-VISIT',EMR_Revision:8}};},
  then(resolve,reject){queries.push(spec);return Promise.resolve(mode==='success'?{data:[{Visit_ID:'SYNTHETIC-VISIT'}]}:mode==='conflict'?{data:[]}:{error:{code:mode,message:'Synthetic failure'}}).then(resolve,reject);}
};}};
const window={
  can:()=>true,
  opdTestNormalizeLabOrder:(row,index)=>({...row,localOrderId:row.localOrderId||`TEST-${index}`,orderNo:row.orderNo||`TEST-${index}`}),
  opdTestState:{orders:[{name:'CBC 24 p',orderedAt:'2026-10-14T02:00:00Z'},{name:'CBC 24 p',orderedAt:'2026-10-14T04:00:00Z'}],medications:[],persistedRevision:1},
  opdTestSelectedVisit:{patientId:'SYNTHETIC-PATIENT',visitId:'SYNTHETIC-VISIT'},
  opdTestPersistenceContext(){return {visitId:'SYNTHETIC-VISIT',patientId:'SYNTHETIC-PATIENT',doctor:'Synthetic doctor',orders:this.opdTestState.orders,medications:[],revision:2,completedAt:'2026-10-14T04:30:00Z',disposition:'Home'};},
  opdTestUsesMockPersistence:()=>false,
  opdTestIsMissingPersistenceColumnError:()=>false,
  async opdTestRecordEncounterRevision(){auditCalls++;if(auditFailure)throw Error('Synthetic audit failure');return 'recorded';}
};
const {appendOrderHistory}=await import('../src/patientOrderHistory.js');
const context=vm.createContext({window,supabaseClient:client,dbTable:x=>x,buildOpdTestVisitPersistence,appendOrderHistory,console:{error(){}},currentUser:{id:'SYNTHETIC-DOCTOR'}});
vm.runInContext(block('window.opdTestUpdateVisitRow =','window.opdTestRecordEncounterRevision ='),context);
vm.runInContext(block('window.opdTestPersistVisit =','window.opdTestRequestExit ='),context);
for(const errorCode of ['42501','57014','conflict']){
  mode=errorCode;const before=JSON.stringify(window.opdTestState);
  await assert.rejects(window.opdTestPersistVisit(),error=>error.code===(errorCode==='conflict'?'OPD_VISIT_CONFLICT':errorCode));
  assert.equal(JSON.stringify(window.opdTestState),before,'failed database update preserves all draft orders');
  assert.equal(auditCalls,0,'failed update does not record a successful audit');
}
mode='success';queries=[];const result=await window.opdTestPersistVisit();
assert.equal(result.orders.length,2);
assert.notEqual(result.orders[0].orderBatchId,result.orders[1].orderBatchId);
assert.notEqual(result.orders[0].localOrderId,result.orders[1].localOrderId);
assert.ok(queries[0].filters.some(([key,value])=>key==='Patient_ID'&&value==='SYNTHETIC-PATIENT'));
assert.ok(queries[0].filters.some(([key,value])=>key==='EMR_Revision'&&value===1));
assert.equal(JSON.parse(queries[0].update.Lab_Orders_JSON).length,2);
assert.equal(window.opdTestState.persistedRevision,2);
auditFailure=true;const saved=await window.opdTestPersistVisit();
assert.equal(saved.auditMode,'failed','audit failure after successful clinical write is explicitly surfaced');
console.log('Real OPD save functions with mocked database: scoped save, repeat batches, permission denial, timeout, revision conflict and audit failure passed.');
