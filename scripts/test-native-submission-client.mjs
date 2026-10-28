import assert from 'node:assert/strict';
import {createNativeSubmissionClient} from '../src/nativePrescriptionSubmit.js';
const line={prescriptionItemId:'SYN-L1',sourceDrugId:'SYN-D1',name:'Synthetic',quantity:'2',dose:'1',route:'oral',frequency:'daily',duration:'2 days',instructions:'Synthetic instructions'};
let calls=0;const rpc=async(name,args)=>{calls++;assert.equal(name,'pmc_submit_native_batch_v1');assert.equal(args.p_lines[0].status,undefined);return{data:{revision:1,batchId:'SYN-B1',replayed:false},error:null};};
const client=createNativeSubmissionClient(rpc);
const request={patientId:'SYN-P1',visitId:'SYN-V1',expectedRevision:0,batchId:'SYN-B1',lines:[line]};
assert.equal((await client.send(request)).revision,1);
await assert.rejects(client.send({...request,lines:[{...line,quantity:'0'}]}),/INVALID_LINE/);assert.equal(calls,1);
await assert.rejects(client.send({...request,lines:[{...line,isFreeText:true}]}),/CATALOG_REQUIRED/);
await assert.rejects(createNativeSubmissionClient(async()=>({data:null,error:{message:'ENCOUNTER_CHANGED'}})).send(request),/ENCOUNTER_CHANGED/);
await assert.rejects(createNativeSubmissionClient(async()=>({data:{revision:1,batchId:'OTHER'},error:null})).send(request),/SEND_UNCERTAIN/);
console.log('Native submission client synthetic checks passed');

let issue;
try{await client.send({...request,lines:[line,{...line,prescriptionItemId:'SYN-L2',dose:'1 tablet',duration:'',instructions:''}]});}catch(error){issue=error;}
assert.equal(issue?.lineNumber,2);
assert.deepEqual(issue?.fields,['dose','duration','instructions']);
assert.equal(calls,1);
