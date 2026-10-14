import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
const root=process.argv[2]||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');const a=main.indexOf('window.executeTriageSave = async function');const b=main.indexOf('window.openEMRLabModal',a);assert(a>=0&&b>a);
async function run(options={}){
 let historyWrites=0,visitWrites=0,closed=0,refreshes=0,logs=[];const alerts=[],rows=[{visitId:'SYN-V',sentinel:'preserve'}];
 const fd={visitId:'SYN-V',patientId:'SYN-P',v_clinical_department:'ER',v_department:'Room S',v_temp:'37',v_bp:'120/80',v_symptoms:'SYNTHETIC-SYMPTOM'};
 const window={ipdParseBloodPressure:()=>({systolic:120,diastolic:80}),ipdCalculateBmiValue:()=>22,combineLocalDateTimeIso:()=> '2026-10-14T10:00:00Z',ipdId:()=> 'SYN-VITAL',ipdCurrentUserName:()=> 'Synthetic Nurse',ipdNeedsMigration:error=>['PGRST204','42703','PGRST205'].includes(error?.code),formDateFromIso:()=> '2026-10-14',formTimeFromIso:()=> '17:00',logAction(){},loadTriageQueue(){refreshes++;},loadQueue(){refreshes++;}};
 const supabaseClient={from(table){if(table==='OPD_Vital_Signs')return {async insert(){historyWrites++;if(options.historyThrows)throw Error('Synthetic outage');return {error:options.historyError??null,status:options.historyStatus};}};
 assert.equal(table,'Visits');return {update(){visitWrites++;const filters={};const query={eq(key,value){filters[key]=value;return query;},async select(){assert.equal(filters.Visit_ID,'SYN-V');assert.equal(filters.Patient_ID,'SYN-P');if(options.visitThrows)throw Error('Synthetic outage');if(options.fallback&&visitWrites===1)return {data:null,error:{code:'PGRST204'}};return {data:options.data??[{Visit_ID:'SYN-V',Patient_ID:'SYN-P'}],error:options.visitError??null};}};return query;}};}};
 const context={window,supabaseClient,dbTable:value=>value,currentUser:{id:'SYN-USER'},currentTriageData:rows,Date,String,Boolean,Array,Number,console:{log(...args){logs.push(args.join(' '));},warn(...args){logs.push(args.join(' '));}},Swal:{fire(...args){alerts.push(args);},showLoading(){}},$:()=>({modal(action){if(action==='hide')closed++;}})};
 vm.runInNewContext(main.slice(a,b),context);await window.executeTriageSave(fd);
 assert(!logs.some(line=>line.includes('SYN-P')||line.includes('SYNTHETIC-SYMPTOM')),'clinical identifiers/symptoms are not logged');
 return {historyWrites,visitWrites,closed,refreshes,alerts,rows};
}
let result=await run();assert.equal(result.closed,1);assert.equal(result.refreshes,2);assert.equal(result.alerts.at(-1)[2],'success');
result=await run({historyError:{code:'PGRST205',message:'Missing table'}});assert.equal(result.visitWrites,1);assert.equal(result.closed,1);assert.equal(result.alerts.at(-1)[2],'warning');
for(const historyError of [{code:'42501',message:'Denied'},{code:'PGRST204',message:'Missing column'},{code:'23514',message:'Invalid value'}]){result=await run({historyError});assert.equal(result.visitWrites,0);assert.equal(result.closed,0);assert.equal(result.alerts.at(-1)[2],'error');assert.equal(result.rows[0].sentinel,'preserve');}
for(const data of [[],[{Visit_ID:'OTHER',Patient_ID:'SYN-P'}],[{Visit_ID:'SYN-V',Patient_ID:'OTHER'}]]){result=await run({data});assert.equal(result.closed,0);assert.equal(result.refreshes,0);assert.equal(result.alerts.at(-1)[2],'error');assert.equal(result.rows[0].sentinel,'preserve');}
for(const options of [{historyThrows:true},{visitThrows:true},{visitError:{code:'42501',message:'Denied'}}]){result=await run(options);assert.equal(result.closed,0);assert.equal(result.alerts.at(-1)[2],'error');}
result=await run({fallback:true});assert.equal(result.visitWrites,2);assert.equal(result.closed,1);assert.equal(result.alerts.at(-1)[2],'success');
console.log('PASS actual triage save: normal/legacy Visit save, honest missing-history warning, column/permission/validation rejection, empty/wrong Visit/Patient refusal, transport errors, RR/O2 compatibility and no clinical debug logs. Synthetic only.');
