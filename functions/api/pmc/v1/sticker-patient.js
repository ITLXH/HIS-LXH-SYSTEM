import { requireHisStaff, jsonResponse } from '../../../_utils/pmc-read-auth.js';

export async function onRequestPost({ request, env }) {
  if (env.PMC_PRESCRIPTION_API_ENABLED !== 'true') return jsonResponse({error:'DISABLED'},503);
  try {
    const auth = await requireHisStaff({request,env});
    if (auth.response) return auth.response;
    if (!['admin','pharmacy'].includes(String(auth.profile.Role).toLowerCase())) return jsonResponse({error:'FORBIDDEN'},403);
    const {hn,prefix} = await request.json();
    const suggesting = prefix !== undefined;
    if (suggesting && (hn !== undefined || typeof prefix !== "string" || !/^LXH[A-Z0-9-]{3,60}$/.test(prefix))) return jsonResponse({error:"INVALID_HN"},400);
    if (!suggesting && (typeof hn !== 'string' || !/^LXH[A-Z0-9-]{1,60}$/.test(hn))) return jsonResponse({error:'INVALID_HN'},400);
    const query = new URLSearchParams({Patient_ID:'eq.'+hn,select:'Patient_ID,Title,First_Name,Last_Name,Gender,Date_of_Birth,Age',limit:'2'});
    if (suggesting) {
      query.set("Patient_ID","like."+prefix+"*");
      query.set("select","Patient_ID,First_Name,Last_Name");
      query.set("order","Patient_ID.asc");
      query.set("limit","6");
    }
    const response = await fetch(new URL('/rest/v1/HIS_One_Patients?'+query,env.SUPABASE_URL),{
      headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+auth.accessToken},redirect:'manual',signal:AbortSignal.timeout(8000)
    });
    if (!response.ok) return jsonResponse({error:'SOURCE_UNAVAILABLE'},503);
    const rows = await response.json();
    if (suggesting) {
      if (!Array.isArray(rows) || rows.length > 6 || rows.some(row => typeof row.Patient_ID !== "string" || !row.Patient_ID.startsWith(prefix))) return jsonResponse({error:"INVALID_SOURCE"},502);
      return jsonResponse({suggestions:rows.map(row => ({hn:row.Patient_ID,fullName:[row.First_Name,row.Last_Name].filter(Boolean).join(" ")}))});
    }
    if (!Array.isArray(rows) || rows.length>1) return jsonResponse({error:'INVALID_SOURCE'},502);
    if (!rows.length) return jsonResponse({patient:null});
    const p=rows[0],fullName=[p.First_Name,p.Last_Name].filter(Boolean).join(' ').trim();
    if (p.Patient_ID!==hn || !fullName) return jsonResponse({error:'INVALID_SOURCE'},502);
    const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
    const dob=String(p.Date_of_Birth||'').slice(0,10);
    const age=/^\d{4}-\d{2}-\d{2}$/.test(dob) && dob<=today
      ? Number(today.slice(0,4))-Number(dob.slice(0,4))-Number(today.slice(5)<dob.slice(5))
      : /^\d{1,3}$/.test(String(p.Age)) ? Number(p.Age) : null;
    return jsonResponse({patient:{hn,title:p.Title||'',fullName,age:age!==null && age<=130 ? age:null,sex:p.Gender||'—'}});
  } catch {return jsonResponse({error:'SOURCE_UNAVAILABLE'},503);}
}
