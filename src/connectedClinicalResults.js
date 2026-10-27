/** Source records are presentation only; never merge patient history into a visit draft. */
export function installConnectedResults({window,document,getSession,isSignedIn,fetcher=fetch}) {
  const pending=new Map();
  const snapshots=new Map();
  let generation=0;
  const ids={xray:'opdTestUxiXrayResults',ultrasound:'opdTestUxiUltrasoundResults',medication:'opdTestPmcResults'};
  const html=value=>window.opdTestHtml(value??'');
  const date=value=>html(window.opdTestLisFormatDateTime(value));
  const scope=()=>({patientId:window.opdTestLisPatientId(),visitId:String(window.opdTestSelectedVisit?.visitId||window.opdTestSelectedVisit?.rowIdx||'')});
  const key=value=>`${value.patientId}:${value.visitId}:${window.clinicalPresentationEpoch||0}`;
  const set=(type,value)=>{const host=document.getElementById(ids[type]);if(host)host.innerHTML=value;};
  const message=text=>`<p class="connected-result-message">${html(text)}</p>`;
  window.clearConnectedClinicalResults=()=>{generation++;pending.clear();snapshots.clear();window.clearConnectedResultToasts?.();Object.keys(ids).forEach(type=>set(type,''));};

  function imaging(body) {
    ['xray','ultrasound'].forEach(type=>{
      const rows=body.results.filter(row=>{
        const exams=Array.isArray(row.exams)?row.exams:[];
        const ultrasound=exams.some(exam=>/ultrasound|sonogra|^US$/i.test(exam.modality||''));
        const xray=exams.some(exam=>/x.?ray|radiograph|^DX$|^CR$/i.test(exam.modality||''));
        return type==='ultrasound'?ultrasound:(xray||!ultrasound);
      });
      set(type,`<div class="connected-result-heading">UXI · ປະຫວັດຜົນຂອງຄົນເຈັບ</div>${rows.length?rows.map(row=>`<article class="connected-result-card" data-result-scope="patient-history">
        <strong>${html((row.exams||[]).map(exam=>exam.name).join(', '))}</strong>
        <div class="connected-result-meta">${html(row.id)} · ${html(row.status)} · ວັນທີກວດ ${date(row.orderedAt)} · ອອກຜົນ ${date(row.reportedAt)}</div>
        <small>ປະຫວັດ HN ນີ້ · ຍັງບໍ່ຜູກກັບ Visit ປັດຈຸບັນ</small>
        <p class="connected-result-report">${html(row.report)}</p>
        <div class="connected-result-files">${(row.files||[]).map(file=>{
          let url;try{url=new URL(file.url,'https://his.invalid');}catch{return '';}
          if(url.origin!=='https://his.invalid'||url.pathname!=='/api/uxi/result-file'||url.searchParams.get('patientId')!==body.patientId||url.searchParams.get('orderId')!==row.id)return '';
          return `<a class="btn btn-sm btn-outline-primary" href="${html(url.pathname+url.search)}" target="_blank" rel="noopener"><i class="fas fa-eye" aria-hidden="true"></i> ${html(file.name)}</a>`;
        }).join('')}</div></article>`).join(''):message('ຍັງບໍ່ມີຜົນ UXI ທີ່ອອກລາຍງານແລ້ວ')}${body.hasMore?message('ສະແດງ 50 ຜົນລ່າສຸດ · ປະຫວັດເຕັມຢູ່ UXI'):''}`);
    });
  }
  function pharmacy(body) {
    const decision={READY:'ກວດຮັບແລ້ວ',HOLD:'ລໍກວດສອບ',REJECTED:'ປະຕິເສດ'};
    set('medication',`<div class="connected-result-heading">PMC · ຜົນການຈ່າຍຢາຂອງ Visit ນີ້</div>
      ${!body.clinicalEnabled?message('PMC ຍັງປິດການຈ່າຍຢາຈິງ · ສະແດງສະເພາະປະຫວັດທີ່ບັນທຶກແລ້ວ'):''}
      ${body.rows.length?body.rows.map(row=>`<article class="connected-result-card"><strong>${html(row.prescriptionId)} · Revision ${html(row.revision)}</strong><div class="connected-result-meta">${html(row.status)} · ${date(row.receivedAt)}</div>
      <div class="table-responsive"><table class="table table-sm"><thead><tr><th>ລາຍການຢາ</th><th>ສັ່ງ</th><th>ຈ່າຍ</th><th>ສົ່ງຄືນ</th><th>ກວດຮັບ</th></tr></thead><tbody>${row.lines.map(line=>`<tr><td>${html(line.name)} <small>${html(line.unit)}</small></td><td>${html(line.ordered)}</td><td>${html(line.issued)}</td><td>${html(line.returned)}</td><td>${html(decision[line.decision]||'ລໍກວດຮັບ')}${line.reason?` · ${html(line.reason)}`:''}</td></tr>`).join('')}</tbody></table></div></article>`).join(''):message('ຍັງບໍ່ມີຜົນຕອບກັບຈາກ PMC ສຳລັບ Visit ນີ້')}
      ${body.hasMore?message('ສະແດງ 50 ໃບສັ່ງລ່າສຸດ'):''}`);
  }

  window.opdTestFetchConnectedResults=async function(type) {
    if(!isSignedIn())return;
    const identity=scope(),captured=key(identity),stamp=generation;
    if(!identity.patientId||(type==='medication'&&!identity.visitId))return;
    const kind=type==='medication'?'pmc':'uxi',requestKey=`${kind}:${captured}`;
    if(pending.has(requestKey))return pending.get(requestKey);
    const types=kind==='pmc'?['medication']:['xray','ultrasound'];
    const current=()=>isSignedIn()&&stamp===generation&&captured===key(scope());
    const work=(async()=>{
      types.forEach(name=>set(name,message('ກຳລັງດຶງຜົນ...')));
      try {
        const session=await getSession(),token=session.data?.session?.access_token;
        if(session.error||!token||!current())throw Error('ກະລຸນາ login ໃໝ່');
        const query=new URLSearchParams(kind==='pmc'?identity:{patientId:identity.patientId});
        const response=await fetcher(`/api/${kind}/results?${query}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15_000)});
        if(!response.ok)throw Error(response.status===401||response.status===403?'ບໍ່ມີສິດເບິ່ງຜົນ · ກະລຸນາ login ໃໝ່':`${kind.toUpperCase()} ຍັງບໍ່ພ້ອມ · ກະລຸນາລອງໂຫຼດໃໝ່`);
        const body=await response.json();
        const latest=await getSession();
        if(!current()||latest.error||latest.data?.session?.access_token!==token)return;
        if(body.patientId!==identity.patientId||(kind==='pmc'&&(body.schema!=='pmc-his-results-v1'||body.visitId!==identity.visitId||!Array.isArray(body.rows)||body.rows.length>50))||(kind==='uxi'&&(body.schema!=='his-uxi-results-v1'||!Array.isArray(body.results)||body.results.length>50)))throw Error('ຂໍ້ມູນຜົນບໍ່ກົງ · ກະລຸນາໂຫຼດໃໝ່');
        if(kind==='pmc')pharmacy(body);else imaging(body);
        const fingerprint=JSON.stringify(kind==='pmc'?body.rows:body.results);
        const previous=snapshots.get(requestKey);snapshots.set(requestKey,fingerprint);
        if(previous!==undefined&&previous!==fingerprint&&(kind==='pmc'?body.rows:body.results).length){
          const oldRows=JSON.parse(previous);
          const changed=kind==='uxi'?body.results.find(row=>!oldRows.some(old=>old.id===row.id&&JSON.stringify(old)===JSON.stringify(row))):null;
          const resultType=kind==='pmc'?'medication':changed?.exams?.some(exam=>/ultrasound|sonogra|^US$/i.test(exam.modality||''))?'ultrasound':'xray';
          window.showConnectedResultToast?.({source:kind==='pmc'?'PMC':'UXI',patientId:identity.patientId,onOpen:()=>{
            if(!current())return;
            window.opdTestSelectOrderTab?.(resultType);
            document.getElementById(ids[resultType])?.scrollIntoView?.({behavior:'smooth',block:'nearest'});
          }});
        }
      } catch(error) {
        if(current())types.forEach(name=>set(name,message(error?.name==='TimeoutError'?'ດຶງຜົນຊ້າເກີນໄປ · ລອງໂຫຼດໃໝ່':error.message||'ດຶງຜົນບໍ່ສຳເລັດ')));
      }
    })();
    pending.set(requestKey,work);
    try{await work;}finally{if(pending.get(requestKey)===work)pending.delete(requestKey);}
  };
}
