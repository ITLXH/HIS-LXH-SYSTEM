import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=require('esbuild');
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
const source=`
import {onRequestGet as uxi} from './functions/api/uxi/results.js';
import {onRequestGet as file} from './functions/api/uxi/result-file.js';
import {onRequestGet as pmc} from './functions/api/pmc/results.js';
export default {async fetch(request){
 const input=new URL(request.url),redirect=input.searchParams.get('redirect')==='1';let calls=0;
 globalThis.fetch=async(url,init={})=>{new Request(url,init);calls++;const path=new URL(url).pathname;
  if(path==='/auth/v1/user')return Response.json({id:'STAFF-SYN'});
  if(path.endsWith('/HIS_One_Users'))return Response.json([{Status:'active',Role:'doctor',Permissions:'opd'}]);
  if(redirect)return new Response('',{status:302,headers:{location:'https://never-follow.invalid'}});
  if(path.endsWith('/HIS_One_Patients'))return Response.json([{Patient_ID:'PATIENT-SYN'}]);
  if(path.endsWith('/HIS_One_Visits'))return Response.json([{Patient_ID:'PATIENT-SYN',Visit_ID:'VISIT-SYN'}]);
  if(path.endsWith('/UXI_One_main_imaging_orders'))return Response.json([{id:'ORDER-SYN',cn:'PATIENT-SYN',status:'Reported',report:'Synthetic',exams:[],result_files:[{id:'FILE-SYN',name:'test.pdf',type:'application/pdf',storagePath:'ORDER-SYN/test.pdf'}]}]);
  if(path.startsWith('/storage/'))return new Response('%PDF-synthetic');
  if(path==='/api/his/results')return Response.json({schema:'pmc-his-results-v1',patientId:'PATIENT-SYN',visitId:'VISIT-SYN',clinicalEnabled:false,rows:[]});
  throw Error('Unexpected target');
 };
 const env={SUPABASE_URL:'https://synthetic.invalid',SUPABASE_ANON_KEY:'public-synthetic',SUPABASE_SERVICE_ROLE_KEY:'private-synthetic',PMC_RESULTS_ORIGIN:'https://pmc.invalid'};
 const type=input.searchParams.get('type'),path=type==='file'?'/api/uxi/result-file?patientId=PATIENT-SYN&orderId=ORDER-SYN&fileId=FILE-SYN':type==='pmc'?'/api/pmc/results?patientId=PATIENT-SYN&visitId=VISIT-SYN':'/api/uxi/results?patientId=PATIENT-SYN';
 const response=await (type==='file'?file:type==='pmc'?pmc:uxi)({request:new Request('https://his.invalid'+path,{headers:{authorization:'Bearer synthetic-user'}}),env});
 response.headers.set('x-calls',String(calls));return response;
}};`;
const bundled=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-08-27',script:bundled.outputFiles[0].text}));
try{
 for(const type of ['uxi','file','pmc'])for(const redirect of [0,1]){
  const response=await mf.dispatchFetch('https://local.invalid/?'+new URLSearchParams({type,redirect:String(redirect)}));
  assert.equal(response.status,redirect?503:200,type+' redirect='+redirect);
  assert.equal(response.headers.get('Location'),null);
 }
 console.log('HIS result workerd transport passed; six cases, no external requests.');
}finally{await mf.dispose();}
