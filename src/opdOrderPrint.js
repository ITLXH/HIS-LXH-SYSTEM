const escapePrintHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const valueOrLine = value => escapePrintHtml(String(value || '').trim() || '................................');

const firstPrintValue = (...values) => {
  const value = values.find(candidate => String(candidate ?? '').trim());
  return value === undefined ? '' : String(value).trim();
};

const quantityTokenPattern = /(?:^|\s*[·|;,]\s*)(?:qty|quantity|ຈຳນວນ)\s*[:.]?\s*([^·|;,]+)/i;
const bareQuantityPattern = /^\d+(?:[.,]\d+)?(?:\s*(?:ເມັດ|ແຄັບຊູນ|ຊອງ|ຂວດ|ຫຼອດ|tab(?:let)?s?|cap(?:sule)?s?|sachet(?:s)?|bottle(?:s)?|tube(?:s)?))?$/i;

export function normalizeMedicationPrintItem(item = {}) {
  const isFreeText = Boolean(item.isFreeText || item.freeText);
  const rawInstructions = firstPrintValue(item.instructions, item.instr, item.dosage, item.directions);
  const quantityMatch = rawInstructions.match(quantityTokenPattern);
  const quantityFromInstructions = quantityMatch?.[1]?.trim() || '';
  const explicitQuantity = firstPrintValue(item.quantity, item.qty, item.totalQuantity, item.totalQty);
  const instructionsAreQuantityOnly = !explicitQuantity && bareQuantityPattern.test(rawInstructions);
  const quantity = explicitQuantity || quantityFromInstructions || (instructionsAreQuantityOnly ? rawInstructions : '');
  const structuredDirections = [item.dose, item.route, item.frequency || item.usage, item.duration]
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .join(' · ');
  const cleanedInstructions = instructionsAreQuantityOnly
    ? ''
    : rawInstructions.replace(quantityTokenPattern, '').replace(/^[\s·|;,]+|[\s·|;,]+$/g, '').trim();

  return {
    name: isFreeText ? firstPrintValue(item.freeText, item.name) : firstPrintValue(item.name),
    quantity,
    dosage: cleanedInstructions || structuredDirections,
    note: firstPrintValue(item.note, item.remark)
  };
}

const patientFullName = patient => {
  const title = String(patient?.title || '').trim();
  const name = String(patient?.name || '').trim();
  if (!title) return name;
  if (!name) return title;
  return name.toLocaleLowerCase().startsWith(title.toLocaleLowerCase()) ? name : `${title} ${name}`;
};

const safePrintAssetUrl = value => {
  const url = String(value || '').trim();
  return /^(https?:\/\/|\/|data:image\/(?:png|jpe?g|webp);base64,)/i.test(url) ? url : '/luckxay-logo.jpg';
};

const formatPrintDateTime = value => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return { date: escapePrintHtml(value || ''), time: '' };
  return {
    date: date.toLocaleDateString('en-GB'),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  };
};

