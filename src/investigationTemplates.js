import defaults from './investigationTemplateDefaults.json' with { type: 'json' };
import { escapeHisHtml as esc } from '../shared/his-html.js';
import { createRequestFormPdf } from './requestFormPdf.js';

const STORAGE_KEY = 'his_investigation_templates_v1';
const clone = value => JSON.parse(JSON.stringify(value));
export const normalizeInvestigationName = value => String(value || '').toLowerCase()
  .replace(/\((?:lab\s*imdc|lab\s*thai|150\s*hospital|sth|mtp\s*lab)\)/gi, '')
  .replace(/[^a-z0-9\u0e80-\u0eff]+/g, '');
export const defaultInvestigationTemplates = () => clone(defaults);
const safeImage = value => /^\/order-forms\/[a-z0-9-]+\.png$/i.test(value)
  || /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value);

export function validateInvestigationTemplates(templates) {
  if (!Array.isArray(templates) || !templates.length || templates.length > 20) throw new Error('ຕ້ອງມີແບບໃບສັ່ງ 1–20 ແບບ');
  const ids = new Set();
  for (const template of templates) {
    if (!/^[a-z0-9_-]+$/i.test(template.id || '') || ids.has(template.id) || !String(template.title || '').trim()) throw new Error('ຊື່ ຫຼື ID ແບບໃບສັ່ງບໍ່ຖືກຕ້ອງ');
    ids.add(template.id);
    if (!Array.isArray(template.pages) || !template.pages.length || template.pages.length > 10) throw new Error('ຈຳນວນໜ້າບໍ່ຖືກຕ້ອງ');
    template.pages.forEach(page => {
      if (!safeImage(page.image) || !Number.isFinite(page.width) || page.width <= 0 || !Number.isFinite(page.height) || page.height <= 0) throw new Error('ຮູບໜ້າໃບສັ່ງບໍ່ຖືກຕ້ອງ');
    });
    if (!Array.isArray(template.items) || !Array.isArray(template.fields) || template.items.length > 1000 || template.fields.length > 100) throw new Error('ລາຍການໃນແບບໃບສັ່ງບໍ່ຖືກຕ້ອງ');
    if (template.preferredFor?.some(type => !['lab','ultrasound','xray'].includes(type))) throw new Error('ປະເພດແບບໃບສັ່ງບໍ່ຖືກຕ້ອງ');
    const rowIds = new Set();
    for (const row of [...template.items, ...template.fields]) {
      const page = template.pages[row.page - 1];
      if (!/^[a-z0-9_-]+$/i.test(row.id || '') || rowIds.has(row.id) || !page || !Number.isInteger(row.page)) throw new Error('ລາຍການ ຫຼື ໜ້າບໍ່ຖືກຕ້ອງ');
      rowIds.add(row.id);
      if (![row.x, row.y, row.width, row.height].every(Number.isFinite) || row.x < 0 || row.y < 0 || row.width <= 0 || row.height <= 0 || row.x + row.width > page.width + 1 || row.y + row.height > page.height + 1) throw new Error('ຕຳແໜ່ງລາຍການຕ້ອງຢູ່ພາຍໃນໜ້າ');
      if ('name' in row && (!row.name.trim() || !['lab', 'ultrasound', 'xray'].includes(row.type))) throw new Error('ຊື່ ຫຼື ປະເພດກວດບໍ່ຖືກຕ້ອງ');
      if ('key' in row && (!['patientId','patientName','phone','orderNo','date','diagnosis','history','doctor'].includes(row.key) || !Number.isFinite(row.fontSize) || row.fontSize < 5 || row.fontSize > 36)) throw new Error('ຊ່ອງຂໍ້ມູນບໍ່ຖືກຕ້ອງ');
      if (row.originalPosition && (!template.pages[row.originalPosition.page-1] || ![row.originalPosition.x,row.originalPosition.y,row.originalPosition.width,row.originalPosition.height].every(Number.isFinite))) throw new Error('ຕຳແໜ່ງເດີມບໍ່ຖືກຕ້ອງ');
    }
  }
  return templates;
}

export function loadInvestigationTemplates(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    return saved ? validateInvestigationTemplates(JSON.parse(saved)) : defaultInvestigationTemplates();
  } catch { return defaultInvestigationTemplates(); }
}

