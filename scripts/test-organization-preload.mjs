import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const start=source.indexOf("supabaseClient.from(dbTable('Organizations')).select(");
const end=source.indexOf("supabaseClient.from(dbTable('Drugs_Master'))",start);
assert.ok(start>=0&&end>start);const expression=source.slice(start,end).trim().replace(/,\s*$/,'');
async function run(result) {
 let calls=0,renders=0,html='',warnings=0;
 const previous=[{id:'SYNTHETIC-OLD',name:'Previous organization'}];
 const jq={html(value){renders++;html=value;return this;},trigger(){return this;}};
 const context={activeOrgsList:previous,console:{warn(){warnings++;}},jQuery:{},$:()=>jq,
 dbTable:name=>name,supabaseClient:{from(table){assert.equal(table,'Organizations');return {select(fields){assert.equal(fields,'Org_Code,Org_Name,Org_ID,Name');return {limit(limit){assert.equal(limit,9999);calls++;return Promise.resolve(result);}};}};}}};
 const outcome=vm.runInNewContext(expression,context);await outcome;
 return {context,previous,calls,renders,html,warnings};
}
const success=await run({data:[{Org_ID:'SYNTHETIC-1',Org_Code:'SYN',Org_Name:'Synthetic Company',Name:'Synthetic Contact'}],error:null});
assert.equal(success.calls,1);assert.equal(success.context.activeOrgsList[0].id,'SYNTHETIC-1');assert.match(success.html,/SYN - Synthetic Company \(Synthetic Contact\)/);
const failed=await run({data:null,error:{code:'42501'}});assert.equal(failed.context.activeOrgsList,failed.previous);assert.equal(failed.renders,0);assert.equal(failed.warnings,1,'failed read is observable without clinical values');
const partial=await run({data:[{Org_ID:'PARTIAL'}],error:{code:'57014'}});assert.equal(partial.context.activeOrgsList,partial.previous);assert.equal(partial.renders,0,'partial/error data cannot replace previous options');
const noContact=await run({data:[{Org_ID:'SYNTHETIC-2',Org_Code:'S2',Org_Name:'Synthetic Company'}],error:null});assert.doesNotMatch(noContact.html,/undefined|null/);
const empty=await run({data:[],error:null});assert.equal(empty.context.activeOrgsList.length,0);assert.equal(empty.renders,1,'successful empty data replaces old options');
console.log('PASS actual Organizations preload: valid projection, labels, one read, failed/partial read preservation, optional contact and empty response. Synthetic data only.');
