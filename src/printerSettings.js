export const PRINTER_SETTINGS_STORAGE_KEY = 'his_local_printer_settings_v1';
export const PRINTER_SETTINGS_VERSION = 6;

export const PRINTER_PAPER_PRESETS = Object.freeze({
  xp420b: { label: 'XP-420B · 70 × 100 mm', width: 70, height: 100, orientation: 'portrait' },
  a4_portrait: { label: 'A4 · 210 × 297 mm', width: 210, height: 297, orientation: 'portrait' },
  a4_landscape: { label: 'A4 Landscape · 297 × 210 mm', width: 297, height: 210, orientation: 'landscape' },
  a5_portrait: { label: 'A5 · 148 × 210 mm', width: 148, height: 210, orientation: 'portrait' },
  letter: { label: 'Letter · 215.9 × 279.4 mm', width: 215.9, height: 279.4, orientation: 'portrait' },
  custom: { label: 'Custom size', width: 100, height: 180, orientation: 'portrait' }
});

export const PRINTER_DOCUMENT_TYPES = Object.freeze({
  patient_sticker: {
    label: 'Patient Sticker', sublabel: 'XP-420B · 70 × 100 mm / 3 ອັນ', icon: 'fa-tags', containerId: 'print-area', supportsCards: true,
    description: 'Sticker ຂໍ້ມູນຄົນເຈັບ 3 ລາຍການຕໍ່ເຈ້ຍ XP-420B ຂະໜາດ 70 × 100 mm'
  },
  opd_card: {
    label: 'OPD Card', sublabel: 'A4 Portrait', icon: 'fa-file-medical-alt', containerId: 'opd-print-area',
    description: 'ແບບຟອມ OPD ແລະໃບຕິດຕາມການຮັກສາ'
  },
  patient_cover: {
    label: 'Patient Cover', sublabel: 'A4 Portrait', icon: 'fa-folder-open', containerId: 'cover-print-area',
    description: 'ໜ້າປົກແຟ້ມ OPD/IPD ຂອງຄົນເຈັບ'
  },
  vaccine_card: {
    label: 'Vaccine Card', sublabel: 'A4 Portrait', icon: 'fa-syringe', containerId: 'vac-print-area',
    description: 'ບັດ ແລະເອກະສານວັກຊີນ'
  },
  opd_order: {
    label: 'OPD Order', sublabel: 'A4 Portrait', icon: 'fa-clipboard-list', containerId: '',
    description: 'ໃບສັ່ງການແພດ, ຢາ, Lab ແລະການກວດ'
  },
  manpower: {
    label: 'Manpower', sublabel: 'A4 Landscape', icon: 'fa-user-clock', containerId: 'view-manpower',
    description: 'ຕາຕະລາງການປະຈຳການຂອງພະນັກງານແບບໜ້າດຽວ'
  },
  dashboard: {
    label: 'Dashboard Report', sublabel: 'A4 Landscape', icon: 'fa-chart-pie', containerId: 'dashboardPrintArea',
    description: 'Dashboard ແລະລາຍງານສະຫຼຸບ'
  }
});

const PROFILE_DEFAULTS = Object.freeze({
  patient_sticker: {
    enabled: true, printerName: 'Xprinter XP-420B', paperPreset: 'xp420b', orientation: 'portrait',
    width: 70, height: 100, scale: 100, marginTop: 2, marginRight: 2, marginBottom: 2, marginLeft: 2,
    offsetX: 0, offsetY: 0, copies: 1, fontScale: 35, itemsPerPage: 3, itemWidth: 66, itemHeight: 31,
    gap: 2, printBackground: false, headerFooter: false
  },
  opd_card: {
    enabled: true, printerName: 'A4 Printer', paperPreset: 'a4_portrait', orientation: 'portrait',
    width: 210, height: 297, scale: 100, marginTop: 10, marginRight: 12, marginBottom: 10, marginLeft: 12,
    offsetX: 0, offsetY: 0, copies: 1, fontScale: 100, itemsPerPage: 1, itemWidth: 186, itemHeight: 277,
    gap: 0, printBackground: true, headerFooter: false
  },
  patient_cover: {
    enabled: true, printerName: 'A4 Printer', paperPreset: 'a4_portrait', orientation: 'portrait',
    width: 210, height: 297, scale: 100, marginTop: 4, marginRight: 4, marginBottom: 4, marginLeft: 4,
    offsetX: 0, offsetY: 0, copies: 1, fontScale: 100, itemsPerPage: 1, itemWidth: 198, itemHeight: 289,
    gap: 0, printBackground: true, headerFooter: false
  },
  vaccine_card: {
    enabled: true, printerName: 'A4 Printer', paperPreset: 'a4_portrait', orientation: 'portrait',
    width: 210, height: 297, scale: 100, marginTop: 4, marginRight: 4, marginBottom: 4, marginLeft: 4,
    offsetX: 0, offsetY: 0, copies: 1, fontScale: 100, itemsPerPage: 1, itemWidth: 198, itemHeight: 289,
    gap: 0, printBackground: true, headerFooter: false
  },
  opd_order: {
    enabled: true, printerName: 'A4 Printer', paperPreset: 'a4_portrait', orientation: 'portrait',
    width: 210, height: 297, scale: 100, marginTop: 8, marginRight: 8, marginBottom: 8, marginLeft: 8,
    offsetX: 0, offsetY: 0, copies: 1, fontScale: 100, itemsPerPage: 1, itemWidth: 194, itemHeight: 281,
    gap: 0, printBackground: true, headerFooter: false
  },
  manpower: {
    enabled: true, printerName: 'A4 Printer', paperPreset: 'a4_landscape', orientation: 'landscape',
    width: 297, height: 210, scale: 100, marginTop: 4, marginRight: 4, marginBottom: 4, marginLeft: 4,
    offsetX: 0, offsetY: 0, copies: 1, fontScale: 100, itemsPerPage: 1, itemWidth: 289, itemHeight: 202,
    gap: 0, printBackground: true, headerFooter: false
  },
  dashboard: {
    enabled: true, printerName: 'A4 Printer', paperPreset: 'a4_landscape', orientation: 'landscape',
    width: 297, height: 210, scale: 100, marginTop: 4, marginRight: 4, marginBottom: 4, marginLeft: 4,
    offsetX: 0, offsetY: 0, copies: 1, fontScale: 100, itemsPerPage: 1, itemWidth: 289, itemHeight: 202,
    gap: 0, printBackground: true, headerFooter: false
  }
});

