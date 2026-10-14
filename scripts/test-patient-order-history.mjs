import assert from 'node:assert/strict';
import {savePatientOrderHistory,parseOrderHistory} from '../src/patientOrderHistory.js';
let stored=null,fail=false,race=false,writes=[];
const client={from(table){assert.equal(table,'Visits');const spec={filters:[]};return {
  select(){return this;},eq(key,value){spec.filters.push([key,value]);return this;},is(key,value){return this.eq(key,value);},update(value){spec.update=value;return this;},
  async maybeSingle(){return {data:{Visit_ID:'V-TEST',Patient_ID:'P-TEST',Lab_Orders_JSON:stored}};},
  then(resolve,reject){return (async()=>{assert.ok(spec.filters.some(([key,value])=>key==='Visit_ID'&&value==='V-TEST'));assert.ok(spec.filters.some(([key,value])=>key==='Patient_ID'&&value==='P-TEST'));if(fail)return {error:{code:'42501',message:'Synthetic denial'}};if(race){race=false;stored=JSON.stringify([{localOrderId:'OTHER-STAFF',name:'Glucose',orderedAt:'2026-10-14T08:30:00Z'}]);return {data:[]};}const expected=spec.filters.find(([key])=>key==='Lab_Orders_JSON')[1];if(expected!==stored)return {data:[]};assert.deepEqual(Object.keys(spec.update),['Lab_Orders_JSON']);stored=spec.update.Lab_Orders_JSON;writes.push(spec.update);return {data:[{Visit_ID:'V-TEST'}]};})().then(resolve,reject);}
};}};
const save=orders=>savePatientOrderHistory({client,table:'Visits',visitId:'V-TEST',patientId:'P-TEST',orders,canSave:true});
const first={localOrderId:'B1-1',orderBatchId:'B1',name:'CBC',orderedAt:'2026-10-14T09:00:00Z'};
const second={localOrderId:'B2-1',orderBatchId:'B2',name:'CBC',orderedAt:'2026-10-14T11:00:00Z'};
await save([first]);await save([second]);assert.deepEqual(parseOrderHistory(stored),[first,second]);
await save([second]);assert.equal(parseOrderHistory(stored).length,2,'retry is idempotent');
const old=stored;fail=true;await assert.rejects(save([{...first,localOrderId:'FAIL'}]));assert.equal(stored,old);fail=false;
await assert.rejects(savePatientOrderHistory({client,table:'Visits',visitId:'V-TEST',patientId:'P-TEST',orders:[first],canSave:false}));assert.equal(stored,old);
await assert.rejects(savePatientOrderHistory({client,table:'Visits',visitId:'V-TEST',patientId:'P-TEST',orders:[first],canSave:true,isCurrent:()=>false}));
stored=null;race=true;await save([first]);assert.deepEqual(parseOrderHistory(stored).map(row=>row.localOrderId),['OTHER-STAFF','B1-1'],'concurrent staff orders survive retry');
assert.equal(writes.length,3);
console.log('HIS history-only save: persistence/read-back, different-time batches, retry, denial, stale patient and concurrent staff passed; only Lab_Orders_JSON written.');
