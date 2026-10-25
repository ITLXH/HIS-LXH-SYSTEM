import { requireHisStaff, jsonResponse } from '../../../_utils/pmc-read-auth.js';

export async function onRequestGet({ request, env }) {
  const fail = (status, error) => jsonResponse({ error }, status);
  if (env.PMC_PRESCRIPTION_API_ENABLED !== 'true') return fail(503, 'Pharmacy export is not enabled');
  const url = new URL(request.url), from = url.searchParams.get('from'), to = url.searchParams.get('to'), offset = Number(url.searchParams.get('offset') || '0');
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  try {
    if ([...url.searchParams.keys()].some(key => !['from','to','offset'].includes(key) || url.searchParams.getAll(key).length !== 1)
      || !validDate(from) || !validDate(to) || from > to || Date.parse(to)-Date.parse(from)>31*86400000 || !Number.isInteger(offset) || offset<0 || offset>10000) return fail(400, 'Invalid date range');
    const auth = await requireHisStaff({ request, env });
    if (auth.response) return auth.response;
    if (!['admin','pharmacy'].includes(String(auth.profile.Role).toLowerCase())) return fail(403,'Pharmacy role required');
    if (!env.SUPABASE_ANON_KEY) return fail(503,'Pharmacy export is not configured');
    const end = new Date(Date.parse(to)+86400000).toISOString().slice(0,10);
    const query = new URLSearchParams({ select:'Visit_ID,Patient_ID,Patient_Name,Doctor_Name,Date,EMR_Revision,Prescription_JSON',order:'Date.desc,Visit_ID.asc',limit:'21',offset:String(offset) });
    query.append('Date',`gte.${from}`); query.append('Date',`lt.${end}`);
    const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/+$/,'')}/rest/v1/HIS_One_Visits?${query}`,{ headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:`Bearer ${auth.accessToken}`} });
    if (!response.ok) return fail([401,403].includes(response.status)?response.status:503,'Clinical queue unavailable');
    const visits = await response.json(); if (!Array.isArray(visits)) return fail(503,'Invalid source');
    const rows=[];
    for (const visit of visits.slice(0,20)) {
      let lines; try { lines=typeof visit.Prescription_JSON==='string'?JSON.parse(visit.Prescription_JSON||'[]'):visit.Prescription_JSON; } catch { continue; }
      if (!Array.isArray(lines)||!lines.length||lines.length>100||!Number.isSafeInteger(visit.EMR_Revision)||visit.EMR_Revision<1) continue;
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(visit.Patient_ID)||!/^[A-Za-z0-9_-]{1,120}$/.test(visit.Visit_ID)) continue;
      if (lines.some(line=>!line||typeof line!=='object')) continue;
      const statuses=lines.map(line=>String(line.pharmacyStatus||line.status||'').toLowerCase());
      const completed=lines.every((line,i)=>statuses[i]==='dispensed'&&line.dispensedAt&&line.dispensedBy);
      const status=completed?'COMPLETED':statuses.every(s=>['rejected','cancelled','canceled'].includes(s))?'FAILED':statuses.every(s=>['accepted','preparing','ready','dispensed'].includes(s))?'ACCEPTED':'INCOMPLETE';
      const doctors=[...new Set(lines.map(line=>String(line.prescribedBy||visit.Doctor_Name||'').trim()).filter(Boolean))].join(', ');
      rows.push({patientId:visit.Patient_ID,visitId:visit.Visit_ID,patientName:String(visit.Patient_Name||'').slice(0,300),doctorName:doctors.slice(0,300),orderedAt:String(visit.Date||'').slice(0,60),revision:visit.EMR_Revision,lineCount:lines.length,status});
    }
    return jsonResponse({rows,hasMore:visits.length>20});
  } catch { return fail(503,'Clinical queue unavailable'); }
}
