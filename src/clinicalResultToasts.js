export function installResultToasts({window,document,canNotify}) {
  const timers=new Map();
  window.getGlobalClinicalResultToastContainer=function(){
    let host=document.getElementById('clinicalResultToastContainer');
    if(!host){host=document.createElement('div');host.id='clinicalResultToastContainer';host.className='opd-toast-container clinical-result-toast-container';host.setAttribute('aria-live','polite');host.setAttribute('aria-atomic','false');}
    if(host.parentElement!==document.body)document.body.appendChild(host);
    return host;
  };
  function dismiss(toast){const timer=timers.get(toast);if(timer)window.clearTimeout(timer);timers.delete(toast);toast.remove();}
  window.clearConnectedResultToasts=()=>{[...timers.keys()].forEach(dismiss);};
  window.showConnectedResultToast=function({source,patientId,onOpen}){
    if(!canNotify()||!['UXI','PMC'].includes(source))return;
    const host=window.getGlobalClinicalResultToastContainer();
    const toast=document.createElement('div');toast.className='opd-toast opd-lis-result-toast connected-result-toast';toast.dataset.source=source;toast.setAttribute('role','button');toast.setAttribute('tabindex','0');
    const icon=document.createElement('span');icon.className='opd-toast-icon';icon.textContent='✓';
    const body=document.createElement('div');body.className='opd-toast-body';
    const title=document.createElement('div');title.className='opd-toast-title';title.textContent=source==='UXI'?'ຜົນ UXI ອັບເດດແລ້ວ':'ສະຖານະ PMC ອັບເດດແລ້ວ';
    const detail=document.createElement('div');detail.className='opd-toast-text';detail.textContent=`HN ${patientId}`;
    body.appendChild(title);body.appendChild(detail);
    const close=document.createElement('button');close.className='opd-toast-close';close.textContent='×';close.setAttribute('aria-label','ປິດ');close.onclick=event=>{event.stopPropagation();dismiss(toast);};
    toast.appendChild(icon);toast.appendChild(body);toast.appendChild(close);
    toast.onclick=()=>{if(canNotify())onOpen?.();};
    toast.onkeydown=event=>{if(event.target===toast&&['Enter',' '].includes(event.key)){event.preventDefault();toast.onclick();}};
    host.appendChild(toast);timers.set(toast,window.setTimeout(()=>dismiss(toast),5000));
    while(timers.size>3)dismiss(timers.keys().next().value);
  };
}
