import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/pmc/v1/orders.js';
const env={PMC_PRESCRIPTION_API_ENABLED:'true',SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_ANON_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-server'};
let role='admin', source=[{Visit_ID:'VISIT-SYN',Patient_ID:'PATIENT-SYN',Patient_Name:'Synthetic patient',Doctor_Name:'Synthetic doctor',Date:'2026-10-17',EMR_Revision:1,Prescription_JSON:'[{"status":"sent_to_pharmacy"}]'}];
const original=globalThis.fetch; const calls=[];
globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return Response.json(String(url).includes('/auth/v1/user')?{id:'synthetic'}:String(url).includes('HIS_One_Users')?[{Status:'active',Role:role}]:source);};
const run=()=>onRequestGet({env,request:new Request('https://his.example/api/pmc/v1/orders?from=2026-10-17&to=2026-10-17',{headers:{Authorization:'Bearer synthetic-user'}})});
try {
 const response=await run();assert.equal(response.status,200);const body=await response.json();assert.equal(body.rows[0].doctorName,'Synthetic doctor');assert.equal(body.rows[0].status,'INCOMPLETE');assert.equal(body.hasMore,false);
 const read=calls.find(call=>call.url.includes('HIS_One_Visits'));assert.equal(read.options.headers.Authorization,'Bearer synthetic-user');assert.equal(new URL(read.url).searchParams.get('limit'),'21');
 role='doctor';assert.equal((await run()).status,403);role='admin';
 source=[{...source[0],Prescription_JSON:'[{"status":"dispensed"}]'}];assert.equal((await (await run()).json()).rows[0].status,'ACCEPTED');
 source=[{...source[0],Prescription_JSON:'[{"status":"rejected"}]'}];assert.equal((await (await run()).json()).rows[0].status,'FAILED');
 console.log('HIS queue synthetic checks passed');
}finally{globalThis.fetch=original;}
