import assert from 'node:assert/strict';
import {installResultToasts} from '../src/clinicalResultToasts.js';
class Element {constructor(tag){this.tagName=tag;this.children=[];this.dataset={};}appendChild(child){this.children.push(child);child.parentElement=this;return child;}setAttribute(key,value){this[key]=value;}remove(){this.parentElement.children=this.parentElement.children.filter(child=>child!==this);}replaceChildren(){this.children=[];}querySelectorAll(){return this.children;} }
const body=new Element('body'),document={body,createElement:tag=>new Element(tag),getElementById:id=>body.children.find(e=>e.id===id)};
let allowed=false,opened=0,next=0;const timers=new Map();
const window={setTimeout(fn,ms){timers.set(++next,{fn,ms});return next;},clearTimeout(id){timers.delete(id);}};
installResultToasts({window,document,canNotify:()=>allowed});
window.showConnectedResultToast({source:'UXI',patientId:'SYN',onOpen:()=>opened++});assert.equal(body.children.length,0);
allowed=true;window.showConnectedResultToast({source:'UXI',patientId:'<img src=x>',onOpen:()=>opened++});
const host=document.getElementById('clinicalResultToastContainer');assert(host);assert.equal(host.children.length,1);assert.equal([...timers.values()][0].ms,5000);
host.children[0].onclick();assert.equal(opened,1);
[...timers.values()][0].fn();assert.equal(host.children.length,0);
window.showConnectedResultToast({source:'PMC',patientId:'SYN',onOpen:()=>opened++});allowed=false;host.children[0].onclick();assert.equal(opened,1);
window.clearConnectedResultToasts();assert.equal(host.children.length,0);assert.equal(timers.size,0);
console.log('Bottom-right result toast lifecycle checks passed');
