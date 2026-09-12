export const OPD_DEPARTMENTS = Object.freeze([
  { key: 'integumentary', label: 'Integumentary ລະບົບຜີວໜັງ' },
  { key: 'muscular_skeletal', label: 'Muscular&Skeletal ລະບົບກ້າມເນື້ອແລະກະດູກ' },
  { key: 'nervous', label: 'Nervous ລະບົບປະສາດ' },
  { key: 'cardiovescular', label: 'Cardiovescular ລະບົບຫົວໃຂຫລອດເລືອດ' },
  { key: 'respiratory', label: 'Respiratory ລະບົບຫາຍໃຈ' },
  { key: 'gastro_intentinal', label: 'Gastro&Intentinal ກະເພາະລຳໄສ' },
  { key: 'urology', label: 'Urology ລະບົບຸາຍເທ່' },
  { key: 'reproductive_obgyn', label: 'Reproductive&OB-GYN ລະບົບສືບພັນແລະປະສູດພະຍາດຍິງ' },
  { key: 'ncds', label: 'NCDs(DM/HN/DLP/Ob/CV/CA) ກູມພະຍາດຊຳເຮື້ອ' },
  { key: 'immune_lymphatic', label: 'Immune-Lymphatic ພູມຕູ້ມກັນ-ຕ່ອມນຳ້ເຫຼືອງ' },
  { key: 'ent', label: 'ENT ຫູດັງຄໍ' },
  { key: 'hematology', label: 'Hematology ກຸ່ມພະຍາດເລືອດ' },
  { key: 'ophthalmology', label: 'Ophthalmology ຕາ' },
]);

const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
const exactKeyLookup = new Map(OPD_DEPARTMENTS.flatMap(item => [
  [normalize(item.key), item.key],
  [normalize(item.label), item.key],
]));

export function resolveOpdDepartmentKey(value) {
  const normalized = normalize(value);
  if (!normalized) return '';
  if (exactKeyLookup.has(normalized)) return exactKeyLookup.get(normalized);

  const legacyAliases = [
    [/integument|dermat|skin|ຜີວໜັງ/, 'integumentary'],
    [/muscular|skeletal|ortho|ກ້າມເນື້ອ|ກະດູກ/, 'muscular_skeletal'],
    [/nervous|neuro|ປະສາດ/, 'nervous'],
    [/cardio|ຫົວໃຈ|ຫລອດເລືອດ/, 'cardiovescular'],
    [/respiratory|pulmon|ຫາຍໃຈ/, 'respiratory'],
    [/gastro|intestinal|intentinal|ກະເພາະ|ລຳໄສ/, 'gastro_intentinal'],
    [/urolog|ຸາຍເທ່|ຖ່າຍເທ/, 'urology'],
    [/reproductive|obgyn|ob\s*&\s*gyn|ob-gyn|ສືບພັນ|ປະສູດ/, 'reproductive_obgyn'],
    [/ncd|dm\/hn|chronic|ຊຳເຮື້ອ/, 'ncds'],
    [/immune|lymph|ພູມ|ນຳ້ເຫຼືອງ/, 'immune_lymphatic'],
    [/\bent\b|otorhino|ຫູ|ດັງ|ຄໍ/, 'ent'],
    [/hematolog|blood disease|ພະຍາດເລືອດ/, 'hematology'],
    [/ophthalmolog|eye disease|ພະຍາດຕາ|^ຕາ$/, 'ophthalmology'],
  ];
  return legacyAliases.find(([pattern]) => pattern.test(normalized))?.[1] || '';
}

export function getOpdDepartmentFromVisit(visit = {}) {
  let note = visit.Clinical_Note_JSON ?? visit.clinicalNoteJson ?? null;
  if (typeof note === 'string') {
    try { note = JSON.parse(note); } catch { note = null; }
  }
  const key = resolveOpdDepartmentKey(note?.departmentKey)
    || resolveOpdDepartmentKey(note?.department);
  if (!key) return null;
  return OPD_DEPARTMENTS.find(item => item.key === key) || null;
}