const printStyles = `
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; color: #111; background: #fff; }
  body { font: 13px/1.38 "Phetsarath OT", "Noto Sans Lao", Arial, sans-serif; }
  .sheet { width: 194mm; min-height: 279mm; margin: 0 auto; display: flex; flex-direction: column; }
  .header { position: relative; display: grid; grid-template-columns: 78mm minmax(0, 1fr) 49mm; align-items: start; min-height: 33mm; padding: 1mm 0 2mm; column-gap: 3mm; }
  .hospital-identity { display: flex; align-items: flex-start; min-width: 0; }
  .logo-frame { width: 19.5mm; height: 20mm; flex: 0 0 19.5mm; margin-right: .5mm; overflow: hidden; }
  .logo { width: 30mm; height: 30mm; transform: translate(-3.5mm, -3.5mm); clip-path: inset(0 0 44% 0); object-fit: contain; filter: grayscale(1); }
  .brand { min-width: 0; padding-top: 1mm; text-align: left; }
  .hospital-la { margin: 0; font-size: 22px; font-weight: 700; line-height: 1.18; white-space: nowrap; }
  .hospital-en { margin: .3mm 0 0; font-family: "Times New Roman", serif; font-size: 18px; font-weight: 700; line-height: 1.18; white-space: nowrap; }
  .hospital-phone { margin-top: 1mm; font-size: 11.5px; line-height: 1.3; white-space: nowrap; }
  .document-heading { position: absolute; top: 10mm; left: 50%; width: max-content; max-width: 70mm; transform: translateX(-50%); text-align: center; }
  .document-title { margin: 0; font-size: 22px; font-weight: 700; line-height: 1.25; white-space: nowrap; }
  .document-title span { font-size: 14px; font-weight: 600; }
  .document-meta { grid-column: 3; min-width: 0; padding-top: .5mm; text-align: left; font-size: 12.5px; line-height: 1.35; }
  .document-meta div { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: end; gap: 1mm; min-height: 7mm; padding: .6mm 0 .3mm; border-bottom: 1px dotted #666; white-space: nowrap; overflow: hidden; }
  .document-meta b { min-width: 0; overflow: hidden; font-size: inherit; font-weight: 600; white-space: nowrap; }
  .patient-grid { margin: 1.5mm 0 1mm; }
  .patient-row { display: grid; gap: 1mm 2mm; }
  .patient-row-primary { grid-template-columns: minmax(0, 1.75fr) minmax(0, 1.05fr) minmax(0, .55fr); }
  .patient-row-address { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1.1fr) minmax(0, 1.35fr) minmax(0, .75fr); column-gap: 1.5mm; }
  .patient-urgent-row { grid-template-columns: minmax(0, 1fr) minmax(60mm, .55fr); }
  .patient-urgent-spacer { min-height: 7mm; }
  .line-field { display: grid; grid-template-columns: max-content minmax(0, 1fr); align-items: end; gap: 1mm; min-width: 0; min-height: 7.5mm; border-bottom: 1px dotted #555; padding: 1mm .4mm .55mm; overflow: visible; line-height: 1.3; }
  .line-field b { min-width: 0; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .field-value { display: block; min-width: 0; padding-left: .3mm; font-size: 12.5px; line-height: 1.25; white-space: normal; overflow-wrap: anywhere; }
  .patient-row-address .line-field { min-height: 9mm; }
  .patient-phone .field-value { white-space: nowrap; overflow-wrap: normal; }
  .diagnosis { min-height: 8mm; margin: 2mm 0; border-bottom: 1px dotted #555; padding: 1mm; font-size: 12.5px; line-height: 1.35; }
  .diagnosis b { font-size: inherit; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #222; padding: 2mm; vertical-align: top; }
  th { background: #fff; text-align: center; font-size: 13.5px; font-weight: 700; line-height: 1.35; }
  tbody td { font-size: 13px; }
  .number { width: 10mm; text-align: center; }
  .imaging-table tbody td { height: 181mm; }
  .xray-request { width: 64%; }
  .xray-result { width: 36%; }
  .rx-table { height: 142mm; }
  .rx-table .rx-item-row { height: 7.5mm; }
  .rx-table .rx-item-row td { height: 7.5mm; border-top: 0; border-bottom: 0; padding: .7mm 2mm; line-height: 1.22; }
  .rx-table .rx-fill-row { height: auto; }
  .rx-table tbody tr:last-child td { border-top: 0; }
  .rx-number { width: 5%; }
  .rx-name { width: 44%; }
  .rx-qty { width: 13%; text-align: center; }
  .rx-directions { width: 28%; }
  .rx-note { width: 10%; }
  .order-line { margin: 0 0 2.5mm; white-space: pre-wrap; overflow-wrap: anywhere; }
  .recommendation { min-height: 28mm; border: 1px solid #222; border-top: 0; padding: 2mm; white-space: pre-wrap; }
  .recommendation-lines { min-height: 20mm; padding-top: 1mm; background: repeating-linear-gradient(to bottom, transparent 0, transparent 6.5mm, #777 6.5mm, #777 6.7mm); }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 35mm; margin-top: 2mm; padding: 0 12mm 1mm; text-align: center; }
  .signature-name { min-height: 8mm; border-bottom: 1px dotted #555; margin-bottom: 1mm; }
  .rx-signatures { padding-top: 0; }
  .rx-signatures .signature-name { border-bottom: 0; }
  .single-signature { margin-left: auto; width: 62mm; padding-top: 2mm; text-align: center; }
  .single-signature .signature-name { min-height: 8mm; }
  .signatures, .single-signature, .recommendation { font-size: 12.5px; line-height: 1.4; }
  .muted { color: #444; font-size: 12px; }
  .print-actions { position: fixed; right: 12px; top: 12px; }
  .print-actions button { border: 0; border-radius: 4px; padding: 8px 14px; color: #fff; background: #1769a6; cursor: pointer; }
  @media print {
    .print-actions { display: none !important; }
    .sheet { break-after: avoid; }
  }
`;

