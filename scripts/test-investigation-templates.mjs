import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { resolveOpdTestInvestigationType } from '../src/opdTestPersistence.js';
import { defaultInvestigationTemplates, validateInvestigationTemplates, loadInvestigationTemplates, saveInvestigationTemplates,
  investigationCatalog, renderInvestigationSheet, buildInvestigationPreviewDocument, installInvestigationTemplates } from '../src/investigationTemplates.js';

const templates = defaultInvestigationTemplates();
validateInvestigationTemplates(templates);
assert.equal(templates[0].items.length,266);
assert.equal(templates[1].pages.length,2);
for (const template of templates) for(const page of template.pages) assert.ok(fs.existsSync(new URL(`../public${page.image}`,import.meta.url)));
const storage = {value:null,getItem(){return this.value},setItem(key,value){this.value=value}};
saveInvestigationTemplates(templates,storage);
assert.deepEqual(loadInvestigationTemplates(storage),templates);
storage.value='{broken';
assert.deepEqual(loadInvestigationTemplates(storage),templates);
const invalid=defaultInvestigationTemplates();invalid[0].pages[0].image='javascript:alert(1)';
assert.throws(()=>saveInvestigationTemplates(invalid,storage));
const catalog=investigationCatalog(templates);
assert.ok(catalog.find(row=>row.name==='CBC 24 p' && row.type==='lab'));
assert.ok(catalog.find(row=>row.name==='Whole Abdomen' && row.type==='ultrasound'));
const sheet=renderInvestigationSheet(templates[0],1,{selected:['CBC 24 p'],type:'lab'});
assert.equal((sheet.match(/it-check/g)||[]).length,1);
const edited=defaultInvestigationTemplates();edited[0].items[0].enabled=false;edited[0].items[0].hiddenOriginal=true;
assert.ok(!investigationCatalog(edited).some(row=>row.name==='CBC 24 p'));
assert.ok(renderInvestigationSheet(edited[0],1).includes('it-replacement'));
const print=buildInvestigationPreviewDocument({type:'lab',template:templates[0],patient:{id:'TEST-01',name:'<script>bad</script>'},
  items:[{name:'CBC 24 p'},{name:'CUSTOM UNSHEETED TEST',instructions:'fasting'}]});
assert.ok(print.includes('&lt;script&gt;bad&lt;/script&gt;'));
assert.ok(!print.includes('<script>bad</script>'));
assert.ok(print.includes('CUSTOM UNSHEETED TEST'));
assert.ok(print.includes('fasting'));
assert.ok(!print.includes('window.onload'));
assert.ok(print.includes('onclick="printRequestPdf()"'));

// Exercise the real catalog merge and routing used by the OPD screen.
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const block=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const actualWindow={getInvestigationCatalog:()=>catalog};
const context=vm.createContext({window:actualWindow,resolveOpdTestInvestigationType,Map,Set});
vm.runInContext(block('window.normalizeEMRLabFormMatchText =','window.normalizeEMRLabOrderText ='),context);
vm.runInContext(block('window.opdTestInvestigationTypeForItem =','window.opdTestInvestigationTypeMeta ='),context);
const merged=actualWindow.mergeEMRLabsWithOrderForm([{id:'DB-CBC',name:'CBC 24 p'},{id:'DB-US',name:'Whole Abdomen (Lab IMDC)'}]);
assert.equal(merged.find(row=>row.name==='CBC 24 p').id,'DB-CBC');
assert.equal(actualWindow.opdTestInvestigationTypeForItem(merged.find(row=>row.name==='Whole Abdomen (Lab IMDC)')),'ultrasound');
assert.equal(actualWindow.opdTestInvestigationTypeForItem({name:'Whole Abdomen',orderType:'lab'}),'lab','historical explicit type is preserved');
assert.ok(merged.some(row=>row.isFormVirtual && row.formReference.number===266));
let printed='',opened=0;
Object.assign(actualWindow,{
  can:()=>true,opdTestSelectedVisit:{patientId:'TEST-PRINT',patientName:'Local Patient'},
  opdTestDiagnosisValues:()=>['Local diagnosis'],
  opdTestInvestigationBatchForIndex:()=>({type:'lab',key:'LOCAL-BATCH',orderedAt:'2026-10-14T14:00:00+07:00',entries:[{item:{name:'CBC 24 p'}}]}),
  getInvestigationTemplateForType:type=>templates[type==='lab'?0:1],
  open:()=>{opened++;return {document:{open(){},write(html){printed=html},close(){}},close(){}};},
  opdTestSimpleAlert:()=>assert.fail('Unexpected print alert')
});
Object.assign(context,{document:{getElementById:()=>null},currentUser:{name:'Local Doctor'},labsMasterList:merged,buildInvestigationPreviewDocument});
vm.runInContext(block('window.opdTestInvestigationTypeMeta =','window.opdTestSetInvestigationPickerMode ='),context);
vm.runInContext(block('window.opdTestPrintOrderBatch =','window.opdTestEditMedicationBatch ='),context);
actualWindow.opdTestPrintOrderBatch('lab',0);
assert.equal(opened,1);
assert.ok(printed.includes('lab-1.png') && printed.includes('TEST-PRINT'));
assert.equal((printed.match(/class="it-check"/g)||[]).length,1);
actualWindow.can=()=>false;actualWindow.opdTestPrintOrderBatch('lab',0);
assert.equal(opened,1,'print permission blocks opening a preview');

globalThis.window={alert(){},confirm(){return true}};
globalThis.document={getElementById(){return null}};
globalThis.localStorage=storage;storage.value=null;
installInvestigationTemplates({canEdit:()=>true});
const uiCatalog=catalog.map((row,index)=>({index,name:row.name,type:row.type,formReference:row}));
const allLab=window.renderInvestigationPicker(uiCatalog,[],'lab','');
assert.equal((allLab.match(/onchange="window.toggleEMRLabPickerSelection/g)||[]).length,146,'every examination on page one is selectable');
window.investigationPickerPage=2;
assert.equal((window.renderInvestigationPicker(uiCatalog,[],'lab','').match(/onchange="window.toggleEMRLabPickerSelection/g)||[]).length,120);
window.investigationPickerPage=1;
assert.ok(allLab.includes('it-picker-crop'));
assert.ok(!allLab.includes('it-page-label">'));
const mixedPreview=buildInvestigationPreviewDocument({type:'lab',template:templates[0],items:[{name:'CBC 24 p'},{name:'Whole Abdomen'}]});
assert.equal((mixedPreview.match(/class="it-check"/g)||[]).length,2,'mixed examinations remain checked on the full printed form');
assert.ok(!mixedPreview.includes('class="it-picker-crop"'));
const filtered=window.renderInvestigationPicker(uiCatalog,[],'ultrasound','whole abdomen');
assert.equal((filtered.match(/onchange="window.toggleEMRLabPickerSelection/g)||[]).length,1);
assert.ok(filtered.includes('it-search-choice'));
window.itEditorAction('addItem');window.itEditorUpdate('name','NEW LOCAL TEST');window.itEditorAction('save');
assert.ok(window.getInvestigationCatalog().some(row=>row.name==='NEW LOCAL TEST'));
window.itEditorAction('copy');window.itEditorAction('prefer','lab');window.itEditorAction('save');
assert.ok(window.getInvestigationTemplateForType('lab').id.startsWith('custom-'));
const saved=storage.value;
installInvestigationTemplates({canEdit:()=>false});window.itEditorAction('deleteTemplate');
assert.equal(storage.value,saved);
console.log('Investigation templates: catalog, search, preview, escaping, CRUD, activation, permissions and persistence passed.');
