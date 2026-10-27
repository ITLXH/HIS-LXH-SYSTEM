import assert from 'node:assert/strict';
import { onRequestGet as uxi } from '../functions/api/uxi/results.js';
import { onRequestGet as file } from '../functions/api/uxi/result-file.js';
import { onRequestGet as access } from '../functions/api/pmc/v1/result-access.js';
import { onRequestGet as pmc } from '../functions/api/pmc/results.js';

const env={SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_ANON_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'server-test',PMC_RESULTS_ORIGIN:'https://pmc.example'};
const original=globalThis.fetch;
let active=true,role='doctor',visible=true,visitVisible=true,status='Reported',calls=[],missing=false,archiveHash='',archiveBucket='uxi-results';
const report={id:'UXI-SYN',cn:'PATIENT-SYN',status:'Reported',ordered_at:'2026-10-05T02:00:00Z',reported_at:'2026-10-06T02:00:00Z',report:'Synthetic findings',exams:[{name:'Synthetic chest',modality:'X-Ray'}],result_files:[{id:'FILE-SYN',name:'report.pdf',type:'application/pdf',storagePath:'UXI-SYN/report.pdf'}]};
globalThis.fetch=async(input,init={})=>{
 const url=new URL(input);calls.push({url,init});
 if(url.pathname==='/auth/v1/user')return Response.json({id:'STAFF-SYN',app_metadata:{}});
 if(url.pathname.endsWith('/HIS_One_Users'))return Response.json([{Role:role,Status:active?'active':'disabled',Permissions:'opd'}]);
 if(url.pathname.endsWith('/HIS_One_Patients')){assert.equal(init.headers.Authorization,'Bearer staff-token');return Response.json(visible?[{Patient_ID:'PATIENT-SYN'}]:[]);}
 if(url.pathname.endsWith('/HIS_One_Visits')){assert.equal(init.headers.Authorization,'Bearer staff-token');return Response.json(visitVisible?[{Visit_ID:'VISIT-SYN',Patient_ID:'PATIENT-SYN'}]:[]);}
 if(url.pathname.endsWith('/UXI_One_main_imaging_orders'))return Response.json([{...report,status}]);
 if(url.pathname.includes('/storage/v1/object/'))return missing?new Response(null,{status:404}):new Response('%PDF-synthetic',{headers:{'content-type':'application/pdf'}});
 if(url.href==='https://oauth2.googleapis.com/token')return Response.json({access_token:'drive-test'});
 if(url.origin==='https://www.googleapis.com'&&url.pathname==='/drive/v3/files')return Response.json({files:[{id:'DRIVE-SYN',appProperties:{his_source_bucket:archiveBucket,his_source_path_sha256:archiveHash}}]});
 if(url.pathname==='/drive/v3/files/DRIVE-SYN'){assert.equal(init.headers.Authorization,'Bearer drive-test');return new Response('%PDF-archive');}
 if(url.origin==='https://pmc.example'){assert.equal(init.headers.Authorization,'Bearer staff-token');return Response.json({schema:'pmc-his-results-v1',patientId:'PATIENT-SYN',visitId:'VISIT-SYN',clinicalEnabled:false,rows:[]});}
 throw Error('Unexpected network request '+url.pathname);
};
function request(path,token='staff-token'){return new Request('https://his.example'+path,{headers:token?{Authorization:'Bearer '+token}:{}});}
const list='/api/uxi/results?patientId=PATIENT-SYN';
try{
 assert.equal((await uxi({env,request:request(list,'')})).status,401);assert.equal(calls.length,0);
 active=false;assert.equal((await uxi({env,request:request(list)})).status,403);active=true;
 visible=false;assert.equal((await uxi({env,request:request(list)})).status,404);assert(!calls.some(c=>c.url.pathname.endsWith('/UXI_One_main_imaging_orders')));visible=true;
 calls=[];const response=await uxi({env,request:request(list)});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 const body=await response.json();assert.equal(body.results[0].report,'Synthetic findings');assert.equal(body.results[0].scope,'patient-history');assert.equal(body.results[0].orderedAt,'2026-10-05T02:00:00Z');assert.equal(body.results[0].files[0].url,'/api/uxi/result-file?patientId=PATIENT-SYN&orderId=UXI-SYN&fileId=FILE-SYN');
 const read=calls.find(c=>c.url.pathname.endsWith('/UXI_One_main_imaging_orders'));assert.equal(read.url.searchParams.get('cn'),'eq.PATIENT-SYN');assert.equal(read.url.searchParams.get('limit'),'51');assert(!JSON.stringify(body).includes('storagePath'));
 status='In Progress';assert.equal((await (await uxi({env,request:request(list)})).json()).results.length,0);
 const filePath=body.results[0].files[0].url;
 assert.equal((await file({env,request:request(filePath)})).status,404);status='Reported';
 assert.equal((await file({env,request:request(filePath.replace('FILE-SYN','OTHER'))})).status,404);
 const pdf=await file({env,request:request(filePath)});assert.equal(pdf.status,200);assert.equal(await pdf.text(),'%PDF-synthetic');assert.equal(pdf.headers.get('cache-control'),'private, no-store');
 missing=true;assert.equal((await file({env,request:request(filePath)})).status,404);missing=false;
 const driveEnv={...env,GOOGLE_DRIVE_FOLDER_ID:'ROOT-SYN',GOOGLE_DRIVE_OAUTH_JSON:JSON.stringify({type:'authorized_user',client_id:'synthetic',client_secret:'synthetic',refresh_token:'synthetic'})};
 archiveHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('uxi-results/UXI-SYN/report.pdf')))].map(n=>n.toString(16).padStart(2,'0')).join('');
 missing=true;const archived=await file({env:driveEnv,request:request(filePath)});assert.equal(archived.status,200);assert.equal(await archived.text(),'%PDF-archive');
 archiveBucket='other';assert.equal((await file({env:driveEnv,request:request(filePath)})).status,404);missing=false;
 assert.equal((await file({env,request:request(filePath+'&path=OTHER')})).status,400);
 const target='/api/pmc/v1/result-access?patientId=PATIENT-SYN&visitId=VISIT-SYN';
 assert.equal((await access({env,request:request(target)})).status,200);
 visitVisible=false;assert.equal((await access({env,request:request(target)})).status,404);visitVisible=true;
 role='reception';assert.equal((await access({env,request:request(target)})).status,403);role='doctor';
 const result=await pmc({env,request:request('/api/pmc/results?patientId=PATIENT-SYN&visitId=VISIT-SYN')});assert.equal(result.status,200);assert.equal((await result.json()).clinicalEnabled,false);
 console.log('External clinical result API checks passed');
}finally{globalThis.fetch=original;}