export function saveInvestigationTemplates(templates, storage = globalThis.localStorage) {
  validateInvestigationTemplates(templates);
  storage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

const position = (row, page) => `left:${row.x / page.width * 100}%;top:${row.y / page.height * 100}%;width:${row.width / page.width * 100}%;height:${row.height / page.height * 100}%;`;
const itemMatches = (item, name) => [item.name, item.baseName].some(candidate => normalizeInvestigationName(candidate) === normalizeInvestigationName(name));

export function investigationCatalog(templates) {
  const unique = new Map();
  for (const template of templates) for (const item of template.items) {
    if (item.enabled === false) continue;
    const key = `${item.type}:${normalizeInvestigationName(item.name)}`;
    if (!unique.has(key)) unique.set(key, { ...item, templateId: template.id });
  }
  return [...unique.values()];
}

export function renderInvestigationSheet(template, pageNumber, options = {}) {
  const page = template.pages[pageNumber - 1];
  const selected = options.selected || [];
  const query = String(options.query || '').toLowerCase().trim();
  const rows = template.items.filter(item => item.page === pageNumber);
  const overlay = rows.map(item => {
    const isSelected = selected.some(name => itemMatches(item, name));
    const active = item.enabled !== false && (!options.restrictType || item.type === options.type);
    const matches = !query || `${item.number} ${item.name} ${item.baseName || ''}`.toLowerCase().includes(query);
    const catalogItem = options.catalog?.find(row => row.formReference?.templateId === template.id && row.formReference?.id === item.id)
      || options.catalog?.find(row => itemMatches(item, row.formReference?.name || row.name));
    const changed = !item.original || item.name !== item.baseName || item.number !== (item.originalNumber ?? item.number) || item.hiddenOriginal || item.originalPosition;
    const replacement = changed ? `<span class="it-replacement">${item.enabled === false ? '' : `${esc(item.number || '')}. ${esc(item.name)}`}</span>` : '';
    if (options.interactive && active && matches && catalogItem) {
      return `<label class="it-row ${isSelected ? 'it-selected' : ''} ${query ? 'it-match' : ''}" style="${position(item,page)}" title="${esc(item.name)}">
        ${replacement}<input aria-label="${esc(item.name)}" type="checkbox" ${isSelected ? 'checked' : ''} onchange="window.toggleEMRLabPickerSelection(${catalogItem.index},this.checked)"><span class="it-check">${isSelected ? '✓' : ''}</span></label>`;
    }
    return `<div class="it-row ${options.interactive && (!active || !matches) ? 'it-muted' : ''}" style="${position(item,page)}">${replacement}${isSelected && active ? '<span class="it-check">✓</span>' : ''}</div>`;
  }).join('');
  const masks = template.items.filter(item => item.originalPosition?.page === pageNumber).map(item =>
    `<span class="it-row" style="${position(item.originalPosition,page)}background:white"></span>`).join('');
  const fields = (options.fields || []).filter(field => field.page === pageNumber).map(field => {
    const value = options.values?.[field.key];
    if (!value) return '';
    return `<span class="it-field" style="${position(field,page)}font-size:${field.fontSize || 11}pt">${esc(value)}</span>`;
  }).join('');
  const sheet = `<section class="it-sheet" style="aspect-ratio:${page.width}/${page.height}" data-template-page="${pageNumber}"><img class="it-background" src="${esc(page.image)}" alt="${esc(template.title)} — ${pageNumber}" draggable="false">${masks}${overlay}${fields}</section>`;
  if (!options.interactive || options.fullPage) return sheet;
  const top = Math.max(0,Math.min(page.pickerTop ?? Math.min(...rows.map(row=>row.y))-20,...rows.map(row=>row.y)));
  const bottom = Math.min(page.height,Math.max(page.pickerBottom ?? 0,...rows.map(row=>row.y+row.height)));
  return `<div class="it-picker-crop" style="aspect-ratio:${page.width}/${bottom-top};width:min(100%,calc(var(--it-picker-content-height,65dvh) * ${page.width/(bottom-top)}))"><div style="position:absolute;left:0;right:0;top:-${top/(bottom-top)*100}%">${sheet}</div></div>`;
}

export const investigationSheetStyles = `
.it-sheet{position:relative;width:100%;background:white;overflow:hidden;isolation:isolate}
.it-background{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:-1}
.it-row{position:absolute;margin:0;display:block;box-sizing:border-box;color:#111}
label.it-row{cursor:pointer;border-radius:2px}label.it-row:hover{background:#0078d42b;outline:1px solid #0078d4}
.it-row input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}
.it-row:focus-within{outline:2px solid #0078d4}.it-muted{background:#ffffffcc;pointer-events:none}
.it-selected{background:#0078d417;outline:1px solid #0078d4}.it-match{background:#ffdf5f55}
.it-check{position:absolute;left:0;top:0;color:#000;font:bold 11pt Arial;line-height:1}
.it-replacement{position:absolute;inset:0;padding-left:12px;background:#fff;font:9pt 'Phetsarath OT','Noto Sans Lao','Times New Roman',serif;overflow:hidden}
.it-field{position:absolute;background:white;white-space:nowrap;overflow:hidden;color:#111;line-height:1.1;font-family:'Phetsarath OT','Noto Sans Lao',Arial,sans-serif}
.it-picker-pages{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
.it-picker-page{min-width:0;overflow:hidden;border:1px solid #cbd5e1;background:white}
.it-picker-page-number{position:sticky;top:0;z-index:2;background:#eaf3fb;color:#17496a;padding:5px 10px;font-size:12px}
.it-page-label{display:flex;justify-content:space-between;padding:8px 12px;background:#eaf3fb;color:#17496a}
.it-picker-crop{position:relative;overflow:hidden;background:white;margin:0 auto}
.it-search-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:65dvh;overflow:auto}
.it-search-choice{display:flex;align-items:center;gap:12px;min-height:48px;padding:10px 14px;border:1px solid #cbd5e1;border-radius:6px;background:white;cursor:pointer;font-size:16px}
.it-search-choice:has(input:checked){background:#e4f2ff;border-color:#1769aa}.it-search-choice input{width:22px;height:22px;flex-shrink:0;cursor:pointer}
#emrLabModal.it-wide-picker .modal-dialog{width:calc(100vw - 24px);max-width:none;margin:12px auto}
#emrLabModal.it-wide-picker .emr-lis-layout{grid-template-columns:minmax(0,1fr) 280px;gap:8px}
#emrLabModal.it-wide-picker .emr-lis-summary-panel{font-size:12px}
#emrLabModal.it-wide-picker .emr-lis-panel-title span{display:none}
#emrLabModal.it-wide-picker .emr-lis-panel-header{padding:5px 8px}
#emrLabModal.it-wide-picker .emr-lis-search-row{padding:5px 8px}
#emrLabModal.it-wide-picker .emr-lis-summary-text strong,#emrLabModal.it-wide-picker .emr-lis-panel-title strong{font-size:12px}
#emrLabModal.it-wide-picker .emr-lis-summary-body{max-height:65dvh;overflow:auto}
#emrLabModal.it-wide-picker .modal-body{padding:6px!important}
#emrLabModal.it-wide-picker .emr-lis-shell{padding:6px}
#emrLabModal.it-wide-picker .emr-lis-layout>section.emr-lis-panel{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:42px minmax(0,1fr)}
#emrLabModal.it-wide-picker .emr-lis-panel-header{min-width:0;gap:6px;padding:4px 8px}
#emrLabModal.it-wide-picker .emr-lis-layout>section .emr-lis-panel-header{border-bottom:0}
#emrLabModal.it-wide-picker .emr-lis-layout>section .emr-lis-panel-title i,#emrLabModal.it-wide-picker .emr-lis-refresh{display:none}
#emrLabModal.it-wide-picker .emr-lis-search-row{padding:4px 8px 4px 0;min-width:0}
#emrLabModal.it-wide-picker #labCheckboxContainer{grid-column:1/-1;display:grid;grid-template-rows:minmax(0,1fr) auto;min-height:0;max-height:none;overflow:hidden;padding:0 8px 4px;background:white;scrollbar-gutter:auto}
.it-picker-viewport{min-height:0;min-width:0;container-type:size;overflow:hidden;display:flex;align-items:center;justify-content:center}
.it-picker-viewport .it-picker-crop{--it-picker-content-height:100cqh;flex-shrink:0}
.it-pagination{display:flex;justify-content:flex-end;gap:6px;padding:4px 0;min-height:36px;background:white}.it-pagination button{font-size:12px}
#emrLabModal.it-wide-picker .emr-lis-summary-body{min-height:0;max-height:none;overflow:auto;font-size:12px}
#emrLabModal.it-wide-picker .emr-lis-summary-body strong{font-size:12px}
#emrLabModal.it-wide-picker .emr-lis-summary-count{font-size:12px;min-width:28px;height:28px}
#emrLabModal.it-wide-picker .it-search-results{max-height:none;min-height:0}
@media(max-width:850px){.it-picker-pages{grid-template-columns:1fr}.it-picker-page{max-height:65dvh}}
@media print{.it-selected{background:transparent;outline:0}.it-sheet{break-after:page;break-inside:avoid}.it-sheet:last-child{break-after:auto}}
`;

export function buildInvestigationPreviewDocument({ type, template, items = [], patient = {}, encounter = {}, orderNo = '', orderedAt }) {
  const selected = items.map(item => item.formName || item.name);
  const date = new Date(orderedAt || Date.now());
  const fullName = patient.title && !String(patient.name || '').startsWith(patient.title) ? `${patient.title} ${patient.name || ''}` : patient.name;
  const values = { patientId: patient.id, patientName: fullName, phone: patient.phone,
    diagnosis: encounter.diagnosis, history: encounter.history, doctor: encounter.doctor, orderNo,
    date: Number.isNaN(date.getTime()) ? String(orderedAt || '') : date.toLocaleDateString('en-GB') };
  const missing = items.filter(item => !template.items.some(row => row.enabled !== false && itemMatches(row,item.formName || item.name)));
  const notes = items.filter(item => item.instructions || item.priority === 'Urgent');
  const appendix = missing.length || notes.length ? `<section class="it-appendix"><h2>ລາຍການເພີ່ມເຕີມ / ຄຳແນະນຳ</h2><p>${esc(values.patientId)} · ${esc(values.patientName)} · ${esc(orderNo)}</p>${missing.map(item => `<p>☑ ${esc(item.name)}</p>`).join('')}${notes.map(item => `<p><b>${esc(item.name)}</b>: ${esc(item.instructions || '')} ${item.priority === 'Urgent' ? '— Urgent' : ''}</p>`).join('')}</section>` : '';
  const origin = globalThis.location?.origin;
  const base = origin && /^https?:\/\//.test(origin) ? `<base href="${esc(origin)}/">` : '';
  return `<!doctype html><html lang="lo"><head><meta charset="utf-8">${base}<title>${esc(template.title)} — ${esc(patient.id || '')}</title><style>
  @page{size:A4 portrait;margin:5mm}*{box-sizing:border-box}body{margin:0;background:#dce3eb;font-family:'Phetsarath OT','Noto Sans Lao',Arial,sans-serif}
  ${investigationSheetStyles}
  .it-toolbar{position:sticky;top:0;z-index:3;display:flex;gap:16px;align-items:center;padding:12px 20px;background:#173e62;color:white}.it-toolbar button{padding:10px 20px;cursor:pointer;border:0;border-radius:6px;font:inherit}.it-document{width:210mm;margin:20px auto}.it-sheet{width:210mm;height:297mm;margin-bottom:16px;box-shadow:0 3px 16px #0002}.it-appendix{background:white;padding:15mm;min-height:297mm;break-before:page}
  @media print{html,body{background:white;width:auto;height:auto}.it-toolbar{display:none}.it-document{margin:0;width:100%}.it-sheet{width:100%;height:auto;min-height:0;margin:0;box-shadow:none;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always}.it-sheet:last-child{break-after:auto;page-break-after:auto}.it-appendix{margin:0;min-height:0;padding:5mm;break-before:page}}
  </style></head><body><header class="it-toolbar"><button id="backButton" onclick="returnToOrder()">← ກັບຄືນ</button><strong>${esc(template.title)} · Preview</strong><button id="printButton" disabled onclick="printRequestPdf()">ພິມ / Print PDF</button><span id="previewStatus">ກຳລັງໂຫຼດ...</span></header><main class="it-document">${template.pages.map((_,index) => renderInvestigationSheet(template,index+1,{ selected,type,fields:template.fields,values })).join('')}${appendix}</main><script>
  const createRequestFormPdf = ${createRequestFormPdf.toString()};
  let requestPdfUrl = '';
  async function printRequestPdf() {
    const target = window.open('', '_blank');
    if (!target) { document.getElementById('previewStatus').textContent='ກະລຸນາອະນຸຍາດ Pop-up ເພື່ອເປີດ PDF'; return; }
    try {
      await window.itPreviewReady;
      if (!requestPdfUrl) requestPdfUrl=URL.createObjectURL(await createRequestFormPdf(document));
      target.location.replace(requestPdfUrl);
    } catch { target.close(); document.getElementById('previewStatus').textContent='ສ້າງ PDF ບໍ່ສຳເລັດ'; }
  }
  function returnToOrder() {
    if (window.opener && !window.opener.closed) { window.opener.focus(); window.close(); }
    else if (window.history.length > 1) { window.history.back(); }
    else { window.close(); }
  }
  window.itPreviewReady = (async () => {
    try {
      await Promise.all([...document.images].map(image => image.decode()));
      await document.fonts.ready;
      document.querySelectorAll('.it-field').forEach(field => {
        let size = parseFloat(getComputedStyle(field).fontSize);
        while ((field.scrollWidth > field.clientWidth || field.scrollHeight > field.clientHeight) && size > 8) { size -= .5; field.style.fontSize = size + 'px'; }
      });
      document.getElementById('printButton').disabled = false;
      document.getElementById('previewStatus').textContent = 'A4 · ${template.pages.length} ໜ້າ · ຂອບ 5mm';
    } catch { document.getElementById('previewStatus').textContent = 'ໂຫຼດຮູບແບບຟອມບໍ່ສຳເລັດ · ກະລຸນາເປີດ preview ໃໝ່'; }
  })();
  </script></body></html>`;
}

export function installInvestigationTemplates({ onChange = () => {}, canEdit = () => false } = {}) {
  let templates = loadInvestigationTemplates();
  let draft = clone(templates), activeId = templates[0].id, pageNumber = 1, selectedId = '', search = '';
  const active = () => draft.find(t => t.id === activeId) || draft[0];
  window.getInvestigationTemplates = () => clone(templates);
  window.getInvestigationTemplateForType = type => templates.find(t => t.preferredFor?.includes(type)) || templates.find(t => t.items.some(row => row.enabled !== false && row.type === type) && (type === 'lab' ? t.id === 'lab' : t.id === 'imaging')) || templates.find(t => t.items.some(row => row.enabled !== false && row.type === type));
  window.getInvestigationCatalog = () => investigationCatalog(templates);
  window.renderInvestigationPicker = (catalog, selected, type, query) => {
    query = String(query || '').trim().toLowerCase();
    const template = window.getInvestigationTemplateForType(type);
    if (!template) return '<p>ຍັງບໍ່ມີແບບໃບສັ່ງກວດ</p>';
    const relevant = template.items.filter(row => row.enabled !== false && (!query || `${row.number} ${row.name}`.toLowerCase().includes(query)));
    const extras = catalog.filter(row => !template.items.some(item => itemMatches(item,row.formReference?.name || row.name)) && row.type === type && (!query || row.name.toLowerCase().includes(query)));
    if (query) {
      const matches = relevant.map(item => ({item,entry:catalog.find(row => row.formReference?.templateId === template.id && row.formReference?.id === item.id) || catalog.find(row=>itemMatches(item,row.formReference?.name || row.name))})).filter(row=>row.entry);
      const unique = new Map(matches.map(row=>[row.entry.index,row]));
      extras.forEach(entry=>unique.set(entry.index,{entry,item:entry.formReference || entry}));
      return `<style>${investigationSheetStyles}</style><div class="it-search-results">${[...unique.values()].map(({entry,item})=>`<label class="it-search-choice"><input type="checkbox" aria-label="${esc(entry.name)}" ${selected.includes(entry.name)?'checked':''} onchange="window.toggleEMRLabPickerSelection(${entry.index},this.checked)"><span>${esc(item.number || '')}${item.number?'. ':''}${esc(entry.name)}</span></label>`).join('')}</div>${!unique.size?'<p class="p-3">ບໍ່ພົບລາຍການກວດ</p>':''}`;
    }
    const selectedPage=Math.min(window.investigationPickerPage || 1,template.pages.length);
    const pages = template.pages.map((_,index) => {
      if(index+1!==selectedPage)return '';
      if (query && !relevant.some(row => row.page === index+1)) return '';
      return renderInvestigationSheet(template,index+1,{interactive:true,catalog,selected,query});
    }).join('');
    return `<style>${investigationSheetStyles}</style><div class="it-picker-viewport">${pages}</div><nav class="it-pagination" aria-label="Order form pages">${template.pages.map((_,i)=>`<button type="button" class="btn btn-sm ${i+1===selectedPage?'btn-primary':'btn-outline-primary'}" onclick="window.selectInvestigationPage(${i+1})">ໜ້າ ${i+1}</button>`).join('')}</nav>${!relevant.length ? '<p class="p-3">ບໍ່ພົບລາຍການກວດ</p>' : ''}`;
  };
  const editable = () => { if (!canEdit()) { window.alert('ບໍ່ມີສິດແກ້ໄຂການຕັ້ງຄ່າ'); return false; } return true; };
  const host = () => document.getElementById('investigationTemplateEditor');
  const render = () => {
    if (!host()) return;
    const template = active();
    const row = [...template.items,...template.fields].find(item => item.id === selectedId);
    host().innerHTML = `<style>${investigationSheetStyles}
    .it-editor-grid{display:grid;grid-template-columns:320px minmax(0,1fr);gap:20px}.it-editor-list{max-height:360px;overflow:auto}.it-editor-preview{max-height:820px;overflow:auto;border:1px solid #cbd5e1}.it-editor-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}.it-editor-grid label{font-size:13px}.it-editor-grid button{font-size:13px}.it-editor-list button{display:block;width:100%;text-align:left;padding:7px;border:0;border-bottom:1px solid #e2e8f0;background:white}.it-editor-list button.active{background:#dceefc}@media(max-width:850px){.it-editor-grid{grid-template-columns:1fr}}
    </style><div class="d-flex gap-2 flex-wrap mb-3"><select class="form-select" style="width:280px" onchange="window.itEditorAction('template',this.value)">${draft.map(t=>`<option value="${esc(t.id)}" ${t.id===template.id?'selected':''}>${esc(t.title)}</option>`).join('')}</select><button class="btn btn-outline-primary" onclick="window.itEditorAction('copy')">ເພີ່ມແບບ</button><button class="btn btn-outline-danger" onclick="window.itEditorAction('deleteTemplate')">ລຶບແບບ</button><button class="btn btn-primary" onclick="window.itEditorAction('save')">ບັນທຶກໃນ local</button><button class="btn btn-outline-secondary" onclick="window.itEditorAction('discard')">ຍົກເລີກການແກ້ໄຂ</button><button class="btn btn-outline-secondary" onclick="window.itEditorAction('reset')">ຄືນຄ່າເດີມ</button></div>
    <div class="it-editor-grid"><div><label class="form-label">ຊື່ແບບໃບສັ່ງ</label><input class="form-control mb-2" value="${esc(template.title)}" onchange="window.itEditorAction('title',this.value)">
    <div class="mb-3">ໃຊ້ແບບນີ້ສຳລັບ: ${['lab','ultrasound','xray'].map(type=>`<label class="me-2"><input type="checkbox" ${template.preferredFor?.includes(type)?'checked':''} onchange="window.itEditorAction('prefer','${type}')"> ${type}</label>`).join('')}</div>
    <div class="d-flex gap-2 mb-2"><select class="form-select" onchange="window.itEditorAction('page',this.value)">${template.pages.map((_,i)=>`<option ${pageNumber===i+1?'selected':''} value="${i+1}">ໜ້າ ${i+1}</option>`).join('')}</select><button class="btn btn-outline-primary" onclick="window.itEditorAction('addPage')">+ ໜ້າ</button><button class="btn btn-outline-danger" onclick="window.itEditorAction('deletePage')">− ໜ້າ</button></div>
    <label class="form-label">ປ່ຽນຮູບໜ້າໃບສັ່ງ (PNG/JPG)</label><input class="form-control mb-3" type="file" accept="image/png,image/jpeg,image/webp" onchange="window.itEditorImage(this.files[0])">
    <div class="d-flex gap-2 mb-2"><button class="btn btn-outline-primary" onclick="window.itEditorAction('addItem')">+ ລາຍການກວດ</button><button class="btn btn-outline-primary" onclick="window.itEditorAction('addField')">+ ຊ່ອງຂໍ້ມູນ</button></div>
    <input class="form-control mb-2" placeholder="ຄົ້ນຫາລາຍການ..." value="${esc(search)}" onchange="window.itEditorAction('search',this.value)">
    <div class="it-editor-list mb-3">${[...template.items,...template.fields].filter(item=>item.page===pageNumber && `${item.name || item.label}`.toLowerCase().includes(search.toLowerCase())).map(item=>`<button class="${item.id===selectedId?'active':''}" onclick="window.itEditorAction('select','${esc(item.id)}')">${esc(item.number || '')} ${esc(item.name || item.label)}${item.enabled===false?' (ປິດ)':''}</button>`).join('')}</div>
    ${row ? `<div class="it-editor-fields">${['name' in row?'name':'label',...('name' in row?['number','type']:['key','fontSize']),'page','x','y','width','height'].map(key=>`<label>${esc(({name:'ຊື່ການກວດ',label:'ປ້າຍຊ່ອງ',number:'ເລກລຳດັບ',type:'ປະເພດ',key:'ຂໍ້ມູນ',fontSize:'ຂະໜາດໂຕໜັງສື',page:'ໜ້າ',x:'ແນວນອນ X (pt)',y:'ແນວຕັ້ງ Y (pt)',width:'ຄວາມກວ້າງ (pt)',height:'ຄວາມສູງ (pt)'})[key])}${key==='type'?`<select class="form-select" onchange="window.itEditorUpdate('${key}',this.value)">${['lab','ultrasound','xray'].map(type=>`<option ${row.type===type?'selected':''}>${type}</option>`).join('')}</select>`:key==='key'?`<select class="form-select" onchange="window.itEditorUpdate('${key}',this.value)">${['patientId','patientName','phone','orderNo','date','diagnosis','history','doctor'].map(k=>`<option ${row.key===k?'selected':''}>${k}</option>`).join('')}</select>`:`<input class="form-control" ${['name','label'].includes(key)?'':'type="number" step="0.1"'} value="${esc(row[key] ?? '')}" onchange="window.itEditorUpdate('${key}',this.value)">`}</label>`).join('')}</div><button class="btn btn-outline-danger mt-2" onclick="window.itEditorAction('deleteRow')">ລຶບລາຍການ / ຊ່ອງ</button>`:''}
    <p class="text-muted mt-3">ບັນທຶກໃນ browser ນີ້. ຄລິກເທິງໜ້າໃບສັ່ງເພື່ອຍ້າຍລາຍການທີ່ເລືອກ.</p></div><div><div class="d-flex gap-2 mb-2"><button class="btn btn-outline-primary" onclick="window.itEditorAction('preview')">Preview ແບບໃບສັ່ງ</button><button class="btn btn-outline-secondary" onclick="window.itEditorAction('export')">Export</button><label class="btn btn-outline-secondary mb-0">Import<input hidden type="file" accept="application/json" onchange="window.itEditorImport(this.files[0])"></label></div><div class="it-editor-preview" onclick="window.itEditorMove(event)">${renderInvestigationSheet(template,pageNumber,{fields:template.fields,values:{patientId:'LXH2026-000001',patientName:'ທົດສອບ ແບບໃບສັ່ງ',diagnosis:'Preview',doctor:'ທ່ານໝໍ'}})}</div></div></div>`;
  };
  window.itEditorUpdate = (key,value) => {
    if (!editable()) return;
    const row = [...active().items,...active().fields].find(item=>item.id===selectedId);
    if (!row) return;
    if (row.original && ['x','y','page','width','height'].includes(key) && !row.originalPosition) row.originalPosition={page:row.page,x:row.x,y:row.y,width:row.width,height:row.height};
    if (row.original && key==='number' && !row.originalNumber) row.originalNumber=row.number;
    row[key] = ['name','label','type','key'].includes(key) ? value : Number(value);
    render();
  };
  window.itEditorMove = event => {
    if (!editable() || !selectedId) return;
    const sheet = event.target.closest('.it-sheet');
    const row = [...active().items,...active().fields].find(item=>item.id===selectedId);
    if (!sheet || !row) return;
    if (row.original && !row.originalPosition) row.originalPosition={page:row.page,x:row.x,y:row.y,width:row.width,height:row.height};
    const rect = sheet.getBoundingClientRect(), page = active().pages[pageNumber-1];
    row.x = Math.max(0,Math.min(page.width-row.width,(event.clientX-rect.left)/rect.width*page.width));
    row.y = Math.max(0,Math.min(page.height-row.height,(event.clientY-rect.top)/rect.height*page.height));
    row.page = pageNumber;
    render();
  };
  window.itEditorImage = async file => {
    if (!file || !editable()) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>3*1024*1024) return window.alert('ຮູບ PNG/JPG/WebP ສູງສຸດ 3 MB');
    const reader = new FileReader(); reader.onload = () => { active().pages[pageNumber-1].image=reader.result; render(); }; reader.readAsDataURL(file);
  };
  window.itEditorImport = async file => {
    if (!file || !editable()) return;
    try { draft = clone(validateInvestigationTemplates(JSON.parse(await file.text()))); activeId=draft[0].id; pageNumber=1; selectedId=''; render(); } catch(error) { window.alert(error.message); }
  };
  window.itEditorAction = (action,value) => {
    if (!editable()) return;
    const template = active();
    if (action==='template') { activeId=value; pageNumber=1; selectedId=''; }
    if (action==='page') { pageNumber=Number(value); selectedId=''; }
    if (action==='select') selectedId=value;
    if (action==='search') search=value;
    if (action==='title') template.title=value;
    if (action==='prefer') {
      const remove=template.preferredFor?.includes(value);
      draft.forEach(t=>{t.preferredFor=(t.preferredFor || []).filter(type=>type!==value);});
      if(!remove) template.preferredFor.push(value);
    }
    if (action==='copy') { const copy=clone(template); copy.id=`custom-${Date.now()}`; copy.title+=' (ໃໝ່)'; copy.preferredFor=[]; draft.push(copy); activeId=copy.id; }
    if (action==='deleteTemplate' && draft.length>1 && window.confirm('ລຶບແບບໃບສັ່ງນີ້?')) { draft=draft.filter(t=>t.id!==template.id); activeId=draft[0].id; pageNumber=1; }
    if (action==='addPage') { template.pages.push({image:'/order-forms/blank.png',width:595.276,height:841.89}); pageNumber=template.pages.length; }
    if (action==='deletePage' && template.pages.length>1 && window.confirm('ລຶບໜ້າ ແລະ ລາຍການໃນໜ້ານີ້?')) {
      template.pages.splice(pageNumber-1,1);
      for (const key of ['items','fields']) template[key]=template[key].filter(row=>row.page!==pageNumber).map(row=>({...row,page:row.page>pageNumber?row.page-1:row.page,
        originalPosition:row.originalPosition ? {...row.originalPosition,page:row.originalPosition.page>pageNumber?row.originalPosition.page-1:row.originalPosition.page} : undefined}));
      pageNumber=1;selectedId='';
    }
    if (action==='addItem' || action==='addField') {
      const row={id:`custom-${Date.now()}`,page:pageNumber,x:30,y:100,width:180,height:18};
      if(action==='addItem') { Object.assign(row,{name:'ລາຍການກວດໃໝ່',number:template.items.length+1,type:template.id==='lab'?'lab':'ultrasound',enabled:true,original:false});template.items.push(row); }
      else { Object.assign(row,{key:'diagnosis',label:'ຊ່ອງໃໝ່',fontSize:11});template.fields.push(row); }
      selectedId=row.id;
    }
    if (action==='deleteRow') {
      const row=template.items.find(item=>item.id===selectedId);
      if(row?.original) {row.enabled=false;row.hiddenOriginal=true;}
      else {template.items=template.items.filter(item=>item.id!==selectedId);template.fields=template.fields.filter(item=>item.id!==selectedId);}
      selectedId='';
    }
    if(action==='discard') {draft=clone(templates);activeId=draft[0].id;pageNumber=1;selectedId='';}
    if(action==='reset' && window.confirm('ຄືນຄ່າແບບຕົ້ນສະບັບທັງໝົດ?')) {draft=defaultInvestigationTemplates();activeId=draft[0].id;pageNumber=1;selectedId='';}
    if(action==='save') {try {saveInvestigationTemplates(draft);templates=clone(draft);onChange();window.alert('ບັນທຶກໃນ local ແລ້ວ');} catch(error){window.alert(error.message);} }
    if(action==='preview') {const popup=window.open('','_blank');if(popup){popup.document.write(buildInvestigationPreviewDocument({type:template.id==='lab'?'lab':'ultrasound',template}));popup.document.close();}}
    if(action==='export') {const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='investigation-templates.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    render();
  };
  window.renderInvestigationTemplateEditor = render;
  return { getTemplates:()=>clone(templates) };
}
