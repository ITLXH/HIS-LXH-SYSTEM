import {requireHisStaff,jsonResponse} from '../../../_utils/pmc-read-auth.js';
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(value);
const integer=value=>Number.isSafeInteger(value)&&value>0;
export async function onRequestPost({request,env}){
 const fail=(status,error)=>jsonResponse({error},status);
 let validRequest=false;
 if(env.PMC_PRESCRIPTION_API_ENABLED!=='true')return fail(503,'Signal feed is not enabled');
 try{
  const auth=await requireHisStaff({request,env});if(auth.response)return auth.response;
  if(!['admin','pharmacy'].includes(String(auth.profile.Role).toLowerCase()))return fail(403,'Pharmacy role required');
  const reader=request.body?.getReader();let size=0,text='';const decoder=new TextDecoder();
  if(!reader)return fail(400,'Invalid batch');
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096){await reader.cancel();return fail(400,'Invalid batch');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();
  const input=JSON.parse(text),ack=input?.ack??[];
  if(!input||Array.isArray(input)||Object.keys(input).some(key=>!['consumerId','ack'].includes(key))||typeof input.consumerId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.consumerId)||!Array.isArray(ack)||ack.length>100||ack.some(id=>!integer(id)))return fail(400,'Invalid batch');
  validRequest=true;
  if(!env.SUPABASE_ANON_KEY)return fail(503,'Signal feed is not configured');
  const response=await fetch(`${String(env.SUPABASE_URL).replace(/\/+$/,'')}/rest/v1/rpc/pmc_his_signal_batch_v1`,{method:'POST',headers:{apikey:env.SUPABASE_ANON_KEY,authorization:`Bearer ${auth.accessToken}`,'content-type':'application/json'},body:JSON.stringify({p_consumer:input.consumerId,p_ack:ack,p_limit:100}),redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return fail([401,403].includes(response.status)?response.status:503,'Signal feed unavailable');
  const raw=await response.text();if(raw.length>100000)return fail(502,'Invalid signal batch');
  const data=JSON.parse(raw);
  if(!data||Object.keys(data).some(key=>!['events','hasMore'].includes(key))||typeof data.hasMore!=='boolean'||!Array.isArray(data.events)||data.events.length>100||data.hasMore&&!data.events.length)return fail(502,'Invalid signal batch');
  for(let i=0;i<data.events.length;i++){const e=data.events[i];if(!e||Object.keys(e).some(key=>!['signalId','patientId','visitId','revision','action'].includes(key))||!integer(e.signalId)||!integer(e.revision)||!validId(e.patientId)||!validId(e.visitId)||!['INSERT','UPDATE','DELETE'].includes(e.action)||i>0&&e.signalId<=data.events[i-1].signalId)return fail(502,'Invalid signal batch');}
  return jsonResponse(data);
 }catch{return fail(validRequest?503:400,validRequest?'Signal feed unavailable':'Invalid signal request');}
}
