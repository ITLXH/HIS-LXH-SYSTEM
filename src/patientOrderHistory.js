export function parseOrderHistory(value) {
  if (!value) return [];
  const rows=typeof value==='string'?JSON.parse(value):value;
  if(!Array.isArray(rows))throw Error('Invalid saved examination history');
  return rows;
}
export function appendOrderHistory(existing,incoming) {
  const rows=[...existing],ids=new Set(existing.map(row=>row.localOrderId||row.orderNo).filter(Boolean));
  for(const row of incoming){const id=row.localOrderId||row.orderNo;if(!id)throw Error('Examination order identity required');
    if(!row.historySaved && !['manual','picker','picker-edit'].includes(row.source) && existing.some(old=>!(old.localOrderId||old.orderNo)&&old.name===row.name&&(!old.orderedAt||old.orderedAt===row.orderedAt)))continue;
    if(!ids.has(id)){rows.push({...row});ids.add(id);}}
  return rows;
}
export async function savePatientOrderHistory({client,table,visitId,patientId,orders,canSave,isCurrent=()=>true}) {
  if(!canSave || !visitId || !patientId || !orders.length)throw Error('Not authorized or missing examination context');
  for(let attempt=0;attempt<3;attempt++){
    if(!isCurrent())throw Error('Patient or session changed; reopen the examination');
    const response=await client.from(table).select('Visit_ID,Patient_ID,Lab_Orders_JSON').eq('Visit_ID',visitId).eq('Patient_ID',patientId).maybeSingle();
    if(response.error)throw response.error;
    if(!response.data)throw Error('Visit not found or access denied');
    const previous=response.data.Lab_Orders_JSON;
    const existing=parseOrderHistory(previous),merged=appendOrderHistory(existing,orders);
    if(merged.length===existing.length)return existing;
    if(!isCurrent())throw Error('Patient or session changed; reopen the examination');
    let query=client.from(table).update({Lab_Orders_JSON:JSON.stringify(merged)}).eq('Visit_ID',visitId).eq('Patient_ID',patientId);
    query=previous==null?query.is('Lab_Orders_JSON',null):query.eq('Lab_Orders_JSON',previous);
    const result=await query.select('Visit_ID');
    if(result.error)throw result.error;
    if(result.data?.length)return merged;
  }
  throw Error('Examination history changed concurrently. Please retry.');
}
