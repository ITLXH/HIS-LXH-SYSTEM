import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/lis/result-file.js';
const original=globalThis.fetch; let storageReads=0, patientAllowed=true;
try {
 globalThis.fetch=async input=>{
  const u=new URL(input);
  if(u.pathname==='/auth/v1/user')return Response.json({id:'synthetic-staff'});
  if(u.pathname.endsWith('/HIS_One_Users'))return Response.json([{Role:'admin',Status:'active'}]);
  if(u.pathname.endsWith('/lis_one_order_result_files'))return Response.json([{order_id:'ORDER-SYN'}]);
  if(u.pathname.endsWith('/lis_one_test_orders'))return Response.json([{patient_id:'HN-SYN'}]);
  if(u.pathname.endsWith('/HIS_One_Patients')){assert.equal(u.searchParams.get('Patient_ID'),'eq.HN-SYN');return Response.json(patientAllowed?[{Patient_ID:'HN-SYN'}]:[]);}
  if(u.pathname.includes('/storage/')){storageReads++;return new Response('synthetic-pdf',{headers:{'Content-Type':'application/pdf'}});}
  throw Error('Unexpected synthetic request');
 };
 const ctx={request:new Request('https://his.invalid/api/lis/result-file?path=ORDER-SYN/report.pdf',{headers:{Authorization:'Bearer synthetic'}}),env:{SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-private'}};
 assert.equal((await onRequestGet(ctx)).status,200);assert.equal(storageReads,1);
 patientAllowed=false;assert.equal((await onRequestGet(ctx)).status,404);assert.equal(storageReads,1);
 console.log('Order-folder PDF mapping and patient access denial passed.');
}finally{globalThis.fetch=original;}
