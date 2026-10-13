
export function hasUnsavedWork(doc) {
  if (doc.querySelector('.modal.show, .swal2-container.swal2-shown, [role="dialog"], [data-release-saving="true"]')) return true;
  if (doc.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return true;
  return [...doc.querySelectorAll('[data-release-dirty="true"]')].some(el => el.getClientRects().length);
}
export function watchRelease(version, browser, options = {}) {
  let pending='', checking=false, stopped=false, reloading=false, retry=null;
  const doc=browser.document;
  const mark=event=>{ const container=event.target?.closest?.('form, .page, .modal, .panel, .workspace'); if(container)container.dataset.releaseDirty='true'; };
  const reset=event=>{ const container=event.target?.closest?.('form'); if(container)delete container.dataset.releaseDirty; };
  const clearSaved=event=>{ const container=event.target; if(container?.dataset)delete container.dataset.releaseDirty; };
  async function reloadWhenSafe() {
    if(stopped||!pending||reloading)return;
    if(browser.navigator?.onLine===false||doc.visibilityState==='hidden'||hasUnsavedWork(doc)||options.isBusy?.()) {
      if(retry===null)retry=browser.setTimeout(()=>{retry=null;void reloadWhenSafe();},5000);
      return;
    }
    reloading=true;
    try { await options.beforeReload?.(pending); if(!stopped)browser.location.reload(); }
    catch { reloading=false; if(!stopped&&retry===null)retry=browser.setTimeout(()=>{retry=null;void reloadWhenSafe();},5000); }
  }
  async function check() {
    if(stopped||checking||reloading||doc.visibilityState==='hidden'||browser.navigator?.onLine===false)return;
    if(pending){await reloadWhenSafe();return;}
    checking=true;
    const controller=new AbortController();
    const timeout=browser.setTimeout(()=>controller.abort(),10000);
    try {
      const response=await browser.fetch('/version.json?t='+Date.now(),{cache:'no-store',signal:controller.signal});
      if(!response.ok)return;
      const payload=await response.json();
      if(stopped||typeof payload?.version!=='string'||!payload.version.trim()||payload.version===version)return;
      pending=payload.version;
      options.onAvailable?.(pending);
      await reloadWhenSafe();
    } catch { /* Offline/invalid manifest preserves current session and clinical work. */ }
    finally { checking=false;browser.clearTimeout(timeout); }
  }
  doc.addEventListener('input',mark,true);doc.addEventListener('change',mark,true);
  doc.addEventListener('reset',reset,true);doc.addEventListener('release:work-saved',clearSaved,true);
  doc.addEventListener('visibilitychange',check);browser.addEventListener('focus',check);
  const poll=browser.setInterval(check,60000),initial=browser.setTimeout(check,10000);
  return ()=>{stopped=true;browser.clearInterval(poll);browser.clearTimeout(initial);if(retry!==null)browser.clearTimeout(retry);
    doc.removeEventListener('input',mark,true);doc.removeEventListener('change',mark,true);doc.removeEventListener('reset',reset,true);
    doc.removeEventListener('release:work-saved',clearSaved,true);doc.removeEventListener('visibilitychange',check);browser.removeEventListener('focus',check);};
}
export function showReleaseNotice(doc) {
  if(doc.getElementById('release-session-notice'))return;
  const notice=doc.createElement('div');notice.id='release-session-notice';notice.setAttribute('role','status');
  notice.textContent='ມີລຸ້ນໃໝ່ · ບັນທຶກ/ເກັບວຽກທີ່ກຳລັງເຮັດ ແລະປິດໜ້າແກ້ໄຂກ່ອນ reload ເພື່ອ login ໃໝ່.';
  notice.style.cssText='position:fixed;top:0;left:0;right:0;z-index:20000;padding:12px;background:#fff3cd;color:#533f03;text-align:center';
  doc.body.appendChild(notice);
}
