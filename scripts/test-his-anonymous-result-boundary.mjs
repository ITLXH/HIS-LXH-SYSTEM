import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/lis/result-file.js';
const originalFetch=globalThis.fetch;let lookups=0;
try {
 globalThis.fetch=async()=>{lookups++;throw new Error('unauthenticated request reached a protected service');};
 const response=await onRequestGet({request:new Request('https://his.invalid/api/lis/result-file?path=patients/HN0001/result.pdf'),env:{SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-private'}});
 assert.equal(response.status,401);
 assert.equal(lookups,0);
 console.log('Anonymous LIS result-file requests are rejected before storage access.');
}finally{globalThis.fetch=originalFetch;}
