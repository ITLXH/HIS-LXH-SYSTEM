const columns=['Patient_ID','Old_Patient_ID','First_Name','Last_Name','Phone_Number','Name_Org','Insurance_Company'];
export function patientRegistrySearchTokens(value){return String(value||'').trim().replace(/[,%().:*_]/g,' ').split(/\s+/).filter(Boolean).slice(0,4).map(token=>token.slice(0,60));}
export function applyPatientRegistryGlobalSearch(query,value){
 const hn=String(value||'').trim().toUpperCase();
 if(/^LXH\d{4}-\d{6}$/.test(hn))return query.eq('Patient_ID',hn);
 if(/^LXH\d{4}(?:-\d{0,5})?$/.test(hn))return query.ilike('Patient_ID',hn+'%');
 return patientRegistrySearchTokens(value).reduce((next,token)=>next.or(columns.map(column=>column+'.ilike.%'+token+'%').join(',')),query);
}
