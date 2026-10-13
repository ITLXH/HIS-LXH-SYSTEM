import assert from 'node:assert/strict';
import {watchRelease} from '../src/releaseSafety.js';
function fixture(){
 let id=0,unsafe=false,fetches=0,reloads=0;
 const timers=new Map(),events=new Map();
 const doc={visibilityState:'visible',activeElement:null,querySelector:()=>unsafe?{}:null,querySelectorAll:()=>[],addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
 const browser={document:doc,navigator:{onLine:true},location:{reload:()=>reloads++},fetch:async()=>{fetches++;return {ok:true,json:async()=>({version:'new'})};},setTimeout:(f,ms)=>{timers.set(++id,{f,ms});return id;},clearTimeout:i=>timers.delete(i),setInterval:(f,ms)=>{timers.set(++id,{f,ms,interval:true});return id;},clearInterval:i=>timers.delete(i),addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
 return {browser,doc,timers,events,setUnsafe:x=>unsafe=x,stats:()=>({fetches,reloads}),async run(ms){const entry=[...timers].find(([,v])=>v.ms===ms);assert.ok(entry);if(!entry[1].interval)timers.delete(entry[0]);await entry[1].f();}};
}
const a=fixture();let invalidations=0,notices=0;
a.setUnsafe(true);const stop=watchRelease('old',a.browser,{beforeReload:async()=>invalidations++,onAvailable:()=>notices++});
await a.run(10000);assert.equal(invalidations,0);assert.equal(a.stats().reloads,0);assert.equal(notices,1);
await a.run(5000);assert.equal(invalidations,0,'editing still retains authentication');
a.setUnsafe(false);await a.run(5000);assert.equal(invalidations,1);assert.equal(a.stats().reloads,1);stop();assert.equal(a.timers.size,0);assert.equal(a.events.size,0);
const b=fixture();b.doc.visibilityState='hidden';const stopB=watchRelease('old',b.browser);await b.run(10000);assert.equal(b.stats().fetches,0);b.doc.visibilityState='visible';b.browser.navigator.onLine=false;await b.run(60000);assert.equal(b.stats().fetches,0);stopB();
const c=fixture();let resolve;const pending=new Promise(r=>resolve=r);c.browser.fetch=async()=>{await pending;return {ok:true,json:async()=>({version:'new'})};};let called=0;const stopC=watchRelease('old',c.browser,{beforeReload:()=>called++});const running=c.run(10000);stopC();resolve();await running;assert.equal(called,0);assert.equal(c.stats().reloads,0,'late response after cleanup cannot reload');
const d=fixture();d.browser.fetch=async()=>({ok:true,json:async()=>{throw Error('HTML fallback');}});const stopD=watchRelease('old',d.browser,{beforeReload:()=>called++});await d.run(10000);assert.equal(d.stats().reloads,0);stopD();
const e=fixture();let busy=true;const stopE=watchRelease('old',e.browser,{isBusy:()=>busy});await e.run(10000);assert.equal(e.stats().reloads,0);busy=false;await e.run(5000);assert.equal(e.stats().reloads,1);stopE();
console.log('PASS release safety: dirty/pending work, safe re-login, hidden/offline, invalid manifest, cleanup and late responses.');

const offlinePending=fixture();offlinePending.setUnsafe(true);const stopOffline=watchRelease('old',offlinePending.browser);await offlinePending.run(10000);offlinePending.setUnsafe(false);offlinePending.browser.navigator.onLine=false;await offlinePending.run(5000);assert.equal(offlinePending.stats().reloads,0,'pending release must not log out while offline');offlinePending.browser.navigator.onLine=true;await offlinePending.run(5000);assert.equal(offlinePending.stats().reloads,1);stopOffline();
