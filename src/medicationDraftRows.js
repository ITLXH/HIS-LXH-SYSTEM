const fields = ['dose', 'route', 'frequency', 'duration', 'quantity'];
const dailyFrequency = { OD: 1, BID: 2, TID: 3, QID: 4 };

export function calculateQuantity(dose, frequency, duration) {
  const amount = String(dose || '').trim().match(/^(\d+(?:\.\d+)?)\s*(?:ເມັດ|ແຄັບຊູນ|ຊອງ|tablets?|tabs?|capsules?|caps?|sachets?)$/i);
  const days = String(duration || '').trim().match(/^(\d+)\s*(?:days?|ມື້)?$/i);
  const count = Number(amount?.[1]) * dailyFrequency[String(frequency || '').toUpperCase()] * Number(days?.[1]);
  return Number.isSafeInteger(count) && count > 0 && count <= 9999 ? String(count) : '';
}

export function createCatalogDraft(drug, template = {}) {
  const row = {
    name: String(drug.name || '').trim(),
    sourceDrugId: String(drug.id || '').trim(),
    unitCode: String(drug.unitCode || '').trim(),
    ...(drug.catalogueVersion ? { catalogueVersion: drug.catalogueVersion } : {}),
    source: 'catalog',
    needsDetails: true,
    ...Object.fromEntries(fields.map(field => [field, String(template[field] || '').trim()]))
  };
  const calculated = calculateQuantity(row.dose, row.frequency, row.duration);
  row.quantityMode = !row.quantity || row.quantity === calculated ? 'auto' : 'template';
  row.autoQuantity = row.quantityMode === 'auto';
  if (row.autoQuantity) row.quantity = calculated;
  row.instructions = [row.dose, row.route, row.frequency, row.duration].filter(Boolean).join(' · ');
  return row;
}

export function updateCatalogDraft(row, field, value) {
  if (!fields.includes(field)) return row;
  const updated = { ...row, [field]: String(value || '').trim() };
  if (field === 'quantity') updated.quantityMode = updated.quantity ? 'manual' : 'auto';
  else if (updated.quantityMode === 'template' && updated[field] !== row[field]) updated.quantityMode = 'auto';
  updated.autoQuantity = updated.quantityMode === 'auto';
  if (updated.autoQuantity) updated.quantity = calculateQuantity(updated.dose, updated.frequency, updated.duration);
  updated.instructions = [updated.dose, updated.route, updated.frequency, updated.duration].filter(Boolean).join(' · ');
  return updated;
}

export function invalidCatalogDraftIndex(rows) {
  return rows.findIndex(row => row.needsDetails && (
    fields.some(field => !String(row[field] || '').trim()) ||
    !/^(?:[1-9]\d*|0\.\d*[1-9]\d*|[1-9]\d*\.\d*[1-9]\d*)$/.test(String(row.quantity || ''))
  ));
}

export function syncCatalogDraftValues(row, values) {
  if (!row?.needsDetails) return row;
  return fields.reduce((current, field) => (
    Object.hasOwn(values, field) ? updateCatalogDraft(current, field, values[field]) : current
  ), row);
}
