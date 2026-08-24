import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpdOrderPrintDocument } from '../src/opdOrderPrint.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'tmp', 'pdfs', 'generated');
fs.mkdirSync(outputDir, { recursive: true });

const logoPath = path.join(root, 'public', 'luckxay-logo.jpg');
const logoUrl = `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString('base64')}`;
const common = {
  autoPrint: false,
  hospital: {
    name: 'ໂຮງໝໍ ຫຼັກໄຊ',
    englishName: 'Luckxay Hospital',
    phone: '030 5138861, 030 5138287',
    logoUrl
  },
  patient: {
    id: 'LXH2026-001405',
    title: 'ທ້າວ',
    name: 'ທົດສອບ ລະບົບ',
    dob: '20/05/2020',
    age: '6 ປີ',
    gender: 'ຊາຍ',
    phone: '020 5555 5555',
    address: 'ບ້ານໂພນສະຫວ່າງ',
    district: 'ເມືອງໄຊເສດຖາ',
    province: 'ນະຄອນຫຼວງວຽງຈັນ'
  },
  encounter: {
    diagnosis: 'Suspected right knee fracture',
    doctor: 'ທ່ານ ດຣ. ທົດສອບ',
    recommendation: 'ຮັບປະທານຢາຕາມຄຳແນະນຳ ແລະ ກັບມາພົບແພດຖ້າອາການບໍ່ດີຂຶ້ນ.'
  },
  orderedAt: '2026-08-17T17:55:00+07:00'
};

const samples = {
  xray: {
    ...common,
    type: 'xray',
    orderNo: 'HIS-XR-20260817-001405-01',
    items: [{ name: 'X-Ray Right Knee AP/Lateral', instructions: 'Suspected fracture', priority: 'Urgent' }]
  },
  ultrasound: {
    ...common,
    type: 'ultrasound',
    orderNo: 'HIS-US-20260817-001405-01',
    items: [{ name: 'Ultrasound whole abdomen', instructions: 'Fasting for 6 hours', priority: 'Routine' }]
  },
  pharmacy: {
    ...common,
    type: 'medication',
    orderNo: 'HIS-RX-20260817-001405-01',
    items: [
      { name: 'Paracetamol 500 mg', quantity: '10', dose: '1 tablet', route: 'PO', frequency: 'TID', duration: '3 days', note: 'After meal' },
      { name: 'Amoxicillin 500 mg', instructions: '1 capsule · PO · TID · 5 days · Qty 15', quantity: '15', note: 'Complete course' },
      { name: 'ORS sachet', instructions: '5' },
      { name: 'Cetirizine 10 mg', quantity: '7', dose: '1 tablet', route: 'PO', frequency: 'OD', duration: '7 days' },
      { name: 'Omeprazole 20 mg', quantity: '14', dose: '1 capsule', route: 'PO', frequency: 'BID', duration: '7 days' },
      { name: 'Vitamin B Complex', quantity: '10', dose: '1 tablet', route: 'PO', frequency: 'OD', duration: '10 days' },
      { name: 'Diclofenac gel', quantity: '1 tube', instructions: 'Apply thinly · Topical · TID · 5 days' },
      { name: 'Salbutamol inhaler', quantity: '1', instructions: '2 puffs · Inhalation · PRN' },
      { name: 'Azithromycin 250 mg', quantity: '6', dose: '2 tablets day 1, then 1 tablet', route: 'PO', frequency: 'OD', duration: '5 days' },
      { name: 'Zinc 20 mg', quantity: '10', dose: '1 tablet', route: 'PO', frequency: 'OD', duration: '10 days' },
      { name: 'Calamine lotion', quantity: '1 bottle', instructions: 'Apply to affected area · Topical · BID' },
      { name: 'Normal saline 0.9%', quantity: '2 bottles', instructions: 'Use as directed' }
    ]
  }
};

Object.entries(samples).forEach(([name, data]) => {
  fs.writeFileSync(path.join(outputDir, `${name}.html`), buildOpdOrderPrintDocument(data), 'utf8');
});

console.log(`Rendered OPD print samples to ${outputDir}`);
