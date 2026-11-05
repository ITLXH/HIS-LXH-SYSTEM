import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/pmc/v1/prescriptions.js';
const line={prescriptionItemId:'SYN-L',sourceDrugId:'SYN-D',name:'Synthetic',unitCode:'TAB',quantity:'2',instructions:'Synthetic directions',status:'sent_to_pharmacy'};
globalThis.fetch=async url=>String(url).includes('/auth/v1/user')?Response.json({id:'SYN-U'}):String(url).includes('HIS_One_Users')?Response.json([{Status:'active',Role:'pharmacy'}]):Response.json([{Visit_ID:'SYN-V',Patient_ID:'SYN-P',EMR_Revision:1,Prescription_JSON:JSON.stringify([line])}]);
const run=()=>onRequestGet({request:new Request('https://his.example/api/pmc/v1/prescriptions?patientId=SYN-P&visitId=SYN-V',{headers:{Authorization:'Bearer synthetic'}}),env:{SUPABASE_URL:'https://db.example',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'server',PMC_PRESCRIPTION_API_ENABLED:'true'}});
const response=await run();
assert.equal(response.status,200);const {lines}=await response.json();
assert.equal(lines[0].unitCode,'TAB');assert.equal(lines[0].sourceDrugId,'SYN-D');assert.equal(lines[0].instructions,line.instructions);assert.equal(lines[0].dose,'');
assert.ok(lines[0].holds.includes('UNIT_MAPPING_REQUIRED'),'Exported unit is not authority to dispense');
line.unitCode='';line.sourceDrugId=null;const legacy=await run();assert.equal(legacy.status,200);const oldBody=await legacy.json();assert.equal(Object.hasOwn(oldBody.lines[0],'unitCode'),false);line.unitCode='TAB';line.sourceDrugId='SYN-D';
for(const [key,value] of [['unitCode','x'.repeat(161)],['sourceDrugId','bad/id'],['catalogueVersion','wrong']]){const old=line[key];line[key]=value;assert.equal((await run()).status,409);if(old===undefined)delete line[key];else line[key]=old;}
console.log('PASS source unit/identity and original instructions without invented dose or dispensing authority');
