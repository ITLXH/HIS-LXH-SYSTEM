import {requireHisStaff,jsonResponse} from '../../../_utils/pmc-read-auth.js';
export async function handlePmcMedicines({request,env},fetcher=fetch,authorize=requireHisStaff){
 if(env.PMC_MEDICINE_CATALOGUE_ENABLED!=='true')return jsonResponse({enabled:false});
 if(!env.PMC_MEDICINE_CATALOGUE_KEY||env.PMC_MEDICINE_CATALOGUE_KEY.length<32)return jsonResponse({error:'CATALOGUE_UNAVAILABLE'},503);
 const fail=()=>jsonResponse({error:'CATALOGUE_UNAVAILABLE'},503);
 try{
  const auth=await authorize({request,env});if(auth.response)return auth.response;
  if(!['admin','doctor'].includes(String(auth.profile.Role).toLowerCase()))return jsonResponse({error:'FORBIDDEN'},403);
  const origin=new URL(env.PMC_MEDICINE_CATALOGUE_ORIGIN);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||!env.PMC_MEDICINE_CATALOGUE_KEY)return fail();
  const url=String(env.SUPABASE_URL).replace(/\/$/,'');
  const caller={apikey:env.SUPABASE_ANON_KEY,Authorization:`Bearer ${auth.accessToken}`,'content-type':'application/json'};
  const rpc=(name,body,headers)=>fetcher(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const permission=await rpc('his_one_has_action',{module_name:'opd',action_name:'edit'},caller);
  if(!permission.ok||await permission.json()!==true)return jsonResponse({error:'FORBIDDEN'},403);
  const upstream=await fetcher(`${origin.origin}/api/catalogue/medicines`,{headers:{Authorization:`Bearer ${env.PMC_MEDICINE_CATALOGUE_KEY}`},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!upstream.ok)return fail();
  const text=await upstream.text();if(new TextEncoder().encode(text).length>8000000)return fail();
  const snapshot=JSON.parse(text);
  const synced=await rpc('pmc_apply_medicine_catalogue_v1',{p_snapshot:snapshot},{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'content-type':'application/json'});
  if(!synced.ok)return fail();
  const response=await rpc('pmc_orderable_medicines_v1',{},caller);if(!response.ok)return fail();
  const catalogue=await response.json();return jsonResponse({enabled:true,version:catalogue.version,items:catalogue.items});
 }catch{return fail();}
}
export const onRequestGet=ctx=>handlePmcMedicines(ctx);
