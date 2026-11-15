export const defaultMedicationOptions = {
  route: [
    ['PO', 'ກິນ (PO)'], ['IV', 'ສີດເຂົ້າເສັ້ນ (IV)'],
    ['IM', 'ສີດເຂົ້າກ້າມ (IM)'], ['SC', 'ສີດໃຕ້ຜິວ (SC)'],
    ['Topical', 'ທາ'], ['Inhaled', 'ສູດດົມ']
  ],
  frequency: [
    ['OD', 'ວັນລະ 1 ເທື່ອ'], ['BID', 'ວັນລະ 2 ເທື່ອ'],
    ['TID', 'ວັນລະ 3 ເທື່ອ'], ['QID', 'ວັນລະ 4 ເທື່ອ'],
    ['PRN', 'ເມື່ອຈຳເປັນ'], ['STAT', 'ທັນທີ'], ['Once', 'ຄັ້ງດຽວ']
  ]
};

export const defaultMedicationDurations = ['3', '5', '7', '14', '30'];

export function validMedicationMasterValue(category, value) {
  const text = String(value || '').trim();
  if (category === 'MedicationDuration') return /^(?:[1-9]\d{0,3})$/.test(text);
  if (category === 'MedicationRoute' || category === 'MedicationFrequency') {
    const [code, ...label] = text.split('|');
    return /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(code) && Boolean(label.join('|').trim());
  }
  return true;
}

export function medicationOptions(rows, type) {
  if (!Array.isArray(rows)) return defaultMedicationOptions[type] || [];
  const seen = new Set();
  return rows.flatMap(row => {
    const [rawCode, ...labelParts] = String(row.value || '').split('|');
    const code = rawCode.trim();
    const label = labelParts.join('|').trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(code) || !label || seen.has(code)) return [];
    seen.add(code);
    return [[code, label]];
  });
}

export function durationOptions(rows) {
  if (!Array.isArray(rows)) return defaultMedicationDurations;
  return [...new Set(rows.map(row => String(row.value || '').trim()))]
    .filter(value => /^(?:[1-9]\d{0,3})$/.test(value));
}
