import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/api/pmc/v1/sticker-patient.js';
const env={PMC_PRESCRIPTION_API_ENABLED:'true',SUPABASE_URL:'https://database.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'server'};
const request=(hn,token)=>new Request('https://his.invalid/',{method:'POST',headers:token?{authorization:'Bearer '+token}:{},body:JSON.stringify({hn})});
let role='viewer';
let rows=[];
globalThis.fetch=async(input,init)=>{
 const url=new URL(input);
 if(url.pathname==='/auth/v1/user')return Response.json({id:'test'});
 if(url.pathname.endsWith('/HIS_One_Users'))return Response.json([{Status:'active',Role:role}]);
 assert.equal(url.searchParams.get('Patient_ID'),'eq.LXH-TEST');
 assert.equal(init.headers.Authorization,'Bearer demo');
 assert.equal(init.headers.apikey,'anon');
 return Response.json(rows);
};
async function lookup(hn='LXH-TEST',token='demo'){return onRequestPost({request:request(hn,token),env});}
assert.equal((await lookup('LXH-TEST','')).status,401);
assert.equal((await lookup()).status,403);
role='pharmacy';
assert.equal((await lookup('*')).status,400);
assert.deepEqual(await (await lookup()).json(),{patient:null});
rows=[{Patient_ID:'LXH-TEST',First_Name:'Synthetic',Last_Name:'Patient',Age:29}];
assert.equal((await (await lookup()).json()).patient.age,29);
rows.push(rows[0]);
assert.equal((await lookup()).status,502);
console.log('Exact-HN pharmacy access and identity checks passed');