const renderHeader = ({ hospital, title, titleEnglish, orderedAt, showTime = true }) => {
  const timestamp = formatPrintDateTime(orderedAt);
  const hospitalName = hospital?.name || 'ໂຮງໝໍ ຫຼັກໄຊ';
  const hospitalEnglish = hospital?.englishName || 'Luckxay Hospital';
  const logo = escapePrintHtml(safePrintAssetUrl(hospital?.logoUrl));
  return `<header class="header">
    <div class="hospital-identity">
      <span class="logo-frame"><img class="logo" src="${logo}" alt="Hospital logo"></span>
      <div class="brand">
        <p class="hospital-la">${escapePrintHtml(hospitalName)}</p>
        <p class="hospital-en">${escapePrintHtml(hospitalEnglish)}</p>
        ${hospital?.phone ? `<div class="hospital-phone">Tel: ${escapePrintHtml(hospital.phone)}</div>` : ''}
      </div>
    </div>
    <div class="document-heading">
      <h1 class="document-title">${escapePrintHtml(title)}${titleEnglish ? ` <span>(${escapePrintHtml(titleEnglish)})</span>` : ''}</h1>
    </div>
    <div class="document-meta">
      <div><span>ເລກທີ / No:</span><b>&nbsp;</b></div>
      <div><span>ວັນທີ / Date:</span><b>${valueOrLine(timestamp.date)}</b></div>
      ${showTime ? `<div><span>ເວລາ / Time:</span><b>${valueOrLine(timestamp.time)}</b></div>` : ''}
    </div>
  </header>`;
};

const renderPatient = (patient, { includeUrgentPhone = false } = {}) => `<section class="patient-grid">
  <div class="patient-row patient-row-primary">
    <div class="line-field patient-name"><b>ຊື່ນາມສະກຸນ / Name Surname:</b><span class="field-value">${valueOrLine(patientFullName(patient))}</span></div>
    <div class="line-field patient-dob"><b>ວັນ/ເດືອນ/ປີ / DOB:</b><span class="field-value">${valueOrLine(patient?.dob)}</span></div>
    <div class="line-field patient-age"><b>ອາຍຸ / Age:</b><span class="field-value">${valueOrLine(patient?.age)}</span></div>
  </div>
  <div class="patient-row patient-row-address">
    <div class="line-field patient-address"><b>ທີ່ຢູ່ / Address:</b><span class="field-value">${valueOrLine(patient?.address)}</span></div>
    <div class="line-field patient-district"><b>ເມືອງ / District:</b><span class="field-value">${valueOrLine(patient?.district)}</span></div>
    <div class="line-field patient-province"><b>ແຂວງ / Province:</b><span class="field-value">${valueOrLine(patient?.province)}</span></div>
    <div class="line-field patient-phone"><b>Tel:</b><span class="field-value">${valueOrLine(patient?.phone)}</span></div>
  </div>
  ${includeUrgentPhone ? `<div class="patient-row patient-urgent-row">
    <div class="patient-urgent-spacer"></div>
    <div class="line-field patient-urgent-phone"><b>ເບີໂທສຸກເສີນ / Urgent tel:</b><span class="field-value">${valueOrLine(patient?.urgentPhone || patient?.emergencyPhone)}</span></div>
  </div>` : ''}
</section>`;

