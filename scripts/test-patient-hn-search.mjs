import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import {applyPatientRegistryGlobalSearch,patientRegistrySearchTokens} from '../src/patientRegistrySearch.js';
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const start=main.indexOf('window.applyPatientRegistryFilters = function');const end=main.indexOf('window.patientRegistryHasFilters',start);assert(start>0&&end>start);
const context={window:{patientRegistrySearchTokens},applyPatientRegistryGlobalSearch,$:selector=>({val:()=>selector==='#patientDateFrom'?'2021-01-01':''})};
vm.runInNewContext(main.slice(start,end),context);
function builder(){const calls=[];const query={calls,eq(...args){calls.push(['eq',...args]);return query;},ilike(...args){calls.push(['ilike',...args]);return query;},or(...args){calls.push(['or',...args]);return query;},gte(...args){calls.push(['gte',...args]);return query;},lte(...args){calls.push(['lte',...args]);return query;}};return query;}
const run=value=>context.window.applyPatientRegistryFilters(builder(),{search:{value}}).calls;
assert.deepEqual(run('lxh2021-000041'),[['eq','Patient_ID','LXH2021-000041'],['gte','Registration_Date','2021-01-01']]);
assert.deepEqual(run('LXH2021'),[['ilike','Patient_ID','LXH2021%'],['gte','Registration_Date','2021-01-01']]);
assert.equal(run('LXH2021-0000')[0][2],'LXH2021-0000%');
const ordinary=run('Synthetic Patient');assert.equal(ordinary.filter(call=>call[0]==='or').length,2);assert.equal(ordinary[0][1].split(',').length,7);
assert.equal(run('020123')[0][0],'or');assert.equal(run('LXH2021 Clinic')[0][0],'or');assert.equal(run('LXH2021%')[0][0],'or');
const combined=context.window.applyPatientRegistryFilters(builder(),{search:{value:'LXH2021'},columns:{3:{search:{value:'13579'}},4:{search:{value:'Synthetic'}},7:{search:{value:'020'}}}}).calls;
assert.equal(combined[0][0],'ilike');assert(combined.some(call=>call[0]==='or'&&call[1]==='Old_Patient_ID.ilike.%13579%'));assert.equal(combined.at(-1)[0],'gte');
const ids=Array.from({length:41},(_,index)=>'LXH2021-'+String(index+1).padStart(6,'0'));assert.equal(ids.filter(id=>id.startsWith(run('LXH2021')[0][2].slice(0,-1))).length,41);assert.equal(ids.filter(id=>id===run('LXH2021-000041')[0][2]).length,1);
console.log('PASS actual registry filter: canonical exact/prefix HN, generic text/phone/org compatibility, combined filters/date and 41-row synthetic prefix semantics. No database access.');
