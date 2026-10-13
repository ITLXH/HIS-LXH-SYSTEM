import { watchRelease, hasUnsavedWork, showReleaseNotice } from './releaseSafety.js';
export const HIS_BUILD_ID = typeof __HIS_BUILD_ID__ !== 'undefined' ? String(__HIS_BUILD_ID__) : 'development';
export const hasVisibleUnsavedWork = (doc=document) => hasUnsavedWork(doc);
export function startBuildVersionRefresh(options={}) {
  if(typeof window==='undefined'||['localhost','127.0.0.1'].includes(window.location.hostname))return ()=>{};
  if(window.__hisVersionRefreshStarted)return window.__hisStopVersionRefresh;
  window.__hisVersionRefreshStarted=true;
  const stop=watchRelease(HIS_BUILD_ID,window,{beforeReload:options.beforeReload,onAvailable:()=>showReleaseNotice(document)});
  window.__hisStopVersionRefresh=()=>{stop();window.__hisVersionRefreshStarted=false;};
  return window.__hisStopVersionRefresh;
}