const renderImagingSheet = data => {
  const isUltrasound = data.type === 'ultrasound';
  const title = isUltrasound ? 'ໃບສັ່ງກວດ Ultrasound' : 'ໃບສັ່ງກວດ';
  const titleEnglish = isUltrasound ? 'Ultrasound Request' : '';
  const requestLines = (data.items || []).map((item, index) => {
    const details = [item.instructions, item.priority && !/routine|normal|ປົກກະຕິ/i.test(item.priority) ? item.priority : '']
      .filter(Boolean).join(' — ');
    return `<p class="order-line"><b>${index + 1}. ${escapePrintHtml(item.name || '')}</b>${details ? `<br><span>${escapePrintHtml(details)}</span>` : ''}</p>`;
  }).join('');
  return `${renderHeader({ ...data, title, titleEnglish, showTime: false })}
    ${renderPatient(data.patient)}
    <div class="diagnosis"><b>ບົ່ງມະຕິພະຍາດ / Diagnosis:</b> ${valueOrLine(data.encounter?.diagnosis)}</div>
    <table class="imaging-table">
      <thead><tr><th class="number">ລ/ດ</th><th class="xray-request">ລາຍການສັ່ງກວດ</th><th class="xray-result">ຜົນໄດ້ຮັບ</th></tr></thead>
      <tbody><tr><td class="number"></td><td>${requestLines}</td><td></td></tr></tbody>
    </table>
    <div class="single-signature"><div class="signature-name"></div><b>ລາຍເຊັນແພດ</b></div>`;
};

const renderPrescriptionSheet = data => {
  const rows = (data.items || []).map((source, index) => {
    const item = normalizeMedicationPrintItem(source);
    return `<tr class="rx-item-row">
    <td class="rx-number">${index + 1}</td>
    <td class="rx-name">${escapePrintHtml(item.name || '')}</td>
    <td class="rx-qty">${escapePrintHtml(item.quantity || '')}</td>
    <td class="rx-directions">${escapePrintHtml(item.dosage || '')}</td>
    <td class="rx-note">${escapePrintHtml(item.note || '')}</td>
  </tr>`;
  }).join('');
  const fillRow = '<tr class="rx-fill-row"><td></td><td></td><td></td><td></td><td></td></tr>';
  return `${renderHeader({ ...data, title: 'ໃບສັ່ງຢາ', titleEnglish: 'Prescription' })}
    ${renderPatient(data.patient, { includeUrgentPhone: true })}
    <div class="diagnosis"><b>ບົ່ງມະຕິພະຍາດ / Diagnosis:</b> ${valueOrLine(data.encounter?.diagnosis)}</div>
    <table class="rx-table">
      <thead><tr><th class="rx-number">ລ/ດ</th><th class="rx-name">Name of Drug&nbsp; ຊື່ຢາ</th><th class="rx-qty">ຈຳນວນ / Capsule</th><th class="rx-directions">ວິທີກິນ / Dosage</th><th class="rx-note">ໝາຍເຫດ / Note</th></tr></thead>
      <tbody>${rows}${fillRow}</tbody>
    </table>
    <div class="recommendation"><b>ຄຳແນະນຳ / Recommendation:</b><div class="recommendation-lines">${escapePrintHtml(data.encounter?.recommendation || '')}</div></div>
    <div class="signatures rx-signatures">
      <div><div class="signature-name"></div><b>ລາຍເຊັນເພສັດ / Pharmacist</b></div>
      <div><div class="signature-name"></div><b>ລາຍເຊັນແພດ / Doctor</b></div>
    </div>`;
};

export function buildOpdOrderPrintDocument(data = {}) {
  const type = data.type === 'medication' ? 'medication' : (data.type === 'ultrasound' ? 'ultrasound' : 'xray');
  const content = type === 'medication' ? renderPrescriptionSheet({ ...data, type }) : renderImagingSheet({ ...data, type });
  const title = type === 'medication' ? 'Prescription' : (type === 'ultrasound' ? 'Ultrasound Request' : 'X-Ray Request');
  const autoPrintScript = data.autoPrint === false
    ? ''
    : `<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},250);});<\/script>`;
  return `<!doctype html><html lang="lo"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${printStyles}</style></head>
    <body><main class="sheet">${content}</main><div class="print-actions"><button type="button" onclick="window.print()">Print</button></div>
    ${autoPrintScript}</body></html>`;
}

export { escapePrintHtml, formatPrintDateTime };
