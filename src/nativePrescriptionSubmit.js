const id=/^[A-Za-z0-9._:-]{1,120}$/;
const positive=/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/;
const fields=['prescriptionItemId','sourceDrugId','name','quantity','dose','route','frequency','duration','instructions'];
export function createNativeSubmissionClient(rpc){
 return {async send({patientId,visitId,expectedRevision,batchId,lines}){
  if(!id.test(patientId||'')||!id.test(visitId||'')||!id.test(batchId||'')||!Number.isInteger(expectedRevision)||expectedRevision<0||!Array.isArray(lines)||!lines.length||lines.length>100)throw Error('INVALID_BATCH');
  const payload=lines.map(line=>{
   if(line.isFreeText||line.freeText||!id.test(line.sourceDrugId||''))throw Error('CATALOG_REQUIRED');
   if(!id.test(line.prescriptionItemId||'')||fields.slice(2).some(k=>!String(line[k]??'').trim()||String(line[k]).length>1000)||['quantity','dose'].some(k=>!positive.test(String(line[k]))||Number(line[k])<=0))throw Error('INVALID_LINE');
   return Object.fromEntries(fields.map(k=>[k,String(line[k]).trim()]));
  });
  if(new Set(payload.map(l=>l.prescriptionItemId)).size!==payload.length)throw Error('DUPLICATE_LINE');
  const response=await rpc('pmc_submit_native_batch_v1',{p_patient_id:patientId,p_visit_id:visitId,p_expected_revision:expectedRevision,p_batch_id:batchId,p_lines:payload});
  if(response.error){const message=String(response.error.message||'');throw Error(['SUBMISSION_DISABLED','CATALOG_REQUIRED','FORBIDDEN','ENCOUNTER_CHANGED','SENT_BATCH_CHANGED','SOURCE_DRAFT_REVIEW_REQUIRED','DUPLICATE_LINE','INVALID_LINE'].find(code=>message.includes(code))||'SEND_UNCERTAIN');}
  const result=response.data;if(!result||result.batchId!==batchId||!Number.isInteger(result.revision)||result.revision<1||typeof result.replayed!=='boolean')throw Error('SEND_UNCERTAIN');
  return result;
 }};
}
export function installNativePrescriptionSubmit({getClient,getContext,getBatches,getState,isAllowed,confirmSend,onSaved}){
 let busy=false,message='',activeIdentity='';
 const client=createNativeSubmissionClient((...args)=>getClient().rpc(...args));
 const identity=()=>{const c=getContext();return JSON.stringify([c.patientId,c.visitId]);};
 function render(){
  const anchor=document.getElementById('opdTestMedicationOrderButton');if(!anchor)return;
  const currentIdentity=identity();if(activeIdentity!==currentIdentity){activeIdentity=currentIdentity;message='';}
  let root=document.getElementById('opdNativePrescriptionSubmit');if(!root){root=document.createElement('div');root.id='opdNativePrescriptionSubmit';root.className='mt-2';anchor.parentElement.append(root);}
  root.replaceChildren();
  for(const [i,batch] of getBatches().entries()){
   const sent=batch.entries.every(e=>['sent_to_pharmacy','accepted','preparing','ready','dispensed'].includes(e.item.pharmacyStatus||e.item.status));
   const button=document.createElement('button');button.type='button';button.className='btn btn-primary btn-sm me-2';button.textContent=sent?`ຊຸດ ${i+1} · ສົ່ງຫ້ອງຢາແລ້ວ`:`ຢືນຢັນສົ່ງຫ້ອງຢາ · ຊຸດ ${i+1}`;button.disabled=busy||sent||!isAllowed();button.addEventListener('click',()=>void send(batch));root.append(button);
  }
  if(message){const status=document.createElement('p');status.setAttribute('role','status');status.textContent=message;root.append(status);}
 }
 async function send(batch){
  if(busy||!isAllowed())return;busy=true;
  const ctx=getContext(),key=identity(),lines=batch.entries.map(e=>({...e.item})),snapshot=JSON.stringify(lines),revision=Number(getState().persistedRevision??0);render();
  try{
   if(!await confirmSend(`HN ${ctx.patientId} · Visit ${ctx.visitId} · ${lines.length} ລາຍການ. ກວດຊື່ຄົນເຈັບ, ແພ້ຢາ, ຈຳນວນ ແລະ ວິທີໃຊ້ກ່ອນສົ່ງ.`))return;
   const current=getBatches().find(b=>b.key===batch.key);
   if(identity()!==key||!isAllowed()||JSON.stringify(current?.entries.map(e=>({...e.item})))!==snapshot)throw Error('ENCOUNTER_CHANGED');
   const result=await client.send({patientId:ctx.patientId,visitId:ctx.visitId,expectedRevision:revision,batchId:batch.key,lines});
   if(identity()!==key)return;
   if(JSON.stringify(getBatches().find(b=>b.key===batch.key)?.entries.map(e=>({...e.item})))!==snapshot)throw Error('ENCOUNTER_CHANGED');
   getState().persistedRevision=result.revision;
   const ids=new Set(lines.map(l=>l.prescriptionItemId));
   getState().medications=getState().medications.map(l=>ids.has(l.prescriptionItemId)?{...l,status:'sent_to_pharmacy',pharmacyStatus:'sent_to_pharmacy'}:l);
   message='ບັນທຶກ ແລະ ສົ່ງຫ້ອງຢາແລ້ວ; ການກວດອື່ນຍັງບໍ່ຈົບ.';onSaved?.();
  }catch(error){if(identity()===key)message=error.message==='SUBMISSION_DISABLED'?'ຍັງບໍ່ເປີດສົ່ງຢາໃນ server; ຕິດຕໍ່ IT.':error.message==='INVALID_LINE'||error.message==='CATALOG_REQUIRED'?'ກວດລາຍການຢາ, ຈຳນວນ, Dose, Route, Frequency, Duration ແລະ ວິທີໃຊ້ໃຫ້ຄົບ.':'ຍັງຢືນຢັນການສົ່ງບໍ່ໄດ້; ກວດສະຖານະກ່ອນ, ຢ່າສ້າງຊຸດຢາຊ້ຳ.';}
  finally{busy=false;render();}
 }
 return{render};
}