const CONTAINER_DOCUMENT_MAP = Object.freeze(Object.fromEntries(
  Object.entries(PRINTER_DOCUMENT_TYPES).filter(([, meta]) => meta.containerId).map(([key, meta]) => [meta.containerId, key])
));

const clamp = (value, min, max, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
const clone = value => JSON.parse(JSON.stringify(value));
const clean = value => String(value ?? '').trim();

function createDeviceId() {
  const random = globalThis.crypto?.randomUUID?.().slice(0, 8).toUpperCase()
    || Math.random().toString(36).slice(2, 10).toUpperCase();
  return `HIS-PC-${random}`;
}

export function createDefaultPrinterSettings() {
  return {
    version: PRINTER_SETTINGS_VERSION,
    device: { id: createDeviceId(), name: 'ຄອມພິວເຕີນີ້' },
    profiles: clone(PROFILE_DEFAULTS),
    updatedAt: new Date().toISOString()
  };
}

function migratePrinterSettings(source = {}) {
  const migrated = source && typeof source === 'object' ? clone(source) : {};
  const version = Number(migrated.version) || 1;
  const sticker = migrated?.profiles?.patient_sticker;
  const matches = (profile, expected) => Object.entries(expected)
    .every(([key, value]) => Number(profile?.[key]) === value);
  // Replace previous guessed sticker stock with the user's measured stock.
  // Preserve the device and all other document profiles.
  if (version < PRINTER_SETTINGS_VERSION && sticker) {
    migrated.profiles.patient_sticker = { ...sticker, ...clone(PROFILE_DEFAULTS.patient_sticker) };
  }
  migrated.version = PRINTER_SETTINGS_VERSION;
  return migrated;
}

export function normalizePrinterProfile(source = {}, fallback = PROFILE_DEFAULTS.patient_sticker) {
  const base = { ...fallback, ...(source && typeof source === 'object' ? source : {}) };
  const preset = PRINTER_PAPER_PRESETS[base.paperPreset] ? base.paperPreset : 'custom';
  return {
    enabled: base.enabled !== false,
    printerName: clean(base.printerName),
    paperPreset: preset,
    orientation: base.orientation === 'landscape' ? 'landscape' : 'portrait',
    width: clamp(base.width, 20, 500, fallback.width),
    height: clamp(base.height, 20, 500, fallback.height),
    scale: clamp(base.scale, 25, 200, fallback.scale),
    marginTop: clamp(base.marginTop, 0, 50, fallback.marginTop),
    marginRight: clamp(base.marginRight, 0, 50, fallback.marginRight),
    marginBottom: clamp(base.marginBottom, 0, 50, fallback.marginBottom),
    marginLeft: clamp(base.marginLeft, 0, 50, fallback.marginLeft),
    offsetX: clamp(base.offsetX, -30, 30, fallback.offsetX),
    offsetY: clamp(base.offsetY, -30, 30, fallback.offsetY),
    copies: Math.round(clamp(base.copies, 1, 20, fallback.copies)),
    fontScale: clamp(base.fontScale, 20, 160, fallback.fontScale),
    itemsPerPage: Math.round(clamp(base.itemsPerPage, 1, 3, fallback.itemsPerPage)),
    itemWidth: clamp(base.itemWidth, 20, 500, fallback.itemWidth),
    itemHeight: clamp(base.itemHeight, 15, 500, fallback.itemHeight),
    gap: clamp(base.gap, 0, 30, fallback.gap),
    printBackground: base.printBackground === true,
    headerFooter: base.headerFooter === true
  };
}

export function normalizePrinterSettings(source = {}) {
  const migrated = migratePrinterSettings(source);
  const defaults = createDefaultPrinterSettings();
  const profiles = {};
  Object.keys(PRINTER_DOCUMENT_TYPES).forEach(key => {
    profiles[key] = normalizePrinterProfile(migrated?.profiles?.[key], PROFILE_DEFAULTS[key]);
  });
  return {
    version: PRINTER_SETTINGS_VERSION,
    device: {
      id: clean(migrated?.device?.id) || defaults.device.id,
      name: clean(migrated?.device?.name) || defaults.device.name
    },
    profiles,
    updatedAt: clean(migrated?.updatedAt) || defaults.updatedAt
  };
}

function pageDimensions(profile) {
  let width = profile.width;
  let height = profile.height;
  if (profile.orientation === 'landscape' && width < height) [width, height] = [height, width];
  if (profile.orientation === 'portrait' && width > height) [width, height] = [height, width];
  return { width, height };
}

export function buildRuntimePrintCss(documentType, profile, containerId = '') {
  // Chromium may ignore a named @page when the Windows printer uses custom
  // stock. Install this unnamed rule last and only while the sticker dialog is
  // open. It is intentionally fixed, not derived from saved local settings.
  if (documentType === 'patient_sticker') {
    return `@media print {
      @page { size: 70mm 100mm; margin: 0; }
      html, body, #partial-prints { width: 70mm !important; min-width: 70mm !important; max-width: 70mm !important; height: 100mm !important; min-height: 100mm !important; max-height: 100mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      #partial-prints { position: relative !important; }
    }`;
  }
  const normalized = normalizePrinterProfile(profile, PROFILE_DEFAULTS[documentType] || PROFILE_DEFAULTS.opd_card);
  if (!normalized.enabled) return '';
  const { width, height } = pageDimensions(normalized);
  const printableWidth = Math.max(0, width - normalized.marginLeft - normalized.marginRight);
  const printableHeight = Math.max(0, height - normalized.marginTop - normalized.marginBottom);
  const selector = containerId ? `#${String(containerId).replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
  const scale = normalized.scale / 100;
  const fontScale = normalized.fontScale / 100;
  let css = `@media print {
    @page { size: ${width}mm ${height}mm; margin: ${normalized.marginTop}mm ${normalized.marginRight}mm ${normalized.marginBottom}mm ${normalized.marginLeft}mm; }
    html, body { print-color-adjust: ${normalized.printBackground ? 'exact' : 'economy'}; -webkit-print-color-adjust: ${normalized.printBackground ? 'exact' : 'economy'}; }
    ${selector}.print-active { position: relative !important; left: ${normalized.offsetX}mm !important; top: ${normalized.offsetY}mm !important; zoom: ${scale} !important; }
  `;
  if (documentType === 'patient_sticker') {
    const idFont = (52 * fontScale).toFixed(2);
    const payerLabelFont = (22 * fontScale).toFixed(2);
    const payerFont = (25 * fontScale).toFixed(2);
    const labelFont = (30 * fontScale).toFixed(2);
    const valueFont = (37 * fontScale).toFixed(2);
    const nameFont = (39 * fontScale).toFixed(2);
    css += `
      #partial-prints, #print-area.print-active { width: ${printableWidth}mm !important; height: ${printableHeight}mm !important; min-height: ${printableHeight}mm !important; max-height: ${printableHeight}mm !important; overflow: hidden !important; }
      #print-area.print-active { max-width: none !important; break-inside: avoid !important; page-break-inside: avoid !important; break-after: avoid !important; page-break-after: avoid !important; }
      #print-area.print-active .print-card-grid { display: flex !important; flex-flow: column nowrap !important; width: 100% !important; height: 100% !important; align-items: center !important; justify-content: flex-start !important; gap: ${normalized.gap}mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      #print-area.print-active .patient-card { flex: 0 0 ${normalized.itemHeight}mm !important; width: ${normalized.itemWidth}mm !important; height: ${normalized.itemHeight}mm !important; min-height: ${normalized.itemHeight}mm !important; max-height: ${normalized.itemHeight}mm !important; padding: 1.5mm 3mm 2mm !important; border-width: 1px !important; border-radius: 2px !important; break-inside: avoid !important; page-break-inside: avoid !important; }
      #print-area.print-active .patient-card:nth-child(n+${normalized.itemsPerPage + 1}) { display: none !important; }
      #print-area.print-active .pcard-id { font-size: ${idFont}px !important; line-height: 1 !important; border-bottom-width: 1.5px !important; margin-bottom: .55mm !important; padding-bottom: .55mm !important; }
      #print-area.print-active .pcard-payer { min-height: 4mm !important; margin-bottom: .45mm !important; padding: .35mm 1mm !important; border-left-width: 2px !important; }
      #print-area.print-active .pcard-payer-label { font-size: ${payerLabelFont}px !important; }
      #print-area.print-active .pcard-payer-name { font-size: ${payerFont}px !important; }
      #print-area.print-active .pcard-info { gap: .25mm !important; }
      #print-area.print-active .pcard-row { line-height: 1.01 !important; }
      #print-area.print-active .pcard-label { font-size: ${labelFont}px !important; }
      #print-area.print-active .pcard-value, #print-area.print-active .pcard-time { font-size: ${valueFont}px !important; }
      #print-area.print-active .pcard-name { font-size: ${nameFont}px !important; }
      #print-area.print-active .pcard-value-2nd { margin-left: 2mm !important; }
    `;
  }
  return `${css}\n}`;
}

function escapeMarkup(value) {
  return clean(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function buildDocumentPreviewMarkup(documentType, dims) {
  const landscape = dims.width > dims.height;
  const pageClass = `printer-document-preview printer-document-preview--${documentType.replace(/_/g, '-')} ${landscape ? 'printer-document-preview--landscape' : ''}`;
  const header = (title, subtitle, code = 'LXH') => `<header class="printer-document-header">
    <div class="printer-document-logo">LXH<small>ຫຼັກໄຊ</small></div>
    <div><strong>${title}</strong><span>${subtitle}</span></div>
    <b class="printer-document-code">${code}</b>
  </header>`;
  const row = (label, value) => `<div class="printer-document-field"><span>${label}</span><strong>${value}</strong></div>`;
  const section = title => `<div class="printer-document-section-title">${title}</div>`;

  const templates = {
    opd_card: `${header('OPD CARD · ໃບຄົນເຈັບ', 'ໂຮງໝໍຫຼັກໄຊ · 12/09/2026', 'OPD-0018')}
      ${section('ຂໍ້ມູນຄົນເຈັບ')}
      <div class="printer-document-grid">${row('ລະຫັດຄົນເຈັບ', 'LXH2026-0001')}${row('ຊື່-ນາມສະກຸນ', 'ທ່ານ ສົມພອນ ພົມມະຈັນ')}${row('ເພດ / ອາຍຸ', 'ຊາຍ · 36 ປີ')}${row('ໂທລະສັບ', '020 5555 5555')}${row('ບ້ານ / ເມືອງ', 'ຕົວຢ່າງ / ຫຼັກໄຊ')}${row('ສິດການຮັກສາ', 'ປະກັນສຸຂະພາບ')}</div>
      ${section('ການຮັກສາຄັ້ງນີ້')}
      <div class="printer-document-grid">${row('ແພດ', 'ດຣ. ສົມພອນ ພົມມະຈັນ')}${row('ພະແນກ', 'General Practice')}${row('ອາການຫຼັກ', 'ໄຂ້ ແລະ ເຈັບຄໍ')}${row('ນັດຄັ້ງຕໍ່ໄປ', '19/09/2026')}</div>
      <div class="printer-document-signatures"><span>ລາຍເຊັນຄົນເຈັບ</span><span>ລາຍເຊັນແພດ</span></div>`,
    patient_cover: `${header('PATIENT COVER · ໜ້າປົກແຟ້ມ', 'ປະຫວັດການຮັກສາຄົນເຈັບ', 'FILE-0001')}
      <div class="printer-cover-title">ແຟ້ມປະຫວັດຄົນເຈັບ</div>
      <div class="printer-cover-id">LXH2026-0001</div>
      <div class="printer-document-grid printer-document-grid--single">${row('ຊື່-ນາມສະກຸນ', 'ທ່ານ ສົມພອນ ພົມມະຈັນ')}${row('ວັນເດືອນປີເກີດ', '15/01/1990 (36 ປີ)')}${row('ບ້ານ / ເມືອງ / ແຂວງ', 'ຕົວຢ່າງ / ຫຼັກໄຊ / ວຽງຈັນ')}${row('ເບີໂທ', '020 5555 5555')}${row('ວັນທີເປີດແຟ້ມ', '12/09/2026')}</div>
      <div class="printer-barcode">|||| ||| | |||| || ||| ||||</div><div class="printer-document-footer">ເອກະສານພາຍໃນ · ກະລຸນາເກັບຮັກສາ</div>`,
    vaccine_card: `${header('VACCINE CARD · ບັດວັກຊີນ', 'ປະຫວັດການຮັບວັກຊີນ', 'VAC-0001')}
      ${section('ຂໍ້ມູນຜູ້ຮັບວັກຊີນ')}
      <div class="printer-document-grid">${row('ຊື່-ນາມສະກຸນ', 'ທ່ານ ສົມພອນ ພົມມະຈັນ')}${row('ລະຫັດ', 'LXH2026-0001')}${row('ວັນເກີດ', '15/01/1990')}${row('ເບີໂທ', '020 5555 5555')}</div>
      ${section('ລາຍການວັກຊີນ')}
      <table class="printer-document-table"><thead><tr><th>ວັນທີ</th><th>ວັກຊີນ</th><th>ເຂັມ</th><th>ຜູ້ໃຫ້</th></tr></thead><tbody><tr><td>12/09/2026</td><td>COVID-19</td><td>1</td><td>ນ. ຄຳແພງ</td></tr><tr><td>12/03/2026</td><td>Influenza</td><td>1</td><td>ນ. ສຸພາ</td></tr><tr><td>12/09/2027</td><td>Booster</td><td>2</td><td>—</td></tr></tbody></table>
      <div class="printer-document-signatures"><span>ລາຍເຊັນຜູ້ຮັບ</span><span>ລາຍເຊັນພະຍາບານ</span></div>`,
    opd_order: `${header('OPD ORDER · ໃບສັ່ງການແພດ', 'ລາຍການສັ່ງການຮັກສາ · 12/09/2026', 'ORD-0018')}
      <div class="printer-document-grid">${row('ຄົນເຈັບ', 'ສົມພອນ ພົມມະຈັນ')}${row('ລະຫັດ', 'LXH2026-0001')}${row('ແພດ', 'ດຣ. ສົມພອນ')}${row('ວິນິດໄສ', 'J06.9 · ໄຂ້ຫວັດ')}</div>
      ${section('ລາຍການສັ່ງ')}
      <table class="printer-document-table"><thead><tr><th>#</th><th>ລາຍການ</th><th>ຈຳນວນ</th><th>ວິທີໃຊ້</th></tr></thead><tbody><tr><td>1</td><td>Paracetamol 500 mg</td><td>10 ເມັດ</td><td>ຄັ້ງລະ 1 ເມັດ</td></tr><tr><td>2</td><td>Amoxicillin 500 mg</td><td>15 ເມັດ</td><td>ຫຼັງອາຫານ 3 ຄັ້ງ</td></tr><tr><td>3</td><td>ກວດ CBC</td><td>1</td><td>ສົ່ງຫ້ອງ Lab</td></tr></tbody></table>
      <div class="printer-order-note"><b>ໝາຍເຫດ:</b> ດື່ມນ້ຳຫຼາຍ ແລະ ກັບມາພົບແພດຕາມນັດ</div><div class="printer-document-signatures"><span>ລາຍເຊັນແພດ</span><span>ລາຍເຊັນຜູ້ຮັບຢາ</span></div>`,
    manpower: `${header('DAILY MANPOWER · ຕາຕະລາງການປະຈຳການ', 'ວັນທີ 12/09/2026 · ກະເຊົ້າ 08:00–16:00', 'SHIFT-01')}
      <table class="printer-document-table printer-document-table--compact"><thead><tr><th>ພະແນກ</th><th>ຊື່ພະນັກງານ</th><th>ໜ້າທີ່</th><th>ສະຖານະ</th></tr></thead><tbody><tr><td>ແພດ</td><td>ດຣ. ສົມພອນ</td><td>General Practice</td><td class="is-ok">ເຂົ້າປະຈຳການ</td></tr><tr><td>ແພດ</td><td>ດຣ. ມາລີ</td><td>Pediatrics</td><td class="is-ok">ເຂົ້າປະຈຳການ</td></tr><tr><td>ພະຍາບານ</td><td>ນ. ຄຳແພງ</td><td>Nursing</td><td class="is-ok">ເຂົ້າປະຈຳການ</td></tr><tr><td>ການຢາ</td><td>ນ. ມາຍາ</td><td>Pharmacy</td><td class="is-off">ວ່າງ</td></tr><tr><td>ແລັບ</td><td>ນ. ອານຸສອນ</td><td>Laboratory</td><td class="is-ok">ເຂົ້າປະຈຳການ</td></tr></tbody></table>
      <div class="printer-manpower-summary"><b>ລວມ 5 ຄົນ</b><span>ເຂົ້າປະຈຳການ 4 · ວ່າງ 1 · ລາ 0</span></div>`,
    dashboard: `${header('CLINIC SNAPSHOT · DASHBOARD REPORT', 'ສະຫຼຸບການໃຫ້ບໍລິການ · 12/09/2026', 'REPORT-01')}
      <div class="printer-dashboard-metrics"><div><b>24</b><span>ຜູ້ມາຮັບບໍລິການ</span></div><div><b>16</b><span>ຄົນເຈັບໃໝ່</span></div><div><b>8</b><span>ກັບມາຊ້ຳ</span></div><div><b>4</b><span>ພະແນກ</span></div></div>
      ${section('ຈຳນວນຕາມພະແນກ')}
      <div class="printer-dashboard-bars"><div><span>General Practice</span><i style="--bar:82%"></i><b>10</b></div><div><span>Pediatrics</span><i style="--bar:58%"></i><b>7</b></div><div><span>Laboratory</span><i style="--bar:42%"></i><b>5</b></div><div><span>Radiology</span><i style="--bar:25%"></i><b>2</b></div></div>
      <div class="printer-document-footer">ລາຍງານຈາກ HIS · ຜູ້ຈັດເຮັດ: Admin</div>`
  };
  return `<div class="${pageClass}">${templates[documentType] || `${header('HIS DOCUMENT', 'ຕົວຢ່າງເອກະສານ', 'PREVIEW')}${section('ຂໍ້ມູນຕົວຢ່າງ')}<div class="printer-document-grid">${row('ລະຫັດ', 'LXH2026-0001')}${row('ວັນທີ', '12/09/2026')}${row('ສະຖານະ', 'ພ້ອມພິມ')}</div>`}</div>`;
}

export function installPrinterSettings() {
  let state;
  let activeType = 'patient_sticker';

  const load = () => {
    try {
      const raw = localStorage.getItem(PRINTER_SETTINGS_STORAGE_KEY);
      state = normalizePrinterSettings(raw ? JSON.parse(raw) : {});
    } catch {
      state = createDefaultPrinterSettings();
    }
    return state;
  };

  const persist = () => {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(PRINTER_SETTINGS_STORAGE_KEY, JSON.stringify(state));
  };

  const notify = (title, text, icon = 'success') => {
    if (window.Swal?.fire) return window.Swal.fire({ title, text, icon, timer: 1800, showConfirmButton: false });
    window.alert(`${title}\n${text}`);
  };

  const input = id => document.getElementById(id);
  const setValue = (id, value) => { const el = input(id); if (el) el.value = value ?? ''; };
  const setChecked = (id, value) => { const el = input(id); if (el) el.checked = value === true; };

  const readProfileForm = () => normalizePrinterProfile({
    enabled: input('printerProfileEnabled')?.checked,
    printerName: input('printerProfilePrinterName')?.value,
    paperPreset: input('printerProfilePaper')?.value,
    orientation: input('printerProfileOrientation')?.value,
    width: input('printerProfileWidth')?.value,
    height: input('printerProfileHeight')?.value,
    scale: input('printerProfileScale')?.value,
    marginTop: input('printerProfileMarginTop')?.value,
    marginRight: input('printerProfileMarginRight')?.value,
    marginBottom: input('printerProfileMarginBottom')?.value,
    marginLeft: input('printerProfileMarginLeft')?.value,
    offsetX: input('printerProfileOffsetX')?.value,
    offsetY: input('printerProfileOffsetY')?.value,
    copies: input('printerProfileCopies')?.value,
    fontScale: input('printerProfileFontScale')?.value,
    itemsPerPage: input('printerProfileItems')?.value,
    itemWidth: input('printerProfileItemWidth')?.value,
    itemHeight: input('printerProfileItemHeight')?.value,
    gap: input('printerProfileGap')?.value,
    printBackground: input('printerProfileBackground')?.checked,
    headerFooter: input('printerProfileHeaderFooter')?.checked
  }, PROFILE_DEFAULTS[activeType]);

  const renderPreview = (profile = readProfileForm()) => {
    const host = input('printerPreviewStage');
    if (!host) return;
    const dims = pageDimensions(profile);
    const maxWidth = 228;
    const maxHeight = 390;
    const ratio = Math.min(maxWidth / dims.width, maxHeight / dims.height);
    const previewWidth = dims.width * ratio;
    const previewHeight = dims.height * ratio;
    const marginX = Math.max(0, profile.marginLeft * ratio);
    const marginY = Math.max(0, profile.marginTop * ratio);
    const offsetX = profile.offsetX * ratio;
    const offsetY = profile.offsetY * ratio;
    let content = '';
    if (PRINTER_DOCUMENT_TYPES[activeType]?.supportsCards) {
      const itemWidth = Math.min(profile.itemWidth * ratio, previewWidth - marginX * 2);
      const itemHeight = profile.itemHeight * ratio;
      content = Array.from({ length: profile.itemsPerPage }, (_, index) => `
        <div class="printer-sticker-preview printer-sticker-preview--full" style="--preview-item-width:${itemWidth}px;--preview-item-height:${itemHeight}px">
          <div class="printer-preview-id">LXH2026-000${index + 1}</div>
          <div class="printer-preview-row printer-preview-row--name"><span>ຊື່ ແລະ ນາມສະກຸນ:</span><strong>ທ່ານ ສົມພອນ ພົມມະຈັນ</strong></div>
          <div class="printer-preview-row"><span>ວັນເດືອນປີເກີດ:</span><strong>1990-01-15 (36 ປີ)</strong></div>
          <div class="printer-preview-row"><strong>ບ້ານ: ຕົວຢ່າງ</strong><strong>ເມືອງ: ຫຼັກໄຊ</strong></div>
          <div class="printer-preview-row"><strong>ແຂວງ: ວຽງຈັນ</strong></div>
          <div class="printer-preview-row"><strong>ເບີໂທ: 020 5555 5555</strong></div>
        </div>`).join('');
    } else {
      content = buildDocumentPreviewMarkup(activeType, dims);
    }
    host.innerHTML = `<div class="printer-paper-preview" data-size="${dims.width} × ${dims.height} mm" style="--preview-width:${previewWidth}px;--preview-height:${previewHeight}px;--preview-margin-x:${marginX}px;--preview-margin-y:${marginY}px;--preview-gap:${profile.gap * ratio}px;--preview-offset-x:${offsetX}px;--preview-offset-y:${offsetY}px">${content}</div>`;
  };

  const renderJobList = () => {
    const host = input('printerJobList');
    if (!host) return;
    host.innerHTML = Object.entries(PRINTER_DOCUMENT_TYPES).map(([key, meta]) => {
      const profile = state.profiles[key];
      return `<button type="button" class="printer-job-button ${key === activeType ? 'is-active' : ''}" onclick="window.selectPrinterDocumentType('${key}')">
        <i class="fas ${meta.icon}"></i><span><strong>${escapeMarkup(meta.label)}</strong><small>${escapeMarkup(meta.sublabel)}</small></span>
        <i class="fas ${profile.enabled ? 'fa-check-circle' : 'fa-pause-circle'}"></i>
      </button>`;
    }).join('');
  };

  const fillProfile = () => {
    const meta = PRINTER_DOCUMENT_TYPES[activeType];
    const profile = state.profiles[activeType];
    if (!meta || !profile) return;
    if (input('printerProfileCode')) input('printerProfileCode').textContent = activeType.toUpperCase();
    if (input('printerProfileTitle')) input('printerProfileTitle').textContent = meta.label;
    if (input('printerProfileDescription')) input('printerProfileDescription').textContent = meta.description;
    setChecked('printerProfileEnabled', profile.enabled);
    setValue('printerProfilePrinterName', profile.printerName);
    setValue('printerProfilePaper', profile.paperPreset);
    setValue('printerProfileOrientation', profile.orientation);
    setValue('printerProfileWidth', profile.width);
    setValue('printerProfileHeight', profile.height);
    setValue('printerProfileScale', profile.scale);
    setValue('printerProfileMarginTop', profile.marginTop);
    setValue('printerProfileMarginRight', profile.marginRight);
    setValue('printerProfileMarginBottom', profile.marginBottom);
    setValue('printerProfileMarginLeft', profile.marginLeft);
    setValue('printerProfileOffsetX', profile.offsetX);
    setValue('printerProfileOffsetY', profile.offsetY);
    setValue('printerProfileCopies', profile.copies);
    setValue('printerProfileFontScale', profile.fontScale);
    setValue('printerProfileItems', profile.itemsPerPage);
    setValue('printerProfileItemWidth', profile.itemWidth);
    setValue('printerProfileItemHeight', profile.itemHeight);
    setValue('printerProfileGap', profile.gap);
    setChecked('printerProfileBackground', profile.printBackground);
    setChecked('printerProfileHeaderFooter', profile.headerFooter);
    input('printerStickerOptions')?.classList.toggle('d-none', !meta.supportsCards);
    renderPreview(profile);
  };

  window.initPrinterSettings = function () {
    if (!state) load();
    const paper = input('printerProfilePaper');
    if (paper && !paper.options.length) {
      paper.innerHTML = Object.entries(PRINTER_PAPER_PRESETS).map(([key, preset]) => `<option value="${key}">${escapeMarkup(preset.label)}</option>`).join('');
    }
    if (input('printerDeviceId')) input('printerDeviceId').textContent = state.device.id;
    setValue('printerDeviceName', state.device.name);
    renderJobList();
    fillProfile();
    const form = input('printerProfileForm');
    if (form && !form.dataset.previewBound) {
      form.dataset.previewBound = '1';
      form.addEventListener('input', () => renderPreview());
      form.addEventListener('change', () => renderPreview());
    }
  };

  window.selectPrinterDocumentType = function (key) {
    if (!PRINTER_DOCUMENT_TYPES[key]) return;
    activeType = key;
    renderJobList();
    fillProfile();
  };

  window.changePrinterPaperPreset = function () {
    const preset = PRINTER_PAPER_PRESETS[input('printerProfilePaper')?.value];
    if (!preset || input('printerProfilePaper')?.value === 'custom') return renderPreview();
    setValue('printerProfileWidth', preset.width);
    setValue('printerProfileHeight', preset.height);
    setValue('printerProfileOrientation', preset.orientation);
    renderPreview();
  };

  window.savePrinterDeviceName = function () {
    state.device.name = clean(input('printerDeviceName')?.value) || 'ຄອມພິວເຕີນີ້';
    persist();
    setValue('printerDeviceName', state.device.name);
    notify('ບັນທຶກແລ້ວ', `Device: ${state.device.name}`);
  };

  window.savePrinterProfile = function (event) {
    event?.preventDefault?.();
    state.profiles[activeType] = readProfileForm();
    persist();
    renderJobList();
    fillProfile();
    notify('ບັນທຶກ Profile ແລ້ວ', 'ຄ່ານີ້ຈະໃຊ້ສະເພາະ Browser ຂອງຄອມນີ້');
  };

  window.resetPrinterProfile = function () {
    state.profiles[activeType] = clone(PROFILE_DEFAULTS[activeType]);
    persist();
    renderJobList();
    fillProfile();
    notify('Reset ສຳເລັດ', 'ກັບໄປໃຊ້ຄ່າມາດຕະຖານ');
  };

  window.previewPrinterProfile = function () {
    const profile = readProfileForm();
    renderPreview(profile);
    input('printerPreviewStage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const source = input('printerPreviewStage')?.querySelector('.printer-paper-preview');
    if (!source) return;
    document.getElementById('printerPreviewModal')?.remove();
    const dims = pageDimensions(profile);
    const maxWidth = Math.min(window.innerWidth * 0.78, 780);
    const maxHeight = Math.min(window.innerHeight * 0.78, 860);
    const ratio = Math.min(maxWidth / dims.width, maxHeight / dims.height);
    const pageWidth = dims.width * ratio;
    const pageHeight = dims.height * ratio;
    const page = source.cloneNode(true);
    page.classList.add('printer-preview-modal-page');
    page.style.setProperty('--preview-width', `${pageWidth}px`);
    page.style.setProperty('--preview-height', `${pageHeight}px`);
    page.style.setProperty('--preview-margin-x', `${profile.marginLeft * ratio}px`);
    page.style.setProperty('--preview-margin-y', `${profile.marginTop * ratio}px`);
    page.style.setProperty('--preview-gap', `${profile.gap * ratio}px`);
    page.style.setProperty('--preview-offset-x', `${profile.offsetX * ratio}px`);
    page.style.setProperty('--preview-offset-y', `${profile.offsetY * ratio}px`);
    page.querySelectorAll('.printer-sticker-preview').forEach(card => {
      card.style.setProperty('--preview-item-width', `${profile.itemWidth * ratio}px`);
      card.style.setProperty('--preview-item-height', `${profile.itemHeight * ratio}px`);
    });

    const meta = PRINTER_DOCUMENT_TYPES[activeType];
    const modal = document.createElement('div');
    modal.id = 'printerPreviewModal';
    modal.className = 'printer-preview-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `<div class="printer-preview-modal__dialog">
      <header class="printer-preview-modal__header"><div><span>LIVE PREVIEW</span><h3>${escapeMarkup(meta?.label || 'Preview')}</h3><small>${dims.width} × ${dims.height} mm · ${escapeMarkup(profile.printerName)}</small></div><button type="button" class="printer-preview-modal__close" aria-label="Close preview">&times;</button></header>
      <div class="printer-preview-modal__body"></div>
      <footer class="printer-preview-modal__footer"><span><i class="fas fa-info-circle"></i> ຕົວຢ່າງສຳລັບປັບຂະໜາດ; ເວລາພິມຈິງຈະໃຊ້ຂໍ້ມູນຈາກລະບົບ</span><button type="button" class="btn btn-primary printer-preview-modal__done">ປິດ Preview</button></footer>
    </div>`;
    modal.querySelector('.printer-preview-modal__body').appendChild(page);
    document.body.appendChild(modal);
    let escapeHandler;
    const close = () => { if (escapeHandler) document.removeEventListener('keydown', escapeHandler); modal.remove(); };
    modal.querySelector('.printer-preview-modal__close')?.addEventListener('click', close);
    modal.querySelector('.printer-preview-modal__done')?.addEventListener('click', close);
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    escapeHandler = event => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', escapeHandler);
  };

  window.testPrinterProfile = function () {
    const profile = readProfileForm();
    const meta = PRINTER_DOCUMENT_TYPES[activeType];
    const dims = pageDimensions(profile);
    const popup = window.open('', '_blank', 'width=900,height=900');
    if (!popup) return notify('ບໍ່ສາມາດເປີດ Test Print', 'ກະລຸນາອະນຸຍາດ Pop-up ໃນ Browser', 'warning');
    const cards = meta.supportsCards
      ? Array.from({ length: profile.itemsPerPage }, (_, index) => `<section class="test-card"><b>LXH2026-TEST-${index + 1}</b><div>ຊື່ ແລະ ນາມສະກຸນ: ທົດສອບຂະໜາດພິມ</div><div>50 mm calibration line</div><i></i></section>`).join('')
      : `<section class="test-page"><h1>${escapeMarkup(meta.label)}</h1><p>${dims.width} × ${dims.height} mm · ${profile.orientation}</p><i></i></section>`;
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="lo"><head><meta charset="utf-8"><title>HIS Print Test</title><style>
      @page { size:${dims.width}mm ${dims.height}mm; margin:${profile.marginTop}mm ${profile.marginRight}mm ${profile.marginBottom}mm ${profile.marginLeft}mm; }
      *{box-sizing:border-box}html,body{margin:0;padding:0;font-family:"Noto Sans Lao",Arial,sans-serif;color:#111}.sheet{position:relative;left:${profile.offsetX}mm;top:${profile.offsetY}mm;display:flex;flex-direction:column;align-items:center;gap:${profile.gap}mm;zoom:${profile.scale / 100}}
      .test-card{width:${profile.itemWidth}mm;height:${profile.itemHeight}mm;border:1px solid #000;padding:2mm 3mm;overflow:hidden;font-size:${Math.max(9, 15 * profile.fontScale / 100)}px}.test-card b{display:block;border-bottom:1px solid #000;text-align:center;font:700 ${Math.max(14, 28 * profile.fontScale / 100)}px Consolas,monospace;margin-bottom:2mm}.test-card i,.test-page i{display:block;width:50mm;border-top:1px solid #000;margin-top:3mm}.test-page{width:100%;min-height:80mm;border:1px solid #000;padding:8mm}.test-page h1{font-size:22px}@media screen{body{padding:20px;background:#ddd}.sheet{width:${dims.width - profile.marginLeft - profile.marginRight}mm;min-height:${dims.height - profile.marginTop - profile.marginBottom}mm;background:#fff;margin:auto}}@media print{.sheet{width:100%}}
    </style></head><body><main class="sheet">${cards}</main><script>addEventListener('load',()=>setTimeout(()=>print(),350));<\/script></body></html>`);
    popup.document.close();
  };

  window.exportPrinterSettings = function () {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `his-printer-settings-${state.device.id}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  window.importPrinterSettings = async function (file) {
    if (!file) return;
    try {
      state = normalizePrinterSettings(JSON.parse(await file.text()));
      persist();
      window.initPrinterSettings();
      notify('Import ສຳເລັດ', 'ກວດຄ່າແລ້ວກົດ Test print ກ່ອນນຳໃຊ້');
    } catch {
      notify('Import ບໍ່ສຳເລັດ', 'ໄຟລ໌ Printer Settings ບໍ່ຖືກຕ້ອງ', 'error');
    }
  };

  window.getPrinterProfile = function (documentType) {
    if (!state) load();
    return state.profiles[documentType] ? clone(state.profiles[documentType]) : null;
  };

  window.preparePrinterPrint = function (containerId, documentType = '') {
    if (!state) load();
    const type = documentType || CONTAINER_DOCUMENT_MAP[containerId];
    const profile = state.profiles[type];
    document.getElementById('hisPrinterRuntimeStyle')?.remove();
    if (!type || (type !== 'patient_sticker' && !profile?.enabled)) return false;
    const runtimeCss = buildRuntimePrintCss(type, profile, containerId);
    if (!runtimeCss) return false;
    const style = document.createElement('style');
    style.id = 'hisPrinterRuntimeStyle';
    style.dataset.documentType = type;
    style.textContent = runtimeCss;
    document.head.appendChild(style);
    return true;
  };

  window.finishPrinterPrint = function () {
    document.getElementById('hisPrinterRuntimeStyle')?.remove();
  };

  load();
  return { getState: () => clone(state), getProfile: key => window.getPrinterProfile(key) };
}
