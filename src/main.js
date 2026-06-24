const SUPABASE_URL = "https://pzyrowzghrcfpmhkreag.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXJvd3pnaHJjZnBtaGtyZWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTI2NzcsImV4cCI6MjA5NzE4ODY3N30.aTIC9Ov8jo-WhdUTZ_bZswmOgauC53R7vjYGcUln8Q0";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
console.log("Supabase Client:", supabaseClient);

const DB_TABLE_PREFIX = "HIS_One_";
const dbTable = (name) => `${DB_TABLE_PREFIX}${name}`;

function sha256Fallback(text) {
  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const words = [];
  const ascii = unescape(encodeURIComponent(text));
  const hash = [];
  const k = [];
  let primeCounter = 0;
  let candidate = 2;
  const isPrime = (n) => {
    for (let factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  while (primeCounter < 64) {
    if (isPrime(candidate)) {
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
    candidate++;
  }

  for (let i = 0; i < ascii.length; i++) words[i >> 2] |= ascii.charCodeAt(i) << ((3 - i) % 4) * 8;
  words[ascii.length >> 2] |= 0x80 << ((3 - ascii.length) % 4) * 8;
  words[((ascii.length + 8) >> 6 << 4) + 15] = ascii.length * 8;

  for (let j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] + (w[i] = i < 16 ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  return hash.map(value => {
    let hex = '';
    for (let i = 3; i >= 0; i--) hex += ((value >> (i * 8)) & 255).toString(16).padStart(2, '0');
    return hex;
  }).join('');
}

window.hashPassword = async function (password) {
  const text = String(password || '');
  if (!window.crypto?.subtle || typeof TextEncoder === 'undefined') return sha256Fallback(text);
  const bytes = new TextEncoder().encode(text);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};

let currentUser = null;
let masterDataStore = {};
let queueDataStore = [];
let dashRefreshInterval = null;
let reportRefreshInterval = null;
let chartInstances = {};
let html5QrCode = null;
let currentReportData = [];
let currentVisitHistoryData = [];
let currentTriageData = [];
let systemSettings = { hospitalName: "", logoUrl: "", opdHeaderUrl: "", opdFooterUrl: "", rememberLastModule: false };
let servicesDataStore = [];
let locationsDataStore = [];
let allPatientsList = [];
let vaccinesMasterList = [];
let activeOrgsList = [];
let drugsMasterList = [];
let labsMasterList = [];
let currentEMRLabs = [];
let currentEMRLabPickerSelection = [];
let currentEMRLabSearchQuery = '';
let currentEMRDrugs = [];

window.normalizePatientCode = function (value) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
};

window.fetchSupabaseRows = async function (tableName, options = {}) {
  const {
    select = '*',
    orderBy = null,
    ascending = true,
    pageSize = 1000
  } = options;
  const rows = [];
  let start = 0;

  while (true) {
    let query = supabaseClient
      .from(dbTable(tableName))
      .select(select);

    if (orderBy) query = query.order(orderBy, { ascending });
    const { data, error } = await query.range(start, start + pageSize - 1);
    if (error) throw error;

    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    start += pageSize;
  }

  return rows;
};
const HIS_AUTH_SESSION_KEY = 'his_current_user_session';
const HIS_AUTH_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

window.appTranslations = {
  lo: {
    'nav.dashboard': 'ແຜງຄວບຄຸມ',
    'nav.report': 'ສະຖານະຄິວຄົນເຈັບ',
    'nav.visitHistory': 'ປະຫວັດການກວດ',
    'nav.patients': 'ຄົນເຈັບ',
    'nav.triage': 'ຊັກປະຫວັດ',
    'nav.opd': 'ຫ້ອງກວດແພດ (OPD)',
    'nav.vaccines': 'ວັກຊີນ',
    'nav.appointments': 'ນັດໝາຍ',
    'nav.settings': 'ຕັ້ງຄ່າ',
    'nav.ipdManagement': 'ຄົນເຈັບນອນ IPD',
    'nav.ipdDashboard': 'ແຜງຄວບຄຸມ IPD',
    'nav.admitPatient': 'ຮັບຄົນເຈັບນອນ',
    'nav.wardBedManagement': 'ຈັດການຫວອດ / ຕຽງ',
    'nav.inpatientList': 'ລາຍຊື່ຄົນເຈັບນອນ',
    'nav.dischargeSummary': 'ສະຫຼຸບການອອກໂຮງໝໍ',
    'common.search': 'ຄົ້ນຫາ',
    'common.reset': 'ລ້າງຄ່າ',
    'common.action': 'ຈັດການ',
    'ipd.title': 'ຈັດການຫວອດ / ຕຽງ',
    'ipd.subtitle': 'ຈັດການຫວອດ, ຫ້ອງ, ຕຽງ, ການຈັດຕຽງ ແລະ ການຍ້າຍຕຽງຂອງ IPD',
    'ipd.addWard': 'ເພີ່ມຫວອດ',
    'ipd.addRoom': 'ເພີ່ມຫ້ອງ',
    'ipd.addBed': 'ເພີ່ມຕຽງ',
    'ipd.totalBeds': 'ຕຽງທັງໝົດ',
    'ipd.available': 'ວ່າງ',
    'ipd.occupied': 'ມີຄົນເຈັບ',
    'ipd.reserved': 'ຈອງ',
    'ipd.cleaning': 'ກຳລັງອະນາໄມ',
    'ipd.maintenance': 'ສ້ອມແປງ',
    'ipd.inactive': 'ປິດໃຊ້ງານ',
    'ipd.occupancyRate': 'ອັດຕາຄອງຕຽງ',
    'ipd.ward': 'ຫວອດ',
    'ipd.room': 'ຫ້ອງ',
    'ipd.status': 'ສະຖານະ',
    'ipd.bedType': 'ປະເພດຕຽງ',
    'ipd.allWards': 'ຫວອດທັງໝົດ',
    'ipd.allRooms': 'ຫ້ອງທັງໝົດ',
    'ipd.allStatus': 'ສະຖານະທັງໝົດ',
    'ipd.allTypes': 'ປະເພດທັງໝົດ',
    'ipd.searchPlaceholder': 'ຕຽງ, ຫ້ອງ, HN, ຊື່ຄົນເຈັບ, IPD No',
    'ipd.bedBoard': 'ກະດານຕຽງ',
    'ipd.wards': 'ຫວອດ',
    'ipd.rooms': 'ຫ້ອງ',
    'ipd.beds': 'ຕຽງ',
    'ipd.movementHistory': 'ປະຫວັດການຍ້າຍຕຽງ',
    'ipd.wardId': 'ລະຫັດຫວອດ',
    'ipd.wardName': 'ຊື່ຫວອດ',
    'ipd.type': 'ປະເພດ',
    'ipd.floor': 'ຊັ້ນ',
    'ipd.department': 'ພະແນກ',
    'ipd.roomId': 'ລະຫັດຫ້ອງ',
    'ipd.roomNo': 'ເລກຫ້ອງ',
    'ipd.dailyCharge': 'ຄ່າຫ້ອງ/ມື້',
    'ipd.bedId': 'ລະຫັດຕຽງ',
    'ipd.bedNo': 'ເລກຕຽງ',
    'ipd.patientHn': 'HN ຄົນເຈັບ',
    'ipd.ipdNo': 'ເລກ IPD',
    'ipd.dateTime': 'ວັນທີ / ເວລາ',
    'ipd.from': 'ຈາກ',
    'ipd.to': 'ໄປ',
    'ipd.reason': 'ເຫດຜົນ',
    'ipd.by': 'ໂດຍ',
    'common.save': 'ບັນທຶກ',
    'common.cancel': 'ຍົກເລີກ',
    'common.saved': 'ບັນທຶກແລ້ວ',
    'common.updated': 'ອັບເດດແລ້ວ',
    'common.error': 'ຜິດພາດ',
    'common.warning': 'ແຈ້ງເຕືອນ',
    'common.info': 'ຂໍ້ມູນ',
    'ipd.editWard': 'ແກ້ໄຂຫວອດ',
    'ipd.wardType': 'ປະເພດຫວອດ',
    'ipd.description': 'ລາຍລະອຽດ',
    'ipd.wardRequired': 'ກະລຸນາປ້ອນຊື່ຫວອດ.',
    'ipd.wardSaved': 'ບັນທຶກຂໍ້ມູນຫວອດແລ້ວ.',
    'ipd.createWardFirst': 'ກະລຸນາເພີ່ມຫວອດກ່ອນ',
    'ipd.createWardFirstText': 'ຕ້ອງມີຫວອດກ່ອນຈຶ່ງຈະເພີ່ມຫ້ອງໄດ້.',
    'ipd.editRoom': 'ແກ້ໄຂຫ້ອງ',
    'ipd.roomNumber': 'ເລກຫ້ອງ',
    'ipd.roomType': 'ປະເພດຫ້ອງ',
    'ipd.chargePerDay': 'ຄ່າຫ້ອງ / ມື້',
    'ipd.roomRequired': 'ກະລຸນາປ້ອນເລກຫ້ອງ.',
    'ipd.roomSaved': 'ບັນທຶກຂໍ້ມູນຫ້ອງແລ້ວ.',
    'ipd.createRoomFirst': 'ກະລຸນາເພີ່ມຫ້ອງກ່ອນ',
    'ipd.createRoomFirstText': 'ຕ້ອງມີຫ້ອງກ່ອນຈຶ່ງຈະເພີ່ມຕຽງໄດ້.',
    'ipd.editBed': 'ແກ້ໄຂຕຽງ',
    'ipd.bedNumber': 'ເລກຕຽງ',
    'ipd.notes': 'ໝາຍເຫດ',
    'ipd.bedRequired': 'ກະລຸນາປ້ອນເລກຕຽງ.',
    'ipd.bedNumberRequired': 'ກະລຸນາປ້ອນເລກຕຽງ.',
    'ipd.bedDuplicate': 'ເລກຕຽງຕ້ອງບໍ່ຊ້ຳກັນໃນຫ້ອງດຽວກັນ.',
    'ipd.bedSaved': 'ບັນທຶກຂໍ້ມູນຕຽງແລ້ວ.',
    'ipd.assign': 'ຈັດຕຽງ',
    'ipd.transfer': 'ຍ້າຍຕຽງ',
    'ipd.chart': 'ແຟ້ມ IPD',
    'ipd.patient': 'ຄົນເຈັບ',
    'ipd.doctor': 'ແພດ',
    'ipd.admit': 'ຮັບເຂົ້າ',
    'ipd.los': 'ຈຳນວນມື້ນອນ',
    'ipd.total': 'ລວມ',
    'ipd.noWardBedData': 'ຍັງບໍ່ມີຂໍ້ມູນຫວອດ/ຕຽງ. ເລີ່ມຈາກເພີ່ມຫວອດ, ເພີ່ມຫ້ອງ, ແລ້ວເພີ່ມຕຽງ.',
    'ipd.noBedMatch': 'ບໍ່ພົບຕຽງຕາມເງື່ອນໄຂທີ່ເລືອກ.',
    'ipd.assignTitle': 'ຈັດຄົນເຈັບເຂົ້າຕຽງ',
    'ipd.ipdAdmission': 'ການນອນ IPD',
    'ipd.roomBed': 'ຫ້ອງ / ຕຽງ',
    'ipd.assignedDateTime': 'ວັນທີ/ເວລາຈັດຕຽງ',
    'ipd.assignedBy': 'ຜູ້ຈັດຕຽງ',
    'ipd.note': 'ໝາຍເຫດ',
    'ipd.cannotAssign': 'ຈັດຕຽງບໍ່ໄດ້',
    'ipd.assignAllowedText': 'ຈັດຕຽງໄດ້ສະເພາະຕຽງວ່າງ ຫຼື ຕຽງຈອງເທົ່ານັ້ນ.',
    'ipd.noActiveAdmission': 'ບໍ່ມີຄົນເຈັບ IPD ທີ່ກຳລັງນອນ',
    'ipd.noActiveAdmissionText': 'ກະລຸນາສ້າງ admission ທີ່ active ກ່ອນຈັດຕຽງ.',
    'ipd.admissionNotFound': 'ບໍ່ພົບຂໍ້ມູນ admission.',
    'ipd.assignedSuccess': 'ຈັດຄົນເຈັບເຂົ້າຕຽງແລ້ວ.',
    'ipd.transferTitle': 'ຍ້າຍຕຽງ',
    'ipd.destinationBed': 'ຕຽງປາຍທາງ',
    'ipd.transferDateTime': 'ວັນທີ/ເວລາຍ້າຍ',
    'ipd.transferredBy': 'ຜູ້ຍ້າຍ',
    'ipd.cannotTransfer': 'ຍ້າຍຕຽງບໍ່ໄດ້',
    'ipd.sourceOccupiedText': 'ຕຽງຕົ້ນທາງຕ້ອງມີຄົນເຈັບກ່ອນຈຶ່ງຍ້າຍໄດ້.',
    'ipd.noDestinationBed': 'ບໍ່ມີຕຽງປາຍທາງ',
    'ipd.noDestinationBedText': 'ບໍ່ພົບຕຽງວ່າງ ຫຼື ຕຽງຈອງສຳລັບຍ້າຍ.',
    'ipd.destinationAvailableText': 'ຕຽງປາຍທາງຕ້ອງເປັນຕຽງວ່າງ ຫຼື ຕຽງຈອງ.',
    'ipd.noLinkedAdmissionText': 'ບໍ່ພົບ admission active ທີ່ຜູກກັບຕຽງນີ້.',
    'ipd.transferredSuccess': 'ຍ້າຍຄົນເຈັບໄປຕຽງໃໝ່ແລ້ວ.',
    'ipd.confirmDirectRelease': 'ຢືນຢັນປ່ອຍຕຽງໂດຍກົງ',
    'ipd.confirmDirectReleaseText': 'ຕາມ workflow ທາງການ ຕຽງທີ່ມີຄົນເຈັບຄວນປ່ຽນເປັນກຳລັງອະນາໄມກ່ອນ. ຕ້ອງການປ່ຽນເປັນວ່າງໂດຍກົງບໍ?',
    'ipd.markAvailable': 'ປ່ຽນເປັນວ່າງ',
    'ipd.cannotDeactivate': 'ປິດໃຊ້ງານບໍ່ໄດ້',
    'ipd.occupiedCannotDeactivate': 'ຕຽງທີ່ມີຄົນເຈັບຢູ່ບໍ່ສາມາດປິດໃຊ້ງານໄດ້.',
    'ipd.statusChanged': 'ປ່ຽນສະຖານະຕຽງແລ້ວ.',
    'ipd.cannotDeleteWard': 'ລຶບຫວອດບໍ່ໄດ້',
    'ipd.wardHasRoomsText': 'ຫວອດນີ້ມີຫ້ອງຢູ່ ລະບົບຈະປິດໃຊ້ງານແທນການລຶບ.',
    'ipd.cannotDeleteRoom': 'ລຶບຫ້ອງບໍ່ໄດ້',
    'ipd.roomHasBedsText': 'ຫ້ອງນີ້ມີຕຽງຢູ່ ລະບົບຈະປິດໃຊ້ງານແທນການລຶບ.',
    'ipd.noIpdChart': 'ບໍ່ມີແຟ້ມ IPD',
    'ipd.noIpdChartText': 'ຕຽງນີ້ຍັງບໍ່ໄດ້ຜູກກັບ admission active.',
    'ipd.loadingData': 'ກຳລັງໂຫຼດຂໍ້ມູນຫວອດ ແລະ ຕຽງ IPD...',
    'ipd.unableLoadData': 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນ IPD ໄດ້',
    'ipd.diagnosis': 'ການວິນິດໄສ',
    'option.Male': 'ຊາຍ',
    'option.Female': 'ຍິງ',
    'option.Pediatric': 'ເດັກ',
    'option.Maternity': 'ແມ່ແລະເດັກ',
    'option.ICU': 'ICU',
    'option.Emergency': 'ສຸກເສີນ',
    'option.Private': 'ຫ້ອງພິເສດ',
    'option.Semi-private': 'ຫ້ອງກຶ່ງພິເສດ',
    'option.General': 'ທົ່ວໄປ',
    'option.Isolation': 'ແຍກໂຣກ',
    'option.Standard': 'ມາດຕະຖານ',
    'option.Delivery': 'ຫ້ອງຄອດ',
    'option.Active': 'ເປີດໃຊ້ງານ',
    'option.Inactive': 'ປິດໃຊ້ງານ',
    'option.Available': 'ວ່າງ',
    'option.Occupied': 'ມີຄົນເຈັບ',
    'option.Reserved': 'ຈອງ',
    'option.Cleaning': 'ກຳລັງອະນາໄມ',
    'option.Maintenance': 'ສ້ອມແປງ',
    'option.Assign': 'ຈັດຕຽງ',
    'option.Transfer': 'ຍ້າຍຕຽງ',
    'option.Discharge': 'ອອກຈາກຕຽງ',
    'option.Update': 'ອັບເດດ'
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.report': 'Patient Queue Status',
    'nav.visitHistory': 'Visit History',
    'nav.patients': 'Patients',
    'nav.triage': 'Triage',
    'nav.opd': 'Doctor Room (OPD)',
    'nav.vaccines': 'Vaccines',
    'nav.appointments': 'Appointments',
    'nav.settings': 'Settings',
    'nav.ipdManagement': 'Inpatients (IPD)',
    'nav.ipdDashboard': 'IPD Dashboard',
    'nav.admitPatient': 'Admit Patient',
    'nav.wardBedManagement': 'Ward / Bed Management',
    'nav.inpatientList': 'Inpatient List',
    'nav.dischargeSummary': 'Discharge Summary',
    'common.search': 'Search',
    'common.reset': 'Reset',
    'common.action': 'Action',
    'ipd.title': 'Ward / Bed Management',
    'ipd.subtitle': 'IPD ward, room, bed assignment, transfer, and bed movement board',
    'ipd.addWard': 'Add Ward',
    'ipd.addRoom': 'Add Room',
    'ipd.addBed': 'Add Bed',
    'ipd.totalBeds': 'Total Beds',
    'ipd.available': 'Available',
    'ipd.occupied': 'Occupied',
    'ipd.reserved': 'Reserved',
    'ipd.cleaning': 'Cleaning',
    'ipd.maintenance': 'Maintenance',
    'ipd.inactive': 'Inactive',
    'ipd.occupancyRate': 'Occupancy Rate',
    'ipd.activeAdmissions': 'Active IPD',
    'ipd.waitingBed': 'Waiting Bed',
    'ipd.longStay': 'Long Stay',
    'ipd.ward': 'Ward',
    'ipd.room': 'Room',
    'ipd.status': 'Status',
    'ipd.bedType': 'Bed Type',
    'ipd.allWards': 'All wards',
    'ipd.allRooms': 'All rooms',
    'ipd.allStatus': 'All status',
    'ipd.allTypes': 'All types',
    'ipd.allDoctors': 'All doctors',
    'ipd.searchPlaceholder': 'Bed, room, HN, patient, doctor, IPD no',
    'ipd.bedBoard': 'Bed Board',
    'ipd.doctorCensus': 'Doctor Census',
    'ipd.wards': 'Wards',
    'ipd.rooms': 'Rooms',
    'ipd.beds': 'Beds',
    'ipd.movementHistory': 'Movement History',
    'ipd.wardId': 'Ward ID',
    'ipd.wardName': 'Ward Name',
    'ipd.type': 'Type',
    'ipd.floor': 'Floor',
    'ipd.department': 'Department',
    'ipd.roomId': 'Room ID',
    'ipd.roomNo': 'Room No',
    'ipd.dailyCharge': 'Daily Charge',
    'ipd.bedId': 'Bed ID',
    'ipd.bedNo': 'Bed No',
    'ipd.patientHn': 'Patient HN',
    'ipd.ipdNo': 'IPD No',
    'ipd.dateTime': 'Date/Time',
    'ipd.from': 'From',
    'ipd.to': 'To',
    'ipd.reason': 'Reason',
    'ipd.by': 'By',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.saved': 'Saved',
    'common.updated': 'Updated',
    'common.error': 'Error',
    'common.warning': 'Warning',
    'common.info': 'Info',
    'ipd.editWard': 'Edit Ward',
    'ipd.wardType': 'Ward Type',
    'ipd.description': 'Description',
    'ipd.wardRequired': 'Ward Name is required.',
    'ipd.wardSaved': 'Ward has been saved.',
    'ipd.createWardFirst': 'Create ward first',
    'ipd.createWardFirstText': 'Please create a ward before adding rooms.',
    'ipd.editRoom': 'Edit Room',
    'ipd.roomNumber': 'Room Number',
    'ipd.roomType': 'Room Type',
    'ipd.chargePerDay': 'Charge / Day',
    'ipd.roomRequired': 'Room Number is required.',
    'ipd.roomSaved': 'Room has been saved.',
    'ipd.createRoomFirst': 'Create room first',
    'ipd.createRoomFirstText': 'Please create a room before adding beds.',
    'ipd.editBed': 'Edit Bed',
    'ipd.bedNumber': 'Bed Number',
    'ipd.notes': 'Notes',
    'ipd.bedRequired': 'Bed Number is required.',
    'ipd.bedNumberRequired': 'Bed Number is required.',
    'ipd.bedDuplicate': 'Bed number must be unique within the same room.',
    'ipd.bedSaved': 'Bed has been saved.',
    'ipd.assign': 'Assign',
    'ipd.transfer': 'Transfer',
    'ipd.chart': 'Chart',
    'ipd.patient': 'Patient',
    'ipd.doctor': 'Doctor',
    'ipd.admit': 'Admit',
    'ipd.los': 'LOS',
    'ipd.total': 'Total',
    'ipd.noWardBedData': 'No ward or bed data yet. Start by creating a ward, then room, then bed.',
    'ipd.noBedMatch': 'No beds match the current filters.',
    'ipd.assignTitle': 'Assign Patient to Bed',
    'ipd.ipdAdmission': 'IPD Admission',
    'ipd.roomBed': 'Room / Bed',
    'ipd.assignedDateTime': 'Assigned Date/Time',
    'ipd.assignedBy': 'Assigned By',
    'ipd.note': 'Note',
    'ipd.cannotAssign': 'Cannot assign',
    'ipd.assignAllowedText': 'Only Available or Reserved beds can be assigned.',
    'ipd.noActiveAdmission': 'No active IPD admissions',
    'ipd.noActiveAdmissionText': 'Create an active admission before assigning a bed.',
    'ipd.admissionNotFound': 'Admission not found.',
    'ipd.assignedSuccess': 'Patient has been assigned to the bed.',
    'ipd.transferTitle': 'Transfer Bed',
    'ipd.destinationBed': 'Destination Bed',
    'ipd.transferDateTime': 'Transfer Date/Time',
    'ipd.transferredBy': 'Transferred By',
    'ipd.cannotTransfer': 'Cannot transfer',
    'ipd.sourceOccupiedText': 'Source bed must be occupied.',
    'ipd.noDestinationBed': 'No destination bed',
    'ipd.noDestinationBedText': 'No Available or Reserved destination bed was found.',
    'ipd.destinationAvailableText': 'Destination bed must be Available or Reserved.',
    'ipd.noLinkedAdmissionText': 'No active admission is linked to the source bed.',
    'ipd.transferredSuccess': 'Patient has been transferred to the new bed.',
    'ipd.confirmDirectRelease': 'Confirm direct release',
    'ipd.confirmDirectReleaseText': 'Occupied beds should normally move to Cleaning first. Continue and mark Available directly?',
    'ipd.markAvailable': 'Mark Available',
    'ipd.cannotDeactivate': 'Cannot deactivate',
    'ipd.occupiedCannotDeactivate': 'Occupied beds cannot be deactivated.',
    'ipd.statusChanged': 'Bed status has been updated.',
    'ipd.cannotDeleteWard': 'Cannot delete ward',
    'ipd.wardHasRoomsText': 'This ward has rooms. It can be deactivated only.',
    'ipd.cannotDeleteRoom': 'Cannot delete room',
    'ipd.roomHasBedsText': 'This room has beds. It will be deactivated instead.',
    'ipd.noIpdChart': 'No IPD chart',
    'ipd.noIpdChartText': 'This bed is not linked to an active IPD admission.',
    'ipd.loadingData': 'Loading IPD ward and bed data...',
    'ipd.unableLoadData': 'Unable to load IPD data',
    'ipd.diagnosis': 'Diagnosis',
    'ipd.noDoctorCensus': 'No active IPD patients match the current filters.',
    'ipd.unassignedDoctor': 'Unassigned doctor',
    'ipd.careTeamList': 'Active patients under this doctor',
    'ipd.filterDoctor': 'Filter by this doctor'
  }
};

Object.assign(window.appTranslations.lo, {
  'ipd.activeAdmissions': 'ຄົນເຈັບ IPD',
  'ipd.waitingBed': 'ລໍຖ້າຕຽງ',
  'ipd.longStay': 'ນອນດົນ',
  'ipd.allDoctors': 'ແພດທັງໝົດ',
  'ipd.searchPlaceholder': 'ຕຽງ, ຫ້ອງ, HN, ຊື່ຄົນເຈັບ, ແພດ, IPD No',
  'ipd.doctorCensus': 'ຕິດຕາມຕາມແພດ',
  'ipd.noDoctorCensus': 'ບໍ່ພົບຄົນເຈັບ IPD active ຕາມເງື່ອນໄຂນີ້.',
  'ipd.unassignedDoctor': 'ຍັງບໍ່ລະບຸແພດ',
  'ipd.careTeamList': 'ຄົນເຈັບ active ທີ່ແພດນີ້ຮັບຜິດຊອບ',
  'ipd.filterDoctor': 'ກັ່ນຕອງຕາມແພດນີ້'
});

Object.assign(window.appTranslations.lo, {
  'obs.selectDoctors': 'ເລືອກແພດ',
  'obs.selectNurses': 'ເລືອກພະຍາບານ',
  'obs.multiSelectHint': 'ກົດ Ctrl ຫຼື Shift ເພື່ອເລືອກຫຼາຍຄົນ',
  'obs.selectProviderRequired': 'ກະລຸນາເລືອກຜູ້ບັນທຶກຢ່າງນ້ອຍ 1 ຄົນ'
});

Object.assign(window.appTranslations.en, {
  'ipd.nurseStation': 'Nurse Station',
  'ipd.compactView': 'Compact View',
  'ipd.detailView': 'Detail View',
  'ipd.floorPlanView': 'Floor Plan View',
  'ipd.inpatientList': 'Inpatient List',
  'ipd.ageSex': 'Age/Sex',
  'ipd.backToWardBoard': 'Back to Ward Board',
  'ipd.chartSummary': 'Summary',
  'ipd.doctorNotes': 'Doctor Notes',
  'ipd.doctorNotesDescription': 'SOAP format clinical progress notes',
  'ipd.nursingNotes': 'Nursing Notes',
  'ipd.vitalSigns': 'Vital Signs',
  'ipd.orders': 'Orders',
  'ipd.labResults': 'Lab Results',
  'ipd.radiology': 'Radiology',
  'ipd.procedures': 'Procedures',
  'ipd.billing': 'Billing',
  'ipd.discharge': 'Discharge',
  'ipd.chartWorkspaceText': 'This workspace is ready for structured IPD documentation as clinical data connections are added.',
  'ipd.noChartDataYet': 'No records in this section yet.',
  'ipd.noInpatientData': 'No active IPD patients match the current filters.',
  'ipd.assignPatient': 'Assign Patient',
  'ipd.reserve': 'Reserve',
  'ipd.cancelReservation': 'Cancel Reservation',
  'ipd.viewIpdChart': 'View IPD Chart',
  'ipd.transferBed': 'Transfer Bed',
  'ipd.dischargeReleaseBed': 'Discharge / Release Bed',
  'ipd.paymentType': 'Payment Type',
  'ipd.cannotChangeStatus': 'Cannot change bed status',
  'ipd.occupiedToAvailableBlocked': 'Occupied beds must be discharged or released to Cleaning first. After cleaning, mark the bed Available.',
  'ipd.directOccupiedBlocked': 'Do not mark a bed Occupied directly. Use Assign Patient so an active admission is linked.',
  'ipd.inactiveNoAction': 'Inactive beds have no clinical actions.',
  'ipd.dischargeNeedsAdmission': 'This occupied bed has no active admission. Open the bed record and correct the admission link before discharge.',
  'ipd.noActiveChartText': 'No active IPD admission is linked to this bed or chart.',
  'ipd.filterActive': 'Active',
  'ipd.filterDischarged': 'Discharged',
  'ipd.filterAll': 'All',
  'ipd.viewHistory': 'View History',
  'ipd.historyChartReadOnly': 'Viewing discharged admission (read-only)',
  'ipd.noDischargedData': 'No discharged IPD admissions found.',
  'ipd.assistantNurse': 'Assistant Nurse',
  'ipd.doctorRequired': 'Please select an attending doctor.',
  'ipd.nurseRequired': 'Please select an assistant nurse.',
  'ipd.bedRequired': 'Please select a room / bed.',
  'ipd.searchHint': 'Type HN, old HN, or name…',
  'ipd.generalWardsTitle': 'General Wards',
  'ipd.generalWardsSubtitle': 'Standard IPD wards (admit, transfer, discharge)',
  'ipd.vipWardsTitle': 'VIP Rooms',
  'ipd.vipWardsSubtitle': 'Premium IPD rooms — separated from general wards',
  'ipd.wardsCount': 'wards',
  'ipd.addVipRoom': 'Add VIP Room',
  'ipd.editVipRoom': 'Edit VIP Room',
  'ipd.noVipWard': 'No VIP ward exists',
  'ipd.noVipWardText': 'Create a ward with Type = "VIP" first, then add VIP rooms to it.',
  'ipd.configTitle': 'IPD Configuration (Wards/Rooms/Beds)',
  'ipd.configSubtitle': 'Manage IPD wards, rooms and beds (CRUD)',
  'ipd.wardsTab': 'Wards',
  'ipd.roomsTab': 'Rooms',
  'ipd.bedsTab': 'Beds'
});

Object.assign(window.appTranslations.lo, {
  'ipd.nurseStation': 'ມຸມມອງພະຍາບານ',
  'ipd.compactView': 'ມຸມມອງຫຍໍ້',
  'ipd.detailView': 'ມຸມມອງລະອຽດ',
  'ipd.floorPlanView': 'ຜັງຫ້ອງ',
  'ipd.inpatientList': 'ລາຍຊື່ຄົນເຈັບນອນ',
  'ipd.ageSex': 'ອາຍຸ/ເພດ',
  'ipd.backToWardBoard': 'ກັບໄປກະດານຕຽງ',
  'ipd.chartSummary': 'ສະຫຼຸບ',
  'ipd.doctorNotes': 'ບັນທຶກແພດ',
  'ipd.doctorNotesDescription': 'ບັນທຶກຄວາມຄືບໜ້າທາງຄລິນິກແບບ SOAP',
  'ipd.nursingNotes': 'ບັນທຶກພະຍາບານ',
  'ipd.vitalSigns': 'ສັນຍານຊີບ',
  'ipd.orders': 'ຄຳສັ່ງຮັກສາ',
  'ipd.labResults': 'ຜົນແລັບ',
  'ipd.radiology': 'ລັງສີ',
  'ipd.procedures': 'ຫັດຖະການ',
  'ipd.billing': 'ການເງິນ',
  'ipd.discharge': 'ອອກໂຮງໝໍ',
  'ipd.chartWorkspaceText': 'ພື້ນທີ່ນີ້ພ້ອມສຳລັບບັນທຶກ IPD ແບບເປັນໂຄງສ້າງ ເມື່ອເຊື່ອມຂໍ້ມູນທາງຄລິນິກເພີ່ມ.',
  'ipd.noInpatientData': 'ບໍ່ພົບຄົນເຈັບ IPD active ຕາມເງື່ອນໄຂນີ້.',
  'ipd.assignPatient': 'ຈັດຄົນເຈັບ',
  'ipd.reserve': 'ຈອງຕຽງ',
  'ipd.cancelReservation': 'ຍົກເລີກຈອງ',
  'ipd.viewIpdChart': 'ເບິ່ງແຟ້ມ IPD',
  'ipd.transferBed': 'ຍ້າຍຕຽງ',
  'ipd.dischargeReleaseBed': 'ອອກ/ປ່ອຍຕຽງ',
  'ipd.paymentType': 'ປະເພດຈ່າຍເງິນ',
  'ipd.cannotChangeStatus': 'ປ່ຽນສະຖານະຕຽງບໍ່ໄດ້',
  'ipd.occupiedToAvailableBlocked': 'ຕຽງທີ່ມີຄົນເຈັບຕ້ອງອອກ/ປ່ອຍເປັນກຳລັງອະນາໄມກ່ອນ. ຫຼັງອະນາໄມແລ້ວຈຶ່ງປ່ຽນເປັນວ່າງ.',
  'ipd.directOccupiedBlocked': 'ຢ່າປ່ຽນຕຽງເປັນມີຄົນເຈັບໂດຍກົງ. ໃຫ້ໃຊ້ປຸ່ມຈັດຄົນເຈັບເພື່ອຜູກ active admission.',
  'ipd.inactiveNoAction': 'ຕຽງປິດໃຊ້ງານບໍ່ມີ clinical action.',
  'ipd.dischargeNeedsAdmission': 'ຕຽງນີ້ສະແດງວ່າມີຄົນເຈັບ ແຕ່ບໍ່ພົບ active admission. ກວດແກ້ຂໍ້ມູນ admission ກ່ອນ discharge.',
  'ipd.noActiveChartText': 'ບໍ່ພົບ active IPD admission ທີ່ຜູກກັບຕຽງ ຫຼື chart ນີ້.',
  'ipd.filterActive': 'ກຳລັງນອນ',
  'ipd.filterDischarged': 'ອອກໂຮງໝໍແລ້ວ',
  'ipd.filterAll': 'ທັງໝົດ',
  'ipd.viewHistory': 'ເບິ່ງປະຫວັດ',
  'ipd.historyChartReadOnly': 'ກຳລັງເບິ່ງປະຫວັດການນອນທີ່ອອກໂຮງໝໍແລ້ວ (ອ່ານຢ່າງດຽວ)',
  'ipd.noDischargedData': 'ບໍ່ພົບປະຫວັດຄົນເຈັບທີ່ອອກໂຮງໝໍແລ້ວ.',
  'ipd.assistantNurse': 'ພະຍາບານຜູ້ຊ່ວຍ',
  'ipd.doctorRequired': 'ກະລຸນາເລືອກແພດຜູ້ຮັບຜິດຊອບ.',
  'ipd.nurseRequired': 'ກະລຸນາເລືອກພະຍາບານຜູ້ຊ່ວຍ.',
  'ipd.bedRequired': 'ກະລຸນາເລືອກຫ້ອງ / ຕຽງ.',
  'ipd.searchHint': 'ພິມ HN, HN ເກົ່າ ຫຼື ຊື່…',
  'ipd.generalWardsTitle': 'ຫວອດທົ່ວໄປ',
  'ipd.generalWardsSubtitle': 'ຫວອດ IPD ມາດຕະຖານ (ຮັບເຂົ້າ, ຍ້າຍ, ອອກ)',
  'ipd.vipWardsTitle': 'ຫ້ອງ VIP',
  'ipd.vipWardsSubtitle': 'ຫ້ອງ IPD ພິເສດ — ແຍກອອກຈາກຫວອດທົ່ວໄປ',
  'ipd.wardsCount': 'ຫວອດ',
  'ipd.addVipRoom': 'ເພີ່ມຫ້ອງ VIP',
  'ipd.editVipRoom': 'ແກ້ໄຂຫ້ອງ VIP',
  'ipd.noVipWard': 'ຍັງບໍ່ມີຫວອດ VIP',
  'ipd.noVipWardText': 'ໃຫ້ສ້າງຫວອດປະເພດ Type = "VIP" ກ່ອນ ແລ້ວຄ່ອຍເພີ່ມຫ້ອງ VIP.',
  'ipd.configTitle': 'ຕັ້ງຄ່າ IPD (ຫວອດ/ຫ້ອງ/ຕຽງ)',
  'ipd.configSubtitle': 'ຈັດການຫວອດ, ຫ້ອງ ແລະ ຕຽງ IPD (CRUD)',
  'ipd.wardsTab': 'ຫວອດ',
  'ipd.roomsTab': 'ຫ້ອງ',
  'ipd.bedsTab': 'ຕຽງ'
});

Object.assign(window.appTranslations.lo, {
  'ipd.noChartDataYet': 'ຍັງບໍ່ມີບັນທຶກໃນສ່ວນນີ້.'
});

Object.assign(window.appTranslations.en, {
  'ipd.dashboardSubtitle': 'IPD census, admissions, discharge readiness and bed utilization',
  'ipd.totalAdmissions': 'Total Admissions',
  'ipd.activeInpatients': 'Active Inpatients',
  'ipd.availableBeds': 'Available Beds',
  'ipd.occupiedBeds': 'Occupied Beds',
  'ipd.todayAdmissions': "Today's Admissions",
  'ipd.todayDischarges': "Today's Discharges",
  'ipd.admissionsByMonth': 'Admissions by Month',
  'ipd.occupancyTrend': 'Occupancy Trend',
  'ipd.recentAdmissions': 'Recent Admissions',
  'ipd.pendingDischarge': 'Patients Pending Discharge',
  'ipd.bedStatusSummary': 'Bed Status Summary',
  'ipd.admitSubtitle': 'Create and place active IPD admissions into available or reserved beds',
  'ipd.newAdmission': 'New IPD Admission',
  'ipd.readyBeds': 'Ready Beds',
  'ipd.waitingAdmissions': 'Admissions Waiting for Bed',
  'ipd.dischargeSubtitle': 'Discharge workflow and beds that need cleaning before reuse',
  'ipd.cleaningBeds': 'Beds in Cleaning',
  'ipd.inpatientSubtitle': 'Active IPD patients by ward, room, bed and attending doctor',
  'ipd.patientName': 'Patient Name',
  'ipd.admitDateTime': 'Admit Date/Time',
  'ipd.chartSubtitle': 'IPD admission chart',
  'ipd.printDischarge': 'Print Discharge',
  'ipd.timeline': 'Timeline',
  'ipd.patientTimeline': 'Patient Timeline',
  'ipd.timelineDescription': 'Admission events, notes, vitals, labs, medications and procedures grouped by date',
  'ipd.all': 'All',
  'ipd.labs': 'Labs',
  'ipd.medications': 'Medications',
  'ipd.clinicalSnapshot': 'Clinical Snapshot',
  'ipd.latestLabResult': 'Latest Lab Result',
  'ipd.activeMedications': 'Active Medications',
  'ipd.todayDoctorNote': 'Today Doctor Note',
  'ipd.wardRoomBed': 'Ward / Room / Bed',
  'ipd.admissionDate': 'Admission Date',
  'ipd.currentStatus': 'Current Status',
  'ipd.temperature': 'Temperature',
  'ipd.pulse': 'Pulse',
  'ipd.respiration': 'Respiration',
  'ipd.painScore': 'Pain Score',
  'ipd.latestVitals': 'Latest Vitals',
  'ipd.linkedOpdVisits': 'Linked OPD Visits',
  'ipd.linkedLisOrders': 'Linked LIS Orders',
  'ipd.latestOpdDiagnosis': 'Latest OPD Diagnosis',
  'ipd.billingTotal': 'Billing Total',
  'ipd.noVitalsRecorded': 'No vitals recorded',
  'ipd.noTimelineEvents': 'No timeline events found for this filter.',
  'ipd.events': 'events',
  'ipd.noDate': 'No Date',
  'ipd.showMore': 'Show more',
  'ipd.ipdAdmissionEvent': 'IPD Admission',
  'ipd.doctorSoapNote': 'Doctor SOAP Note',
  'ipd.nursingNote': 'Nursing Note',
  'ipd.shift': 'Shift',
  'ipd.labOrder': 'Lab Order',
  'ipd.labResult': 'Lab Result',
  'ipd.medicationOrder': 'Medication Order',
  'ipd.linkedOpd': 'Linked OPD',
  'ipd.linkedOpdLis': 'Linked OPD/LIS',
  'ipd.soapNote': 'SOAP Note',
  'ipd.addSoapNote': 'Add SOAP Note',
  'ipd.editSoapNote': 'Edit SOAP Note',
  'ipd.shiftNotes': 'Shift Notes',
  'ipd.addShiftNote': 'Add Shift Note',
  'ipd.editNursingNote': 'Edit Nursing Note',
  'ipd.addNursingNote': 'Add Nursing Note',
  'ipd.vitalsDescription': 'Temperature, BP, pulse, respiration, SpO2 and pain trend',
  'ipd.addVitals': 'Add Vitals',
  'ipd.editVitals': 'Edit Vital Signs',
  'ipd.addVitalSigns': 'Add Vital Signs',
  'ipd.medicationDescription': 'Drug, dose, frequency, route and duration',
  'ipd.addMedication': 'Add Medication',
  'ipd.editMedicationOrder': 'Edit Medication Order',
  'ipd.addMedicationOrder': 'Add Medication Order',
  'ipd.labDescription': 'Existing LIS/OPD lab orders linked by patient HN',
  'ipd.refresh': 'Refresh',
  'ipd.radiologyDescription': 'Imaging requests and results',
  'ipd.addImaging': 'Add Imaging',
  'ipd.editImagingRequest': 'Edit Imaging Request',
  'ipd.addImagingRequest': 'Add Imaging Request',
  'ipd.proceduresDescription': 'Bedside or operating room procedures during admission',
  'ipd.addProcedure': 'Add Procedure',
  'ipd.editProcedure': 'Edit Procedure',
  'ipd.billingDescription': 'IPD admission charges and payment status',
  'ipd.addCharge': 'Add Charge',
  'ipd.editBillingItem': 'Edit Billing Item',
  'ipd.addBillingItem': 'Add Billing Item',
  'ipd.dischargeDescription': 'Printable IPD discharge document',
  'ipd.editSummary': 'Edit Summary',
  'ipd.print': 'Print',
  'ipd.createDischargeSummary': 'Create Discharge Summary',
  'ipd.editDischargeSummary': 'Edit Discharge Summary',
  'ipd.noSoapNotes': 'No SOAP notes recorded yet.',
  'ipd.noNursingNotes': 'No nursing shift notes recorded yet.',
  'ipd.noVitalSigns': 'No vital signs recorded yet.',
  'ipd.noMedicationOrders': 'No medication orders recorded yet.',
  'ipd.noLinkedLabs': 'No linked LIS lab orders or results found for this patient.',
  'ipd.noRadiology': 'No imaging requests or results recorded yet.',
  'ipd.noProcedures': 'No procedures recorded yet.',
  'ipd.noBillingItems': 'No IPD billing items recorded yet.',
  'ipd.noDischargeSummary': 'No discharge summary prepared yet. Click Edit Summary to create one.',
  'ipd.prepareDischargeFirst': 'Please prepare discharge summary first.',
  'ipd.finalDiagnosis': 'Final Diagnosis',
  'ipd.hospitalCourse': 'Hospital Course',
  'ipd.treatmentGiven': 'Treatment Given',
  'ipd.conditionOnDischarge': 'Condition on Discharge',
  'ipd.dischargeMedications': 'Discharge Medications',
  'ipd.followUp': 'Follow Up',
  'ipd.instructions': 'Instructions',
  'ipd.preparedBy': 'Prepared by',
  'ipd.doctorSignature': 'Doctor signature',
  'ipd.dischargeDate': 'Discharge Date',
  'ipd.dischargeTime': 'Discharge Time',
  'ipd.date': 'Date',
  'ipd.visit': 'Visit',
  'ipd.lab': 'Lab',
  'ipd.resultStatus': 'Result/Status',
  'ipd.requested': 'Requested',
  'ipd.imaging': 'Imaging',
  'ipd.bodyPart': 'Body Part',
  'ipd.resultNote': 'Result/Note',
  'ipd.findingsNotes': 'Findings/Notes',
  'ipd.performer': 'Performer',
  'ipd.descriptionColumn': 'Description',
  'ipd.quantityShort': 'Qty',
  'ipd.unit': 'Unit',
  'ipd.amount': 'Amount',
  'ipd.sourceActions': 'Source/Actions',
  'ipd.ordered': 'Ordered',
  'ipd.drug': 'Drug',
  'ipd.dose': 'Dose',
  'ipd.frequencyUsage': 'Frequency/Usage',
  'ipd.route': 'Route',
  'ipd.durationQty': 'Duration/Qty',
  'ipd.orderedAt': 'Ordered At',
  'ipd.frequency': 'Frequency',
  'ipd.duration': 'Duration',
  'ipd.orderedBy': 'Ordered By',
  'ipd.requestDateTime': 'Request Date/Time',
  'ipd.imagingType': 'Imaging Type',
  'ipd.requestNote': 'Request Note',
  'ipd.result': 'Result',
  'ipd.findings': 'Findings',
  'ipd.unitPrice': 'Unit Price',
  'ipd.deleteRecord': 'Delete this record?',
  'ipd.delete': 'Delete',
  'ipd.disable': 'Disable',
  'ipd.edit': 'Edit',
  'ipd.view': 'View',
  'ipd.drugRequired': 'Drug is required',
  'ipd.procedureRequired': 'Procedure name is required',
  'ipd.descriptionRequired': 'Description is required',
  'ipd.noReadyBeds': 'No available or reserved beds.',
  'ipd.noWaitingAdmissions': 'No active admissions waiting for a bed.',
  'ipd.patientRequired': 'Patient required',
  'ipd.patientRequiredText': 'Please register the patient first in Patient Registration, then create the IPD admission.',
  'ipd.searchRegisteredPatient': 'Search Registered Patient',
  'ipd.searchPatientPlaceholder': 'Search HN or patient name',
  'ipd.noBedYet': 'No bed yet',
  'ipd.admitted': 'Admitted'
});

Object.assign(window.appTranslations.lo, {
  'ipd.dashboardSubtitle': 'ສະຫຼຸບການນອນ IPD, ການຮັບເຂົ້າ, ການກຽມອອກ ແລະ ການໃຊ້ຕຽງ',
  'ipd.totalAdmissions': 'ການນອນທັງໝົດ',
  'ipd.activeInpatients': 'ຄົນເຈັບກຳລັງນອນ',
  'ipd.availableBeds': 'ຕຽງວ່າງ',
  'ipd.occupiedBeds': 'ຕຽງມີຄົນເຈັບ',
  'ipd.todayAdmissions': 'ຮັບເຂົ້າມື້ນີ້',
  'ipd.todayDischarges': 'ອອກໂຮງໝໍມື້ນີ້',
  'ipd.admissionsByMonth': 'ການຮັບເຂົ້າຕາມເດືອນ',
  'ipd.occupancyTrend': 'ແນວໂນ້ມການຄອງຕຽງ',
  'ipd.recentAdmissions': 'ຮັບເຂົ້າຫຼ້າສຸດ',
  'ipd.pendingDischarge': 'ຄົນເຈັບລໍຖ້າອອກໂຮງໝໍ',
  'ipd.bedStatusSummary': 'ສະຫຼຸບສະຖານະຕຽງ',
  'ipd.admitSubtitle': 'ສ້າງການນອນ IPD ແລະ ຈັດເຂົ້າຕຽງວ່າງ ຫຼື ຕຽງຈອງ',
  'ipd.newAdmission': 'ຮັບ IPD ໃໝ່',
  'ipd.readyBeds': 'ຕຽງພ້ອມໃຊ້',
  'ipd.waitingAdmissions': 'ຄົນເຈັບລໍຖ້າຕຽງ',
  'ipd.dischargeSubtitle': 'Workflow ອອກໂຮງໝໍ ແລະ ຕຽງທີ່ຕ້ອງອະນາໄມກ່ອນໃຊ້ຄືນ',
  'ipd.cleaningBeds': 'ຕຽງກຳລັງອະນາໄມ',
  'ipd.inpatientSubtitle': 'ຄົນເຈັບ IPD active ຕາມຫວອດ, ຫ້ອງ, ຕຽງ ແລະ ແພດຜູ້ຮັບຜິດຊອບ',
  'ipd.patientName': 'ຊື່ຄົນເຈັບ',
  'ipd.admitDateTime': 'ວັນທີ/ເວລາຮັບເຂົ້າ',
  'ipd.chartSubtitle': 'ແຟ້ມການນອນ IPD',
  'ipd.printDischarge': 'ພິມໃບອອກໂຮງໝໍ',
  'ipd.timeline': 'Timeline',
  'ipd.patientTimeline': 'Timeline ຄົນເຈັບ',
  'ipd.timelineDescription': 'ເຫດການຮັບເຂົ້າ, ບັນທຶກ, vital signs, lab, ຢາ ແລະ ຫັດຖະການ ແຍກຕາມວັນທີ',
  'ipd.all': 'ທັງໝົດ',
  'ipd.labs': 'ແລັບ',
  'ipd.medications': 'ຢາ',
  'ipd.clinicalSnapshot': 'ສະຫຼຸບອາການຫຼ້າສຸດ',
  'ipd.latestLabResult': 'ຜົນແລັບຫຼ້າສຸດ',
  'ipd.activeMedications': 'ຢາທີ່ກຳລັງໃຊ້',
  'ipd.todayDoctorNote': 'ບັນທຶກແພດມື້ນີ້',
  'ipd.wardRoomBed': 'ຫວອດ / ຫ້ອງ / ຕຽງ',
  'ipd.admissionDate': 'ວັນທີຮັບເຂົ້າ',
  'ipd.currentStatus': 'ສະຖານະປັດຈຸບັນ',
  'ipd.temperature': 'ອຸນຫະພູມ',
  'ipd.pulse': 'ຊີບພະຈອນ',
  'ipd.respiration': 'ຫາຍໃຈ',
  'ipd.painScore': 'ຄະແນນເຈັບ',
  'ipd.latestVitals': 'Vital Signs ຫຼ້າສຸດ',
  'ipd.linkedOpdVisits': 'OPD ທີ່ເຊື່ອມໂຍງ',
  'ipd.linkedLisOrders': 'ຄຳສັ່ງ LIS ທີ່ເຊື່ອມໂຍງ',
  'ipd.latestOpdDiagnosis': 'ວິນິດໄສ OPD ຫຼ້າສຸດ',
  'ipd.billingTotal': 'ຍອດຄ່າໃຊ້ຈ່າຍລວມ',
  'ipd.noVitalsRecorded': 'ຍັງບໍ່ມີ Vital Signs',
  'ipd.noTimelineEvents': 'ບໍ່ພົບເຫດການ Timeline ຕາມຕົວກັ່ນຕອງນີ້.',
  'ipd.events': 'ເຫດການ',
  'ipd.noDate': 'ບໍ່ມີວັນທີ',
  'ipd.showMore': 'ສະແດງເພີ່ມ',
  'ipd.ipdAdmissionEvent': 'ຮັບເຂົ້າ IPD',
  'ipd.doctorSoapNote': 'ບັນທຶກ SOAP ຂອງແພດ',
  'ipd.nursingNote': 'ບັນທຶກພະຍາບານ',
  'ipd.shift': 'ກະ',
  'ipd.labOrder': 'ຄຳສັ່ງແລັບ',
  'ipd.labResult': 'ຜົນແລັບ',
  'ipd.medicationOrder': 'ຄຳສັ່ງຢາ',
  'ipd.linkedOpd': 'ເຊື່ອມຈາກ OPD',
  'ipd.linkedOpdLis': 'ເຊື່ອມຈາກ OPD/LIS',
  'ipd.soapNote': 'ບັນທຶກ SOAP',
  'ipd.addSoapNote': 'ເພີ່ມບັນທຶກ SOAP',
  'ipd.editSoapNote': 'ແກ້ໄຂບັນທຶກ SOAP',
  'ipd.shiftNotes': 'ບັນທຶກປະຈຳກະ',
  'ipd.addShiftNote': 'ເພີ່ມບັນທຶກກະ',
  'ipd.editNursingNote': 'ແກ້ໄຂບັນທຶກພະຍາບານ',
  'ipd.addNursingNote': 'ເພີ່ມບັນທຶກພະຍາບານ',
  'ipd.vitalsDescription': 'ອຸນຫະພູມ, BP, ຊີບພະຈອນ, ຫາຍໃຈ, SpO2 ແລະ trend ຄວາມເຈັບ',
  'ipd.addVitals': 'ເພີ່ມ Vital Signs',
  'ipd.editVitals': 'ແກ້ໄຂ Vital Signs',
  'ipd.addVitalSigns': 'ເພີ່ມ Vital Signs',
  'ipd.medicationDescription': 'ຢາ, ຂະໜາດ, ຄວາມຖີ່, ທາງໃຫ້ຢາ ແລະ ໄລຍະເວລາ',
  'ipd.addMedication': 'ເພີ່ມຢາ',
  'ipd.editMedicationOrder': 'ແກ້ໄຂຄຳສັ່ງຢາ',
  'ipd.addMedicationOrder': 'ເພີ່ມຄຳສັ່ງຢາ',
  'ipd.labDescription': 'ຄຳສັ່ງ/ຜົນແລັບ LIS/OPD ທີ່ເຊື່ອມຕາມ HN',
  'ipd.refresh': 'ໂຫຼດໃໝ່',
  'ipd.radiologyDescription': 'ຄຳຂໍກວດ ແລະ ຜົນລັງສີ',
  'ipd.addImaging': 'ເພີ່ມກວດລັງສີ',
  'ipd.editImagingRequest': 'ແກ້ໄຂຄຳຂໍກວດລັງສີ',
  'ipd.addImagingRequest': 'ເພີ່ມຄຳຂໍກວດລັງສີ',
  'ipd.proceduresDescription': 'ຫັດຖະການຂ້າງຕຽງ ຫຼື ໃນຫ້ອງຜ່າຕັດລະຫວ່າງນອນໂຮງໝໍ',
  'ipd.addProcedure': 'ເພີ່ມຫັດຖະການ',
  'ipd.editProcedure': 'ແກ້ໄຂຫັດຖະການ',
  'ipd.billingDescription': 'ຄ່າໃຊ້ຈ່າຍ IPD ແລະ ສະຖານະຈ່າຍເງິນ',
  'ipd.addCharge': 'ເພີ່ມຄ່າໃຊ້ຈ່າຍ',
  'ipd.editBillingItem': 'ແກ້ໄຂລາຍການເງິນ',
  'ipd.addBillingItem': 'ເພີ່ມລາຍການເງິນ',
  'ipd.dischargeDescription': 'ເອກະສານສະຫຼຸບອອກໂຮງໝໍທີ່ພິມໄດ້',
  'ipd.editSummary': 'ແກ້ໄຂສະຫຼຸບ',
  'ipd.print': 'ພິມ',
  'ipd.createDischargeSummary': 'ສ້າງສະຫຼຸບອອກໂຮງໝໍ',
  'ipd.editDischargeSummary': 'ແກ້ໄຂສະຫຼຸບອອກໂຮງໝໍ',
  'ipd.noSoapNotes': 'ຍັງບໍ່ມີບັນທຶກ SOAP.',
  'ipd.noNursingNotes': 'ຍັງບໍ່ມີບັນທຶກພະຍາບານ.',
  'ipd.noVitalSigns': 'ຍັງບໍ່ມີ Vital Signs.',
  'ipd.noMedicationOrders': 'ຍັງບໍ່ມີຄຳສັ່ງຢາ.',
  'ipd.noLinkedLabs': 'ບໍ່ພົບຄຳສັ່ງ ຫຼື ຜົນແລັບ LIS ທີ່ເຊື່ອມກັບຄົນເຈັບນີ້.',
  'ipd.noRadiology': 'ຍັງບໍ່ມີຄຳຂໍກວດ ຫຼື ຜົນລັງສີ.',
  'ipd.noProcedures': 'ຍັງບໍ່ມີຫັດຖະການ.',
  'ipd.noBillingItems': 'ຍັງບໍ່ມີລາຍການຄ່າໃຊ້ຈ່າຍ IPD.',
  'ipd.noDischargeSummary': 'ຍັງບໍ່ມີສະຫຼຸບອອກໂຮງໝໍ. ກົດແກ້ໄຂສະຫຼຸບເພື່ອສ້າງ.',
  'ipd.prepareDischargeFirst': 'ກະລຸນາກຽມສະຫຼຸບອອກໂຮງໝໍກ່ອນ.',
  'ipd.finalDiagnosis': 'ວິນິດໄສສຸດທ້າຍ',
  'ipd.hospitalCourse': 'ການດຳເນີນການຮັກສາໃນໂຮງໝໍ',
  'ipd.treatmentGiven': 'ການຮັກສາທີ່ໄດ້ຮັບ',
  'ipd.conditionOnDischarge': 'ສະພາບເມື່ອອອກໂຮງໝໍ',
  'ipd.dischargeMedications': 'ຢາກັບບ້ານ',
  'ipd.followUp': 'ນັດຕິດຕາມ',
  'ipd.instructions': 'ຄຳແນະນຳ',
  'ipd.preparedBy': 'ກຽມໂດຍ',
  'ipd.doctorSignature': 'ລາຍເຊັນແພດ',
  'ipd.dischargeDate': 'ວັນທີອອກໂຮງໝໍ',
  'ipd.dischargeTime': 'ເວລາອອກໂຮງໝໍ',
  'ipd.date': 'ວັນທີ',
  'ipd.visit': 'ການມາກວດ',
  'ipd.lab': 'ແລັບ',
  'ipd.resultStatus': 'ຜົນ/ສະຖານະ',
  'ipd.requested': 'ຮ້ອງຂໍ',
  'ipd.imaging': 'ການຖ່າຍພາບ',
  'ipd.bodyPart': 'ສ່ວນຮ່າງກາຍ',
  'ipd.resultNote': 'ຜົນ/ໝາຍເຫດ',
  'ipd.findingsNotes': 'ສິ່ງທີ່ພົບ/ໝາຍເຫດ',
  'ipd.performer': 'ຜູ້ປະຕິບັດ',
  'ipd.descriptionColumn': 'ລາຍລະອຽດ',
  'ipd.quantityShort': 'ຈຳນວນ',
  'ipd.unit': 'ຫົວໜ່ວຍ',
  'ipd.amount': 'ຈຳນວນເງິນ',
  'ipd.sourceActions': 'ແຫຼ່ງຂໍ້ມູນ/ຈັດການ',
  'ipd.ordered': 'ສັ່ງແລ້ວ',
  'ipd.drug': 'ຊື່ຢາ',
  'ipd.dose': 'ຂະໜາດ',
  'ipd.frequencyUsage': 'ຄວາມຖີ່/ວິທີໃຊ້',
  'ipd.route': 'ທາງໃຫ້ຢາ',
  'ipd.durationQty': 'ໄລຍະເວລາ/ຈຳນວນ',
  'ipd.orderedAt': 'ເວລາສັ່ງ',
  'ipd.frequency': 'ຄວາມຖີ່',
  'ipd.duration': 'ໄລຍະເວລາ',
  'ipd.orderedBy': 'ສັ່ງໂດຍ',
  'ipd.requestDateTime': 'ວັນທີ/ເວລາຮ້ອງຂໍ',
  'ipd.imagingType': 'ປະເພດການກວດລັງສີ',
  'ipd.requestNote': 'ໝາຍເຫດຄຳຂໍ',
  'ipd.result': 'ຜົນ',
  'ipd.findings': 'ສິ່ງທີ່ພົບ',
  'ipd.unitPrice': 'ລາຄາຕໍ່ໜ່ວຍ',
  'ipd.deleteRecord': 'ລຶບບັນທຶກນີ້ບໍ?',
  'ipd.delete': 'ລຶບ',
  'ipd.disable': 'ປິດໃຊ້ງານ',
  'ipd.edit': 'ແກ້ໄຂ',
  'ipd.view': 'ເບິ່ງ',
  'ipd.drugRequired': 'ກະລຸນາປ້ອນຊື່ຢາ',
  'ipd.procedureRequired': 'ກະລຸນາປ້ອນຊື່ຫັດຖະການ',
  'ipd.descriptionRequired': 'ກະລຸນາປ້ອນລາຍລະອຽດ',
  'ipd.noReadyBeds': 'ບໍ່ມີຕຽງວ່າງ ຫຼື ຕຽງຈອງ.',
  'ipd.noWaitingAdmissions': 'ບໍ່ມີຄົນເຈັບ active ທີ່ລໍຖ້າຕຽງ.',
  'ipd.patientRequired': 'ຕ້ອງມີຄົນເຈັບ',
  'ipd.patientRequiredText': 'ກະລຸນາລົງທະບຽນຄົນເຈັບກ່ອນຢູ່ Patient Registration ແລ້ວຈຶ່ງສ້າງ IPD admission.',
  'ipd.searchRegisteredPatient': 'ຄົ້ນຫາຄົນເຈັບທີ່ລົງທະບຽນແລ້ວ',
  'ipd.searchPatientPlaceholder': 'ຄົ້ນ HN ຫຼື ຊື່ຄົນເຈັບ',
  'ipd.noBedYet': 'ຍັງບໍ່ຈັດຕຽງ',
  'ipd.admitted': 'ນອນໂຮງໝໍ'
});

Object.assign(window.appTranslations.en, {
  'option.Admitted': 'Admitted',
  'option.Discharged': 'Discharged',
  'option.Ordered': 'Ordered',
  'option.Requested': 'Requested',
  'option.In Progress': 'In Progress',
  'option.Reported': 'Reported',
  'option.Cancelled': 'Cancelled',
  'option.Completed': 'Completed',
  'option.Planned': 'Planned',
  'option.Active': 'Active',
  'option.Hold': 'Hold',
  'option.Stopped': 'Stopped',
  'option.Morning': 'Morning',
  'option.Evening': 'Evening',
  'option.Night': 'Night',
  'option.Room': 'Room',
  'option.Medication': 'Medication',
  'option.Lab': 'Lab',
  'option.Radiology': 'Radiology',
  'option.Procedure': 'Procedure',
  'option.Service': 'Service',
  'option.Other': 'Other',
  'option.Unpaid': 'Unpaid',
  'option.Paid': 'Paid',
  'option.Waived': 'Waived',
  'option.Deposit': 'Deposit',
  'option.Paid/Deposit': 'Paid/Deposit'
});

Object.assign(window.appTranslations.lo, {
  'option.Admitted': 'ນອນໂຮງໝໍ',
  'option.Discharged': 'ອອກໂຮງໝໍ',
  'option.Ordered': 'ສັ່ງແລ້ວ',
  'option.Requested': 'ຮ້ອງຂໍ',
  'option.In Progress': 'ກຳລັງດຳເນີນ',
  'option.Reported': 'ລາຍງານແລ້ວ',
  'option.Cancelled': 'ຍົກເລີກ',
  'option.Completed': 'ສຳເລັດ',
  'option.Planned': 'ວາງແຜນ',
  'option.Hold': 'ພັກໄວ້',
  'option.Stopped': 'ຢຸດແລ້ວ',
  'option.Morning': 'ເຊົ້າ',
  'option.Evening': 'ແລງ',
  'option.Night': 'ກາງຄືນ',
  'option.Room': 'ຫ້ອງ',
  'option.Medication': 'ຢາ',
  'option.Lab': 'ແລັບ',
  'option.Radiology': 'ລັງສີ',
  'option.Procedure': 'ຫັດຖະການ',
  'option.Service': 'ບໍລິການ',
  'option.Other': 'ອື່ນໆ',
  'option.Unpaid': 'ຍັງບໍ່ຈ່າຍ',
  'option.Paid': 'ຈ່າຍແລ້ວ',
  'option.Waived': 'ຍົກເວັ້ນ',
  'option.Deposit': 'ມັດຈຳ',
  'option.Paid/Deposit': 'ຈ່າຍແລ້ວ/ມັດຈຳ'
});

Object.assign(window.appTranslations.en, {
  'ipd.addVitals': 'Add New Vital Sign',
  'ipd.reserveBedTitle': 'Reserve Bed',
  'ipd.editReservation': 'Edit Reservation',
  'ipd.cannotReserve': 'Cannot reserve bed',
  'ipd.reserveAllowedText': 'Only Available or Reserved beds can be reserved.',
  'ipd.manualReservation': 'Manual reservation',
  'ipd.registeredPatientOptional': 'Registered Patient (optional)',
  'ipd.selectRegisteredHn': 'HN (search registered patient)',
  'ipd.searchHnPlaceholder': 'Type HN, name, or phone',
  'ipd.patientMustBeRegistered': 'Please select a registered patient HN from the list.',
  'ipd.reservedFor': 'Reserved For',
  'ipd.reservedBy': 'Reserved By',
  'ipd.expectedAdmit': 'Expected Admit',
  'ipd.reserveUntil': 'Reserve Until',
  'ipd.phone': 'Phone',
  'ipd.reservationPatientRequired': 'Please enter HN or patient name for this reservation.',
  'ipd.reservedSuccess': 'Bed reservation has been saved.',
  'ipd.latestDoctorNote': 'Latest Doctor Note',
  'ipd.weight': 'Weight',
  'ipd.height': 'Height',
  'ipd.recordedBy': 'Recorded By',
  'ipd.source': 'Source',
  'ipd.sourceVisit': 'Source Visit',
  'ipd.initialAssessment': 'Initial Assessment',
  'ipd.manual': 'Manual',
  'ipd.transfers': 'Transfers',
  'ipd.patientTimeline': 'Patient Timeline',
  'ipd.doctorNotes': 'Doctor Notes',
  'ipd.nursingNotes': 'Nursing Notes',
  'ipd.vitalSigns': 'Vital Signs',
  'ipd.medicationOrder': 'Medication Orders',
  'nav.dischargeSummary': 'Discharge Summary',
  'option.Reserve': 'Reserve',
  'ipd.visitsRounds': 'Visits / Rounds',
  'ipd.visitsDescription': 'Doctor & nurse rounds with all clinical actions performed during each visit',
  'ipd.startRound': 'Start Round',
  'ipd.editRound': 'Edit Round',
  'ipd.round': 'Round',
  'ipd.closeRound': 'Close Round',
  'ipd.closeRoundConfirm': 'Mark this round as completed?',
  'ipd.activeRound': 'Active Round',
  'ipd.setActiveRound': 'Set as Active',
  'ipd.noRoundsYet': 'No rounds recorded yet. Click Start Round to begin.',
  'ipd.noActionsInRound': 'No clinical actions linked to this round yet.',
  'ipd.openRounds': 'Open Rounds',
  'ipd.closedRounds': 'Completed Rounds',
  'ipd.noRound': 'No round (standalone)',
  'ipd.linkedRound': 'Linked Round',
  'ipd.linkedRoundHint': 'Pick a round so this action is traced back to the provider visit.',
  'ipd.provider': 'Provider',
  'ipd.selectProvider': 'Select provider',
  'ipd.selectProviderRequired': 'Please select a provider for this round.',
  'ipd.providerRound': 'Provider / Round',
  'ipd.visitType': 'Visit Type',
  'ipd.endDateTime': 'End Date/Time',
  'ipd.reasonChiefConcern': 'Reason / Chief Concern',
  'ipd.summaryActionsTaken': 'Summary / Actions Taken',
  'ipd.summary': 'Summary',
  'ipd.openChartFirst': 'Open a patient chart first before starting a round.',
  'option.Doctor Round': 'Doctor Round',
  'option.Nurse Round': 'Nurse Round',
  'option.Bedside Procedure': 'Bedside Procedure',
  'option.Consult': 'Consult',
  'option.Emergency Visit': 'Emergency Visit',
  'option.Open': 'Open',
  'option.Completed': 'Completed',
  'option.Cancelled': 'Cancelled',
  'ipd.readOnly': 'Read-only entry',
  'ipd.diagnosis': 'Diagnosis',
  'ipd.chiefComplaint': 'Chief Complaint',
  'ipd.subjective': 'Subjective',
  'ipd.subjectivePlaceholder': 'Patient-reported symptoms today',
  'ipd.objective': 'Objective',
  'ipd.objectivePlaceholder': 'Physical exam, vital signs, lab/imaging findings',
  'ipd.assessment': 'Assessment',
  'ipd.plan': 'Plan',
  'ipd.planPlaceholder': 'Medications, labs, imaging, procedures, follow-up, discharge plan...',
  'ipd.patientCondition': 'Patient Condition',
  'ipd.observation': 'Observation',
  'ipd.nursingCareGiven': 'Nursing Care Given',
  'ipd.responseToTreatment': 'Response to Treatment',
  'ipd.intake': 'Intake',
  'ipd.output': 'Output',
  'ipd.fallRisk': 'Fall Risk',
  'ipd.allergyAlert': 'Allergy Alert',
  'ipd.medicationGiven': 'Medication Given',
  'ipd.procedureDone': 'Procedure Done',
  'ipd.consciousness': 'Consciousness',
  'option.Initial': 'Initial',
  'option.Daily Round': 'Daily Round',
  'option.Follow-up': 'Follow-up',
  'option.Emergency': 'Emergency',
  'option.Morning': 'Morning Shift',
  'option.Evening': 'Evening Shift',
  'option.Night': 'Night Shift',
  'option.Low': 'Low',
  'option.Moderate': 'Moderate',
  'option.High': 'High',
  'option.Alert': 'Alert',
  'option.Verbal': 'Verbal',
  'option.Pain': 'Pain',
  'option.Unresponsive': 'Unresponsive',
  'option.Drowsy': 'Drowsy',
  'option.Confused': 'Confused',
  'ipd.btnAddDoctorExam': 'Add Doctor Exam',
  'ipd.btnAddNursingNote': 'Add Nursing Note',
  'ipd.btnAddVitals': 'Add Vital Signs',
  'ipd.modalDoctorAdd': "Doctor's Examination (SOAP Note)",
  'ipd.modalDoctorEdit': "Edit Doctor's Examination",
  'ipd.modalNurseAdd': 'Nursing Record (Shift Note)',
  'ipd.modalNurseEdit': 'Edit Nursing Record',
  'ipd.modalVitalsAdd': 'Vital Signs Record',
  'ipd.modalVitalsEdit': 'Edit Vital Signs',
  'ipd.confirmDeleteWard': 'Permanently delete this ward?',
  'ipd.confirmDeleteRoom': 'Permanently delete this room?',
  'ipd.editBed': 'Edit Bed',
  'ipd.deleteBed': 'Delete Bed',
  'ipd.confirmDeleteBed': 'Permanently delete this bed?',
  'ipd.cannotDeleteBedOccupied': 'Cannot delete an occupied bed. Discharge the patient first.',
  'ipd.cannotDeleteBedReserved': 'Cannot delete a reserved bed. Cancel the reservation first.'
});

Object.assign(window.appTranslations.lo, {
  'ipd.addVitals': 'ເພີ່ມສັນຍານຊີບໃໝ່',
  'ipd.reserveBedTitle': 'ຈອງຕຽງ',
  'ipd.editReservation': 'ແກ້ໄຂການຈອງ',
  'ipd.cannotReserve': 'ຈອງຕຽງບໍ່ໄດ້',
  'ipd.reserveAllowedText': 'ຈອງໄດ້ສະເພາະຕຽງວ່າງ ຫຼື ຕຽງທີ່ຖືກຈອງແລ້ວເທົ່ານັ້ນ.',
  'ipd.manualReservation': 'ພິມຂໍ້ມູນຈອງເອງ',
  'ipd.registeredPatientOptional': 'ຄົນເຈັບທີ່ລົງທະບຽນແລ້ວ (ຖ້າມີ)',
  'ipd.reservedFor': 'ຈອງໃຫ້',
  'ipd.reservedBy': 'ຜູ້ຈອງ',
  'ipd.expectedAdmit': 'ເວລາຄາດວ່າຈະເຂົ້າ',
  'ipd.reserveUntil': 'ຈອງໄວ້ຮອດ',
  'ipd.phone': 'ເບີໂທ',
  'ipd.reservationPatientRequired': 'ກະລຸນາໃສ່ HN ຫຼື ຊື່ຜູ້ຈອງ.',
  'ipd.reservedSuccess': 'ບັນທຶກການຈອງຕຽງແລ້ວ.',
  'ipd.addVitalSigns': 'ເພີ່ມສັນຍານຊີບ',
  'ipd.editVitals': 'ແກ້ໄຂສັນຍານຊີບ',
  'ipd.latestDoctorNote': 'ບັນທຶກແພດຫຼ້າສຸດ',
  'ipd.weight': 'ນ້ຳໜັກ',
  'ipd.height': 'ສ່ວນສູງ',
  'ipd.recordedBy': 'ບັນທຶກໂດຍ',
  'ipd.source': 'ແຫຼ່ງຂໍ້ມູນ',
  'ipd.sourceVisit': 'Visit ຕົ້ນທາງ',
  'ipd.initialAssessment': 'ປະເມີນເບື້ອງຕົ້ນ',
  'ipd.manual': 'ບັນທຶກເອງ',
  'ipd.transfers': 'ການຍ້າຍ',
  'ipd.patientTimeline': 'ປະຫວັດການປິ່ນປົວ',
  'ipd.timeline': 'ປະຫວັດການປິ່ນປົວ',
  'ipd.doctorNotes': 'ບັນທຶກແພດ',
  'ipd.nursingNotes': 'ບັນທຶກພະຍາບານ',
  'ipd.vitalSigns': 'ສັນຍານຊີບ',
  'ipd.medicationOrder': 'ຄຳສັ່ງໃຊ້ຢາ',
  'ipd.labResults': 'ຜົນແລັບ',
  'ipd.radiology': 'ລັງສີ',
  'ipd.procedures': 'ຫັດຖະການ',
  'nav.dischargeSummary': 'ສະຫຼຸບການຈຳໜ່າຍ'
  ,
  'option.Reserve': 'ຈອງຕຽງ',
  'ipd.visitsRounds': 'ການ Visit / Round',
  'ipd.visitsDescription': 'ການ Round ຂອງໝໍ ແລະ ພະຍາບານ ພ້ອມລາຍການທີ່ເຮັດໃນແຕ່ລະຄັ້ງ',
  'ipd.startRound': 'ເລີ່ມ Round',
  'ipd.editRound': 'ແກ້ໄຂ Round',
  'ipd.round': 'Round',
  'ipd.closeRound': 'ປິດ Round',
  'ipd.closeRoundConfirm': 'ຢືນຢັນປິດ Round ນີ້ບໍ?',
  'ipd.activeRound': 'Round ປະຈຸບັນ',
  'ipd.setActiveRound': 'ຕັ້ງເປັນ Round ປະຈຸບັນ',
  'ipd.noRoundsYet': 'ຍັງບໍ່ມີ Round. ກົດ "ເລີ່ມ Round" ເພື່ອເລີ່ມ.',
  'ipd.noActionsInRound': 'ຍັງບໍ່ມີລາຍການທີ່ເຊື່ອມກັບ Round ນີ້.',
  'ipd.openRounds': 'Round ກຳລັງເປີດ',
  'ipd.closedRounds': 'Round ປິດແລ້ວ',
  'ipd.noRound': 'ບໍ່ເຊື່ອມ Round (ບັນທຶກດ່ຽວ)',
  'ipd.linkedRound': 'Round ທີ່ເຊື່ອມ',
  'ipd.linkedRoundHint': 'ເລືອກ Round ເພື່ອບັນທຶກໄວ້ວ່າຂັ້ນຕອນນີ້ເຮັດໃນຊ່ວງ Round ໃດ.',
  'ipd.provider': 'ຜູ້ບັນທຶກ',
  'ipd.selectProvider': 'ເລືອກຜູ້ບັນທຶກ',
  'ipd.selectProviderRequired': 'ກະລຸນາເລືອກຜູ້ບັນທຶກສຳລັບ Round ນີ້.',
  'ipd.providerRound': 'ຜູ້ບັນທຶກ / Round',
  'ipd.visitType': 'ປະເພດ Visit',
  'ipd.endDateTime': 'ວັນທີ / ເວລາສິ້ນສຸດ',
  'ipd.reasonChiefConcern': 'ເຫດຜົນ / ອາການສຳຄັນ',
  'ipd.summaryActionsTaken': 'ສະຫຼຸບ / ຂັ້ນຕອນທີ່ເຮັດ',
  'ipd.summary': 'ສະຫຼຸບ',
  'ipd.openChartFirst': 'ກະລຸນາເປີດແຟ້ມຄົນເຈັບກ່ອນເລີ່ມ Round.',
  'option.Doctor Round': 'Round ໝໍ',
  'option.Nurse Round': 'Round ພະຍາບານ',
  'option.Bedside Procedure': 'ຫັດຖະການຂ້າງຕຽງ',
  'option.Consult': 'ປຶກສາ',
  'option.Emergency Visit': 'Visit ສຸກເສີນ',
  'option.Open': 'ກຳລັງເປີດ',
  'option.Completed': 'ສຳເລັດ',
  'option.Cancelled': 'ຍົກເລີກ',
  'ipd.readOnly': 'ບັນທຶກອ່ານໄດ້ຢ່າງດຽວ',
  'ipd.diagnosis': 'ການວິນິໄສ',
  'ipd.chiefComplaint': 'ອາການສຳຄັນ',
  'ipd.subjective': 'ອາການທີ່ຄົນເຈັບບອກ',
  'ipd.subjectivePlaceholder': 'ອາການທີ່ຄົນເຈັບເລົ່າມື້ນີ້',
  'ipd.objective': 'ຜົນກວດຮ່າງກາຍ',
  'ipd.objectivePlaceholder': 'ກວດຮ່າງກາຍ, vital signs, ຜົນ lab/X-ray ລ່າສຸດ',
  'ipd.assessment': 'ການປະເມີນ',
  'ipd.plan': 'ແຜນຮັກສາ',
  'ipd.planPlaceholder': 'ສັ່ງຢາ, ສັ່ງ lab, X-ray/Ultrasound, ຫັດຖະການ, ນັດຕິດຕາມ, ພິຈາລະນາ Discharge...',
  'ipd.patientCondition': 'ສະພາບຄົນເຈັບ',
  'ipd.observation': 'ການສັງເກດ',
  'ipd.nursingCareGiven': 'ການດູແລທີ່ໃຫ້',
  'ipd.responseToTreatment': 'ການຕອບສະໜອງ',
  'ipd.intake': 'Intake',
  'ipd.output': 'Output',
  'ipd.fallRisk': 'ຄວາມສ່ຽງລົ້ມ',
  'ipd.allergyAlert': 'ການແພ້',
  'ipd.medicationGiven': 'ຢາທີ່ໃຫ້',
  'ipd.procedureDone': 'ຫັດຖະການທີ່ເຮັດ',
  'ipd.consciousness': 'ສະຕິ',
  'option.Initial': 'ປະເມີນເບື້ອງຕົ້ນ',
  'option.Daily Round': 'Round ປະຈຳວັນ',
  'option.Follow-up': 'ຕິດຕາມ',
  'option.Emergency': 'ສຸກເສີນ',
  'option.Morning': 'ກະເຊົ້າ',
  'option.Evening': 'ກະບ່າຍ',
  'option.Night': 'ກະກາງຄືນ',
  'option.Low': 'ຕ່ຳ',
  'option.Moderate': 'ປານກາງ',
  'option.High': 'ສູງ',
  'option.Alert': 'ຮູ້ສຶກຕົວດີ',
  'option.Verbal': 'ຕອບສຽງ',
  'option.Pain': 'ຕອບປວດ',
  'option.Unresponsive': 'ບໍ່ຕອບສະໜອງ',
  'option.Drowsy': 'ຊຶມເຊົາ',
  'option.Confused': 'ສັບສົນ',
  'ipd.btnAddDoctorExam': 'ເພີ່ມການກວດຂອງໝໍ',
  'ipd.btnAddNursingNote': 'ເພີ່ມບັນທຶກພະຍາບານ',
  'ipd.btnAddVitals': 'ເພີ່ມສັນຍານຊີບ',
  'ipd.modalDoctorAdd': 'ການກວດຂອງໝໍ (SOAP Note)',
  'ipd.modalDoctorEdit': 'ແກ້ໄຂການກວດຂອງໝໍ',
  'ipd.modalNurseAdd': 'ບັນທຶກພະຍາບານ (ປະຈຳກະ)',
  'ipd.modalNurseEdit': 'ແກ້ໄຂບັນທຶກພະຍາບານ',
  'ipd.modalVitalsAdd': 'ບັນທຶກສັນຍານຊີບ',
  'ipd.modalVitalsEdit': 'ແກ້ໄຂສັນຍານຊີບ',
  'ipd.confirmDeleteWard': 'ຢືນຢັນລົບທວດນີ້ຖາວອນ?',
  'ipd.confirmDeleteRoom': 'ຢືນຢັນລົບຫ້ອງນີ້ຖາວອນ?',
  'ipd.editBed': 'ແກ້ໄຂຕຽງ',
  'ipd.deleteBed': 'ລົບຕຽງ',
  'ipd.confirmDeleteBed': 'ຢືນຢັນລົບຕຽງນີ້ຖາວອນ?',
  'ipd.cannotDeleteBedOccupied': 'ລົບຕຽງທີ່ມີຄົນເຈັບບໍ່ໄດ້. ກະລຸນາຈຳໜ່າຍຄົນເຈັບອອກກ່ອນ.',
  'ipd.cannotDeleteBedReserved': 'ລົບຕຽງທີ່ຖືກຈອງບໍ່ໄດ້. ກະລຸນາຍົກເລີກການຈອງກ່ອນ.'
});

Object.assign(window.appTranslations.lo, {
  'ipd.selectRegisteredHn': 'HN (ຄົ້ນຈາກການລົງທະບຽນ)',
  'ipd.searchHnPlaceholder': 'ພິມ HN, ຊື່ ຫຼື ເບີໂທ',
  'ipd.patientMustBeRegistered': 'ກະລຸນາເລືອກ HN ຄົນເຈັບຈາກລາຍຊື່ລົງທະບຽນ.'
});

Object.assign(window.appTranslations.lo, {
  'nav.patientManagement': 'ຈັດການຄົນເຈັບ',
  'nav.opdGroup': 'ຄົນເຈັບນອກ (OPD)',
  'nav.opdQueue': 'ຄິວ OPD',
  'nav.opdConsultation': 'ກວດຄົນເຈັບ',
  'nav.opdObservation': 'ຕິດຕາມ OPD',
  'nav.opdObservationManagement': 'ຄົນເຈັບນອນຕິດຕາມ OPD',
  'nav.opdObservationBeds': 'ບອດຕຽງ OPD ຕິດຕາມ',
  'nav.opdObservationList': 'ລາຍຊື່ຄົນເຈັບນອນ OPD',
  'nav.patientList': 'ລາຍຊື່ຄົນເຈັບ',
  'nav.ipdGroup': 'ຄົນເຈັບໃນ (IPD)',
  'nav.ipdDashboardShort': 'Dashboard',
  'nav.ipdAdmission': 'ຮັບເຂົ້ານອນ',
  'nav.bedManagement': 'ຈັດການຕຽງ',
  'nav.ipdInpatients': 'ລາຍຊື່ IPD',
  'nav.ipdDischarge': 'ຈຳໜ່າຍອອກ',
  'obs.title': 'ຄົນເຈັບນອນຕິດຕາມ OPD',
  'obs.subtitle': 'ຄົນເຈັບນອນຕິດຕາມໄລຍະສັ້ນໃນ OPD ໂດຍບໍ່ນັບເປັນ IPD',
  'obs.opdToday': 'OPD ມື້ນີ້',
  'obs.observationPatients': 'ກຳລັງຕິດຕາມ',
  'obs.listSubtitle': 'ລາຍຊື່ຄົນເຈັບທີ່ນອນຕິດຕາມໃນ OPD ແຍກຈາກ IPD',
  'obs.activeIpd': 'IPD Active',
  'obs.bedOccupancy': 'ອັດຕາຄອງຕຽງ',
  'obs.admissionsToday': 'ຮັບນອນມື້ນີ້',
  'obs.dischargesToday': 'ອອກໂຮງໝໍມື້ນີ້',
  'obs.observationNo': 'ເລກ Observation',
  'obs.startTime': 'ເວລາເລີ່ມ',
  'obs.currentDuration': 'ໄລຍະເວລາ',
  'obs.openObservation': 'ເປີດ Observation',
  'obs.convertToIpd': 'ປ່ຽນເປັນ IPD',
  'obs.discharge': 'ຈຳໜ່າຍ',
  'obs.addVital': 'ສັນຍານຊີບ',
  'obs.doctorNote': 'ບັນທຶກແພດ',
  'obs.nursingNote': 'ບັນທຶກພະຍາບານ',
  'obs.medication': 'ຢາ',
  'obs.procedure': 'ຫັດຖະການ',
  'obs.startObservation': 'Observation',
  'obs.assignBed': 'ມອບຕຽງ OPD ສັງເກດ',
  'obs.bedOptional': 'ຍັງບໍ່ມອບຕຽງ (ນັ່ງລໍ)',
  'obs.noObsWardHint': 'ຍັງບໍ່ມີຫວອດປະເພດ "OPD_Observation". ໄປ ຕັ້ງຄ່າ → ຕັ້ງຄ່າ IPD → ເພີ່ມຫວອດ ແລ້ວເລືອກ Type = "OPD_Observation".',
  'obs.bedBoardTitle': 'ຈັດການຕຽງ OPD ຕິດຕາມ',
  'obs.bedBoardSubtitle': 'ຫວອດປະເພດ OPD_Observation · ມອບຕຽງ ແລະ ດູການໃຊ້ງານ',
  'obs.noBedAssigned': 'ບໍ່ໄດ້ມອບຕຽງ',
  'obs.sixHourAlert': 'Observation ເກີນ 6 ຊົ່ວໂມງ. ກະລຸນາພິຈາລະນາຮັບນອນ IPD.',
  'obs.noData': 'ບໍ່ມີລາຍການ Observation',
  'obs.createTitle': 'ສ້າງ OPD Follow-up / Observation',
  'obs.selectVisitForObservation': 'ເລືອກຄົນເຈັບຈາກ OPD queue',
  'obs.noOpdCandidates': 'ບໍ່ມີຄົນເຈັບ OPD ທີ່ສາມາດສ້າງ Observation ໄດ້',
  'obs.saved': 'ບັນທຶກ Observation ແລ້ວ',
  'obs.converted': 'ສ້າງ IPD admission ແລ້ວ. ກະລຸນາຈັດຕຽງຕໍ່.',
  'obs.discharged': 'ຈຳໜ່າຍຈາກ Observation ແລ້ວ'
});

Object.assign(window.appTranslations.en, {
  'nav.patientManagement': 'Patient Management',
  'nav.opdGroup': 'Outpatients (OPD)',
  'nav.opdQueue': 'OPD Queue',
  'nav.opdConsultation': 'Patient Consultation',
  'nav.opdObservation': 'OPD Follow-up',
  'nav.opdObservationManagement': 'OPD Observation Patients',
  'nav.opdObservationBeds': 'OPD Observation Bed Board',
  'nav.opdObservationList': 'OPD Observation Patient List',
  'nav.patientList': 'Patient List',
  'nav.ipdGroup': 'Inpatients (IPD)',
  'nav.ipdDashboardShort': 'Dashboard',
  'nav.ipdAdmission': 'Admission',
  'nav.bedManagement': 'Bed Management',
  'nav.ipdInpatients': 'IPD List',
  'nav.ipdDischarge': 'Discharge',
  'obs.title': 'OPD Observation Patients',
  'obs.subtitle': 'Short-stay OPD observation patients, not counted as IPD',
  'obs.opdToday': 'OPD Today',
  'obs.observationPatients': 'Observation Patients',
  'obs.listSubtitle': 'OPD observation patient list, separated from IPD',
  'obs.activeIpd': 'Active IPD',
  'obs.bedOccupancy': 'Bed Occupancy',
  'obs.admissionsToday': 'Admissions Today',
  'obs.dischargesToday': 'Discharges Today',
  'obs.observationNo': 'Observation No',
  'obs.startTime': 'Start Time',
  'obs.currentDuration': 'Current Duration',
  'obs.openObservation': 'Open Observation',
  'obs.convertToIpd': 'Convert to IPD',
  'obs.discharge': 'Discharge',
  'obs.addVital': 'Vital Sign',
  'obs.doctorNote': 'Doctor Note',
  'obs.nursingNote': 'Nursing Note',
  'obs.medication': 'Medication',
  'obs.procedure': 'Procedure',
  'obs.selectDoctors': 'Select doctors',
  'obs.selectNurses': 'Select nurses',
  'obs.multiSelectHint': 'Use Ctrl or Shift to select multiple people',
  'obs.selectProviderRequired': 'Please select at least one provider',
  'obs.startObservation': 'Observation',
  'obs.assignBed': 'Assign OPD Observation Bed',
  'obs.bedOptional': 'No bed yet (waiting area)',
  'obs.noObsWardHint': 'No ward with Type = "OPD_Observation" exists yet. Go to Settings → IPD Config → add a ward and set Type = "OPD_Observation".',
  'obs.bedBoardTitle': 'OPD Observation Bed Management',
  'obs.bedBoardSubtitle': 'Wards of type OPD_Observation · assign beds and view utilization',
  'obs.noBedAssigned': 'No bed assigned',
  'obs.sixHourAlert': 'Observation exceeds 6 hours. Consider IPD Admission.',
  'obs.noData': 'No observation records',
  'obs.createTitle': 'Create OPD Follow-up / Observation',
  'obs.selectVisitForObservation': 'Select patient from OPD queue',
  'obs.noOpdCandidates': 'No OPD queue patient available for Observation',
  'obs.saved': 'Observation saved',
  'obs.converted': 'IPD admission has been created. Please assign a bed next.',
  'obs.discharged': 'Observation discharged'
});

Object.assign(window.appTranslations.en, {
  'datatable.search': 'Search:',
  'datatable.lengthMenu': 'Show _MENU_',
  'datatable.info': 'Showing _START_ to _END_ of _TOTAL_ entries',
  'datatable.infoEmpty': 'Showing 0 to 0 of 0 entries',
  'datatable.infoFiltered': '(filtered from _MAX_ total entries)',
  'datatable.zeroRecords': 'No matching records found',
  'datatable.emptyTable': 'No data available',
  'datatable.loadingRecords': 'Loading...',
  'datatable.previous': 'Previous',
  'datatable.next': 'Next',
  'patients.title': 'Patient Registration',
  'patients.subtitle': 'All patient records - search, add, and edit',
  'patients.uploadExcel': 'Upload Excel',
  'patients.scanQr': 'Scan QR Card',
  'patients.newPatient': 'New Patient Registration',
  'patients.date': 'Date',
  'patients.time': 'Time',
  'patients.fullName': 'Full Name',
  'patients.gender': 'Gender',
  'patients.age': 'Age',
  'patients.phone': 'Phone',
  'patients.address': 'Address',
  'patients.allergy': 'Allergy',
  'patients.noPatientData': 'No patient records yet',
  'patients.loading': 'Loading...',
  'patients.loadError': 'Unable to load patient data',
  'patients.view': 'View',
  'patients.viewDetails': 'View details',
  'patients.timeline': 'Timeline',
  'patients.edit': 'Edit',
  'patients.printQr': 'Print QR card',
  'patients.delete': 'Delete',
  'patients.yearUnit': 'years',
  'patients.fromDate': 'From date',
  'patients.toDate': 'To date'
});

Object.assign(window.appTranslations.lo, {
  'datatable.search': 'ຄົ້ນຫາ:',
  'datatable.lengthMenu': 'ສະແດງ _MENU_',
  'datatable.info': 'ສະແດງ _START_ ຫາ _END_ ຈາກ _TOTAL_ ລາຍການ',
  'datatable.infoEmpty': 'ສະແດງ 0 ຫາ 0 ຈາກ 0 ລາຍການ',
  'datatable.infoFiltered': '(ກັ່ນຕອງຈາກ _MAX_ ລາຍການທັງໝົດ)',
  'datatable.zeroRecords': 'ບໍ່ພົບຂໍ້ມູນທີ່ກົງກັນ',
  'datatable.emptyTable': 'ບໍ່ມີຂໍ້ມູນ',
  'datatable.loadingRecords': 'ກຳລັງໂຫຼດ...',
  'datatable.previous': 'ກ່ອນໜ້າ',
  'datatable.next': 'ຕໍ່ໄປ',
  'patients.title': 'ລົງທະບຽນຄົນເຈັບ (Registration)',
  'patients.subtitle': 'ຂໍ້ມູນຄົນເຈັບທັງໝົດ - ຄົ້ນຫາ, ເພີ່ມ, ແກ້ໄຂ',
  'patients.uploadExcel': 'ອັບໂຫຼດ Excel',
  'patients.scanQr': 'ສະແກນບັດ QR',
  'patients.newPatient': 'ລົງທະບຽນຄົນເຈັບໃໝ່',
  'patients.date': 'ວັນທີ',
  'patients.time': 'ເວລາ',
  'patients.fullName': 'ຊື່ ແລະ ນາມສະກຸນ',
  'patients.gender': 'ເພດ',
  'patients.age': 'ອາຍຸ',
  'patients.phone': 'ເບີໂທ',
  'patients.address': 'ທີ່ຢູ່',
  'patients.allergy': 'ອາການແພ້',
  'patients.noPatientData': 'ຍັງບໍ່ມີຂໍ້ມູນຄົນເຈັບ',
  'patients.loading': 'ກຳລັງໂຫຼດ...',
  'patients.loadError': 'ເກີດຂໍ້ຜິດພາດໃນການດຶງຂໍ້ມູນ',
  'patients.view': 'ເບິ່ງ',
  'patients.viewDetails': 'ເບິ່ງລາຍລະອຽດ',
  'patients.timeline': 'ປະຫວັດ',
  'patients.edit': 'ແກ້ໄຂ',
  'patients.printQr': 'ພິມບັດ QR',
  'patients.delete': 'ລຶບ',
  'patients.yearUnit': 'ປີ',
  'patients.fromDate': 'ຈາກວັນທີ',
  'patients.toDate': 'ຫາວັນທີ'
});

window.getAppLanguage = function () {
  return localStorage.getItem('hisLanguage') || 'lo';
};

window.t = function (key) {
  const lang = window.getAppLanguage();
  return window.appTranslations?.[lang]?.[key] || window.appTranslations?.en?.[key] || (key.startsWith('option.') ? key.slice(7) : key);
};

window.getDataTableLanguage = function (overrides = {}) {
  return {
    search: window.t('datatable.search'),
    lengthMenu: window.t('datatable.lengthMenu'),
    info: window.t('datatable.info'),
    infoEmpty: window.t('datatable.infoEmpty'),
    infoFiltered: window.t('datatable.infoFiltered'),
    zeroRecords: window.t('datatable.zeroRecords'),
    emptyTable: window.t('datatable.emptyTable'),
    loadingRecords: window.t('datatable.loadingRecords'),
    paginate: {
      previous: window.t('datatable.previous'),
      next: window.t('datatable.next')
    },
    ...overrides
  };
};

window.staticTranslationPairs = [
  ['ລາຍງານ', 'Reports'],
  ['ປະຫວັດການກວດ', 'Visit History'],
  ['ຄົນເຈັບ', 'Patients'],
  ['ຊັກປະຫວັດ', 'Triage'],
  ['ຫ້ອງກວດ', 'OPD'],
  ['ວັກຊີນ', 'Vaccines'],
  ['ນັດໝາຍ', 'Appointments'],
  ['ຕັ້ງຄ່າ', 'Settings'],
  ['ຕັ້ງຄ່າບໍລິການ', 'Service Settings'],
  ['ລາຍການຢາ', 'Drug List'],
  ['ລາຍການແລັບ', 'Lab List'],
  ['ຕັ້ງຄ່າວັກຊີນ', 'Vaccine Settings'],
  ['ເມືອງ-ແຂວງ', 'Districts / Provinces'],
  ['ອົງກອນ/ປະກັນໄພ', 'Organizations / Insurance'],
  ['ຈັດການຜູ້ໃຊ້', 'User Management'],
  ['ຕັ້ງຄ່າລະບົບ', 'System Settings'],
  ['ບັນທຶກກາລະທຳ', 'Activity Log'],
  ['ສຳຮອງຂໍ້ມູນ', 'Backup'],
  ['ລາວ', 'Lao'],
  ['ບໍ່ມີການແຈ້ງເຕືອນ', 'No notifications'],
  ['ເບິ່ງການນັດໝາຍທັງໝົດ', 'View all appointments'],
  ['ເຂົ້າສູ່ລະບົບໃນຖານະ', 'Signed in as'],
  ['ອອກຈາກລະບົບ', 'Log out'],
  ['ບັນທຶກ', 'Save'],
  ['ຍົກເລີກ', 'Cancel'],
  ['ປິດ', 'Close'],
  ['ປິດໜ້າຕ່າງ', 'Close window'],
  ['ຄົ້ນຫາ', 'Search'],
  ['ຄົ້ນຫາຂໍ້ມູນ...', 'Search data...'],
  ['ຄົ້ນຫາລາຍການ...', 'Search items...'],
  ['🔍 ຄົ້ນຫາ ຊື່, LXH...', '🔍 Search name, LXH...'],
  ['ຕົວຢ່າງ: ORG001', 'Example: ORG001'],
  ['ເພີ່ມ', 'Add'],
  ['ເພີ່ມໃໝ່', 'Add new'],
  ['ແກ້ໄຂ', 'Edit'],
  ['ລຶບ', 'Delete'],
  ['ເບິ່ງ', 'View'],
  ['ເບິ່ງລາຍລະອຽດ', 'View details'],
  ['ເບິ່ງ EMR', 'View EMR'],
  ['ເບິ່ງຜົນ', 'View results'],
  ['ພິມ', 'Print'],
  ['ພິມບັດ QR', 'Print QR card'],
  ['ພິມໃບ OPD', 'Print OPD form'],
  ['ຈັດການ', 'Action'],
  ['ສະຖານະ', 'Status'],
  ['ວັນທີ', 'Date'],
  ['ເວລາ', 'Time'],
  ['ອາຍຸ', 'Age'],
  ['ເພດ', 'Gender'],
  ['ເບີໂທ', 'Phone'],
  ['ທີ່ຢູ່', 'Address'],
  ['ຊື່ ແລະ ນາມສະກຸນ', 'Full Name'],
  ['ຊື່ ແລະ ນາມສະກຸນຄົນເຈັບ', 'Patient Full Name'],
  ['ຈຳນວນຄັ້ງມາກວດ', 'Visit Count'],
  ['ພະແນກຫຼ້າສຸດ', 'Latest Department'],
  ['ປະຫວັດເກົ່າ', 'History'],
  ['ວັນທີ ແລະ ເວລາ', 'Date and Time'],
  ['LXH ຄົນເຈັບ', 'Patient LXH'],
  ['ອາການແພ້', 'Allergy'],
  ['ລຶບລາຍການທີ່ເລືອກ', 'Delete selected'],
  ['ອັບໂຫຼດ Excel', 'Upload Excel'],
  ['ດາວໂຫຼດ Excel', 'Download Excel'],
  ['ດາວໂຫຼດ Template', 'Download Template'],
  ['Export Excel', 'Export Excel'],
  ['ສະແກນບັດ QR', 'Scan QR Card'],
  ['ຊີ້ກ້ອງໄປທີ່ QR Code ຂອງຄົນເຈັບ', 'Point the camera at the patient QR code'],
  ['ປິດ / ຍົກເລີກ', 'Close / Cancel'],
  ['ກຳລັງໂຫຼດ...', 'Loading...'],
  ['ກຳລັງໂຫຼດຂໍ້ມູນ...', 'Loading data...'],
  ['ກຳລັງໂຫຼດປະຫວັດ...', 'Loading history...'],
  ['ບໍ່ມີຂໍ້ມູນ', 'No data available'],
  ['ຍັງບໍ່ມີຂໍ້ມູນ', 'No data yet'],
  ['ບໍ່ມີຄິວ Triage', 'No triage queue'],
  ['ບໍ່ມີຄິວລໍຖ້າ', 'No waiting queue'],
  ['ບໍ່ມີປະຫວັດການກວດໃນຊ່ວງວັນທີນີ້', 'No visit history in this date range'],
  ['ບໍ່ມີຂໍ້ມູນໃນຊ່ວງວັນທີນີ້', 'No data in this date range'],
  ['ມື້ນີ້', 'Today'],
  ['ອາທິດນີ້', 'This week'],
  ['ເດືອນນີ້', 'This month'],
  ['ປີນີ້', 'This year'],
  ['ຈາກ', 'From'],
  ['ຫາ', 'To'],
  ['ກ່ອນໜ້າ', 'Previous'],
  ['ຕໍ່ໄປ', 'Next'],
  ['ອັບເດດ: -', 'Updated: -'],
  ['ສະຫຼຸບຈຳນວນຄັ້ງທີ່ຄົນເຈັບເຂົ້າມາກວດ ແລະ ເບິ່ງປະຫວັດເກົ່າໄດ້ທຸກຄັ້ງ', 'Summarize patient visit counts and view previous visit history'],
  ['ຈຸດຊັກປະຫວັດ (Triage)', 'Triage Station'],
  ['ວັດ Vital Signs ແລະ ສ່ົງຄົນເຈັບເຂົ້າຫ້ອງກວດ', 'Record vital signs and send patients to OPD'],
  ['ຫ້ອງກວດແພດ (OPD)', 'Outpatient Department (OPD)'],
  ['ຄິວລໍຖ້າການກວດ', 'Waiting queue'],
  ['ປະຫວັດການສັກວັກຊີນ', 'Vaccination History'],
  ['ບັນທຶກ ແລະ ຕິດຕາມການສັກວັກຊີນຄົນເຈັບ', 'Record and track patient vaccinations'],
  ['ບັນທຶກການສັກວັກຊີນ', 'Record Vaccination'],
  ['ຕັ້ງຄ່າຂໍ້ມູນວັກຊີນ (Vaccine Master)', 'Vaccine Master Settings'],
  ['ລາຍຊື່ວັກຊີນ, ໂດສ ແລະ ໄລຍະ Schedule', 'Vaccine names, doses, and schedules'],
  ['ເພີ່ມລາຍຊື່ວັກຊີນ', 'Add Vaccine'],
  ['ຊື່ວັກຊີນ (Vaccine Name)', 'Vaccine Name'],
  ['ພະຍາດທີ່ປ້ອງກັນ', 'Disease Prevented'],
  ['ຈຳນວນໂດສທັງໝົດ', 'Total Doses'],
  ['ໄລຍະຫ່າງແຕ່ລະເຂັມ', 'Dose Interval'],
  ['ວັນທີສັກ', 'Vaccination Date'],
  ['ຊື່ວັກຊີນ', 'Vaccine Name'],
  ['ໂດສ (Dose)', 'Dose'],
  ['ຜູ້ສັກ', 'Administered By'],
  ['ນັດໝາຍຕໍ່ໄປ', 'Next Appointment'],
  ['ຂໍ້ມູນຢາ', 'Drug Information'],
  ['ເພີ່ມລາຍການຢາ', 'Add Drug'],
  ['ຊື່ຢາ', 'Drug Name'],
  ['ປະເພດຢາ', 'Drug Type'],
  ['ຫົວໜ່ວຍ', 'Unit'],
  ['ວິທີໃຊ້', 'Usage'],
  ['ຂໍ້ມູນ Lab', 'Lab Information'],
  ['ເພີ່ມລາຍການ Lab', 'Add Lab Item'],
  ['ຊື່ລາຍການ', 'Item Name'],
  ['ລາຄາ', 'Price'],
  ['ບໍລິການ', 'Services'],
  ['ເພີ່ມບໍລິການໃໝ່', 'Add New Service'],
  ['Services List (ຊື່ບໍລິການ)', 'Services List'],
  ['Mapped Specialist (ແພດສະເພາະທາງ)', 'Mapped Specialist'],
  ['Revenue Group (ໝວດລາຍຮັບ)', 'Revenue Group'],
  ['ລາຍຊື່ເມືອງ-ແຂວງ', 'District / Province List'],
  ['ເພີ່ມເມືອງ-ແຂວງ', 'Add District / Province'],
  ['ເມືອງ', 'District'],
  ['ແຂວງ', 'Province'],
  ['ອົງກອນ / ປະກັນໄພ', 'Organizations / Insurance'],
  ['ຈັດການອົງກອນ / ປະກັນໄພ', 'Manage Organizations / Insurance'],
  ['ເພີ່ມອົງກອນ', 'Add Organization'],
  ['ຊື່ຜູ້ຕິດຕໍ່', 'Contact Name'],
  ['ລູກຄ້າອົງກອນ', 'Organization Customers'],
  ['ອົງກອນ, ບໍລິສັດ ແລະ ປະກັນໄພ', 'Organizations, companies, and insurance'],
  ['ລະຫັດອົງກອນ', 'Organization Code'],
  ['ຊື່ອົງກອນ', 'Organization Name'],
  ['ຊື່ອົງກອນ (Org Name)', 'Organization Name'],
  ['ສ່ວນຫຼຸດ (Discount)', 'Discount'],
  ['ຈັດການຜູ້ໃຊ້ລະບົບ', 'User Management'],
  ['ສ້າງ ແລະ ຈັດການ Role ຜູ້ໃຊ້ລະບົບ', 'Create and manage user roles'],
  ['ເພີ່ມຜູ້ໃຊ້', 'Add User'],
  ['ເພີ່ມຜູ້ໃຊ້ລະບົບ', 'Add System User'],
  ['ຊື່ພະນັກງານ', 'Employee Name'],
  ['ອີເມວ', 'Email'],
  ['ອີເມວ (Email)', 'Email'],
  ['ລະຫັດຜ່ານ', 'Password'],
  ['ຖ້າແກ້ໄຂ ປ່ອຍວ່າງໄດ້', 'leave blank when editing'],
  ['ສິດ (Role)', 'Role'],
  ['ສິດທັງໝົດ', 'All permissions'],
  ['ແພດ', 'Doctor'],
  ['ພະຍາບານ', 'Nurse'],
  ['ເຈົ້າໜ້າທີ່ຢາ', 'Pharmacy staff'],
  ['ຝ່າຍຕ້ອນຮັບ', 'Reception'],
  ['ຝ່າຍການເງິນ', 'Cashier'],
  ['ພະນັກງານທົ່ວໄປ', 'Staff'],
  ['ສົ່ງຕໍ່ Triage', 'Send to Triage'],
  ['ແກ້ໄຂ Vital Signs', 'Edit Vital Signs'],
  ['ລຶບຄິວ', 'Delete queue'],
  ['ເອີ້ນຄິວ', 'Call queue'],
  ['ຂຽນ EMR', 'Write EMR'],
  ['ລຶບການກວດ', 'Delete visit'],
  ['ສັ່ງກວດ', 'Order test'],
  ['ແກ້ໄຂຜົນ', 'Edit result'],
  ['ລຶບຜົນ', 'Delete result'],
  ['ສ້າງນັດ', 'Create appointment'],
  ['ຍົກເລີກນັດ', 'Cancel appointment'],
  ['ກຳນົດສິດປຸ່ມ:', 'Button permissions:'],
  ['ເລືອກປຸ່ມທີ່ຕ້ອງການອະນຸຍາດໃຫ້ຜູ້ໃຊ້ນີ້ສາມາດກົດໄດ້', 'Select which buttons this user is allowed to use'],
  ['ເລືອກທັງໝົດ', 'Select all'],
  ['ລ້າງທັງໝົດ', 'Clear all'],
  ['ຄ່າເລີ່ມຕົ້ນຕາມ Role', 'Role defaults'],
  ['ບັນທຶກສິດ', 'Save permissions'],
  ['ຊື່ໂຮງໝໍ', 'Hospital Name'],
  ['ຈື່ຈຳໂມດູນຫຼ້າສຸດຫຼັງຈາກ Login', 'Remember last module after login'],
  ['ຈັດການຂໍ້ມູນ Master', 'Master Data Management'],
  ['ຈັດການໝວດຂໍ້ມູນພື້ນຖານທີ່ໃຊ້ໃນລະບົບ', 'Manage base master data used in the system'],
  ['ກຸ່ມຍ່ອຍ', 'Group'],
  ['ເລືອກຫົວຂໍ້ທີ່ຕ້ອງການຈັດການ', 'Choose a category to manage'],
  ['ເລືອກໝວດໝູ່', 'Select category'],
  ['-- ເລືອກໝວດໝູ່ --', '-- Select category --'],
  ['-- ເລືອກ Role --', '-- Select Role --'],
  ['-- ກະລຸນາເລືອກ --', '-- Please select --'],
  ['-- ເລືອກແພດ --', '-- Select doctor --'],
  ['-- ເລືອກຢາ --', '-- Select drug --'],
  ['-- ໜ່ວຍ --', '-- Unit --'],
  ['-- ວິທີໃຊ້ --', '-- Usage --'],
  ['-- ເລືອກຫ້ອງກວດ (ຖ້າມີ) --', '-- Select OPD room (optional) --'],
  ['-- ຄົ້ນຫາ ແລະ ເລືອກຄົນເຈັບ --', '-- Search and select patient --'],
  ['-- ຄົ້ນຫາ ແລະ ເລືອກອົງກອນ --', '-- Search and select organization --'],
  ['ຫົວຂໍ້ທີ່ເລືອກ', 'Selected category'],
  ['ເລືອກໝວດຂໍ້ມູນ', 'Select data category'],
  ['ເພີ່ມຂໍ້ມູນໃໝ່', 'Add new data'],
  ['ລາຍການ', 'items'],
  ['ນັດໝາຍໃໝ່', 'New Appointment'],
  ['ປະເພດລູກຄ້າ', 'Customer Type'],
  ['ຄົນເຈັບ (Patient)', 'Patient'],
  ['ອົງກອນ (Organization)', 'Organization'],
  ['ວັນທີນັດ', 'Appointment Date'],
  ['ເວລານັດ', 'Appointment Time'],
  ['ປະເພດການນັດ', 'Appointment Type'],
  ['ທົ່ວໄປ', 'General'],
  ['ກວດສຸຂະພາບ', 'Checkup'],
  ['ຕິດຕາມ', 'Follow-up'],
  ['ແພດຜູ້ຮັບຜິດຊອບ', 'Responsible Doctor'],
  ['ເຫດຜົນ / ລາຍລະອຽດ', 'Reason / Details'],
  ['ບັນທຶກການນັດໝາຍ', 'Save Appointment'],
  ['ຫ້ອງກວດແພດ (EMR)', 'Medical Examination (EMR)'],
  ['ປະຫວັດການແພ້:', 'Allergy history:'],
  ['ບໍ່ມີ', 'None'],
  ['ຂໍ້ມູນການກວດ', 'Examination Information'],
  ['ສະຖານທີ່ (Site)', 'Site'],
  ['ປະເພດ (Type)', 'Type'],
  ['ບໍລິການທີ່ໃຊ້ (Services)', 'Services Used'],
  ['ແພດສະເພາະທາງ (Specialist)', 'Specialist'],
  ['ໝວດລາຍຮັບ (Revenue Group)', 'Revenue Group'],
  ['ຜົນກວດຮ່າງກາຍ (Physical Exam)', 'Physical Exam'],
  ['ການວິນິດໄສ (Diagnosis / Dx)', 'Diagnosis / Dx'],
  ['ຈຳເປັນຕ້ອງໃສ່ເມື່ອຕ້ອງການປິດຈົບການກວດ', 'required before closing the visit'],
  ['ຄຳແນະນຳ (Advice)', 'Advice'],
  ['ນັດໝາຍຕໍ່ໄປ (Follow-up)', 'Follow-up'],
  ['ແພດຜູ້ກວດ (Doctor)', 'Doctor'],
  ['ສະຖານະປິດຈົບ (Discharge Status)', 'Discharge Status'],
  ['ລໍຖ້າຜົນແລັບ', 'Waiting Lab'],
  ['ພັກການກວດໄວ້ກ່ອນ', 'hold visit until lab result'],
  ['ຮັບຢາກັບບ້ານ', 'Take-home medication'],
  ['ໄປຮັບຢາ', 'go to pharmacy'],
  ['ສົ່ງຕໍ່', 'Transfer'],
  ['ກວດສຳເລັດ / ກັບບ້ານ', 'Completed / Go home'],
  ['ບໍ່ມີຢາ', 'no medication'],
  ['ລາຍການ Lab', 'Lab Items'],
  ['ເພີ່ມ Lab', 'Add Lab'],
  ['ລາຍການຢາ (Rx)', 'Medication List (Rx)'],
  ['ເພີ່ມຢາ', 'Add Drug'],
  ['ບັນທຶກຜົນການກວດ', 'Save Examination Result'],
  ['ເລືອກລາຍການ Lab', 'Select Lab Items'],
  ['ເລືອກລາຍການກວດຈາກ LIS ໂດຍບໍ່ສະແດງລາຄາ', 'Select lab items from LIS without showing prices'],
  ['ສະຫຼຸບລາຍການກວດທີ່ເລືອກໄວ້', 'Selected lab item summary'],
  ['ຍັງບໍ່ມີລາຍການກວດ', 'No lab items selected'],
  ['ຢືນຍັນເລືອກ', 'Confirm selection'],
  ['ຈຳນວນ (Qty)', 'Quantity (Qty)'],
  ['ໜ່ວຍ (Unit)', 'Unit'],
  ['ໃຊ້ຄັ້ງລະ', 'Dose per use'],
  ['ວິທີໃຊ້ (Usage)', 'Usage'],
  ['ລາຍລະອຽດການຮັບບໍລິການ', 'Service Details']
];

window.buildStaticTranslationMaps = function () {
  if (window.staticTranslationMaps) return window.staticTranslationMaps;
  const loToEn = {};
  const enToLo = {};
  (window.staticTranslationPairs || []).forEach(([lo, en]) => {
    loToEn[lo] = en;
    enToLo[en] = lo;
  });
  window.staticTranslationMaps = { loToEn, enToLo };
  return window.staticTranslationMaps;
};

window.translateStaticPhrase = function (text, targetLang = window.getAppLanguage()) {
  if (typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  const { loToEn, enToLo } = window.buildStaticTranslationMaps();
  const map = targetLang === 'en' ? loToEn : enToLo;
  let translated = map[trimmed];
  if (!translated && targetLang === 'en') {
    translated = trimmed
      .replace(/^(\d+)\s*ລາຍການ$/, '$1 items')
      .replace(/^ອັບເດດ:\s*(.*)$/, 'Updated: $1')
      .replace(/^ຈາກວັນທີ$/, 'From date')
      .replace(/^ຫາວັນທີ$/, 'To date');
    if (translated === trimmed) translated = '';
  } else if (!translated && targetLang === 'lo') {
    translated = trimmed
      .replace(/^(\d+)\s*items$/, '$1 ລາຍການ')
      .replace(/^Updated:\s*(.*)$/, 'ອັບເດດ: $1')
      .replace(/^From date$/, 'ຈາກວັນທີ')
      .replace(/^To date$/, 'ຫາວັນທີ');
    if (translated === trimmed) translated = '';
  }
  if (!translated && targetLang === 'en' && /[ກ-ໝ]/.test(trimmed)) {
    translated = trimmed;
    [...(window.staticTranslationPairs || [])]
      .sort((a, b) => b[0].length - a[0].length)
      .forEach(([lo, en]) => {
        if (lo && translated.includes(lo)) translated = translated.split(lo).join(en);
      });
    translated = translated
      .replace(/\([^)]*[ກ-ໝ][^)]*\)/g, '')
      .replace(/\((\s*)\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (translated === trimmed || /[ກ-ໝ]/.test(translated)) translated = '';
  }
  if (!translated || translated === trimmed) return text;
  const leading = text.match(/^\s*/)?.[0] || '';
  const trailing = text.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
};

window.applyStaticLanguage = function (root = document) {
  const targetLang = window.getAppLanguage();
  const container = root && root.nodeType ? root : document;
  const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

  const translateAttributes = (el) => {
    ['placeholder', 'title', 'aria-label'].forEach(attr => {
      if (el.hasAttribute?.(attr)) {
        el.setAttribute(attr, window.translateStaticPhrase(el.getAttribute(attr), targetLang));
      }
    });
  };

  if (container.nodeType === Node.ELEMENT_NODE) translateAttributes(container);
  const elements = container.querySelectorAll ? container.querySelectorAll('[placeholder], [title], [aria-label]') : [];
  elements.forEach(translateAttributes);

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || skipTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-i18n], [data-no-auto-i18n]')) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    node.nodeValue = window.translateStaticPhrase(node.nodeValue, targetLang);
  });
};

window.localizeDataTableOptions = function (options = {}) {
  if (!options || typeof options !== 'object') return options;
  const next = { ...options };
  const currentLanguage = options.language && typeof options.language === 'object' ? options.language : {};
  const translatedOverrides = { ...currentLanguage };
  ['search', 'lengthMenu', 'info', 'infoEmpty', 'infoFiltered', 'zeroRecords', 'emptyTable', 'loadingRecords'].forEach(key => {
    if (translatedOverrides[key]) translatedOverrides[key] = window.translateStaticPhrase(translatedOverrides[key]);
  });
  if (translatedOverrides.paginate) {
    translatedOverrides.paginate = {
      ...translatedOverrides.paginate,
      previous: translatedOverrides.paginate.previous ? window.translateStaticPhrase(translatedOverrides.paginate.previous) : translatedOverrides.paginate.previous,
      next: translatedOverrides.paginate.next ? window.translateStaticPhrase(translatedOverrides.paginate.next) : translatedOverrides.paginate.next
    };
  }
  next.language = window.getDataTableLanguage(translatedOverrides);
  return next;
};

window.installLocalizedDataTable = function () {
  if (!$.fn.DataTable || window.__localizedDataTableInstalled) return;
  const originalDataTable = $.fn.DataTable;
  const localizedDataTable = function (...args) {
    if (args[0] && typeof args[0] === 'object') args[0] = window.localizeDataTableOptions(args[0]);
    return originalDataTable.apply(this, args);
  };
  Object.keys(originalDataTable).forEach(key => { localizedDataTable[key] = originalDataTable[key]; });
  ['isDataTable', 'tables', 'version', 'settings', 'ext'].forEach(key => {
    if (originalDataTable[key] !== undefined) localizedDataTable[key] = originalDataTable[key];
  });
  $.fn.DataTable = localizedDataTable;
  window.__localizedDataTableInstalled = true;
};

window.refreshCurrentViewLocalization = function () {
  const visibleViewId = $('[id^="view-"]:visible').first().attr('id');
  const visibleView = visibleViewId ? visibleViewId.replace(/^view-/, '') : '';
  if (!visibleView) return;

  if (visibleView.startsWith('ipd_')) {
    if (typeof window.refreshVisibleIpdLocalization === 'function') window.refreshVisibleIpdLocalization();
    return;
  }

  if (typeof window.loadView === 'function') {
    const route = window.parseProtectedRoute?.(window.location.pathname);
    if (route?.view === visibleView) window.loadView(route.routeKey || visibleView, { ...route, replace: true });
    else window.loadView(visibleView, { replace: true });
  }
};

window.ipdTranslateValue = function (value) {
  const key = `option.${value}`;
  const translated = window.t(key);
  return translated === key ? value : translated;
};

window.setAppLanguage = function (lang) {
  const nextLang = lang === 'en' ? 'en' : 'lo';
  localStorage.setItem('hisLanguage', nextLang);
  window.applyAppLanguage();
  window.refreshCurrentViewLocalization();
};

window.applyAppLanguage = function () {
  const lang = window.getAppLanguage();
  document.documentElement.lang = lang;
  $('#appLanguageSelect').val(lang);

  $('[data-i18n]').each(function () {
    const key = $(this).attr('data-i18n');
    $(this).text(window.t(key));
  });

  $('[data-i18n-placeholder]').each(function () {
    const key = $(this).attr('data-i18n-placeholder');
    $(this).attr('placeholder', window.t(key));
  });

  window.applyStaticLanguage(document);

  const navTextMap = {
    'nav-report': 'nav.report',
    'nav-visit_history': 'nav.visitHistory',
    'nav-patients': 'nav.patientList',
    'nav-triage': 'nav.triage',
    'nav-opd_queue': 'nav.opdQueue',
    'nav-opd_consultation': 'nav.opdConsultation',
    'nav-opd_observation': 'nav.opdObservationBeds',
    'nav-opd_observation_list': 'nav.opdObservationList',
    'nav-ipd_dashboard': 'nav.ipdDashboardShort',
    'nav-ipd_admission': 'nav.ipdAdmission',
    'nav-ipd_ward_bed': 'nav.bedManagement',
    'nav-ipd_inpatient_list': 'nav.ipdInpatients',
    'nav-ipd_discharge': 'nav.ipdDischarge',
    'nav-vaccines': 'nav.vaccines',
    'nav-appointments': 'nav.appointments'
  };
  Object.entries(navTextMap).forEach(([id, key]) => {
    $('#' + id).children('span').first().text(window.t(key));
  });
  $('.mnu-settings > .his-dropdown-toggle').children('span').first().text(window.t('nav.settings'));
};

window.refreshVisibleIpdLocalization = function () {
  const route = window.parseProtectedRoute?.(window.location.pathname);
  if (route?.view) window.applyHisRouteModeLabels?.(route);
  if ($('#view-ipd_ward_bed:visible').length && typeof window.applyIpdWardBedFilters === 'function') {
    window.applyIpdWardBedFilters();
  }
  if ($('#view-ipd_dashboard:visible').length && typeof window.renderIpdDashboard === 'function' && window.ipdWardBedState?.beds) {
    window.renderIpdDashboard();
  }
  if ($('#view-ipd_inpatient_list:visible').length && typeof window.renderIpdInpatientTable === 'function') {
    window.renderIpdInpatientTable('#ipdStandaloneInpatientTable');
  }
  if ($('#view-ipd_discharge:visible').length && typeof window.renderIpdDischargePage === 'function' && window.ipdWardBedState?.beds) {
    window.renderIpdDischargePage();
  }
  if ($('#view-ipd_chart:visible').length && typeof window.renderIpdChartPage === 'function' && window.ipdCurrentChartAdmissionId) {
    window.renderIpdChartPage(window.ipdCurrentChartAdmissionId);
  }
};

const APP_INTENDED_ROUTE_KEY = 'hisIntendedRoute';

window.HIS_NAV_ROUTES = {
  dashboard: { view: 'dashboard', navId: 'dashboard', path: '/dashboard' },
  report: { view: 'report', navId: 'report', path: '/report' },
  visit_history: { view: 'visit_history', navId: 'visit_history', path: '/visit_history' },
  triage: { view: 'triage', navId: 'triage', path: '/triage' },
  vaccines: { view: 'vaccines', navId: 'vaccines', path: '/vaccines' },
  appointments: { view: 'appointments', navId: 'appointments', path: '/appointments' },
  opd_queue: { view: 'opd', navId: 'opd_queue', path: '/opd/queue' },
  opd_consultation: { view: 'opd', navId: 'opd_consultation', path: '/opd/consultation' },
  opd_observation: { view: 'opd_observation', navId: 'opd_observation', path: '/opd/observation' },
  opd_observation_list: { view: 'opd_observation_list', navId: 'opd_observation_list', path: '/opd/observation/list' },
  patients: { view: 'patients', navId: 'patients', path: '/patients' },
  ipd_dashboard: { view: 'ipd_ward_bed', navId: 'ipd_dashboard', path: '/ipd/dashboard', mode: 'ipd_dashboard' },
  ipd_admission: { view: 'ipd_ward_bed', navId: 'ipd_admission', path: '/ipd/admission', mode: 'ipd_admission' },
  ipd_ward_bed: { view: 'ipd_ward_bed', navId: 'ipd_ward_bed', path: '/ipd/bed-management', mode: 'ipd_bed_management' },
  ipd_inpatient_list: { view: 'ipd_inpatient_list', navId: 'ipd_inpatient_list', path: '/ipd/inpatients', mode: 'ipd_inpatients' },
  ipd_discharge: { view: 'ipd_inpatient_list', navId: 'ipd_discharge', path: '/ipd/discharge', mode: 'ipd_discharge' },
  ipd_config: { view: 'ipd_config', navId: 'ipd_config', path: '/ipd_config' },
  settings: { view: 'settings', navId: 'settings', path: '/settings' },
  orgs: { view: 'orgs', navId: 'orgs', path: '/orgs' },
  users: { view: 'users', navId: 'users', path: '/users' },
  services: { view: 'services', navId: 'services', path: '/services' },
  locations: { view: 'locations', navId: 'locations', path: '/locations' },
  drugs: { view: 'drugs', navId: 'drugs', path: '/drugs' },
  labs: { view: 'labs', navId: 'labs', path: '/labs' },
  vaccine_master: { view: 'vaccine_master', navId: 'vaccine_master', path: '/vaccine_master' },
  activity_log: { view: 'activity_log', navId: 'activity_log', path: '/activity_log' },
  backup: { view: 'backup', navId: 'backup', path: '/backup' },
  'public-queue': { view: 'public-queue', navId: 'public-queue', path: '/public-queue' }
};

window.HIS_PATH_ROUTES = {
  '/dashboard': 'dashboard',
  '/report': 'report',
  '/visit_history': 'visit_history',
  '/triage': 'triage',
  '/vaccines': 'vaccines',
  '/appointments': 'appointments',
  '/patients': 'patients',
  '/opd': 'opd_queue',
  '/opd/queue': 'opd_queue',
  '/opd/consultation': 'opd_consultation',
  '/opd/observation': 'opd_observation',
  '/opd/observation/list': 'opd_observation_list',
  '/opd_observation': 'opd_observation',
  '/opd_observation_list': 'opd_observation_list',
  '/ipd/dashboard': 'ipd_dashboard',
  '/ipd/admission': 'ipd_admission',
  '/ipd/bed-management': 'ipd_ward_bed',
  '/ipd/inpatients': 'ipd_inpatient_list',
  '/ipd/discharge': 'ipd_discharge',
  '/ipd_ward_bed': 'ipd_ward_bed',
  '/ipd_inpatient_list': 'ipd_inpatient_list',
  '/ipd_config': 'ipd_config',
  '/settings': 'settings',
  '/orgs': 'orgs',
  '/users': 'users',
  '/services': 'services',
  '/locations': 'locations',
  '/drugs': 'drugs',
  '/labs': 'labs',
  '/vaccine_master': 'vaccine_master',
  '/activity_log': 'activity_log',
  '/backup': 'backup',
  '/public-queue': 'public-queue'
};

window.HIS_VIEW_DEFAULT_ROUTE = {
  opd: 'opd_queue',
  opd_observation: 'opd_observation',
  opd_observation_list: 'opd_observation_list',
  patients: 'patients',
  ipd_ward_bed: 'ipd_ward_bed',
  ipd_inpatient_list: 'ipd_inpatient_list'
};

window.resolveHisRouteTarget = function (viewOrRoute, options = {}) {
  const requested = String(viewOrRoute || 'dashboard');
  const routeKey = window.HIS_NAV_ROUTES[requested]
    ? requested
    : (window.HIS_VIEW_DEFAULT_ROUTE[requested] || requested);
  const route = window.HIS_NAV_ROUTES[routeKey] || { view: requested, navId: requested, path: `/${requested}` };
  return {
    ...route,
    routeKey,
    view: options.view || route.view || requested,
    navId: options.navId || route.navId || routeKey,
    path: options.path || route.path || `/${route.view || requested}`,
    mode: options.mode || route.mode || null
  };
};

window.updateHisBrowserRoute = function (target, options = {}) {
  if (options.updateUrl === false || !target?.path || !window.history) return;
  const currentPath = window.location.pathname;
  const nextPath = target.path;
  const state = { view: target.view, routeKey: target.routeKey, mode: target.mode || null };
  if (target.view === 'ipd_chart') return;
  if (options.replace || currentPath === nextPath) window.history.replaceState(state, '', nextPath);
  else window.history.pushState(state, '', nextPath);
};

window.applyHisRouteModeLabels = function (target) {
  if (!target) return;
  if (target.view === 'ipd_ward_bed') {
    const key = target.mode === 'ipd_dashboard'
      ? 'nav.ipdDashboardShort'
      : (target.mode === 'ipd_admission' ? 'nav.ipdAdmission' : 'nav.bedManagement');
    $('#view-ipd_ward_bed [data-i18n="ipd.title"]').text(window.t(key));
  }
  if (target.view === 'ipd_inpatient_list') {
    const key = target.mode === 'ipd_discharge' ? 'nav.ipdDischarge' : 'nav.ipdInpatients';
    $('#view-ipd_inpatient_list [data-i18n="nav.inpatientList"]').text(window.t(key));
  }
};

window.parseProtectedRoute = function (pathname = window.location.pathname) {
  const ipdChartPathMatch = pathname.match(/^\/ipd\/chart\/([^/]+)\/?$/) || pathname.match(/^\/ipd\/admissions\/([^/]+)\/chart\/?$/);
  if (ipdChartPathMatch) {
    return { view: 'ipd_chart', admissionId: decodeURIComponent(ipdChartPathMatch[1]), path: `/ipd/chart/${encodeURIComponent(decodeURIComponent(ipdChartPathMatch[1]))}` };
  }
  const normalized = (`/${String(pathname || '').replace(/^\/+/, '')}`).replace(/\/+$/, '') || '/dashboard';
  const routeKey = window.HIS_PATH_ROUTES[normalized] || window.HIS_PATH_ROUTES[decodeURIComponent(normalized)];
  if (routeKey) {
    const target = window.resolveHisRouteTarget(routeKey);
    return {
      ...target,
      redirectPath: normalized !== target.path ? target.path : null
    };
  }
  return null;
};

window.captureProtectedRouteForLogin = function () {
  const route = window.parseProtectedRoute();
  if (!route) return null;
  localStorage.setItem(APP_INTENDED_ROUTE_KEY, JSON.stringify({ ...route, capturedAt: Date.now() }));
  return route;
};

window.consumeIntendedRoute = function () {
  const raw = localStorage.getItem(APP_INTENDED_ROUTE_KEY);
  localStorage.removeItem(APP_INTENDED_ROUTE_KEY);
  if (!raw) return null;
  try {
    const route = JSON.parse(raw);
    if (route?.capturedAt && Date.now() - route.capturedAt > 30 * 60 * 1000) return null;
    return route;
  } catch (e) {
    return null;
  }
};

window.clearIntendedRoute = function () {
  localStorage.removeItem(APP_INTENDED_ROUTE_KEY);
  window.ipdCurrentChartAdmissionId = null;
};

window.emrLabCategoryConfig = [
  {
    key: 'hematology',
    label: 'Hematology',
    columns: 2,
    matchers: [/cbc/i, /abo group/i, /\brh\b/i, /esr/i, /hb\s*typing/i, /\biron\b/i, /ferritin/i, /hba1c/i, /g6pd/i, /tibc/i, /folic acid/i, /blood smear/i, /\bpt\b/i, /\baptt\b/i, /\btt\b/i, /bt\s*\(ts\s*tc\)/i, /\binr\b/i, /blood sugar$/i],
    order: ['CBC 24P', 'ABO group', 'Rh', 'ESR/VS', 'Hb Typing', 'IRON', 'Ferritin', 'HbA1C', 'Blood sugar', 'G6PD', 'TIBC', 'Folic Acid', 'Blood smear', 'PT', 'APTT', 'TT', 'BT (Ts Tc)', 'INR']
  },
  {
    key: 'serology',
    label: 'Serology',
    columns: 2,
    matchers: [/anti-hav/i, /hbeag/i, /gonorrhea/i, /chlamydia|chamydia/i, /hbsag/i, /hbsab/i, /hiv/i, /vdrl/i, /h\.?pylori/i, /hcv/i, /crp/i, /tuberculosis|\btb\b/i, /rickettsia|rikettsia/i, /dengue/i, /typhoid/i, /influenza|infeuza|rsv|covid/i, /antigen/i, /igm/i, /igg/i],
    order: ['Anti-HAV', 'HBsAg', 'HBsAb', 'HCV', 'Rickettsia', 'HBeAg', 'HIV', 'VDRL', 'CRP', 'Dengue NS1', 'IgM, IgG', 'Gonorrhea rapid test', 'Chlamydia rapid test', 'H.Pylori', 'Tuberculosis (TB)', 'Typhoi IgG/IgM', 'Antigen Influenza, RSV, Covid-19']
  },
  {
    key: 'biochemistry',
    label: 'Biochemistry',
    columns: 2,
    matchers: [/blood sugar\/fbs/i, /\bfbs\b/i, /urea\/bun|ureabun/i, /\bbun\b/i, /creatinine/i, /cholesterol/i, /triglycer/i, /hdl/i, /ldl/i, /sgot|\bast\b/i, /sgpt|\balt\b/i, /protein/i, /albumin/i, /direct bilirubin/i, /total bilirubin|bilirubin total/i, /amylase/i, /uric acid/i, /calcium/i, /gamma|ggt/i, /alkaline phosphatase|alp phosphatase|\balp\b/i, /electrolyte/i, /bilirubin/i],
    order: ['Blood sugar/FBS', 'Urea/BUN', 'Creatinine', 'Cholesterol', 'Triglyceride', 'HDL-C', 'LDL-C', 'SGOT(AST)', 'SGPT(ALT)', 'Protein', 'Albumin', 'Direct Bilirubin', 'Total Bilirubin', 'Amylase', 'Uric Acid', 'Calcium', 'Gamma(GGT)', 'Alkaline phosphatase (ALP)', 'Electrolyte (Na,K,Cl)']
  },
  {
    key: 'tumor_markers',
    label: 'Tumor makers',
    columns: 2,
    matchers: [/\bafp\b/i, /ca[-\s]?153/i, /\bcea\b/i, /\bpsa\b/i, /\bt3\b/i, /\bt4\b/i, /\btsh\b/i, /ft3/i, /ft4/i, /ca[-\s]?125/i, /ca[-\s]?19-?9/i, /beta\s*hcg|\bhcg\b/i, /\bfsh\b/i, /\blh\b/i, /rapid test/i],
    order: ['AFP', 'CA-153', 'CEA', 'PSA', 'T3', 'T4', 'TSH', 'FT3', 'FT4', 'CA-125', 'CA 19-9', 'Beta HCG', 'FSH', 'LH', 'AFP(rapid test)', 'CEA(rapid test)', 'PSA(rapid test)']
  },
  {
    key: 'pathology',
    label: 'Pathology',
    columns: 1,
    matchers: [/gram stain/i, /pap smear/i, /co[-\s]?testing/i, /culture/i, /biopsy/i],
    order: ['Gram Stain', 'Pap smear', 'Co - Testing', 'Culture', 'Biopsy']
  },
  {
    key: 'screening_heart',
    label: 'Screening Heart disease',
    columns: 1,
    matchers: [/\bcpk\b/i, /troponin/i, /ck-?mb/i, /homocysteine/i],
    order: ['CPK', 'Troponin T', 'CK-MB', 'Troponin I', 'Homocysteine']
  },
  {
    key: 'urine_stool',
    label: 'Urine/Stool Examination',
    columns: 2,
    matchers: [/urine analysis|urine test/i, /pregnancy/i, /amphetamine/i, /sediment|clot/i, /stool/i, /occult blood/i, /leukocyte/i],
    order: ['Urine Analysis', 'Pregnancy Test', 'Amphetamine', 'Sediment/Clot', 'Stool Examination', 'Occult blood', 'Leukocyte']
  },
  {
    key: 'service',
    label: 'Service',
    columns: 1,
    matchers: [/service/i, /2h/i, /6h/i, /ຜ່າຕັດ/i, /ຄ່າບໍລິການ/i],
    order: ['ການບໍລິການຕິດຕາມອາການ 2h - 6h', 'ການບໍລິການຕິດຕາມອາການ 6h ຂຶ້ນໄປ', 'ນັດຕາທາງສາຍຕາ', 'ນັດຕາທາງລຳບາກ', 'ນັດຕາທາງບັນທຶກ']
  },
  {
    key: 'ultrasound',
    label: 'Ultrasound',
    columns: 2,
    matchers: [/ultrasound/i, /4d obstetric/i, /obstetric/i, /pelvic/i, /prostatic/i, /breast/i, /thyroid/i, /soft tissue/i, /abdominal/i, /colposcopy/i],
    order: ['Abdominal Ultrasound', 'Pelvic Ultrasound', 'Prostatic Ultrasound', 'Thyroid Ultrasound', 'Colposcopy', 'Obstetric Ultrasound', '4D Obstetric Ultrasound', 'Breast Ultrasound', 'Soft Tissue Ultrasound']
  },
  {
    key: 'cardiology',
    label: 'Cardiology',
    columns: 1,
    matchers: [/\becg\b/i, /echo cardio|cardiae ultrasound|cardiac ultrasound|u\/s cardio/i],
    order: ['Cardiae ultrasound/Echo cardio graphy', 'ECG']
  },
  {
    key: 'ent',
    label: 'ENT',
    columns: 2,
    matchers: [/ear\s*-?\s*scopy/i, /throat|thoat\s*-?\s*scopy/i, /nose\s*-?\s*scopy/i, /clean\s*-?\s*ear/i, /clean\s*-?\s*nose/i, /clean\s*-?\s*throat|thoat/i, /\bent\b/i],
    order: ['Ear - scopy', 'Nose - scopy', 'Clean - Nose', 'Thoat - scopy', 'Clean - Ear', 'Clean - Thoat']
  },
  {
    key: 'xray',
    label: 'X-Ray',
    columns: 2,
    matchers: [/x-?ray/i, /town view/i, /mortell|morteill/i, /frog leg/i, /oblique/i, /chest ap/i, /chest pa/i, /chest lat/i, /c\.spine/i, /(?:^|\s)pa(?:,|\s|$)/i],
    order: ['PA, TOWN VIEW,LATERAL', 'PA, ALO', 'PA, LATERAL', 'C.Spine', 'AP, FROG LEG, OBLIQUE', 'Chest AP', 'Morteill AP, Lateral', 'Chest PA', 'Chest LAT']
  },
  {
    key: 'others',
    label: 'Others',
    columns: 1,
    matchers: [/check-?up/i, /package/i],
    order: []
  }
];

window.escapeEmrPickerHtml = function (value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

window.normalizeEMRLabSelection = function (items) {
  return Array.from(new Set((items || []).map(item => {
    if (typeof item === 'string') return item.trim();
    return String(item?.name || '').trim();
  }).filter(Boolean)));
};

window.normalizeLabCategoryLabel = function (value) {
  return String(value || '').trim().toLowerCase();
};

window.getLabCategoryOptions = function () {
  const saved = (masterDataStore['LabCategory'] || []).map(item => String(item.value || '').trim()).filter(Boolean);
  const fallback = (window._masterDataFallback?.LabCategory || []).map(item => String(item || '').trim()).filter(Boolean);
  const merged = [];

  [...saved, ...fallback].forEach(label => {
    if (!label) return;
    if (!merged.some(existing => window.normalizeLabCategoryLabel(existing) === window.normalizeLabCategoryLabel(label))) {
      merged.push(label);
    }
  });

  return merged;
};

window.getEMRLabPickerCategoryConfig = function () {
  const othersCategory = window.emrLabCategoryConfig.find(category => category.key === 'others');
  const base = window.emrLabCategoryConfig
    .filter(category => category.key !== 'others')
    .map(category => ({ ...category }));
  const known = new Set(base.map(category => window.normalizeLabCategoryLabel(category.label)));

  if (othersCategory) known.add(window.normalizeLabCategoryLabel(othersCategory.label));

  window.getLabCategoryOptions().forEach(label => {
    const normalized = window.normalizeLabCategoryLabel(label);
    if (!normalized || known.has(normalized)) return;
    known.add(normalized);
    base.push({
      key: `custom_${normalized.replace(/[^a-z0-9]+/g, '_')}`,
      label,
      columns: 2,
      matchers: [],
      order: []
    });
  });

  if (othersCategory) base.push({ ...othersCategory });

  return base;
};

window.getLabCategoryMappingLookup = function () {
  const lookup = {};
  (masterDataStore['LabCategoryMapping'] || []).forEach(item => {
    try {
      const parsed = JSON.parse(item.value || '{}');
      const labId = String(parsed.labId || '').trim();
      const category = String(parsed.category || '').trim();
      if (!labId || !category) return;
      lookup[labId] = { id: item.id, category };
    } catch (error) {
      console.warn('Invalid LabCategoryMapping entry:', item, error);
    }
  });
  return lookup;
};

window.applyLabCategoriesToList = function (items) {
  const lookup = window.getLabCategoryMappingLookup();
  return (items || []).map(item => {
    const labId = String(item.id || item.Lab_ID || '').trim();
    return {
      ...item,
      category: item.category || lookup[labId]?.category || ''
    };
  });
};

window.ensureLabCategoriesExist = async function (categoryValues) {
  const uniqueCategories = Array.from(new Set((categoryValues || []).map(value => String(value || '').trim()).filter(Boolean)));
  if (!uniqueCategories.length) return { error: null };

  const existing = new Set((masterDataStore['LabCategory'] || []).map(item => window.normalizeLabCategoryLabel(item.value)));
  const missing = uniqueCategories.filter(value => !existing.has(window.normalizeLabCategoryLabel(value)));
  if (!missing.length) return { error: null };

  const { error } = await supabaseClient.from(dbTable('MasterData')).insert(missing.map(value => ({ Category: 'LabCategory', Value: value })));
  return { error };
};

window.saveLabCategoryMapping = async function (labId, category) {
  const normalizedLabId = String(labId || '').trim();
  const normalizedCategory = String(category || '').trim();
  if (!normalizedLabId) return { error: null };

  const lookup = window.getLabCategoryMappingLookup();
  const existing = lookup[normalizedLabId];

  if (!normalizedCategory) {
    if (!existing) return { error: null };
    const { error } = await supabaseClient.from(dbTable('MasterData')).delete().eq('ID', existing.id);
    return { error };
  }

  const ensureResult = await window.ensureLabCategoriesExist([normalizedCategory]);
  if (ensureResult.error) return ensureResult;

  const payload = JSON.stringify({ labId: normalizedLabId, category: normalizedCategory });
  if (existing) {
    if (existing.category === normalizedCategory) return { error: null };
    const { error } = await supabaseClient.from(dbTable('MasterData')).update({ Value: payload }).eq('ID', existing.id);
    return { error };
  }

  const { error } = await supabaseClient.from(dbTable('MasterData')).insert({ Category: 'LabCategoryMapping', Value: payload });
  return { error };
};

window.deleteLabCategoryMappings = async function (labIds) {
  const idSet = new Set((Array.isArray(labIds) ? labIds : [labIds]).map(id => String(id || '').trim()).filter(Boolean));
  if (!idSet.size) return { error: null };

  const mappingIds = (masterDataStore['LabCategoryMapping'] || []).flatMap(item => {
    try {
      const parsed = JSON.parse(item.value || '{}');
      const labId = String(parsed.labId || '').trim();
      return idSet.has(labId) ? [item.id] : [];
    } catch {
      return [];
    }
  });

  if (!mappingIds.length) return { error: null };
  const { error } = await supabaseClient.from(dbTable('MasterData')).delete().in('ID', mappingIds);
  return { error };
};

window.normalizeEMRLabOrderText = function (value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0e80-\u0eff]+/g, '');
};

window.getEMRLabSheetOrderIndex = function (name, order) {
  if (!order || !order.length) return Number.MAX_SAFE_INTEGER;
  const normalizedName = window.normalizeEMRLabOrderText(name);
  const foundIndex = order.findIndex(entry => {
    const normalizedEntry = window.normalizeEMRLabOrderText(entry);
    return normalizedName === normalizedEntry || normalizedName.includes(normalizedEntry) || normalizedEntry.includes(normalizedName);
  });
  return foundIndex === -1 ? Number.MAX_SAFE_INTEGER : foundIndex;
};

window.getEMRLabCategoryForItem = function (lab) {
  const explicitCategory = String(lab?.category || '').trim();
  const effectiveCategories = window.getEMRLabPickerCategoryConfig();
  if (explicitCategory) {
    const normalizedExplicit = window.normalizeLabCategoryLabel(explicitCategory);
    const matched = effectiveCategories.find(category => window.normalizeLabCategoryLabel(category.label) === normalizedExplicit);
    if (matched) return matched;
    return {
      key: `custom_${normalizedExplicit.replace(/[^a-z0-9]+/g, '_')}`,
      label: explicitCategory,
      columns: 2,
      matchers: [],
      order: []
    };
  }

  const searchableText = `${lab?.name || ''} ${lab?.desc || ''}`.toLowerCase();
  for (const category of window.emrLabCategoryConfig) {
    if (category.key === 'others') continue;
    if (category.matchers.some(matcher => matcher.test(searchableText))) return category;
  }
  const others = effectiveCategories.find(category => category.key === 'others');
  return others || effectiveCategories[effectiveCategories.length - 1];
};

window.getEMRLabPickerGroups = function () {
  const groups = window.getEMRLabPickerCategoryConfig().map(category => ({
    ...category,
    items: [],
    selectedCount: 0
  }));
  const groupMap = Object.fromEntries(groups.map(group => [group.key, group]));

  labsMasterList.forEach((lab, index) => {
    const name = String(lab?.name || '').trim();
    const desc = String(lab?.desc || '').trim();
    const haystack = `${name} ${desc}`.toLowerCase();
    if (currentEMRLabSearchQuery && !haystack.includes(currentEMRLabSearchQuery)) return;

    const category = window.getEMRLabCategoryForItem(lab);
    const group = groupMap[category.key] || groupMap.others;
    group.items.push({ ...lab, index, name, desc });
    if (currentEMRLabPickerSelection.includes(name)) group.selectedCount += 1;
  });

  groups.forEach(group => {
    group.items.sort((a, b) => {
      const orderA = window.getEMRLabSheetOrderIndex(a.name, group.order);
      const orderB = window.getEMRLabSheetOrderIndex(b.name, group.order);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  });

  return groups.filter(group => group.items.length > 0);
};

window.syncEMRLabPickerSelectionFromCurrentLabs = function () {
  currentEMRLabPickerSelection = window.normalizeEMRLabSelection(currentEMRLabs || []);
};

window.removeEMRLabPickerSelectionAt = function (index) {
  if (index < 0 || index >= currentEMRLabPickerSelection.length) return;
  currentEMRLabPickerSelection.splice(index, 1);
  currentEMRLabPickerSelection = [...currentEMRLabPickerSelection];
  window.renderEMRLabPicker();
};

window.updateEMRLabPickerSummary = function () {
  const summaryHost = document.getElementById('emrLabSelectedSummary');
  const countHost = document.getElementById('emrLabPickerSelectedCount');
  if (countHost) countHost.textContent = currentEMRLabPickerSelection.length;
  if (!summaryHost) return;

  if (!currentEMRLabPickerSelection.length) {
    summaryHost.innerHTML = `<div class="emr-order-empty">
      <i class="fas fa-clipboard-list"></i>
      <strong>ຍັງບໍ່ມີລາຍການກວດ</strong>
      <span>ເລືອກລາຍການຈາກຝັ່ງຊ້າຍເພື່ອເພີ່ມເຂົ້າ order</span>
    </div>`;
    return;
  }

  summaryHost.innerHTML = `<div class="emr-lis-summary-list">${currentEMRLabPickerSelection.map((name, index) => {
    const match = labsMasterList.find(lab => lab.name === name);
    const safeName = window.escapeEmrPickerHtml(name);
    const safeDesc = window.escapeEmrPickerHtml(match?.desc || 'ພ້ອມສົ່ງກວດ');
    return `<div class="emr-lis-summary-item">
      <div class="emr-lis-summary-text">
        <strong>${safeName}</strong>
        <span>${safeDesc}</span>
      </div>
      <button type="button" class="btn btn-sm btn-link text-danger emr-lis-summary-remove" onclick="window.removeEMRLabPickerSelectionAt(${index})" title="ລຶບລາຍການ">
        <i class="fas fa-times"></i>
      </button>
    </div>`;
  }).join('')}</div>`;
};

window.toggleEMRLabPickerSelection = function (index, checked) {
  const lab = labsMasterList[index];
  const name = String(lab?.name || '').trim();
  if (!name) return;

  const selected = new Set(currentEMRLabPickerSelection);
  if (checked) selected.add(name);
  else selected.delete(name);
  currentEMRLabPickerSelection = Array.from(selected);

  window.renderEMRLabPicker();
};

window.filterEMRLabPicker = function (query) {
  currentEMRLabSearchQuery = String(query || '').trim().toLowerCase();
  window.renderEMRLabPicker();
};

window.renderEMRLabPicker = function () {
  const host = document.getElementById('labCheckboxContainer');
  if (!host) return;

  const searchInput = document.getElementById('emrLabSearchInput');
  if (searchInput && searchInput.value.toLowerCase() !== currentEMRLabSearchQuery) {
    searchInput.value = currentEMRLabSearchQuery;
  }

  if (!labsMasterList.length) {
    host.innerHTML = '<div class="emr-order-empty"><i class="fas fa-spinner fa-spin"></i><strong>ກຳລັງໂຫຼດລາຍການ Lab</strong><span>ກະລຸນາລໍຖ້າຊົ່ວຄູ່...</span></div>';
    window.updateEMRLabPickerSummary();
    return;
  }

  const groups = window.getEMRLabPickerGroups();

  if (!groups.length) {
    host.innerHTML = '<div class="emr-order-empty"><i class="fas fa-search"></i><strong>ບໍ່ພົບລາຍການກວດ</strong><span>ລອງປ່ຽນຄຳຄົ້ນຫາ ຫຼື ກົດ refresh</span></div>';
  } else {
    host.innerHTML = `<div class="emr-lis-sheet-layout">${groups.map(group => {
      const selectedMeta = group.selectedCount > 0 ? `<span class="emr-lis-sheet-section-selected">${group.selectedCount} ເລືອກ</span>` : '';
      return `<section class="emr-lis-sheet-section">
        <div class="emr-lis-sheet-section-head">
          <div>
            <strong class="emr-lis-sheet-section-title">${group.label}</strong>
            <span class="emr-lis-sheet-section-subtitle">${group.items.length} ລາຍການ</span>
          </div>
          <div class="emr-lis-sheet-section-meta">
            ${selectedMeta}
          </div>
        </div>
        <div class="emr-lis-sheet-checklist" style="--emr-sheet-cols:${group.columns || 2};">${group.items.map(item => {
          const isSelected = currentEMRLabPickerSelection.includes(item.name);
          const safeName = window.escapeEmrPickerHtml(item.name);
          const safeDesc = window.escapeEmrPickerHtml(item.desc || '');
          return `<label class="emr-lis-sheet-item ${isSelected ? 'is-selected' : ''}" data-lab-picker-card-index="${item.index}" title="${safeDesc || safeName}">
            <input class="form-check-input shadow-none" type="checkbox" ${isSelected ? 'checked' : ''} onchange="window.toggleEMRLabPickerSelection(${item.index}, this.checked)">
            <span class="emr-lis-sheet-item-text">${safeName}</span>
          </label>`;
        }).join('')}</div>
      </section>`;
    }).join('')}</div>`;
  }

  window.updateEMRLabPickerSummary();
};

window.decorateDataTableUi = function (tableNode) {
  if (!tableNode) return;

  const table = $(tableNode);
  const wrapper = table.closest('.dataTables_wrapper');
  if (!wrapper.length) return;

  wrapper.addClass('his-datatable-shell');
  wrapper.find('.row').addClass('his-datatable-row');
  wrapper.find('.dataTables_length').addClass('his-datatable-length');
  wrapper.find('.dataTables_filter').addClass('his-datatable-filter');
  wrapper.find('.dataTables_info').addClass('his-datatable-info');
  wrapper.find('.dataTables_paginate').addClass('his-datatable-pagination');
  wrapper.find('.pagination').addClass('his-datatable-pagination-list');

  const searchInput = wrapper.find('.dataTables_filter input');
  searchInput
    .attr('placeholder', searchInput.attr('placeholder') || (window.getAppLanguage() === 'en' ? 'Search data...' : 'ຄົ້ນຫາຂໍ້ມູນ...'))
    .addClass('his-datatable-search-input');

  wrapper.find('.dataTables_length select').addClass('his-datatable-select');

  wrapper.find('.dataTables_filter label').contents().filter(function () {
    return this.nodeType === 3;
  }).each(function () {
    this.textContent = this.textContent.replace('Search:', '').replace('ຄົ້ນຫາ:', '').trim();
  });

  window.applyStaticLanguage(wrapper.get(0));
};

// ==========================================
// PARTIAL LOADER — fetch & inject HTML files
// ==========================================
async function loadPartials() {
  const views = [
    'dashboard', 'report', 'visit_history', 'patients', 'triage', 'opd', 'opd_observation', 'opd_observation_list',
    'appointments', 'ipd_ward_bed', 'ipd_inpatient_list', 'ipd_chart', 'ipd_config', 'vaccines', 'vaccine_master', 'drugs',
    'labs', 'services', 'locations', 'users', 'orgs', 'settings', 'activity_log', 'backup', 'public-queue'
  ];
  const modals = [
    'patient-modal',
    'triage-modal',
    'appointment-qr-modal',
    'org-user-modal',
    'admin-modals',
    'vaccine-modals',
    'patient-timeline-modal',
    'emr-modals'
  ];

  try {
    const [navbarHtml, ...rest] = await Promise.all([
      fetch('/partials/navbar.html').then(r => r.text()),
      ...views.map(v => fetch(`/partials/views/${v}.html`).then(r => r.text())),
      ...modals.map(m => fetch(`/partials/modals/${m}.html`).then(r => r.text())),
      fetch('/partials/print-areas.html').then(r => r.text())
    ]);

    document.getElementById('partial-navbar').innerHTML = navbarHtml;
    document.getElementById('partial-views').innerHTML =
      rest.slice(0, views.length).join('\n');
    document.getElementById('partial-modals').innerHTML =
      rest.slice(views.length, views.length + modals.length).join('\n');
    document.getElementById('partial-prints').innerHTML =
      rest[rest.length - 1];
  } catch (err) {
    console.error('loadPartials error:', err);
    // Fallback message so the user knows what went wrong
    document.body.innerHTML += `<div style="position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#ef4444;color:#fff;padding:16px 24px;border-radius:8px;font-family:sans-serif;z-index:9999;">
          ⚠️ ບໍ່ສາມາດໂຫຼດ partials ໄດ້.<br>ກະລຸນາ run ຜ່ານ HTTP server (VS Code Live Server ຫຼື npx serve).<br><small>${err.message}</small></div>`;
  }
}

$(document).ready(async function () {
  // Load all HTML partials first, then init the app
  await loadPartials();
  window.applyAppLanguage();
  window.captureProtectedRouteForLogin();

  if ($.fn.dataTable) {
    window.installLocalizedDataTable();
    $.extend(true, $.fn.dataTable.defaults, {
      responsive: true,
      pageLength: 10,
      language: window.getDataTableLanguage()
    });
  }

  $(document).on('init.dt', function (e, settings) {
    if (settings && settings.nTable) {
      window.decorateDataTableUi(settings.nTable);
    }
  });

  $('#login-section').hide();


  // 🌟 ຈັດການ Z-index Modal ທີ່ຊ້ອນກັນ
  $(document).on('show.bs.modal', '.modal', function () {
    var zIndex = 1040 + (10 * $('.modal:visible').length);
    $(this).css('z-index', zIndex);
    setTimeout(function () {
      $('.modal-backdrop').not('.modal-stack').css('z-index', zIndex - 1).addClass('modal-stack');
    }, 0);
  });

  $(document).on('hidden.bs.modal', '.modal', function () {
    if (document.activeElement) document.activeElement.blur();
    if ($('.modal:visible').length > 0) {
      setTimeout(function () { $('body').addClass('modal-open'); }, 100);
    }
  });

  if (typeof $.fn.modal !== 'undefined' && $.fn.modal.Constructor) {
    $.fn.modal.Constructor.prototype.enforceFocus = function () { };
  }

  if (typeof jQuery !== 'undefined' && $.fn.select2) {
    $('#emrService').select2({ dropdownParent: $('#emrModal'), placeholder: "-- ພິມຄົ້ນຫາບໍລິການ --", allowClear: true }).on('change', window.handleServiceSelectionChange);
    $('#emrDischargeStatus').select2({
      dropdownParent: $('#emrModal'),
      placeholder: "-- ເລືອກ ຫຼື ພິມສະຖານະ --",
      allowClear: true,
      tags: true,
      width: '100%',
      createTag: function (params) {
        let term = (params.term || '').trim();
        if (!term) return null;
        return { id: term, text: term, newTag: true };
      }
    });

    $('#p_district').select2({ dropdownParent: $('#patientModal'), placeholder: "-- ຄົ້ນຫາ ແລະ ເລືອກເມືອງ --", allowClear: false }).on('change', function () {
      let dist = $(this).val();
      let loc = locationsDataStore.find(l => l.district === dist);
      $('#p_province').val(loc ? loc.province : '');
    });

    $('#a_patient').select2({ dropdownParent: $('#apptModal'), placeholder: "-- ຄົ້ນຫາຄົນເຈັບ --", allowClear: true }).on('change', function () {
      let d = $(this).select2('data');
      if (d && d.length > 0 && d[0].id) {
        $('#a_target_id').val(d[0].id);
        let txt = d[0].text;
        $('#a_target_name').val(txt.includes(' - ') ? txt.split(' - ')[1] : txt);
      } else {
        $('#a_target_id').val('');
        $('#a_target_name').val('');
      }
    });

    $('#a_org').select2({ dropdownParent: $('#apptModal'), placeholder: "-- ຄົ້ນຫາອົງກອນ --", allowClear: true }).on('change', function () {
      let d = $(this).select2('data');
      if (d && d.length > 0 && d[0].id) {
        $('#a_target_id').val(d[0].id);
        let txt = d[0].text;
        $('#a_target_name').val(txt.includes(' - ') ? txt.split(' - ')[1] : txt);
      } else {
        $('#a_target_id').val('');
        $('#a_target_name').val('');
      }
    });

    $('#pv_patient').select2({ dropdownParent: $('#patientVacModal'), placeholder: "-- ຄົ້ນຫາຄົນເຈັບ --", allowClear: true }).on('change', function () {
      let d = $(this).select2('data');
      if (d && d.length > 0 && d[0].id) {
        $('#pv_patient_id').val(d[0].id);
        let txt = d[0].text;
        $('#pv_patient_name').val(txt.includes(' - ') ? txt.split(' - ')[1] : txt);
      } else {
        $('#pv_patient_id').val('');
        $('#pv_patient_name').val('');
      }
    });

    $('#emrAddDrugSelect').select2({ dropdownParent: $('#emrDrugModal'), placeholder: "-- ເລືອກຢາ --", allowClear: true });
    
    // Smart drug unit detection
    $('#emrAddDrugSelect').on('change', function() {
      const val = $(this).val();
      if (!val) return;
      const drug = (window.drugsMasterList || []).find(d => d.name === val);
      if (!drug) return;
      const text = (drug.name + ' ' + drug.desc).toLowerCase();
      let unit = "";
      let dose = "1";
      
      if (/inj|ສັກ|iv|im|amp|vial/i.test(text)) {
        unit = "Dose";
      } else if (/tab|cap|ເມັດ|mg/i.test(text)) {
        unit = "ເມັດ (Tab)";
      } else if (/syr|susp|ນ້ຳ|ml/i.test(text)) {
        unit = "ມິນລິລິດ (ml)";
        dose = "1 ບ່ວງ";
      }
      
      if (unit) $('#emrAddDrugUnit').val(unit);
      if (dose) $('#emrAddDrugDose').val(dose);
    });
  }

  $('#pv_vaccine, #pv_date').on('change', window.calculateNextVacDate);
  $('#pv_dose').on('input', window.calculateNextVacDate);

  $('[data-widget="pushmenu"]').on('click', function (e) {
    e.preventDefault();
    if ($(window).width() >= 992) {
      $('body').toggleClass('sidebar-collapse');
    } else {
      $('body').toggleClass('sidebar-open');
    }
  });

  $('.content-wrapper').on('click', function () {
    if ($(window).width() < 992 && $('body').hasClass('sidebar-open')) {
      $('body').removeClass('sidebar-open');
    }
  });

  // 🌟 ຈັດການ Dropdown ຂອງ TOP NAVBAR
  $(document).on('click', '.his-dropdown-toggle', function (e) {
    e.preventDefault();
    e.stopPropagation();

    let parent = $(this).closest('.his-dropdown');
    let wasOpen = parent.hasClass('open');

    // Close ALL dropdowns first
    $('.his-dropdown').removeClass('open');

    // Toggle current
    if (!wasOpen) {
      parent.addClass('open');
      if ($(this).hasClass('his-bell-btn')) { window.renderNotifications(); }
    }
  });

  // Close on click outside OR item click
  $(document).on('click', function (e) {
    if (!$(e.target).closest('.his-dropdown-menu').length && !$(e.target).closest('.his-dropdown-toggle').length) {
      $('.his-dropdown').removeClass('open');
    }
  });

  $(document).on('click', '.his-dropdown-item', function () {
    $('.his-dropdown').removeClass('open');
  });

  // Mobile Hamburger
  $(document).on('click', '.his-hamburger', function (e) {
    e.preventDefault();
    $('#his-nav-items').toggleClass('open');
  });

  // Unified Nav Link Listener (supports both ID-based and Attribute-based navigation)
  $(document).on('click', '.his-nav-link, .his-dropdown-item, .nav-link', function (e) {
    let id = $(this).attr('id');
    if (id && id.startsWith('nav-')) {
      e.preventDefault();
      let routeKey = id.replace('nav-', '');
      let view = $(this).attr('data-view') || routeKey;
      if (!window.HIS_NAV_ROUTES?.[routeKey] && window.HIS_NAV_ROUTES?.[view]) routeKey = view;
      let route = $(this).attr('data-route') || null;
      window.loadView(routeKey, { view, path: route || undefined });
    }
  });

  window.addEventListener('popstate', function () {
    const route = window.parseProtectedRoute(window.location.pathname);
    if (route?.view) window.loadView(route.routeKey || route.view, { ...route, updateUrl: false });
  });

  $('#triageForm input[name="v_bp"]').on('input', function () {
    let bp = $(this).val();
    if (bp.includes('/')) {
      let parts = bp.split('/');
      let sys = parseInt(parts[0]);
      let dia = parseInt(parts[1]);
      if (!isNaN(sys) && !isNaN(dia)) {
        if (sys >= 140 || dia >= 90) {
          $(this).removeClass('border-success text-success border-warning text-dark bg-warning').addClass('border-danger text-danger bg-danger bg-opacity-10 fw-bold');
        } else if (sys <= 90 || dia <= 60) {
          $(this).removeClass('border-success text-success border-danger text-danger bg-danger').addClass('border-warning text-dark bg-warning bg-opacity-10 fw-bold');
        } else {
          $(this).removeClass('border-danger text-danger bg-danger border-warning text-dark bg-warning bg-opacity-10').addClass('border-success text-success fw-bold');
        }
      } else {
        $(this).removeClass('border-danger text-danger bg-danger border-warning text-dark bg-warning bg-opacity-10 border-success text-success fw-bold');
      }
    } else {
      $(this).removeClass('border-danger text-danger bg-danger border-warning text-dark bg-warning bg-opacity-10 border-success text-success fw-bold');
    }
  });

  setTimeout(async () => {
    const restored = !currentUser && await window.restoreAuthSession();
    if (restored) {
      await window.initApp();
      setTimeout(() => {
        window.applyButtonPermissions();
      }, 500);
    } else if (!currentUser) {
      $('body').removeClass('auth-checking');
      $('#app-content').hide();
      $('#login-section').show();
      $('#loading').hide();
    }
  }, 0);
});

window.doLogin = async function () {
  let email = String($('#loginEmail').val() || '').trim();
  let pass = String($('#loginPass').val() || '');
  let passTrimmed = pass.trim();

  if (!email || !pass) {
    Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນອີເມວ ແລະ ລະຫັດຜ່ານໃຫ້ຄົບ', 'warning');
    return;
  }

  window.toggleLoading(true);

  try {
    // 1. Fetch User from Custom Users Table directly (without Supabase Auth)
    const { data, error } = await supabaseClient
      .from(dbTable('Users'))
      .select('*')
      .ilike('Email', email)
      .limit(1);  // ໃຊ້ limit(1) ແທນ .single() ເພື່ອຫຼີກລ່ຽງ error

    window.toggleLoading(false);
    $('body').removeClass('auth-checking');

    // 2. Check if query has error or no data
    if (error) {
      console.error("Query Error:", error);
      Swal.fire('ແຈ້ງເຕືອນ', 'ເກີດຂໍ້ຜິດພາດໃນລະບົບ: ' + error.message, 'error');
      return;
    }

    if (!data || data.length === 0) {
      console.error("Login Error: No user found with email", email);
      Swal.fire('ແຈ້ງເຕືອນ', 'ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ', 'error');
      return;
    }

    // Get first user from array
    const user = data[0];

    // 3. Check password (using Password_Hash only)
    const passHash = await window.hashPassword(pass);
    const passTrimmedHash = passTrimmed === pass ? passHash : await window.hashPassword(passTrimmed);
    const storedPasswordHash = String(user.Password_Hash || '');
    const passwordMatches =
      storedPasswordHash === passHash ||
      storedPasswordHash === passTrimmedHash;
    if (!passwordMatches) {
      Swal.fire('ແຈ້ງເຕືອນ', 'ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ', 'error');
      return;
    }

    // 4. Check status
    if (user.Status !== 'active') {
      Swal.fire('ແຈ້ງເຕືອນ', 'ບັນຊີຂອງທ່ານບໍ່ພົບໃນລະບົບ ຫຼື ຖືກປິດໃຊ້ງານ', 'error');
      return;
    }

    // 5. Save user info to currentUser
    currentUser = window.buildCurrentUserFromDbRow(user);
    window.saveAuthSession();
    window.syncCurrentUserToMasterData(currentUser);

    // 6. Show success message
    Swal.fire({
      title: 'ສຳເລັດ!',
      text: `ຍິນດີຕ້ອນຮັບ, ${currentUser.name}`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    });

    // 8. Show app content
    $('body').removeClass('auth-checking');
    $('#login-section').hide();
    $('#app-content').show();
    $('#sidebarUserName').text(currentUser.name);

    console.log("Login ສຳເລັດ! ຂໍ້ມູນ User:", currentUser);

    window.initApp();
    
    // 9. Apply button permissions after app initializes
    setTimeout(() => {
      window.applyButtonPermissions();
    }, 500);

  } catch (err) {
    window.toggleLoading(false);
    console.error("System Error:", err);
    Swal.fire('ຂໍ້ຜິດພາດ', 'ການເຊື່ອມຕໍ່ມີບັນຫາ, ກະລຸນາກວດສອບອິນເຕີເນັດ!', 'error');
  }
};

window.calculateAgeForm = function () {
  let dobVal = $('#dobInput').val();
  if (dobVal) {
    let dob = new Date(dobVal);
    let age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
    $('#ageInput').val(age);
  }
};

window.handleServiceSelectionChange = function () {
  let selectedVals = $('#emrService').val() || [];
  let specs = [];
  let revs = [];
  selectedVals.forEach(val => {
    let srv = servicesDataStore.find(s => s.service === val);
    if (srv) {
      if (srv.specialist && srv.specialist !== "-") specs.push(srv.specialist);
      if (srv.revenue && srv.revenue !== "-") revs.push(srv.revenue);
    }
  });
  $('#emrSpecialist').val([...new Set(specs)].join(', '));
  $('#emrRevenue').val([...new Set(revs)].join(', '));
};

window.logout = async function () {
  window.toggleLoading(true);
  if (typeof window.teardownOpdQueueRealtime === 'function') window.teardownOpdQueueRealtime();
  await supabaseClient.auth.signOut();
  window.logAction('Logout', 'ອອກຈາກລະບົບ', 'Auth');
  currentUser = null;
  window.clearAuthSession();
  window.clearIntendedRoute();
  if (window.history?.replaceState) window.history.replaceState({ view: 'dashboard' }, '', '/dashboard');
  window.toggleLoading(false);
  $('body').removeClass('auth-checking');
  $('#app-content').hide();
  $('#login-section').show();
  clearInterval(dashRefreshInterval);
  clearInterval(reportRefreshInterval);
  if (window.closeQRScanner) window.closeQRScanner();
};

window.toggleLoading = function (s) {
  $('#loading').css('display', s ? 'block' : 'none');
};

window.getLocalStr = function (dObj) {
  return dObj.getFullYear() + '-' + String(dObj.getMonth() + 1).padStart(2, '0') + '-' + String(dObj.getDate()).padStart(2, '0');
};

window.getLocalDateKey = function (value) {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return window.getLocalStr(d);
};

window.getLocalDayIsoBounds = function (dateValue) {
  const key = dateValue || window.getLocalStr(new Date());
  const parts = String(key).slice(0, 10).split('-').map(Number);
  const y = parts[0] || new Date().getFullYear();
  const m = parts[1] || (new Date().getMonth() + 1);
  const d = parts[2] || new Date().getDate();
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

window.getLocalDateRangeIsoBounds = function (startDate, endDate) {
  const start = window.getLocalDayIsoBounds(startDate);
  const end = window.getLocalDayIsoBounds(endDate || startDate);
  return { startIso: start.startIso, endIso: end.endIso };
};

window.normalizeBooleanSetting = function (value) {
  return ['true', '1', 'yes', 'enabled', 'on'].includes(String(value || '').trim().toLowerCase());
};

window.buildCurrentUserFromDbRow = function (user) {
  if (!user) return null;
  return {
    id: user.ID,
    name: user.Name,
    role: user.Role,
    permissions: user.Permissions,
    buttonPermissions: user.ButtonPermissions || {}
  };
};

window.saveAuthSession = function () {
  if (!currentUser) return;
  try {
    localStorage.setItem(HIS_AUTH_SESSION_KEY, JSON.stringify({
      user: currentUser,
      savedAt: Date.now(),
      expiresAt: Date.now() + HIS_AUTH_SESSION_TTL_MS
    }));
  } catch (err) {
    console.warn('Unable to save login session:', err);
  }
};

window.clearAuthSession = function () {
  try {
    localStorage.removeItem(HIS_AUTH_SESSION_KEY);
  } catch (err) {
    console.warn('Unable to clear login session:', err);
  }
};

window.restoreAuthSession = async function () {
  try {
    const raw = localStorage.getItem(HIS_AUTH_SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (!session?.user?.id || !session?.expiresAt || Date.now() > Number(session.expiresAt)) {
      window.clearAuthSession();
      return false;
    }

    const { data, error } = await supabaseClient
      .from(dbTable('Users'))
      .select('ID,Name,Role,Permissions,ButtonPermissions,Status')
      .eq('ID', session.user.id)
      .limit(1);

    if (error || !data || data.length === 0 || data[0].Status !== 'active') {
      if (error) console.warn('Restore login session failed:', error);
      window.clearAuthSession();
      return false;
    }

    currentUser = window.buildCurrentUserFromDbRow(data[0]);
    window.saveAuthSession();
    window.syncCurrentUserToMasterData(currentUser);
    return true;
  } catch (err) {
    console.warn('Restore login session failed:', err);
    window.clearAuthSession();
    return false;
  }
};

window.canUserAccessView = function (view, perms) {
  if (!view) return false;
  if (currentUser?.role === 'admin' || perms.includes('all')) return true;
  if (view === 'dashboard') return perms.includes('dashboard');
  if (view === 'opd_observation_list') return perms.includes('opd_observation');
  const permissionKey = view.replace(/^ipd_/, 'ipd_');
  return perms.includes(permissionKey) || perms.includes(view);
};

window.getPostLoginView = function (perms) {
  const allowedDashboard = currentUser?.role === 'admin' || perms.includes('dashboard') || perms.includes('all');
  if (systemSettings.rememberLastModule) {
    const lastView = localStorage.getItem('his_last_selected_module') || '';
    if (window.canUserAccessView(lastView, perms)) return lastView;
  } else {
    localStorage.removeItem('his_last_selected_module');
  }
  if (allowedDashboard) return 'dashboard';
  return ['patients', 'triage', 'opd', 'opd_observation', 'ipd_ward_bed'].find(view => window.canUserAccessView(view, perms)) || 'dashboard';
};

window.initApp = async function () {
  try {
    $('#login-section').hide();
    $('#app-content').show();
    $('#sidebarUserName').text(currentUser.name);
    $('.mnu-dashboard, .mnu-report, .mnu-patients, .mnu-triage, .mnu-opd, .mnu-opd_observation, .mnu-orgs, .mnu-users, .mnu-settings, .mnu-services, .mnu-locations, .mnu-appointments, .mnu-vaccines, .mnu-vaccine_master, .mnu-drugs, .mnu-labs, .mnu-ipd_ward_bed, .mnu-ipd_inpatient_list, .mnu-ipd_config').hide();

    let perms = (currentUser.permissions || "").split(',');
    if (currentUser.role === 'admin' || perms.includes('all')) {
      $('.nav-item, .nav-header, .his-dropdown, .his-nav-link').show();
    } else {
      perms.forEach(p => {
        $('.mnu-' + p.trim()).show();
      });
      if (perms.includes('triage') || perms.includes('opd')) {
        $('.nav-header.mnu-opd').show();
      }
    }

    if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
    if (typeof Chart !== 'undefined' && !window.dashboardNoDataPluginRegistered) {
      Chart.register({
        id: 'dashboardNoDataOverlay',
        afterDraw(chart, args, pluginOptions) {
          if (!pluginOptions || !pluginOptions.enabled) return;
          const chartArea = chart.chartArea;
          if (!chartArea) return;

          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2;
          const ctx = chart.ctx;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#475569';
          ctx.font = '600 13px "Noto Sans Lao", sans-serif';
          ctx.fillText(pluginOptions.message || 'ບໍ່ພົບຂໍ້ມູນ', centerX, centerY - 8);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '11px "Noto Sans Lao", sans-serif';
          ctx.fillText(pluginOptions.submessage || 'ລອງປ່ຽນວັນທີ ຫຼື ຊ່ວງເວລາ', centerX, centerY + 12);
          ctx.restore();
        }
      });
      window.dashboardNoDataPluginRegistered = true;
    }

    window.toggleLoading(true);

    // Seed Defaults in background (don't block login)
    window.seedMasterDefaults();

    // Subscribe to OPD queue changes so doctors get notified on new arrivals
    window.setupOpdQueueRealtime();

    // Fetch all other data in parallel
    await Promise.all([
      supabaseClient.from(dbTable('MasterData')).select('ID,Category,Value').order('Category').then(({ data, error }) => {
        if (error) { console.error('MasterData load error:', error); return; }
        const map = {};
        (data || []).forEach(r => { if (!map[r.Category]) map[r.Category] = []; map[r.Category].push({ id: r.ID, value: r.Value }); });
        console.log('MasterData loaded, categories:', Object.keys(map));
        window.loadMasterDataGlobalCallback(map);
      }),
      supabaseClient.from(dbTable('Service_Lists')).select('*').order('ID').then(({ data }) => {
        servicesDataStore = (data || []).map(r => ({ id: r.ID, revenue: r.Revenue_Group, specialist: r.Mapped_Specialist, service: r.Services_List }));
        let so = '';
        servicesDataStore.forEach(s => { so += `<option value="${s.service}">${s.service}</option>`; });
        if (typeof jQuery !== 'undefined') $('#emrService').empty().append(so).trigger('change');
      }),
      supabaseClient.from(dbTable('Locations')).select('*').order('Province').then(({ data }) => {
        locationsDataStore = (data || []).map(r => ({ id: r.ID, district: r.District, province: r.Province }));
        let o = '<option value="">-- ຄົ້ນຫາ ແລະ ເລືອກເມືອງ --</option>';
        locationsDataStore.forEach(l => o += `<option value="${l.district}">${l.district}</option>`);
        if (typeof jQuery !== 'undefined') $('#p_district').html(o);
      }),
      window.refreshPatientOrgDropdown(),
      new Promise((resolve) => { window.preloadDropdownDataCallback(resolve); })
    ]);

    try {
      const { data: settingsRows } = await supabaseClient.from(dbTable('Settings')).select('Key,Value');
      (settingsRows || []).forEach(r => {
        if (r.Key === 'HospitalName') systemSettings.hospitalName = r.Value || systemSettings.hospitalName;
        if (r.Key === 'LogoUrl') systemSettings.logoUrl = r.Value || '';
        if (r.Key === 'OpdHeaderUrl') systemSettings.opdHeaderUrl = r.Value || '';
        if (r.Key === 'OpdFooterUrl') systemSettings.opdFooterUrl = r.Value || '';
        if (r.Key === 'RememberLastModule') systemSettings.rememberLastModule = window.normalizeBooleanSetting(r.Value);
      });
    } catch (settingsError) {
      console.warn('Settings load skipped during login routing:', settingsError);
    }

    window.checkAlerts();
    window.toggleLoading(false);
    $('body').removeClass('auth-checking');
    
    const intendedRoute = window.consumeIntendedRoute();
    const currentRoute = window.parseProtectedRoute(window.location.pathname);
    const routeToOpen = intendedRoute || currentRoute;
    if (routeToOpen?.view === 'ipd_chart' && routeToOpen.admissionId) {
      window.ipdCurrentChartAdmissionId = routeToOpen.admissionId;
      if (window.history?.replaceState) window.history.replaceState({ view: 'ipd_chart', admissionId: routeToOpen.admissionId }, '', routeToOpen.path || `/ipd/chart/${encodeURIComponent(routeToOpen.admissionId)}`);
      await window.fetchIpdWardBedData();
      window.prepareIpdUnfilteredState();
      window.loadView('ipd_chart');
      return;
    }
    if (routeToOpen?.view) {
      window.ipdCurrentChartAdmissionId = null;
      window.loadView(routeToOpen.routeKey || routeToOpen.view, { ...routeToOpen, replace: true });
      return;
    }

    window.ipdCurrentChartAdmissionId = null;
    const postLoginView = window.getPostLoginView(perms);
    const postLoginTarget = window.resolveHisRouteTarget(postLoginView);
    if (window.history?.replaceState) window.history.replaceState({ view: postLoginTarget.view, routeKey: postLoginTarget.routeKey }, '', postLoginTarget.path);
    window.loadView(postLoginView, { replace: true });
    
    $('body').on('click', '.btn-timeline', function() {
      let pid = $(this).attr('data-pid');
      if (pid) window.showPatientTimeline(pid);
    });

  } catch (e) {
    console.error("InitApp Error:", e);
    window.toggleLoading(false);
    $('body').removeClass('auth-checking');
    Swal.fire('ແຈ້ງເຕືອນ', 'ເກີດຂໍ້ຜິດພາດໃນການໂຫຼດໜ້າຈໍ.', 'error');
  }
};

window.loadView = function (v, options = {}) {
  const routeTarget = window.resolveHisRouteTarget ? window.resolveHisRouteTarget(v, options) : { view: v, navId: v, routeKey: v, path: `/${v}` };
  v = routeTarget.view;
  if (systemSettings.rememberLastModule && v && !['public-queue', 'ipd_chart'].includes(v)) {
    localStorage.setItem('his_last_selected_module', v);
  }
  window.updateHisBrowserRoute?.(routeTarget, options);
  if (typeof bootstrap !== 'undefined') {
    $('.modal.show').each(function () {
      let bsModal = bootstrap.Modal.getInstance(this);
      if (bsModal) bsModal.hide();
    });
  }
  $('.modal-backdrop').remove();
  $('body').removeClass('modal-open').css({ overflow: '', paddingRight: '' });

  // Handle Active States
  $('.nav-link, .his-nav-link, .his-dropdown-item, .his-dropdown-toggle').removeClass('active');

  var navEl = $('#nav-' + routeTarget.navId);
  if (!navEl.length) navEl = $('#nav-' + v);
  if (navEl.length) {
    navEl.addClass('active');
    let parentDropdown = navEl.closest('.his-dropdown');
    if (parentDropdown.length) {
      parentDropdown.find('.his-dropdown-toggle').addClass('active');
    }
  }

  // Switch Views
  let views = ['dashboard', 'report', 'visit_history', 'patients', 'settings', 'orgs', 'triage', 'opd', 'opd_observation', 'opd_observation_list', 'users', 'services', 'locations', 'appointments', 'ipd_ward_bed', 'ipd_inpatient_list', 'ipd_chart', 'ipd_config', 'vaccines', 'vaccine_master', 'drugs', 'labs', 'activity_log', 'backup', 'public-queue'];
  views.forEach(n => {
    if (n === v) $('#view-' + n).show();
    else $('#view-' + n).hide();
  });
  window.applyHisRouteModeLabels?.(routeTarget);

  // Special handling for TV Display (Hide Navbars)
  if (v === 'public-queue') {
    $('#partial-navbar').hide();
    $('.main-sidebar').hide();
    $('.content-wrapper').css('margin-left', '0');
    window.initPublicQueueView();
  } else {
    $('#partial-navbar').show();
    $('.main-sidebar').show();
    $('.content-wrapper').css('margin-left', '');
  }

  // Reset intervals
  if (dashRefreshInterval) clearInterval(dashRefreshInterval);
  if (reportRefreshInterval) clearInterval(reportRefreshInterval);

  // Load Data
  if (v === 'patients') window.initPatientTable();
  if (v === 'orgs') window.loadOrgs();
  if (v === 'triage') {
    if (!$('#triageStartDate').val()) {
      let today = new Date();
      $('#triageStartDate').val(window.getLocalStr(today));
      $('#triageEndDate').val(window.getLocalStr(today));
    }
    window.loadTriageQueue();
  }
  if (v === 'opd') {
    if (!$('#opdStartDate').val()) {
      let today = new Date();
      $('#opdStartDate').val(window.getLocalStr(today));
      $('#opdEndDate').val(window.getLocalStr(today));
    }
    window.loadQueue();
  }
  if (v === 'opd_observation') {
    window.loadObservationPage();
  }
  if (v === 'opd_observation_list') {
    if (!$('#obsListStartDate').val()) {
      let today = new Date();
      $('#obsListStartDate').val(window.getLocalStr(today));
      $('#obsListEndDate').val(window.getLocalStr(today));
    }
    window.loadObservationPage();
  }
  if (v === 'users') window.loadUsers();
  if (v === 'services') window.loadServicesMasterView();
  if (v === 'locations') window.loadLocationsMasterView();
  if (v === 'appointments') window.loadAppointments();
  if (v === 'ipd_ward_bed') {
    window.loadIpdWardBedManagement();
    if (routeTarget.mode === 'ipd_admission') {
      setTimeout(() => { $('.btn-ipd-admit:visible').first().trigger('focus'); }, 250);
    }
  }
  if (v === 'ipd_inpatient_list') {
    if (routeTarget.mode === 'ipd_discharge') window.ipdInpatientFilter = 'discharged';
    else if (routeTarget.mode === 'ipd_inpatients') window.ipdInpatientFilter = 'active';
    window.loadIpdInpatientListPage();
  }
  if (v === 'ipd_config') window.loadIpdConfigPage();
  if (v === 'ipd_chart' && window.ipdCurrentChartAdmissionId) window.loadIpdClinicalChart(window.ipdCurrentChartAdmissionId);
  if (v === 'vaccines') window.loadPatientVaccines();
  if (v === 'vaccine_master') window.loadVaccineMaster();
  if (v === 'drugs') window.loadDrugsMaster();
  if (v === 'labs') window.loadLabsMaster();
  if (v === 'activity_log') window.loadActivityLog();
  if (v === 'backup') window.initBackupView();

  if (v === 'settings') {
    supabaseClient.from(dbTable('Settings')).select('Key,Value').then(({ data }) => {
      let s = { hospitalName: 'HIS HOSPITAL', logoUrl: '', opdHeaderUrl: '', opdFooterUrl: '', rememberLastModule: false };
      (data || []).forEach(r => {
        if (r.Key === 'HospitalName') s.hospitalName = r.Value || s.hospitalName;
        if (r.Key === 'LogoUrl') s.logoUrl = r.Value || '';
        if (r.Key === 'OpdHeaderUrl') s.opdHeaderUrl = r.Value || '';
        if (r.Key === 'OpdFooterUrl') s.opdFooterUrl = r.Value || '';
        if (r.Key === 'RememberLastModule') s.rememberLastModule = window.normalizeBooleanSetting(r.Value);
      });
      systemSettings = s;
      $('#setHospitalName').val(s.hospitalName);
      $('#setLogoUrl').val(s.logoUrl);
      $('#setOpdHeaderUrl').val(s.opdHeaderUrl);
      $('#setOpdFooterUrl').val(s.opdFooterUrl);
      $('#setRememberLastModule').prop('checked', !!s.rememberLastModule);
      if (typeof window.renderMasterCategoryUI === 'function') window.renderMasterCategoryUI();
      window.loadMasterList();
    });
  }

  if (!systemSettings.hospitalName) {
    supabaseClient.from(dbTable('Settings')).select('Key,Value').then(({ data }) => {
      (data || []).forEach(r => { if (r.Key === 'HospitalName') systemSettings.hospitalName = r.Value; });
      window.setBrandName(systemSettings.hospitalName);
    });
  }

  if (v === 'dashboard') {
    window.setDashRange('today');
    dashRefreshInterval = setInterval(() => { window.fetchDashboardData(); window.checkAlerts(); }, 120000);
  }
  if (v === 'report') {
    window.setReportRange('today');
    reportRefreshInterval = setInterval(() => { window.fetchReportData(); window.checkAlerts(); }, 120000);
  }
  if (v === 'visit_history') {
    window.setVisitHistoryRange('today');
    reportRefreshInterval = setInterval(() => { window.fetchVisitHistoryData(); window.checkAlerts(); }, 120000);
  }

  // Close menus
  $('.his-dropdown').removeClass('open');
  $('#his-nav-items').removeClass('open');
};

window.executePrint = function (containerId) {
  var targetContainer = document.getElementById(containerId);
  if (!targetContainer) return;

  // 1. ເຊື່ອງ Wrapper ຫຼັກຂອງລະບົບທັງໝົດ (Sidebar, Header, Main Content)
  var appWrapper = document.querySelector('.wrapper');
  if (appWrapper) appWrapper.style.display = 'none';

  // 2. ເຊື່ອງ Container Print ໂຕອື່ນໆ ທີ່ບໍ່ກ່ຽວຂ້ອງ
  document.querySelectorAll('.print-container').forEach(function (el) {
    el.style.display = 'none';
    el.classList.remove('print-active');
  });

  // 3. ເປີດສະແດງສະເພາະ Container ທີ່ຕ້ອງການພິມ
  targetContainer.style.display = 'block';
  targetContainer.classList.add('print-active');

  // 4. ກວດສອບຮູບພາບໃຫ້ໂຫຼດສຳເລັດກ່ອນພິມ
  requestAnimationFrame(function () {
    var images = Array.from(targetContainer.querySelectorAll('img')).filter(function (img) {
      if (!img.src || img.style.display === 'none') return false;
      var fullSrc = img.getAttribute('src');
      return fullSrc && fullSrc !== '';
    });

    function doPrintAction() {
      setTimeout(function () {
        window.print();

        // 5. ຫຼັງຈາກພິມແລ້ວ ຄືນຄ່າທຸກຢ່າງໃຫ້ເປັນປົກກະຕິ
        setTimeout(function () {
          targetContainer.classList.remove('print-active');
          targetContainer.style.display = 'none';
          if (appWrapper) appWrapper.style.display = 'block'; // ເປີດລະບົບຄືນ
        }, 500);
      }, 500);
    }

    if (images.length === 0) {
      doPrintAction();
      return;
    }

    var loaded = 0;
    images.forEach(function (img) {
      if (img.complete && img.naturalHeight !== 0) {
        loaded++;
        if (loaded === images.length) doPrintAction();
      } else {
        img.onload = img.onerror = function () {
          loaded++;
          if (loaded === images.length) doPrintAction();
        };
      }
    });
  });
};

window.checkAlerts = async function () {
  const today = window.getLocalStr ? window.getLocalStr(new Date()) : new Date().toISOString().split('T')[0];
  const todayRange = window.getLocalDayIsoBounds(today);
  const { data: appts } = await supabaseClient
    .from(dbTable('Appointments'))
    .select('Appt_ID,Patient_Name,Appt_Date,Appt_Time,Type,Status')
    .eq('Status', 'Pending');
  const appointmentAlerts = [];
  (appts || []).forEach(r => {
    if (!r.Appt_Date) return;
    const aDate = r.Appt_Date.split('T')[0];
    const diffDays = Math.round((new Date(aDate) - new Date(today)) / 86400000);
    if (diffDays < 0 || (diffDays >= 0 && diffDays <= 14)) {
      appointmentAlerts.push({ id: r.Appt_ID, patientName: r.Patient_Name, date: aDate, time: r.Appt_Time, type: r.Type, isOverdue: diffDays < 0, daysOut: diffDays });
    }
  });
  appointmentAlerts.sort((a, b) => a.daysOut - b.daysOut);

  const roomAlerts = [];
  try {
    const { data: opdRows, error: opdError } = await supabaseClient.from(dbTable('Visits'))
      .select('Visit_ID,Patient_ID,Patient_Name,Department,Status,Date')
      .eq('Status', 'Waiting OPD')
      .gte('Date', todayRange.startIso)
      .lte('Date', todayRange.endIso)
      .order('Date', { ascending: false })
      .limit(100);
    if (opdError) throw opdError;
    (opdRows || []).forEach(r => {
      if (!window.isOpdRoomMatch || !window.isOpdRoomMatch(r.Department)) return;
      const d = r.Date ? new Date(r.Date) : null;
      roomAlerts.push({
        id: r.Visit_ID,
        patientName: r.Patient_Name || r.Patient_ID || '-',
        patientId: r.Patient_ID || '',
        department: r.Department || 'OPD',
        date: d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB') : '-',
        time: d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-'
      });
    });
    opdActiveRoomAlerts = roomAlerts;
  } catch (err) {
    console.warn('OPD room alert load failed:', err);
    opdActiveRoomAlerts = [];
  }

  (() => {
    const count = appointmentAlerts.length + roomAlerts.length;
    let badge = $('#bell-count');
    let header = $('#bell-header');
    let list = $('#bell-list');
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    if (count > 0) {
      badge.text(count).show();
      const roomLabel = window.getOpdMyRoom ? (window.getOpdMyRoom() || 'ທຸກຫ້ອງ') : 'ທຸກຫ້ອງ';
      header.html(`<span class="text-danger"><i class="fas fa-exclamation-circle"></i> ມີການແຈ້ງເຕືອນ ${count} ລາຍການ</span><div class="small text-muted mt-1">OPD: ${esc(roomLabel)}</div>`);
      let html = '';
      roomAlerts.forEach(a => {
        html += `<a href="#" class="his-dropdown-item py-2 border-bottom border-secondary border-opacity-25" onclick="window.loadView('opd_queue'); return false;">
                            <div class="d-flex align-items-center w-100">
                                <div class="me-3">
                                    <div class="bg-info text-white rounded-circle d-flex align-items-center justify-content-center" style="width:32px;height:32px; min-width:32px; font-size: 11px;">
                                        <i class="fas fa-user-md"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1 overflow-hidden" style="line-height: 1.2;">
                                    <h6 class="m-0 fw-bold mb-1" style="font-size:12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(a.patientName)}</h6>
                                    <div class="text-info opacity-100 mb-1" style="font-size:10.5px; font-weight: 500;">
                                        <i class="fas fa-door-open me-1" style="font-size: 9px;"></i>${esc(a.department)}
                                    </div>
                                    <div class="text-warning opacity-100" style="font-size:10.5px; font-weight: 600;">
                                        <i class="far fa-clock me-1" style="font-size: 9px;"></i>ລໍຖ້າກວດ (${esc(a.date)} ${esc(a.time)})
                                    </div>
                                </div>
                            </div>
                         </a>`;
      });
      appointmentAlerts.forEach(a => {
        let dateColor = a.isOverdue ? "text-danger fw-bold" : (a.daysOut === 0 ? "text-info fw-bold" : "text-warning");
        let label = a.isOverdue ? "ກາຍກຳນົດແລ້ວ!" : (a.daysOut === 0 ? "ມື້ນີ້!" : (a.daysOut === 1 ? "ມື້ອື່ນ" : `ອີກ ${a.daysOut} ວັນ`));
        let iconBg = a.isOverdue ? "bg-danger text-white" : "bg-light text-dark";
        let textType = a.type === 'Vaccine' ? '<span class="text-success">ວັກຊີນ</span>' : 'ທົ່ວໄປ';

        html += `<a href="#" class="his-dropdown-item py-2 border-bottom border-secondary border-opacity-25" onclick="window.loadView('appointments'); return false;">
                            <div class="d-flex align-items-center w-100">
                                <div class="me-3">
                                    <div class="${iconBg} rounded-circle d-flex align-items-center justify-content-center" style="width:32px;height:32px; min-width:32px; font-size: 11px;">
                                        <i class="fas ${a.type === 'Vaccine' ? 'fa-syringe' : 'fa-calendar-check'}"></i>
                                    </div>
                                </div>
                                <div class="flex-grow-1 overflow-hidden" style="line-height: 1.2;">
                                    <h6 class="m-0 fw-bold mb-1" style="font-size:12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(a.patientName)}</h6>
                                    <div class="text-info opacity-100 mb-1" style="font-size:10.5px; font-weight: 500;">
                                        <i class="fas fa-tag me-1" style="font-size: 9px;"></i>${esc(a.time)} - ${textType}
                                    </div>
                                    <div class="${dateColor} opacity-100" style="font-size:10.5px; font-weight: 600;">
                                        <i class="far fa-clock me-1" style="font-size: 9px;"></i>${label} (${esc(a.date)})
                                    </div>
                                </div>
                            </div>
                         </a>`;
      });
      list.html(html);
    } else {
      badge.hide();
      header.text('ບໍ່ມີການແຈ້ງເຕືອນ');
      list.html('<div class="text-center py-3 text-muted small">ບໍ່ມີຄິວ OPD ຂອງຫ້ອງນີ້ ຫຼື ນັດໝາຍໃນໄລຍະ 14 ວັນ</div>');
    }
  })();
};

window.renderNotifications = function () { window.checkAlerts(); };

window.preloadDropdownDataCallback = function (resolve) {
  let promises = [
    window.fetchSupabaseRows('Patients', { select: '*', orderBy: 'Patient_ID', ascending: false }).then((data) => {
      allPatientsList = (data || []).map(p => ({ id: p.Patient_ID, oldId: window.normalizePatientCode(p.Old_Patient_ID || ''), fullname: `${p.First_Name || ''} ${p.Last_Name || ''}`.trim() }));
      let opts = '<option value="">-- ຄົ້ນຫາ ແລະ ເລືອກຄົນເຈັບ --</option>';
      allPatientsList.forEach(p => { opts += `<option value="${p.id}">${p.id}${p.oldId ? ` / Old: ${p.oldId}` : ''} - ${p.fullname}</option>`; });
      if (typeof jQuery !== 'undefined') { $('#a_patient').html(opts).trigger('change'); $('#pv_patient').html(opts).trigger('change'); }
    }),
    supabaseClient.from(dbTable('Organizations')).select('Org_Code,Org_Name').eq('Status', 'Active').then(({ data }) => {
      activeOrgsList = [];
      let seenOpts = new Set();
      (data || []).forEach(r => {
        if (r.Org_Code && !seenOpts.has(r.Org_Code)) {
          seenOpts.add(r.Org_Code);
          activeOrgsList.push({ id: r.Org_Code, name: r.Org_Name });
        }
      });
      let opts = '<option value="">-- ຄົ້ນຫາ ແລະ ເລືອກອົງກອນ --</option>';
      activeOrgsList.forEach(o => { opts += `<option value="${o.id}">${o.id} - ${o.name}</option>`; });
      if (typeof jQuery !== 'undefined') { $('#a_org').html(opts).trigger('change'); }
    }),
    supabaseClient.from(dbTable('Drugs_Master')).select('Drug_ID,Drug_Name,Description').order('Drug_Name').then(({ data }) => {
      drugsMasterList = (data || []).map(r => ({ id: r.Drug_ID, name: r.Drug_Name, desc: r.Description || '' }));
      let o = '<option value="">-- ເລືອກຢາ --</option>';
      drugsMasterList.forEach(d => { o += `<option value="${d.name}">${d.name}${d.desc ? ' (' + d.desc + ')' : ''}</option>`; });
      if (typeof jQuery !== 'undefined') $('#emrAddDrugSelect').html(o).trigger('change');
    }),
    supabaseClient.from(dbTable('Labs_Master')).select('Lab_ID,Lab_Name,Description').order('Lab_Name').then(({ data }) => {
      labsMasterList = window.applyLabCategoriesToList((data || []).map(r => ({ id: r.Lab_ID, name: r.Lab_Name, desc: r.Description || '' })));
      if (document.getElementById('labCheckboxContainer')) window.renderEMRLabPicker();
    })
  ];
  Promise.all(promises).then(() => resolve());
}

window.preloadDropdownData = function () { window.preloadDropdownDataCallback(function () { }); };

window.currentDashRangeType = 'today';
window.currentDashShiftType = 'all';

window.getDashShiftBucket = function (dateValue) {
  const date = new Date(dateValue);
  const hours = date.getHours();
  if (Number.isNaN(hours)) return 'night';
  if (hours >= 8 && hours < 16) return 'morning';
  if (hours >= 16 && hours < 21) return 'evening';
  return 'night';
};

window.setDashRange = function (type) {
  window.currentDashRangeType = type;
  $('.dashboard-range-group .btn').removeClass('active btn-primary').addClass('btn-outline-primary');
  $('#btnDash' + type.charAt(0).toUpperCase() + type.slice(1)).addClass('active btn-primary').removeClass('btn-outline-primary');

  let start = new Date();
  let end = new Date();
  if (type === 'week') {
    let day = start.getDay() || 7;
    if (day !== 1) start.setDate(start.getDate() - (day - 1));
  } else if (type === 'month') {
    start.setDate(1);
  } else if (type === 'year') {
    start.setMonth(0, 1);
  }
  $('#dashStartDate').val(window.getLocalStr(start));
  $('#dashEndDate').val(window.getLocalStr(end));
  window.fetchDashboardData();
};

window.setDashShift = function (type) {
  window.currentDashShiftType = type;
  $('.dashboard-shift-group .btn').removeClass('active btn-primary').addClass('btn-outline-primary');
  $('#btnDashShift' + type.charAt(0).toUpperCase() + type.slice(1)).addClass('active btn-primary').removeClass('btn-outline-primary');
  window.fetchDashboardData();
};

window.fetchDashboardData = async function (rangeType) {
  let sDate = $('#dashStartDate').val();
  let eDate = $('#dashEndDate').val();
  if (!sDate || !eDate) return;

  if (rangeType === 'custom') {
    window.currentDashRangeType = 'custom';
    $('.dashboard-range-group .btn').removeClass('active btn-primary').addClass('btn-outline-primary');
  }

  const dashRangeLabels = {
    today: 'ມື້ນີ້',
    week: 'ອາທິດນີ້',
    month: 'ເດືອນນີ້',
    year: 'ປີນີ້',
    custom: 'ກຳນົດເອງ'
  };
  const dashShiftLabels = {
    all: 'ທັງໝົດ',
    morning: '08:00 - 16:00',
    evening: '16:00 - 21:00',
    night: '21:00 - 08:00'
  };
  const activeRangeType = window.currentDashRangeType || 'custom';
  const activeShiftType = window.currentDashShiftType || 'all';
  const visitRange = window.getLocalDateRangeIsoBounds(sDate, eDate);

  $('#dashReportStartLabel').text(sDate);
  $('#dashReportEndLabel').text(eDate);
  $('#dashRangePresetLabel').text(dashRangeLabels[activeRangeType] || dashRangeLabels.custom);
  $('#dashReportRangeLabel').text(sDate === eDate ? sDate : `${sDate} - ${eDate}`);
  $('#dashShiftLabel').text(dashShiftLabels[activeShiftType] || dashShiftLabels.all);
  let d = new Date();
  $('#dashRefreshTime').text(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
  $('#dash-total, #dash-new, #dash-old, #dash-inscorp').html('<i class="fas fa-spinner fa-spin"></i>');
  $('#dashOpdToday, #dashObservationPatients, #dashActiveIpd, #dashBedOccupancy').html('<i class="fas fa-spinner fa-spin"></i>');

  try {
    // 1. Fetch Visits with range (Strict Filtering)
    let data = [];
    let startRange = 0;
    while (true) {
      const { data: chunk, error } = await supabaseClient
        .from(dbTable('Visits'))
        .select('*')
        .gte('Date', visitRange.startIso)
        .lte('Date', visitRange.endIso)
        .range(startRange, startRange + 999);
      
      if (error) { 
        console.error('Dashboard Range Error:', error); 
        break; 
      }
      if (!chunk || chunk.length === 0) break;
      
      data = data.concat(chunk);
      if (chunk.length < 1000) break;
      startRange += 1000;
    }

    // De-duplicate by Visit_ID for extra safety
    const seenData = new Set();
    data = data.filter(v => {
      if (!v.Visit_ID || seenData.has(v.Visit_ID)) return false;
      seenData.add(v.Visit_ID);
      return true;
    });

    if (activeShiftType !== 'all') {
      data = data.filter(v => v.Date && window.getDashShiftBucket(v.Date) === activeShiftType);
    }

    console.log(`Dashboard Data Loaded: ${data.length} records for range ${sDate} to ${eDate} and shift ${activeShiftType}`);

    // 2. Fetch unique Patients involved (Paginated)
    const pIds = [...new Set(data.map(v => v.Patient_ID).filter(id => !!id))];
    let pMap = {};
    if (pIds.length > 0) {
      let pStart = 0;
      while (true) {
        const { data: pChunk, error: pError } = await supabaseClient.from(dbTable('Patients'))
          .select('*')
          .in('Patient_ID', pIds)
          .range(pStart, pStart + 999);
        if (pError || !pChunk || pChunk.length === 0) break;
        pChunk.forEach(p => pMap[p.Patient_ID] = p);
        if (pChunk.length < 1000) break;
        pStart += 1000;
      }
    }

    // 3. Mark "New" vs "Returning" - Same logic as Triage & Report
    let hasPreviousVisitMap = {};
    if (pIds.length > 0) {
      // First: Count visits per patient in current batch
      const patientVisitCount = {};
      const patientVisits = {};
      data.forEach(v => {
        if (!patientVisits[v.Patient_ID]) patientVisits[v.Patient_ID] = [];
        patientVisits[v.Patient_ID].push(v);
        patientVisitCount[v.Patient_ID] = (patientVisitCount[v.Patient_ID] || 0) + 1;
      });
      
      // For patients with multiple visits: sort by Date, 1st=NEW, 2nd+=RETURNING
      Object.keys(patientVisits).forEach(pid => {
        if (patientVisitCount[pid] > 1) {
          const sortedVisits = patientVisits[pid].sort((a, b) => new Date(a.Date) - new Date(b.Date));
          sortedVisits.slice(1).forEach((v, idx) => {
            const visitKey = `${v.Patient_ID}|${v.Date}`;
            hasPreviousVisitMap[visitKey] = true;
          });
        }
      });
      
      // Second: Check database for any other visits
      for (let i = 0; i < pIds.length; i += 100) {
        const chunkIds = pIds.slice(i, i + 100);
        const { data: allPatientVisits, error: avError } = await supabaseClient
          .from(dbTable('Visits'))
          .select('Visit_ID, Patient_ID, Date')
          .in('Patient_ID', chunkIds)
          .order('Date', { ascending: true });
        
        if (avError || !allPatientVisits || allPatientVisits.length === 0) break;
        
        const currentVisitKeys = new Set(
          data.map(v => `${v.Patient_ID}|${v.Date}`)
        );
        
        const patientPrevVisits = {};
        allPatientVisits.forEach(v => {
          const visitKey = `${v.Patient_ID}|${v.Date}`;
          if (!currentVisitKeys.has(visitKey)) {
            patientPrevVisits[v.Patient_ID] = true;
          }
        });
        
        data.forEach(v => {
          const visitKey = `${v.Patient_ID}|${v.Date}`;
          if (patientPrevVisits[v.Patient_ID]) {
            hasPreviousVisitMap[visitKey] = true;
          }
        });
        
        if (allPatientVisits.length < 1000) break;
      }
    }

    const visitsWithDetails = data.map(v => {
      const visitKey = `${v.Patient_ID}|${v.Date}`;
      return {
        ...v,
        Patients: pMap[v.Patient_ID] || {},
        isNew: !hasPreviousVisitMap[visitKey] // Check visit-specific key
      };
    });

    window.renderDashboardCharts(visitsWithDetails);
    window.updateDashboardOperationalStats(sDate, eDate, data);

  } catch (err) {
    console.error(' Dashboard Error:', err);
  }
};

window.updateDashboardOperationalStats = async function (sDate, eDate, visitsInRange) {
  try {
    const today = window.getLocalStr(new Date());
    const [obsRes, ipdRes, bedsRes] = await Promise.all([
      window.obsFrom(OPD_OBSERVATION_TABLE).select('observation_id,status', { count: 'exact' }).in('status', window.obsActiveStatuses),
      supabaseClient.from(dbTable('Admissions')).select('*').order('Created_At', { ascending: false }).limit(1000),
      supabaseClient.from(dbTable('Beds')).select('Bed_ID,Status,Bed_Status').limit(1000)
    ]);
    const admissions = ipdRes.data || [];
    const beds = bedsRes.data || [];
    const activeBeds = beds.filter(b => !['Inactive', 'Maintenance'].includes(String(b.Status || b.Bed_Status || '').trim()));
    const occupiedBeds = activeBeds.filter(b => String(b.Status || b.Bed_Status || '').trim() === 'Occupied').length;
    const occupancy = activeBeds.length ? Math.round((occupiedBeds / activeBeds.length) * 100) : 0;
    $('#dashOpdToday').text((visitsInRange || []).filter(v => window.getLocalDateKey(v.Date) === today).length);
    $('#dashObservationPatients').text(obsRes.count ?? (obsRes.data || []).length);
    $('#dashActiveIpd').text(admissions.filter(a => window.ipdIsActiveAdmission(a)).length);
    $('#dashBedOccupancy').text(`${occupancy}%`);
  } catch (err) {
    console.warn('Dashboard operational stats failed:', err);
    $('#dashOpdToday, #dashObservationPatients, #dashActiveIpd').text('0');
    $('#dashBedOccupancy').text('0%');
  }
};

window.dashboardChartIds = ['chartTopServices', 'chartRevenue', 'chartSpecialist', 'chartMarketing', 'chartGender', 'chartDept', 'chartSite', 'chartTime', 'chartAge', 'chartProvince'];

window.refreshDashboardChartLayout = function () {
  const resizeCharts = () => {
    window.dashboardChartIds.forEach((chartId) => {
      const chart = chartInstances[chartId];
      const canvas = document.getElementById(chartId);
      if (!chart || !canvas || !canvas.isConnected) return;

      const parent = canvas.parentElement;
      if (!parent || parent.clientWidth === 0 || parent.clientHeight === 0) return;

      chart.resize();
      chart.update('none');
    });
  };

  [0, 120, 400].forEach((delay) => {
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resizeCharts);
      });
    }, delay);
  });
};

window.createChart = function (ctxId, type, labels, data, colors, isHorizontal = false) {
  if (chartInstances[ctxId]) chartInstances[ctxId].destroy();
  const el = document.getElementById(ctxId);
  if (!el) return;
  const ctx = el.getContext('2d');
  const safeLabels = (Array.isArray(labels) && labels.length > 0) ? labels : ['No data'];
  const safeData = (Array.isArray(data) && data.length > 0) ? data.map(value => Number(value) || 0) : [0];
  const hasUsableData = safeData.some(value => value > 0);
  const compactDashboardCharts = new Set(['chartTopServices', 'chartRevenue', 'chartSpecialist', 'chartGender', 'chartDept', 'chartSite', 'chartTime', 'chartAge', 'chartProvince', 'chartMarketing']);
  const isCompactDashboardChart = compactDashboardCharts.has(ctxId);
  const legendFontSize = isCompactDashboardChart ? 8 : 10;
  const tickFontSize = isCompactDashboardChart ? 8 : 10;
  const yTickFontSize = isCompactDashboardChart ? 9 : 11;
  const dataLabelSize = isCompactDashboardChart ? 8 : 10;
  const layoutPadding = isCompactDashboardChart
    ? { right: isHorizontal ? 30 : 8, top: isHorizontal ? 6 : 16, left: 4, bottom: 4 }
    : { right: isHorizontal ? 60 : 15, top: isHorizontal ? 10 : 35, left: 10, bottom: 10 };

  let options = {
    responsive: true, maintainAspectRatio: false,
    indexAxis: isHorizontal ? 'y' : 'x',
    plugins: {
      legend: { 
        display: !['bar'].includes(type) && safeLabels.length > 0 && hasUsableData,
        position: 'bottom',
        labels: { boxWidth: isCompactDashboardChart ? 8 : 10, padding: isCompactDashboardChart ? 8 : 15, font: { size: legendFontSize, family: "'Noto Sans Lao', sans-serif" } }
      },
      tooltip: {
        enabled: hasUsableData,
        backgroundColor: 'rgba(2, 6, 23, 0.95)',
        padding: 10,
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
        cornerRadius: 6,
        displayColors: true
      },
      datalabels: {
        display: (ctx) => {
          if (!hasUsableData) return false;
          const value = ctx.dataset.data[ctx.dataIndex];
          if (!(value > 0)) return false;
          if (isCompactDashboardChart) return safeData.length <= (isHorizontal ? 6 : 5);
          return true;
        },
        color: (type === 'bar' || isHorizontal) ? '#334155' : '#ffffff',
        font: { weight: '700', size: dataLabelSize },
        anchor: (type === 'bar' || isHorizontal) ? 'end' : 'center',
        align: (type === 'bar' || isHorizontal) ? (isHorizontal ? 'end' : 'top') : 'center',
        offset: isCompactDashboardChart ? 4 : 8
      },
      dashboardNoDataOverlay: {
        enabled: !hasUsableData,
        message: 'ບໍ່ພົບຂໍ້ມູນ',
        submessage: 'ລອງປ່ຽນວັນທີ ຫຼື ຊ່ວງເວລາ'
      }
    },
    scales: type === 'bar' ? {
      x: isHorizontal ? { 
          beginAtZero: true, 
          display: hasUsableData,
          grid: { color: '#f1f5f9', drawBorder: false, display: hasUsableData }, 
          ticks: { precision: 0, font: { size: tickFontSize }, display: hasUsableData } 
        } : { 
          display: hasUsableData,
          grid: { display: false },
          ticks: { font: { size: tickFontSize }, display: hasUsableData }
        },
      y: isHorizontal ? { 
          display: hasUsableData,
          grid: { display: false },
          ticks: { font: { size: yTickFontSize }, autoSkip: false, display: hasUsableData },
          position: 'left'
        } : { 
          beginAtZero: true, 
          display: hasUsableData,
          grid: { color: '#f1f5f9', drawBorder: false, display: hasUsableData }, 
          ticks: { precision: 0, font: { size: tickFontSize }, display: hasUsableData } 
        }
    } : {
      x: { display: false },
      y: { display: false }
    },
    layout: { padding: layoutPadding }
  };
  
  const datasetConfig = {
    data: safeData,
    backgroundColor: colors.length > 1 ? colors : colors[0],
    borderRadius: isCompactDashboardChart ? 3 : 4,
    barThickness: safeData.length === 1 ? (isCompactDashboardChart ? 24 : 40) : (safeData.length < 5 ? (isCompactDashboardChart ? 18 : 30) : 'flex'),
    maxBarThickness: isCompactDashboardChart ? 28 : 45,
    minBarLength: isCompactDashboardChart ? 3 : 5,
    categoryPercentage: isCompactDashboardChart ? 0.72 : 0.8,
    barPercentage: isCompactDashboardChart ? 0.82 : 0.9
  };

  chartInstances[ctxId] = new Chart(ctx, { 
    type: type, 
    data: { labels: safeLabels, datasets: [datasetConfig] }, 
    options: options 
  });
};

window.renderDashboardCharts = function (visits) {
  if (!visits) return;

  // 1. Stats
  let total = visits.length;
  let newPatients = 0;
  let oldPatients = 0;

  // We need to fetch all-time visits for these patients to see who is truly "New"
  // However, for dashboard, if we have the isNew flag pre-calculated it would be better.
  // Let's rely on a more efficient way or assume visits data passed here might have it.
  visits.forEach(v => {
    if (v.isNew) newPatients++;
    else oldPatients++;
  });

  // Robust comparison for Insurance/Corporate
  let insCorp = visits.filter(v => {
    let rg = (v.Revenue_Group || v.RevenueGroup || v["Revenue Group"] || "").toString();
    let vt = (v.Visit_Type || v.VisitType || "").toString();
    return (rg && rg !== 'General Cash') || vt.toLowerCase().includes('package');
  }).length;

  $('#dash-total').text(total);
  $('#dash-new').text(newPatients);
  $('#dash-old').text(oldPatients);
  $('#dash-inscorp').text(insCorp);

  // 2. Helper with Grouping
  const getTopNWithOthers = (map, n = 5, minPercent = 0.01) => {
    let entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    let total = entries.reduce((acc, curr) => acc + curr[1], 0);
    if (total === 0) return { labels: [], data: [] };

    // Threshold grouping
    let mainEntries = entries.filter(e => e[1] / total >= minPercent);
    let otherEntries = entries.filter(e => e[1] / total < minPercent);

    // Limit to N most frequent
    if (mainEntries.length > n) {
      otherEntries = otherEntries.concat(mainEntries.slice(n));
      mainEntries = mainEntries.slice(0, n);
    }

    let labels = mainEntries.map(e => e[0]);
    let data = mainEntries.map(e => e[1]);

    if (otherEntries.length > 0) {
      let otherSum = otherEntries.reduce((acc, curr) => acc + curr[1], 0);
      if (otherSum > 0) {
        labels.push("ອື່ນໆ (Other)");
        data.push(otherSum);
      }
    }
    return { labels, data };
  };

  // 3. Process data
  const dashShiftSlotLabels = {
    morning: '08:00 - 16:00',
    evening: '16:00 - 21:00',
    night: '21:00 - 08:00'
  };
  let services = {}, revenue = {}, specialist = {}, gender = {}, deptType = {}, site = {}, opdGender = {}, timeSlot = {
    '08:00 - 16:00': 0,
    '16:00 - 21:00': 0,
    '21:00 - 08:00': 0
  }, ageGroup = {}, district = {}, doctors = {};

  visits.forEach(v => {
    let p = v.Patients || {};
    
    let servicesStr = v.Services_List || v.ServicesList || v["Services List"] || "";
    let revenueVal = v.Revenue_Group || v.RevenueGroup || v["Revenue Group"] || "";
    let specialistVal = v.Mapped_Specialist || v.MappedSpecialist || v["Specialist"] || "";
    let visitType = v.Visit_Type || v.VisitType || "";
    let docName = v.Doctor_Name || v.DoctorName || v["Doctor Name"] || "ບໍ່ລະບຸຊື່ແພດ";

    if (servicesStr) servicesStr.split(',').forEach(s => { let n = s.trim(); if(n) services[n] = (services[n] || 0) + 1; });
    
    if (revenueVal) revenueVal.split(',').forEach(r => { let n = r.trim(); if(n) revenue[n] = (revenue[n] || 0) + 1; });
    if (specialistVal) specialistVal.split(',').forEach(s => { let n = s.trim(); if(n) specialist[n] = (specialist[n] || 0) + 1; });
    
    // Heuristic: only count doctors if they have a specialist assigned (to filter out nurses)
    if (docName && docName !== "ບໍ່ລະບຸຊື່ແພດ" && specialistVal && specialistVal !== "-") {
      doctors[docName] = (doctors[docName] || 0) + 1;
    }

    let g = p.Gender || "ບໍ່ລະບຸ";
    gender[g] = (gender[g] || 0) + 1;
    if (visitType === 'OPD') opdGender[g] = (opdGender[g] || 0) + 1;

    let age = parseInt(p.Age);
    if (!isNaN(age)) {
      let grp = age < 15 ? "0-14" : (age < 35 ? "15-34" : (age < 60 ? "35-59" : "60+"));
      ageGroup[grp] = (ageGroup[grp] || 0) + 1;
    }
    
    let dist = p.District || p.district || "";
    if (dist) district[dist] = (district[dist] || 0) + 1;

    // Simplified Dept Type: OPD only
    let dept = (visitType || "").toString().toUpperCase();
    if (dept) deptType['OPD'] = (deptType['OPD'] || 0) + 1;

    // Simplified Site: In-site vs Out-site
    let sValue = (v.Site || "In-site").toString().toLowerCase();
    let siteKey = (sValue.includes('on') || sValue.includes('out')) ? 'Out-site' : 'In-site';
    site[siteKey] = (site[siteKey] || 0) + 1;

    if (v.Date) {
      const shiftKey = window.getDashShiftBucket(v.Date);
      const slot = dashShiftSlotLabels[shiftKey];
      timeSlot[slot] = (timeSlot[slot] || 0) + 1;
    }
  });

  const palette = ['#1B6BB0', '#3a8dc7', '#115892', '#7baede', '#DD1F26', '#f59ea3', '#ff7a15', '#94a3b8', '#0a4775', '#ffbf00'];
  
  let topSvc = getTopNWithOthers(services, 10, 0.001);
  let topRev = getTopNWithOthers(revenue, 8, 0.005);
  let topSpec = getTopNWithOthers(specialist, 8, 0.005);
  let topDist = getTopNWithOthers(district, 5, 0.001);
  let topDocs = getTopNWithOthers(doctors, 5, 0.0001);

  window.createChart('chartTopServices', 'bar', topSvc.labels, topSvc.data, palette, true);
  window.createChart('chartRevenue', 'bar', topRev.labels, topRev.data, palette, true);
  window.createChart('chartSpecialist', 'bar', topSpec.labels, topSpec.data, palette, true);
  window.createChart('chartMarketing', 'bar', topDocs.labels, topDocs.data, palette, true);
  window.createChart('chartGender', 'doughnut', Object.keys(gender), Object.values(gender), ['#1B6BB0', '#DD1F26', '#94a3b8']);
  window.createChart('chartDept', 'pie', Object.keys(deptType), Object.values(deptType), ['#1B6BB0', '#DD1F26']);
  window.createChart('chartSite', 'pie', Object.keys(site), Object.values(site), ['#7baede', '#3a8dc7']);
  
  window.createChart('chartTime', 'bar', Object.keys(timeSlot), Object.values(timeSlot), [palette[2], palette[1], palette[7]], false);
  window.createChart('chartAge', 'bar', ["0-14", "15-34", "35-59", "60+"], ["0-14", "15-34", "35-59", "60+"].map(k => ageGroup[k] || 0), [palette[2], palette[0], palette[3], palette[1]], false);
  window.createChart('chartProvince', 'bar', topDist.labels, topDist.data, palette, true);
  window.refreshDashboardChartLayout();
};

window.exportDashboardPDF = function () {
  const source = document.getElementById('dashboardPrintArea');
  const pages = source ? Array.from(source.querySelectorAll('.dashboard-report-page--spread')) : [];

  if (!source || pages.length === 0) {
    return Swal.fire('ຜິດພາດ', 'ບໍ່ພົບ dashboard ສຳລັບ export', 'error');
  }

  if (typeof html2pdf === 'undefined') {
    return Swal.fire('ຜິດພາດ', 'ບໍ່ພົບຕົວຊ່ວຍສ້າງ PDF', 'error');
  }

  const opt = {
    margin: 0,
    filename: 'HIS_Dashboard_Landscape_Report.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: source.scrollWidth,
      windowHeight: source.scrollHeight
    },
    pagebreak: { mode: ['css', 'legacy'] },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };

  Swal.fire({ title: 'ກຳລັງສ້າງ PDF...', didOpen: () => { Swal.showLoading() } });

  const runExport = async () => {
    try {
      source.classList.add('dashboard-export-mode');

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const seedNode = document.createElement('div');
      seedNode.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(seedNode);

      const seedWorker = html2pdf().set(opt).from(seedNode).toPdf();
      await seedWorker;
      const pdf = await seedWorker.get('pdf');
      seedNode.remove();

      for (let index = 0; index < pages.length; index += 1) {
        const canvasWorker = html2pdf().set(opt).from(pages[index]).toCanvas();
        await canvasWorker;
        const canvas = await canvasWorker.get('canvas');

        if (!canvas || !canvas.width || !canvas.height) {
          throw new Error(`Dashboard page ${index + 1} could not be rendered for PDF export`);
        }

        if (index > 0) {
          pdf.addPage('a4', 'landscape');
        }
        if (typeof pdf.setPage === 'function') {
          pdf.setPage(index + 1);
        }
        pdf.addImage(
          canvas.toDataURL('image/jpeg', 0.98),
          'JPEG',
          0,
          0,
          297,
          210,
          `dashboard-page-${index + 1}`,
          'FAST'
        );
      }

      pdf.save(opt.filename);
    } catch (err) {
      console.error('Dashboard PDF Error:', err);
      Swal.fire('ຜິດພາດ', 'ບໍ່ສາມາດສ້າງ PDF ໄດ້', 'error');
    } finally {
      source.classList.remove('dashboard-export-mode');
      Swal.close();
    }
  };

  runExport();
};

window.setReportRange = function (type) {
  $('.btn-group .btn').removeClass('active btn-primary').addClass('btn-outline-primary');
  $('#btnRep' + type.charAt(0).toUpperCase() + type.slice(1)).addClass('active btn-primary').removeClass('btn-outline-primary');

  let start = new Date();
  let end = new Date();
  if (type === 'week') {
    let day = start.getDay() || 7;
    if (day !== 1) start.setDate(start.getDate() - (day - 1));
  } else if (type === 'month') {
    start.setDate(1);
  } else if (type === 'year') {
    start.setMonth(0, 1);
  }
  $('#repStartDate').val(window.getLocalStr(start));
  $('#repEndDate').val(window.getLocalStr(end));
  window.fetchReportData();
};

window.fetchReportData = function () {
  let sDate = $('#repStartDate').val();
  let eDate = $('#repEndDate').val();
  if (!sDate || !eDate) return;
  let d = new Date();
  $('#repRefreshTime').text(`ອັບເດດ: ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
  if ($.fn.DataTable.isDataTable('#reportTable')) { $('#reportTable').DataTable().destroy(); }
  $('#reportTable tbody').html('<tr><td colspan="9" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div> ກຳລັງໂຫຼດຂໍ້ມູນ...</td></tr>');
  window._fetchReportData(sDate, eDate);
};

// Pipeline helpers
window.getPatientStage = function (visit) {
  if (!visit) return 1; // ລົງທະບຽນເທົ່ານັ້ນ
  const s = window.normalizeVisitStatus(visit.Status);
  const dischargeStatus = (visit.Discharge_Status || '').toString();
  if (s === 'OPD Observation' || s === 'Admit IPD' || /ຕິດຕາມ OPD|ນອນ IPD/.test(dischargeStatus)) return 5;
  if (s === 'Waiting Lab' || s === 'Calling Lab' || /Waiting Lab/i.test(dischargeStatus)) return 4;
  if (s === 'Waiting OPD' || s === 'Calling OPD') return 3;
  if (s === 'Triage' || s === 'Waiting Triage' || s === 'Calling Triage') return 2;
  if (s === 'Pharmacy' || s === 'Done' || s === 'Completed') return 5;
  if (dischargeStatus && !/Waiting Lab/i.test(dischargeStatus)) return 5;
  return 2;
};

window.normalizeVisitStatus = function (status) {
  const raw = (status || '').toString().trim();
  if (!raw) return '';
  if (/^calling\s+triage/i.test(raw)) return 'Calling Triage';
  if (/^(triage|waiting\s+triage)/i.test(raw)) return 'Triage';
  if (/^calling\s+opd/i.test(raw)) return 'Calling OPD';
  if (/^waiting\s+opd/i.test(raw)) return 'Waiting OPD';
  if (/^calling\s+lab/i.test(raw)) return 'Calling Lab';
  if (/^waiting\s+lab/i.test(raw)) return 'Waiting Lab';
  if (/^completed$/i.test(raw)) return 'Completed';
  if (/^done$/i.test(raw)) return 'Done';
  if (/^pharmacy$/i.test(raw)) return 'Pharmacy';
  if (/^transfer$/i.test(raw)) return 'Transfer';
  if (/^admit$/i.test(raw)) return 'Admit';
  return raw;
};

window.generateUniqueVisitId = async function () {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const candidate = `V${yy}${mm}${dd}-${hh}${mi}${ss}${ms}`;
    const { data, error } = await supabaseClient.from(dbTable('Visits')).select('Visit_ID').eq('Visit_ID', candidate).limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return candidate;
  }
  throw new Error('ບໍ່ສາມາດສ້າງ Visit ID ໃໝ່ໄດ້');
};

window.isSuspiciousDuplicateVisit = function (visit, duplicateVisitMap) {
  if (!visit?.Visit_ID || !duplicateVisitMap?.[visit.Visit_ID]) return false;
  const normalizedStatus = window.normalizeVisitStatus(visit.Status);
  return duplicateVisitMap[visit.Visit_ID] > 1
    && !visit.Department
    && ['Waiting OPD', 'Calling OPD', 'Waiting Lab', 'Calling Lab', 'Completed', 'Done', 'Pharmacy'].includes(normalizedStatus);
};

window.resolvePipelineOutcome = function (visit) {
  const ds = String(visit?.Discharge_Status || '').trim();
  const status = window.normalizeVisitStatus(visit?.Status || '');
  if (/ນອນ IPD|Admit IPD/i.test(ds) || status === 'Admit IPD') {
    return { icon: 'fa-bed', label: 'IPD', color: '#dc2626' };
  }
  if (/ຕິດຕາມ OPD|Observation/i.test(ds) || status === 'OPD Observation') {
    return { icon: 'fa-notes-medical', label: 'ຕິດຕາມ', color: '#f59e0b' };
  }
  if (/Transfer|ສົ່ງຕໍ່/i.test(ds) || status === 'Transfer') {
    return { icon: 'fa-ambulance', label: 'ສົ່ງຕໍ່', color: '#6b7280' };
  }
  if (/ຮັບຢາ|Pharmacy/i.test(ds) || status === 'Pharmacy') {
    return { icon: 'fa-pills', label: 'ຮັບຢາ', color: '#16a34a' };
  }
  return { icon: 'fa-check-circle', label: 'ສຳເລັດ', color: '#16a34a' };
};

window.renderPipeline = function (stage, visit) {
  const outcome = visit ? window.resolvePipelineOutcome(visit) : { icon: 'fa-check-circle', label: 'ສຳເລັດ', color: '#16a34a' };
  const steps = [
    { icon: 'fa-user-plus', label: 'ລົງທະບຽນ' },
    { icon: 'fa-clipboard-list', label: 'ຊັກປະຫວັດ' },
    { icon: 'fa-stethoscope', label: 'ຫ້ອງກວດ' },
    { icon: 'fa-flask', label: 'ຖ້າຜົນ' },
    { icon: outcome.icon, label: outcome.label, finalColor: outcome.color },
  ];
  let h = '<div style="display:flex;align-items:center;padding:4px 0">';
  steps.forEach((s, i) => {
    const done = i + 1 < stage;
    const active = i + 1 === stage;
    const isFinal = i === steps.length - 1;
    const finalReached = isFinal && stage >= steps.length;
    let bg, tc, lc;
    if (finalReached && s.finalColor) {
      bg = s.finalColor; tc = '#fff'; lc = s.finalColor;
    } else if (done) { bg = '#1B6BB0'; tc = '#fff'; lc = '#115892'; }
    else if (active) { bg = '#DD1F26'; tc = '#fff'; lc = '#115892'; }
    else { bg = '#e2e8f0'; tc = '#94a3b8'; lc = '#94a3b8'; }
    if (i > 0) {
      const cc = i < stage - 1 ? '#1B6BB0' : (finalReached ? bg : '#e2e8f0');
      h += `<div style="flex:1;height:3px;background:${cc};margin-bottom:20px;min-width:6px"></div>`;
    }
    h += `<div style="text-align:center;flex-shrink:0">
      <div style="width:30px;height:30px;border-radius:50%;background:${bg};color:${tc};display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:11px;box-shadow:0 2px 5px rgba(0,0,0,.15)${active ? ';outline:3px solid ' + bg + '44' : ''}">
        <i class="fas ${s.icon}"></i>
      </div>
      <div style="font-size:8.5px;color:${lc};font-weight:700;margin-top:3px;white-space:nowrap">${s.label}</div>
    </div>`;
  });
  h += '</div>';
  return h;
};

window.buildPatientVisitSummaryData = async function (sDate, eDate) {
  const visitRange = window.getLocalDateRangeIsoBounds(sDate, eDate);

  // 1A. Fetch Patients registered in date range
  let patientMap = {};
  let pStart = 0;
  while (true) {
    const { data: chunk, error: pErr } = await supabaseClient.from(dbTable('Patients'))
      .select('*')
      .gte('Registration_Date', sDate)
      .lte('Registration_Date', eDate)
      .not('Registration_Date', 'is', null)
      .order('Registration_Date', { ascending: false })
      .range(pStart, pStart + 999);
    if (pErr) throw pErr;
    if (!chunk || chunk.length === 0) break;
    chunk.forEach(p => { patientMap[p.Patient_ID] = p; });
    if (chunk.length < 1000) break;
    pStart += 1000;
  }

  // 1B. Fetch visits in date range so returning patients registered earlier are included
  let visitsInRange = [];
  let vStart = 0;
  while (true) {
    const { data: chunk, error: vErr } = await supabaseClient.from(dbTable('Visits'))
      .select('Patient_ID, Patient_Name, Date, Status, Department, Visit_Type, Symptoms, Diagnosis, Doctor_Name, Lab_Orders_JSON, Prescription_JSON, Discharge_Status, Visit_ID, BP, Temp, Pulse, Weight, Height, SpO2, Advice, Follow_Up, Physical_Exam')
      .gte('Date', visitRange.startIso)
      .lte('Date', visitRange.endIso)
      .not('Date', 'is', null)
      .order('Date', { ascending: false })
      .range(vStart, vStart + 999);
    if (vErr) throw vErr;
    if (!chunk || chunk.length === 0) break;
    visitsInRange = visitsInRange.concat(chunk);
    if (chunk.length < 1000) break;
    vStart += 1000;
  }

  const duplicateVisitMap = {};
  visitsInRange.forEach(v => {
    if (!v?.Visit_ID) return;
    duplicateVisitMap[v.Visit_ID] = (duplicateVisitMap[v.Visit_ID] || 0) + 1;
  });
  visitsInRange = visitsInRange.filter(v => !window.isSuspiciousDuplicateVisit(v, duplicateVisitMap));

  const extraPIds = [...new Set(visitsInRange.map(v => v.Patient_ID).filter(id => id && !patientMap[id]))];
  if (extraPIds.length > 0) {
    for (let i = 0; i < extraPIds.length; i += 100) {
      const chunk = extraPIds.slice(i, i + 100);
      const { data: extra } = await supabaseClient.from(dbTable('Patients')).select('*').in('Patient_ID', chunk);
      (extra || []).forEach(p => { patientMap[p.Patient_ID] = p; });
    }
  }

  const allPatients = Object.values(patientMap);
  if (allPatients.length === 0) return [];

  const allPIds = allPatients.map(p => p.Patient_ID);
  let visitsByPatient = {};
  let visitCountMap = {};
  let rangeVisitCountMap = {};

  visitsInRange.forEach(v => {
    if (!v.Patient_ID) return;
    rangeVisitCountMap[v.Patient_ID] = (rangeVisitCountMap[v.Patient_ID] || 0) + 1;
    if (!visitsByPatient[v.Patient_ID]) visitsByPatient[v.Patient_ID] = [];
    visitsByPatient[v.Patient_ID].push(v);
  });

  for (let i = 0; i < allPIds.length; i += 100) {
    const chunk = allPIds.slice(i, i + 100);
    const { data: allV } = await supabaseClient.from(dbTable('Visits'))
      .select('Patient_ID')
      .in('Patient_ID', chunk);
    const counts = {};
    (allV || []).forEach(v => { counts[v.Patient_ID] = (counts[v.Patient_ID] || 0) + 1; });
    Object.assign(visitCountMap, counts);
  }

  return allPatients.map(p => {
    const candidateVisits = visitsByPatient[p.Patient_ID] || [];
    const visit = candidateVisits.length > 0 ? candidateVisits[0] : null;
    const visitDate = visit ? new Date(visit.Date) : null;
    const regDate = p.Registration_Date ? new Date(p.Registration_Date) : null;
    const displayDate = visitDate || regDate;
    const totalVisitCount = visitCountMap[p.Patient_ID] || 0;

    return {
      ...p,
      ...(visit || {}),
      _sortDate: displayDate ? displayDate.toISOString() : '',
      date: displayDate ? displayDate.toLocaleDateString('en-GB') : '-',
      time: visit ? visitDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : (p.Time || '-'),
      id: p.Patient_ID,
      name: `${p.First_Name || ''} ${p.Last_Name || ''}`.trim() || p.Patient_ID,
      displayName: `${p.Title || ''} ${p.First_Name || ''} ${p.Last_Name || ''}`.trim() || `${p.First_Name || ''} ${p.Last_Name || ''}`.trim() || p.Patient_ID,
      gender: p.Gender || '-',
      age: p.Age || '-',
      status: visit ? (totalVisitCount > 1 ? 'ເກົ່າ' : 'ໃໝ່') : '-',
      visitCount: totalVisitCount,
      rangeVisitCount: rangeVisitCountMap[p.Patient_ID] || 0,
      department: visit?.Department || visit?.Visit_Type || 'OPD',
      type: visit?.Visit_Type || 'OPD',
      latestVisit: visit,
    };
  }).sort((a, b) => {
    if (a._sortDate === b._sortDate) return 0;
    return b._sortDate > a._sortDate ? 1 : -1;
  });
};

window._fetchReportData = async function (sDate, eDate) {
  try {
    const processed = await window.buildPatientVisitSummaryData(sDate, eDate);
    window.renderReportPage(processed);
    window.updateReportObservationStats(sDate, eDate);
  } catch (err) {
    console.error('Report Fetch Error:', err);
    Swal.fire('Error', 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນລາຍງານໄດ້: ' + err.message, 'error');
    window.renderReportPage([]);
  }
};

window.renderReportPage = function (res) {
  currentReportData = res || [];
  if ($.fn.DataTable.isDataTable('#reportTable')) $('#reportTable').DataTable().destroy();

  // Update summary cards
  const total = res.length;
  const done = res.filter(r => window.getPatientStage(r.latestVisit) === 5).length;
  const inProgress = res.filter(r => { const s = window.getPatientStage(r.latestVisit); return s >= 2 && s < 5; }).length;
  const noVisit = res.filter(r => !r.latestVisit).length;
  $('#repTotal').text(total);
  $('#repDone').text(done);
  $('#repInProgress').text(inProgress);
  $('#repNoVisit').text(noVisit);

  if (!res || res.length === 0) {
    $('#reportTable tbody').empty();
    $('#reportTable').DataTable({ language: { emptyTable: "ບໍ່ມີຂໍ້ມູນໃນຊ່ວງວັນທີນີ້", search: "ຄົ້ນຫາ:" } });
    return;
  }

  let h = '';
  res.forEach((r, i) => {
    const stage = window.getPatientStage(r.latestVisit);
    const pipeline = window.renderPipeline(stage, r.latestVisit);
    const patientStatus = r.status === 'ໃໝ່'
      ? '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">ຄົນເຈັບໃໝ່</span>'
      : r.status === 'ເກົ່າ'
        ? '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1">ຄົນເຈັບເກົ່າ</span>'
        : '<span class="badge bg-light text-muted border px-2 py-1">ຍັງບໍ່ເຂົ້າກວດ</span>';
    const departmentBadge = `<span class="badge bg-light text-dark border px-2 py-1">${r.department || 'OPD'}</span>`;
    const act = `<button class="btn btn-sm btn-outline-primary shadow-sm" onclick="window.viewReportDetail(${i})"><i class="fas fa-eye me-1"></i>ເບິ່ງ</button>`;
    h += `<tr>
      <td data-order="${r.Registration_Date || ''}">${r.date}</td>
      <td>${r.time}</td>
      <td class="text-primary fw-bold" style="font-size:12px">${r.id}</td>
      <td class="fw-bold">${r.name}</td>
      <td>${r.gender}</td>
      <td>${r.age}</td>
      <td>${patientStatus}</td>
      <td>${departmentBadge}</td>
      <td style="min-width:300px;padding:6px 8px">${pipeline}</td>
      <td class="text-center">${act}</td>
    </tr>`;
  });

  $('#reportTable tbody').html(h);
  $('#reportTable').DataTable({
    pageLength: 15,
    order: [[0, 'desc']],
    columnDefs: [{ orderable: false, targets: [8, 9] }],
    language: {
      search: "ຄົ້ນຫາ:", lengthMenu: "ສະແດງ _MENU_",
      info: "ສະແດງ _START_ ຫາ _END_ ຈາກ _TOTAL_ ລາຍການ",
      paginate: { previous: "ກ່ອນໜ້າ", next: "ຕໍ່ໄປ" },
      emptyTable: "ບໍ່ມີຂໍ້ມູນ"
    }
  });
};

window.searchReportTable = function () {
  let query = $('#repSearchInput').val().toLowerCase();
  if (!$.fn.DataTable.isDataTable('#reportTable')) return;
  
  let table = $('#reportTable').DataTable();
  table.search(query).draw();
};

window.setVisitHistoryRange = function (type) {
  $('#visitHistoryRangeButtons .btn').removeClass('active btn-primary').addClass('btn-outline-primary');
  $('#btnVisit' + type.charAt(0).toUpperCase() + type.slice(1)).addClass('active btn-primary').removeClass('btn-outline-primary');

  let start = new Date();
  let end = new Date();
  if (type === 'week') {
    let day = start.getDay() || 7;
    if (day !== 1) start.setDate(start.getDate() - (day - 1));
  } else if (type === 'month') {
    start.setDate(1);
  } else if (type === 'year') {
    start.setMonth(0, 1);
  }
  $('#visitStartDate').val(window.getLocalStr(start));
  $('#visitEndDate').val(window.getLocalStr(end));
  window.fetchVisitHistoryData();
};

window.fetchVisitHistoryData = function () {
  let sDate = $('#visitStartDate').val();
  let eDate = $('#visitEndDate').val();
  if (!sDate || !eDate) return;

  let d = new Date();
  $('#visitRefreshTime').text(`ອັບເດດ: ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
  if ($.fn.DataTable.isDataTable('#visitHistoryTable')) $('#visitHistoryTable').DataTable().destroy();
  $('#visitHistoryTable tbody').html('<tr><td colspan="9" class="text-center py-4"><div class="spinner-border text-info spinner-border-sm"></div> ກຳລັງໂຫຼດປະຫວັດ...</td></tr>');
  window._fetchVisitHistoryData(sDate, eDate);
};

window._fetchVisitHistoryData = async function (sDate, eDate) {
  try {
    const processed = await window.buildPatientVisitSummaryData(sDate, eDate);
    window.renderVisitHistoryPage(processed.filter(r => r.latestVisit));
  } catch (err) {
    console.error('Visit History Fetch Error:', err);
    Swal.fire('Error', 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນປະຫວັດການກວດໄດ້: ' + err.message, 'error');
    window.renderVisitHistoryPage([]);
  }
};

window.renderVisitCountBadge = function (count) {
  const visitCount = Number(count) || 0;
  let badgeClass = 'bg-info-subtle text-info border border-info-subtle';
  let iconClass = 'fas fa-notes-medical';

  if (visitCount >= 20) {
    badgeClass = 'bg-danger-subtle text-danger border border-danger-subtle';
    iconClass = 'fas fa-crown';
  } else if (visitCount >= 15) {
    badgeClass = 'bg-warning-subtle text-warning border border-warning-subtle';
    iconClass = 'fas fa-trophy';
  } else if (visitCount >= 10) {
    badgeClass = 'bg-primary-subtle text-primary border border-primary-subtle';
    iconClass = 'fas fa-medal';
  } else if (visitCount >= 5) {
    badgeClass = 'bg-success-subtle text-success border border-success-subtle';
    iconClass = 'fas fa-award';
  }

  return `<span class="badge ${badgeClass} px-2 py-1"><i class="${iconClass} me-1"></i>${visitCount} ຄັ້ງ</span>`;
};

window.renderVisitHistoryPage = function (rows) {
  currentVisitHistoryData = rows || [];
  if ($.fn.DataTable.isDataTable('#visitHistoryTable')) $('#visitHistoryTable').DataTable().destroy();

  if (!currentVisitHistoryData || currentVisitHistoryData.length === 0) {
    $('#visitHistoryTable tbody').empty();
    $('#visitHistoryTable').DataTable({
      language: { emptyTable: 'ບໍ່ມີປະຫວັດການກວດໃນຊ່ວງວັນທີນີ້', search: 'ຄົ້ນຫາ:' }
    });
    return;
  }

  let html = '';
  currentVisitHistoryData.forEach((row, index) => {
    const visitCountBadge = window.renderVisitCountBadge(row.visitCount);
    const departmentBadge = `<span class="badge bg-light text-dark border px-2 py-1">${row.department || row.type || 'OPD'}</span>`;
    const actionBtn = `<button class="btn btn-sm btn-outline-info shadow-sm" onclick="window.showPatientTimeline('${row.id}')"><i class="fas fa-history me-1"></i>ເບິ່ງປະຫວັດ</button>`;

    html += `<tr data-row-index="${index}">
      <td data-order="${row._sortDate || ''}">${row.date}</td>
      <td>${row.time}</td>
      <td class="text-primary fw-bold" style="font-size:12px">${row.id}</td>
      <td class="fw-bold">${row.displayName || row.name}</td>
      <td>${row.gender}</td>
      <td>${row.age}</td>
      <td>${visitCountBadge}</td>
      <td>${departmentBadge}</td>
      <td class="text-center">${actionBtn}</td>
    </tr>`;
  });

  $('#visitHistoryTable tbody').html(html);
  $('#visitHistoryTable').DataTable({
    pageLength: 15,
    order: [[0, 'desc']],
    columnDefs: [{ orderable: false, targets: [8] }],
    language: {
      search: 'ຄົ້ນຫາ:',
      lengthMenu: 'ສະແດງ _MENU_',
      info: 'ສະແດງ _START_ ຫາ _END_ ຈາກ _TOTAL_ ລາຍການ',
      paginate: { previous: 'ກ່ອນໜ້າ', next: 'ຕໍ່ໄປ' },
      emptyTable: 'ບໍ່ມີຂໍ້ມູນ'
    }
  });
};

window.searchVisitHistoryTable = function () {
  let query = $('#visitSearchInput').val().toLowerCase();
  if (!$.fn.DataTable.isDataTable('#visitHistoryTable')) return;

  let table = $('#visitHistoryTable').DataTable();
  table.search(query).draw();
};

window.getVisitHistoryExportRows = function () {
  if (!currentVisitHistoryData || currentVisitHistoryData.length === 0) return [];
  if (!$.fn.DataTable.isDataTable('#visitHistoryTable')) return currentVisitHistoryData;

  const table = $('#visitHistoryTable').DataTable();
  const nodes = table.rows({ search: 'applied' }).nodes().toArray();
  if (!nodes.length) return [];

  return nodes.map(node => {
    const index = Number(node.getAttribute('data-row-index'));
    return Number.isInteger(index) ? currentVisitHistoryData[index] : null;
  }).filter(Boolean);
};

window.exportVisitHistoryExcel = function () {
  const exportRows = window.getVisitHistoryExportRows();
  if (!exportRows.length) return Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ມີຂໍ້ມູນສຳລັບ Export', 'warning');

  const exportArr = exportRows.map(row => ({
    "ວັນທີ": row.date,
    "ເວລາ": row.time,
    "LXH": row.id,
    "ຊື່ ແລະ ນາມສະກຸນ": row.displayName || row.name,
    "ເພດ": row.gender,
    "ອາຍຸ": row.age,
    "ຈຳນວນຄັ້ງມາກວດ": row.visitCount || 0,
    "ຄັ້ງໃນຊ່ວງນີ້": row.rangeVisitCount || 0,
    "ພະແນກຫຼ້າສຸດ": row.department || row.type || 'OPD'
  }));

  const ws = XLSX.utils.json_to_sheet(exportArr);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'VisitHistory');
  XLSX.writeFile(wb, 'HIS_Visit_History.xlsx');
};

window.exportVisitHistoryPDF = function () {
  const exportRows = window.getVisitHistoryExportRows();
  if (!exportRows.length) return Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ມີຂໍ້ມູນສຳລັບ Export', 'warning');
  if (typeof html2pdf === 'undefined') return Swal.fire('ຜິດພາດ', 'ບໍ່ພົບຕົວຊ່ວຍສ້າງ PDF', 'error');

  const rangeText = `${$('#visitStartDate').val() || '-'} ຫາ ${$('#visitEndDate').val() || '-'}`;
  const searchText = ($('#visitSearchInput').val() || '').trim();
  const rowsHtml = exportRows.map((row, index) => `
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px;">${index + 1}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;">${row.date}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;">${row.time}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;">${row.id}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;">${row.displayName || row.name}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${row.gender}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${row.age}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${row.visitCount || 0}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;">${row.department || row.type || 'OPD'}</td>
    </tr>
  `).join('');

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1100px';
  container.style.background = '#ffffff';
  container.style.padding = '24px';
  container.style.fontFamily = "'Noto Sans Lao', sans-serif";
  container.innerHTML = `
    <div style="padding-bottom:16px;border-bottom:2px solid #e2e8f0;margin-bottom:16px;">
      <h2 style="margin:0;color:#0f172a;font-size:24px;">ປະຫວັດການກວດ</h2>
      <div style="margin-top:8px;color:#475569;font-size:13px;">ຊ່ວງວັນທີ: ${rangeText}</div>
      <div style="margin-top:4px;color:#475569;font-size:13px;">ຄົ້ນຫາ: ${searchText || '-'}</div>
      <div style="margin-top:4px;color:#475569;font-size:13px;">ຈຳນວນລາຍການ: ${exportRows.length}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;color:#0f172a;">
      <thead>
        <tr style="background:#eff6ff;">
          <th style="border:1px solid #cbd5e1;padding:8px;">#</th>
          <th style="border:1px solid #cbd5e1;padding:8px;">ວັນທີ</th>
          <th style="border:1px solid #cbd5e1;padding:8px;">ເວລາ</th>
          <th style="border:1px solid #cbd5e1;padding:8px;">LXH</th>
          <th style="border:1px solid #cbd5e1;padding:8px;">ຊື່ ແລະ ນາມສະກຸນ</th>
          <th style="border:1px solid #cbd5e1;padding:8px;">ເພດ</th>
          <th style="border:1px solid #cbd5e1;padding:8px;">ອາຍຸ</th>
          <th style="border:1px solid #cbd5e1;padding:8px;">ຈຳນວນຄັ້ງ</th>
          <th style="border:1px solid #cbd5e1;padding:8px;">ພະແນກຫຼ້າສຸດ</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;

  document.body.appendChild(container);
  const opt = {
    margin: 0.4,
    filename: 'HIS_Visit_History.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
  };

  Swal.fire({ title: 'ກຳລັງສ້າງ PDF...', didOpen: () => { Swal.showLoading(); } });
  html2pdf().set(opt).from(container).save().then(() => {
    container.remove();
    Swal.close();
  }).catch((error) => {
    container.remove();
    console.error('Visit History PDF Export Error:', error);
    Swal.fire('ຜິດພາດ', 'ບໍ່ສາມາດ Export PDF ໄດ້', 'error');
  });
};

window.exportReportExcel = function () {
  if (!currentReportData || currentReportData.length === 0) return Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ມີຂໍ້ມູນສຳລັບ Export', 'warning');
  const stageLabels = ['', 'ລົງທະບຽນ', 'ຊັກປະຫວັດ', 'ຫ້ອງກວດ', 'ຖ້າຜົນ', 'ສຳເລັດ'];
  const exportArr = currentReportData.map(r => ({
    "ວັນທີ": r.date, "ເວລາ": r.time, "ລະຫັດ": r.id,
    "ຊື່ ແລະ ນາມສະກຸນ": r.name, "ເພດ": r.gender, "ອາຍຸ": r.age,
    "ໃໝ່/ເກົ່າ": r.status === 'ໃໝ່' ? 'ຄົນເຈັບໃໝ່' : r.status === 'ເກົ່າ' ? 'ຄົນເຈັບເກົ່າ' : 'ຍັງບໍ່ເຂົ້າກວດ',
    "ພະແນກ": r.department || r.type,
    "ສະຖານະ (ຂັ້ນ)": stageLabels[window.getPatientStage(r.latestVisit)] || '-',
    "ສາຍຫາ": r.latestVisit?.Doctor_Name || '-',
    "ພະຍາດ": r.latestVisit?.Diagnosis || '-',
  }));
  const ws = XLSX.utils.json_to_sheet(exportArr);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, "HIS_Summary_Report.xlsx");
};

window.viewReportDetail = function (i) {
  const r = currentReportData[i];
  if (!r) return;

  const visit = r.latestVisit || r;
  const parseJsonArray = (value) => {
    if (!value) return [];
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const formatMetric = (value, suffix = '') => {
    if (value === null || value === undefined || value === '') return '-';
    return `${value}${suffix}`;
  };

  let labList = "ບໍ່ມີການສັ່ງກວດ", drugList = "ບໍ່ມີການສັ່ງຢາ";
  const labs = parseJsonArray(visit.Lab_Orders_JSON);
  if (labs.length > 0) {
    labList = "<ul class='mb-0 text-start ps-3 report-detail-list'>";
    labs.forEach(l => {
      const label = typeof l === 'string' ? l : (l.name || l.label || '-');
      labList += `<li class="mb-1">${label}</li>`;
    });
    labList += "</ul>";
  }

  const drugs = parseJsonArray(visit.Prescription_JSON);
  if (drugs.length > 0) {
    drugList = "<ul class='mb-0 text-start ps-3 report-detail-list'>";
    drugs.forEach(d => {
      const name = d.name || '-';
      const qty = d.qty || '-';
      const usage = d.usage || 'ບໍ່ລະບຸ';
      drugList += `<li class="mb-2"><strong>${name}</strong> <span class="text-muted">${qty}</span><div class="small text-muted">${usage}</div></li>`;
    });
    drugList += "</ul>";
  }

  const adviceParts = [visit.Advice, visit.Follow_Up].filter(Boolean);
  const symptoms = visit.Symptoms || '-';
  const diagnosis = visit.Diagnosis || 'ຍັງບໍ່ມີຂໍ້ມູນ';
  const physicalExam = visit.Physical_Exam || '-';
  const doctorName = visit.Doctor_Name || '-';

  let html = `
        <div class="report-detail-body">
          <div class="report-detail-patient-bar">
            <div class="report-detail-avatar"><i class="fas fa-user"></i></div>
            <div class="report-detail-patient-meta">
              <h4>${r.name}</h4>
              <div class="report-detail-submeta">
                <span class="report-detail-chip">${r.id}</span>
                <span>${r.gender || '-'}${r.age ? `, ${r.age} ປີ` : ''}</span>
              </div>
            </div>
            <div class="report-detail-visit-meta">
              <div><i class="far fa-calendar-alt me-1"></i>${r.date}</div>
              <div><i class="far fa-clock me-1"></i>${r.time}</div>
            </div>
          </div>

          <div class="row g-3 mt-1">
            <div class="col-md-5">
              <section class="report-detail-card h-100">
                <h6 class="report-detail-section-title">ຂໍ້ມູນພື້ນຖານ</h6>
                <div class="report-detail-vitals-grid">
                  <div class="report-detail-vital-box"><span>BP</span><strong>${formatMetric(visit.BP)}</strong></div>
                  <div class="report-detail-vital-box"><span>Temp</span><strong>${formatMetric(visit.Temp, ' °C')}</strong></div>
                  <div class="report-detail-vital-box"><span>Pulse</span><strong>${formatMetric(visit.Pulse)}</strong></div>
                  <div class="report-detail-vital-box"><span>Weight</span><strong>${formatMetric(visit.Weight, ' kg')}</strong></div>
                  <div class="report-detail-vital-box"><span>Height</span><strong>${formatMetric(visit.Height, ' cm')}</strong></div>
                  <div class="report-detail-vital-box"><span>SpO2</span><strong>${formatMetric(visit.SpO2, '%')}</strong></div>
                </div>

                <div class="report-detail-text-block">
                  <label>ອາການເບື້ອງຕົ້ນ</label>
                  <p>${symptoms}</p>
                </div>
                <div class="report-detail-text-block">
                  <label>ແພດຜູ້ກວດ</label>
                  <p>${doctorName}</p>
                </div>
                <div class="report-detail-text-block mb-0">
                  <label>ການກວດຮ່າງກາຍ</label>
                  <p>${physicalExam}</p>
                </div>
              </section>
            </div>

            <div class="col-md-7">
              <section class="report-detail-card">
                <h6 class="report-detail-section-title">ການວິນິດໄສ</h6>
                <div class="report-detail-diagnosis-box">${diagnosis}</div>

                <div class="row g-3 mt-1">
                  <div class="col-md-6">
                    <div class="report-detail-subcard">
                      <h6><i class="fas fa-flask me-2"></i>ລາຍການແລັບ</h6>
                      <div class="small">${labList}</div>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="report-detail-subcard">
                      <h6><i class="fas fa-pills me-2"></i>ລາຍການຢາ</h6>
                      <div class="small">${drugList}</div>
                    </div>
                  </div>
                </div>

                <div class="report-detail-note-box mt-3">
                  <h6><i class="fas fa-notes-medical me-2"></i>ຄຳແນະນຳ / ຕິດຕາມ</h6>
                  <p class="mb-0">${adviceParts.length > 0 ? adviceParts.join(' | ') : 'ບໍ່ມີຄຳແນະນຳເພີ່ມເຕີມ'}</p>
                </div>
              </section>
            </div>
          </div>
        </div>
    `;
  $('#reportDetailContent').html(html);
  $('#reportDetailModal').modal('show');
};

window.generateNextPatientID = async function () {
  const patientIdPrefix = 'LXH';
  const patientIdYear = String(new Date().getFullYear());
  const patientIdDigits = 6;
  const patientIdPattern = new RegExp(`^${patientIdPrefix}${patientIdYear}-?(\\d+)$`, 'i');

  try {
    const { data, error } = await supabaseClient
      .from(dbTable('Patients'))
      .select('Patient_ID')
      .ilike('Patient_ID', `${patientIdPrefix}${patientIdYear}%`)
      .order('Patient_ID', { ascending: false })
      .limit(100);

    if (error) throw error;

    let maxNum = 0;
    (data || []).forEach(row => {
      const match = String(row.Patient_ID || '').toUpperCase().match(patientIdPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    return `${patientIdPrefix}${patientIdYear}-${String(maxNum + 1).padStart(patientIdDigits, '0')}`;
  } catch (err) {
    console.error("Error generating next patient ID:", err);
    return `${patientIdPrefix}${patientIdYear}-000001`; // Fallback
  }
};

window.generateNextMasterIDs = async function (tableName, idColumn, prefix, padding = 3, count = 1) {
  try {
    const { data, error } = await supabaseClient.from(dbTable(tableName)).select(idColumn);
    if (error) throw error;
    const pattern = new RegExp(`^${prefix}(\\d+)$`, 'i');
    let maxNum = 0;
    (data || []).forEach(row => {
      const m = String(row[idColumn] || '').match(pattern);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });
    const ids = [];
    for (let i = 1; i <= count; i++) ids.push(`${prefix}${String(maxNum + i).padStart(padding, '0')}`);
    return ids;
  } catch (err) {
    console.error(`generateNextMasterIDs(${tableName}) error:`, err);
    const baseTs = Date.now();
    return Array.from({ length: count }, (_, i) => `${prefix}${String(baseTs + i).slice(-Math.max(padding, 6))}`);
  }
};

window.generateNextMasterID = async function (tableName, idColumn, prefix, padding = 3) {
  const [id] = await window.generateNextMasterIDs(tableName, idColumn, prefix, padding, 1);
  return id;
};

window.refreshPatientOrgDropdown = async function () {
  try {
    const { data } = await supabaseClient.from(dbTable('Organizations')).select('*').eq('Status', 'Active');
    let orgOptions = '<option value="">-- ເລືອກອົງກອນ --</option>';
    const seen = new Set();
    (data || []).forEach(org => {
      if (org.Org_Code && !seen.has(org.Org_Code)) {
        seen.add(org.Org_Code);
        orgOptions += `<option value="${org.Org_Code}">${org.Org_Code} - ${org.Org_Name}</option>`;
      }
    });
    if (typeof jQuery !== 'undefined' && $('#p_org_id').length) {
      try { if ($('#p_org_id').data('select2')) $('#p_org_id').select2('destroy'); } catch (e) {}
      $('#p_org_id').html(orgOptions).select2({ dropdownParent: $('#patientModal'), placeholder: '-- ເລືອກອົງກອນ --', allowClear: true });
    }
  } catch (err) {
    console.warn('refreshPatientOrgDropdown failed:', err);
  }
};

// ==========================================
// PATIENT VIEW & DATA
// ==========================================
window.viewPatientDetail = async function (id) {
  console.log("viewPatientDetail called for ID:", id);
  try {
    Swal.fire({ title: 'ກຳລັງດຶງຂໍ້ມູນ...', didOpen: () => Swal.showLoading() });
    const { data, error } = await supabaseClient.from(dbTable('Patients')).select('*').eq('Patient_ID', id).single();
    Swal.close();
    if (error || !data) {
      console.error("Fetch error:", error);
      return Swal.fire('Error', 'ບໍ່ພົບຂໍ້ມູນຄົນເຈັບ', 'error');
    }

    console.log("Patient data fetched:", data);

    const fullname = `${data.Title || ''} ${data.First_Name || ''} ${data.Last_Name || ''}`.trim();
    $('#view_p_name').text(fullname);
    $('#view_p_id').text(data.Patient_ID);
    $('#view_p_old_id').text(data.Old_Patient_ID ? `Old: ${data.Old_Patient_ID}` : '');
    $('#view_p_gender').text(data.Gender || '-');
    $('#view_p_age').text((data.Age || '0') + ' ປີ');
    $('#view_p_dob').text(data.Date_of_Birth || '-');
    $('#view_p_blood').text(data.Blood_Type || '-');
    $('#view_p_phone').text(data.Phone_Number || '-');
    $('#view_p_nation').text(data.Nationality || '-');
    $('#view_p_job').text(data.Occupation || '-');
    $('#view_p_email').text(data.Email || '-');

    $('#view_p_allergy').text(data.Drug_Allergy || 'ບໍ່ມີ');
    $('#view_p_disease').text(data.Underlying_Disease || 'ບໍ່ມີ');
    $('#view_p_reg_date').text(`${data.Registration_Date || '-'} (${data.Shift || ''})`);
    $('#view_p_reg_time').text(data.Time || '-');

    $('#view_p_address').text(data.Address || '-');
    $('#view_p_location').text(`${data.District || ''} ${data.Province || ''}`);
    
    const insOrg = [data.Insurance_Company, data.Organization_Name].filter(x => x).join(' / ') || '-';
    $('#view_p_ins_org').text(insOrg);
    $('#view_p_ins_code').text(data.Insurance_Code || '-');
    $('#view_p_channel').text(data.Marketing_Channel || '-');

    $('#view_p_emer').text(data.Emergency_Name || '-');
    $('#view_p_emer_contact').text(`${data.Emergency_Contact || ''} (${data.Emergency_Relation || ''})`);

    if (data.Photo_URL) {
      console.log("Setting photo URL:", data.Photo_URL);
      $('#view_p_photo').attr('src', data.Photo_URL).show();
      $('#view_p_photo_placeholder').hide();
    } else {
      $('#view_p_photo').hide();
      $('#view_p_photo_placeholder').show();
    }

    if ($('#patientProfileModal').length === 0) {
      console.error("Modal element #patientProfileModal NOT found in DOM!");
      return Swal.fire('Error', 'ລະບົບບໍລິຫາ Modal ບໍ່ເຫັນໃນ DOM', 'error');
    }

    $('#btn_edit_from_view').off('click').on('click', () => {
      $('#patientProfileModal').modal('hide');
      window.editPatient(id);
    });

    console.log("Showing modal...");
    $('#patientProfileModal').modal('show');
  } catch (err) {
    console.error("viewPatientDetail error:", err);
    Swal.fire('Error', 'ເກີດຂໍ້ຜິດພາດ: ' + err.message, 'error');
  }
};

window.setupPatientTableFilters = function (patientTable) {
  const patientFilter = $('#patientTable_filter');
  if (!patientFilter.length) return;

  patientFilter.closest('.dataTables_wrapper').addClass('patient-datatable-shell');
  patientFilter.addClass('patient-table-filter-wrap');

  if (!patientFilter.find('.patient-column-filter-group').length) {
    patientFilter.append(`
      <div class="patient-column-filter-group">
        <label class="patient-date-filter-item mb-0">
          <span>Old ID</span>
          <input type="text" id="patientOldIdSearch" class="form-control form-control-sm" placeholder="LXH...">
        </label>
        <label class="patient-date-filter-item mb-0">
          <span>ຊື່</span>
          <input type="text" id="patientNameSearch" class="form-control form-control-sm" placeholder="ຊື່ / ນາມສະກຸນ">
        </label>
        <label class="patient-date-filter-item mb-0">
          <span>ເບີໂທ</span>
          <input type="text" id="patientPhoneSearch" class="form-control form-control-sm" placeholder="020...">
        </label>
      </div>
      <div class="patient-date-filter-group">
        <label class="patient-date-filter-item mb-0">
          <span data-i18n="patients.fromDate">${window.t('patients.fromDate')}</span>
          <input type="date" id="patientDateFrom" class="form-control form-control-sm">
        </label>
        <label class="patient-date-filter-item mb-0">
          <span data-i18n="patients.toDate">${window.t('patients.toDate')}</span>
          <input type="date" id="patientDateTo" class="form-control form-control-sm">
        </label>
      </div>
    `);
  }

  $('#patientDateFrom, #patientDateTo').off('.patientDateFilter').on('change.patientDateFilter', function () {
    patientTable.draw();
  });

  $('#patientOldIdSearch, #patientNameSearch, #patientPhoneSearch')
    .off('.patientColumnFilter')
    .on('input.patientColumnFilter', function () {
      patientTable.column(3).search(window.normalizePatientCode($('#patientOldIdSearch').val()));
      patientTable.column(4).search(($('#patientNameSearch').val() || '').trim());
      patientTable.column(7).search(($('#patientPhoneSearch').val() || '').trim());
      patientTable.draw();
    });
};

window.initPatientTable = async function () {
  if (!window.__patientDateFilterInstalled) {
    $.fn.dataTable.ext.search.push(function (settings, rowData) {
      if (!settings || settings.nTable.id !== 'patientTable') return true;

      const fromValue = $('#patientDateFrom').val();
      const toValue = $('#patientDateTo').val();
      const rowDate = rowData && rowData[0] ? new Date(`${rowData[0]}T00:00:00`) : null;
      const fromDate = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
      const toDate = toValue ? new Date(`${toValue}T00:00:00`) : null;

      if (!rowDate || Number.isNaN(rowDate.getTime())) return true;
      if (fromDate && !Number.isNaN(fromDate.getTime()) && rowDate < fromDate) return false;
      if (toDate && !Number.isNaN(toDate.getTime()) && rowDate > toDate) return false;
      return true;
    });
    window.__patientDateFilterInstalled = true;
  }

  if ($.fn.DataTable.isDataTable('#patientTable')) {
    $('#patientTable').DataTable().destroy();
  }
  $('#patientTable tbody').html(`<tr><td colspan="11" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div> ${window.t('patients.loading')}</td></tr>`);

  try {
    // Supabase/PostgREST returns 1000 rows by default, so load every page.
    const totalCountRes = await supabaseClient.from(dbTable('Patients')).select('Patient_ID', { head: true, count: 'exact' });
    const totalCount = totalCountRes.count || 0;

    const pageSize = 1000;
    const numPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const pageQueries = [];
    for (let p = 0; p < numPages; p++) {
      pageQueries.push(
        supabaseClient.from(dbTable('Patients')).select('*')
          .order('Patient_ID', { ascending: false })
          .range(p * pageSize, (p + 1) * pageSize - 1)
      );
    }
    const t0 = performance.now();
    const results = await Promise.all(pageQueries);
    const errored = results.find(r => r.error);
    if (errored) throw errored.error;
    const data = results.flatMap(r => r.data || []);
    console.log(`Patients loaded: ${data.length} rows in ${Math.round(performance.now() - t0)}ms (${numPages} parallel pages)`);

    const $loadAllNotice = $('#patientLoadAllNotice');
    if ($loadAllNotice.length) $loadAllNotice.empty().hide();

    $('#patientTable tbody').empty();

    if (!data || data.length === 0) {
      const patientTable = $('#patientTable').DataTable({
        responsive: true,
        language: window.getDataTableLanguage({ emptyTable: window.t('patients.noPatientData') })
      });
      window.setupPatientTableFilters(patientTable);
      return;
    }

    let h = "";
    data.forEach(r => {
      // ໃຊ້ຊື່ Column ຕາມໃນ CSV ຂອງເຈົ້າ (First_Name, Last_Name, ແລະ ອື່ນໆ)
      let fullname = `${r.First_Name || ''} ${r.Last_Name || ''}`.trim();
      let oldPatientId = window.normalizePatientCode(r.Old_Patient_ID || '');
      let safeName = fullname.replace(/'/g, "\\'").replace(/"/g, "&quot;");
      
      // ໃຊ້ Age ຈາກຖານຂໍ້ມູນໂດຍກົງ
      let age = r.Age || 0;
      
      // ຖ້າ Age ເປັນ 0 ຫຼື ບໍ່ມີ ໃຫ້ຄິດໄລ່ຈາກ DOB
      if ((!age || age === 0 || age === '0') && r.Date_of_Birth) {
        const dob = new Date(r.Date_of_Birth);
        if (!isNaN(dob.getTime())) {
          const today = new Date();
          age = today.getFullYear() - dob.getFullYear();
          const m = today.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
          }
        }
      }
      
      // ຖ້າຍັງເປັນ 0 ໃຫ້ສະແດງ "-"
      if (!age || age === 0 || age === '0') {
        age = '-';
      }

      // Build action buttons based on permissions
      let acts = `<div class="d-flex gap-1 flex-nowrap justify-content-center">`;

      // Timeline button (always show)
      acts += `<button class="btn btn-sm btn-outline-info shadow-sm fw-bold btn-timeline" data-pid="${r.Patient_ID}" title="${window.t('patients.timeline')}"><i class="fas fa-history"></i></button>`;

      // View button
      if (window.can('patients', 'view')) {
        acts += `<button class="btn btn-sm btn-info text-white shadow-sm fw-bold" title="${window.t('patients.viewDetails')}" onclick="window.viewPatientDetail('${r.Patient_ID}')"><i class="fas fa-eye me-1"></i> ${window.t('patients.view')}</button>`;
      }

      // Triage button
      if (window.can('patients', 'triage')) {
        acts += `<button class="btn btn-sm btn-warning text-dark shadow-sm fw-bold" onclick="window.sendToTriageFlow('${r.Patient_ID}', '${safeName}')"><i class="fas fa-share me-1"></i> Triage</button>`;
      }

      // Edit button
      if (window.can('patients', 'edit')) {
        acts += `<button class="btn btn-sm btn-primary shadow-sm" title="${window.t('patients.edit')}" onclick="window.editPatient('${r.Patient_ID}')"><i class="fas fa-edit"></i></button>`;
      }

      // Print QR button
      if (window.can('patients', 'print_qr')) {
        acts += `<button class="btn btn-sm btn-dark text-white shadow-sm" title="${window.t('patients.printQr')}" onclick="window.printQRCard('${r.Patient_ID}')"><i class="fas fa-qrcode"></i></button>`;
      }

      // Delete button
      if (window.can('patients', 'delete')) {
        acts += `<button class="btn btn-sm btn-danger shadow-sm" title="${window.t('patients.delete')}" onclick="window.delPatient('${r.Patient_ID}')"><i class="fas fa-trash"></i></button>`;
      }

      acts += `</div>`;

      const pidMatch = String(r.Patient_ID || '').match(/^LXH(\d{4})-?(\d+)$/i);
      const pidSortKey = pidMatch ? (parseInt(pidMatch[1], 10) * 10000000 + parseInt(pidMatch[2], 10)) : 0;
      h += `<tr>
                    <td class="text-muted small">${r.Registration_Date || '-'}</td>
                    <td class="text-muted small">${r.Time || '-'}</td>
                    <td class="text-primary fw-bold" data-order="${pidSortKey}">${r.Patient_ID || '-'}</td>
                    <td class="text-muted fw-bold small">${oldPatientId || '-'}</td>
                    <td class="fw-bold">${fullname}</td>
                    <td>${r.Gender || '-'}</td>
                    <td>${age === '-' ? '-' : `${age} ${window.t('patients.yearUnit')}`}</td>
                    <td class="text-muted">${r.Phone_Number || '-'}</td>
                    <td class="small text-muted">${r.District || ''} ${r.Province || ''}</td>
                    <td class="text-danger fw-bold small">${r.Drug_Allergy || '-'}</td>
                    <td>${acts}</td>
                  </tr>`;
    });

    $('#patientTable tbody').html(h);
    const patientTable = $('#patientTable').DataTable({
      responsive: true,
      deferRender: true,
      pageLength: 10,
      order: [[2, "desc"]],
      language: window.getDataTableLanguage({ emptyTable: window.t('patients.noPatientData') })
    });

    window.setupPatientTableFilters(patientTable);

  } catch (err) {
    console.error("Error loading patients:", err);
    $('#patientTable tbody').html(`<tr><td colspan="11" class="text-center text-danger py-4">${window.t('patients.loadError')}</td></tr>`);
  }
};

// ==========================================
// PATIENT PHOTO HANDLERS (Camera & Upload)
// ==========================================
let cameraStream = null;

window.openCamera = async function () {
  try {
    const video = document.getElementById('camera-video');
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = cameraStream;
    $('#cameraModal').modal('show');
  } catch (err) {
    console.error("Camera error:", err);
    Swal.fire('Error', 'ບໍ່ສາມາດເປີດກ້ອງໄດ້: ' + err.message, 'error');
  }
};

window.closeCamera = function () {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  $('#cameraModal').modal('hide');
};

window.capturePhoto = function () {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  const preview = document.getElementById('photo-preview');
  const placeholder = document.getElementById('photo-placeholder');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  preview.src = dataUrl;
  preview.style.display = 'block';
  placeholder.style.display = 'none';

  window.closeCamera();
};

window.handlePhotoUpload = function (input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      $('#photo-preview').attr('src', e.target.result).show();
      $('#photo-placeholder').hide();
    };
    reader.readAsDataURL(input.files[0]);
  }
};

window.uploadPatientPhoto = async function (pId) {
  const preview = document.getElementById('photo-preview');
  if (!preview.src || preview.src.startsWith('http')) return preview.src;

  try {
    // Convert base64 to Blob
    const response = await fetch(preview.src);
    const blob = await response.blob();
    const fileName = `${pId}_${Date.now()}.jpg`;

    const { data, error } = await supabaseClient.storage
      .from('patient-photos')
      .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
      .from('patient-photos')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (err) {
    console.error("Upload error:", err);
    if (err.message && err.message.includes('Bucket not found')) {
      Swal.fire({
        icon: 'error',
        title: 'ບໍ່ພົບ Bucket ເກັບຮູບ',
        html: `ກະລຸນາສ້າງ Bucket ຊື່ວ່າ <b>patient-photos</b> ໃນ Supabase Storage ກ່ອນເດີ້!<br><br>ຜິດພາດ: ${err.message}`,
        confirmButtonText: 'ເຂົ້າໃຈແລ້ວ'
      });
      return "__BUCKET_ERROR__"; // Special flag
    }
    return null;
  }
};

window.openNewPatientModal = function () {
  // Re-populate all master dropdowns to ensure they're never empty
  window.loadMasterDataGlobalCallback(masterDataStore);

  $('#patientForm')[0].reset();
  $('#p_action').val("new");
  $('#p_id').val("");
  $('#disp_p_id').val("ກຳລັງໂຫຼດ...");
  $('#p_org_id').val(null).trigger('change');
  $('#p_org_name, #p_discount_show').val('');
  $('#p_district').val(null).trigger('change');

  window.generateNextPatientID().then(id => {
    $('#disp_p_id').val(id);
  });
  $('#photo-preview').attr('src', '').hide();
  $('#photo-placeholder').show();
  $('#p_photo_url').val('');

  let n = new Date();
  $('#p_date').val(window.getLocalStr(n));
  $('#p_time').val(n.toTimeString().split(' ')[0].substring(0, 5));

  if (document.activeElement) document.activeElement.blur();
  $('#patientModal').modal('show');
};

window.editPatient = async function (id) {
  Swal.fire({ title: 'ກຳລັງດຶງຂໍ້ມູນ...', didOpen: () => Swal.showLoading() });
  const { data, error } = await supabaseClient.from(dbTable('Patients')).select('*').eq('Patient_ID', id).single();
  Swal.close();
  if (error || !data) return;
  const d = {
    id: data.Patient_ID, old_patient_id: data.Old_Patient_ID || '', title: data.Title || '', firstname: data.First_Name || '',
    lastname: data.Last_Name || '', gender: data.Gender || '', dob: data.Date_of_Birth || '',
    age: data.Age || '', nation: data.Nationality || '', job: data.Occupation || '',
    blood: data.Blood_Type || '', phone: data.Phone_Number || '', email: data.Email || '',
    address: data.Address || '', district: data.District || '', province: data.Province || '',
    org_id: data.Organization_ID || '', org_name: data.Name_Org || '',
    ins_company: data.Insurance_Company || '', ins_code: data.Insurance_Code || '',
    ins_name: data.Insured_Person_Name || '', allergy: data.Drug_Allergy || 'ບໍ່ມີ',
    disease: data.Underlying_Disease || 'ບໍ່ມີ', emer_name: data.Emergency_Name || '',
    emer_contact: data.Emergency_Contact || '', emer_relation: data.Emergency_Relation || '',
    channel: data.Channel || '', date: data.Registration_Date || '', time: data.Time || '', shift: data.Shift || '',
    photo_url: data.Photo_URL || ''
  };

  if (d.photo_url) {
    $('#photo-preview').attr('src', d.photo_url).show();
    $('#photo-placeholder').hide();
    $('#p_photo_url').val(d.photo_url);
  } else {
    $('#photo-preview').attr('src', '').hide();
    $('#photo-placeholder').show();
    $('#p_photo_url').val('');
  }

  $('#patientModalTitle').html(`<i class="fas fa-user-edit text-warning me-2"></i>ແກ້ໄຂຂໍ້ມູນ: <span class="text-primary">${d.id}</span>`);
  $('#p_action').val('edit');
  $('#p_id').val(d.id);
  $('#disp_p_id').val(d.id);
  $('#p_old_patient_id').val(d.old_patient_id);
  for (const [k, v] of Object.entries(d)) {
    if (k === 'org_id') continue;
    let el = document.getElementById('p_' + k) || document.getElementsByName('p_' + k)[0];
    if (el) el.value = v;
  }
  $('#p_org_id').val(d.org_id).trigger('change');
  $('#p_district').val(d.district).trigger('change');
  $('#p_province').val(d.province || '');
  window.fetchOrg();
  if (document.activeElement) document.activeElement.blur();
  $('#patientModal').modal('show');
};

window.submitPatientForm = async function (e) {
  if (e) e.preventDefault();
  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });
  const fd = {};
  new FormData($('#patientForm')[0]).forEach((v, k) => fd[k] = v);
  const isEdit = fd.p_action === 'edit' && fd.p_id;
  const age = parseInt(fd.p_age) || 0;
  const ageGroup = age <= 15 ? '0-15' : (age <= 35 ? '16-35' : (age <= 55 ? '36-55' : '55+'));
  let pId = fd.p_id;
  if (!isEdit) {
    pId = await window.generateNextPatientID();
  }

  // 1. ອັບໂຫຼດຮູບກ່ອນ (ຖ້າມີການປ່ຽນແປງ ຫຼື ຖ່າຍໃໝ່)
  const photoUrl = await window.uploadPatientPhoto(pId);
  if (photoUrl === "__BUCKET_ERROR__") return; // ຢຸດການເຮັດວຽກ ຖ້າ Bucket ບໍ່ມີ (Swal ຈະສະແດງຢູ່ໃນ uploadPatientPhoto)

  const row = {
    Patient_ID: pId, Old_Patient_ID: window.normalizePatientCode(fd.p_old_patient_id || ''), Title: fd.p_title, First_Name: fd.p_firstname, Last_Name: fd.p_lastname,
    Gender: fd.p_gender, Date_of_Birth: fd.p_dob || null, Age: age,
    Nationality: fd.p_nation, Occupation: fd.p_job, Blood_Type: fd.p_blood,
    Phone_Number: fd.p_phone, Email: fd.p_email, Address: fd.p_address,
    District: fd.p_district, Province: fd.p_province,
    Organization_ID: fd.p_org_id, Name_Org: fd.p_org_name,
    Insurance_Company: fd.p_ins_company, Insurance_Code: fd.p_ins_code, Insured_Person_Name: fd.p_ins_name,
    Drug_Allergy: fd.p_allergy, Underlying_Disease: fd.p_disease,
    Emergency_Name: fd.p_emer_name, Emergency_Contact: fd.p_emer_contact, Emergency_Relation: fd.p_emer_relation,
    Channel: fd.p_channel, Registration_Date: fd.p_date || null, Time: fd.p_time,
    Shift: fd.p_shift, Age_Group: ageGroup,
    Photo_URL: photoUrl || fd.p_photo_url // ໃຊ້ URL ໃໝ່ ຫຼື URL ເກົ່າ
  };
  let result;
  if (isEdit) result = await supabaseClient.from(dbTable('Patients')).update(row).eq('Patient_ID', pId);
  else result = await supabaseClient.from(dbTable('Patients')).insert(row);
  Swal.close();
  if (result.error) {
    const isRls = result.error.message && (result.error.message.includes('row-level security') || result.error.message.includes('permission denied') || result.error.code === '42501');
    const msg = isRls
      ? `ບໍ່ມີສິດ INSERT ໃນ table Patients.\n\nກະລຸນາໄປ Supabase Dashboard → Table Editor → Patients → RLS Policies → ເພີ່ມ Policy INSERT ສຳລັບ role "anon"`
      : result.error.message;
    Swal.fire('ຜິດພາດ', msg, 'error'); return;
  }
  $('#patientModal').modal('hide');
  window.logAction(isEdit ? 'Edit' : 'Add', `${isEdit ? 'ແກ້ໄຂ' : 'ເພີ່ມ'}ຄົນເຈັບ: ${pId} - ${row.First_Name} ${row.Last_Name}`, 'Patients');
  window.initPatientTable();
  window.preloadDropdownData();
  Swal.fire({
    title: 'ລົງທະບຽນສຳເລັດ!', text: 'ລະຫັດ: ' + pId, icon: 'success',
    showCancelButton: true, showDenyButton: true,
    confirmButtonText: 'ສົ່ງເຂົ້າ Triage', denyButtonText: 'ພິມບັດ QR', cancelButtonText: 'ປິດ',
    confirmButtonColor: '#f59e0b', denyButtonColor: '#1B6BB0'
  }).then((rr) => {
    if (rr.isConfirmed) window.sendToTriageFlow(pId, (fd.p_firstname || '') + ' ' + (fd.p_lastname || ''));
    else if (rr.isDenied) window.printQRCard(pId);
  });
};

window.delPatient = async function (id) {
  const result = await Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ລຶບ' });
  if (result.isConfirmed) {
    await supabaseClient.from(dbTable('Patients')).delete().eq('Patient_ID', id);
    window.initPatientTable();
    window.preloadDropdownData();
  }
};

window.printQRCard = async function (id) {
  Swal.fire({ title: 'ກຳລັງສ້າງບັດ QR...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  const { data, error } = await supabaseClient.from(dbTable('Patients')).select('*').eq('Patient_ID', id).single();
  if (error || !data) return Swal.fire('ຜິດພາດ', 'ບໍ່ພົບຂໍ້ມູນຄົນເຈັບ', 'error');
  const d = {
    id: data.Patient_ID, title: data.Title || '', firstname: data.First_Name || '',
    lastname: data.Last_Name || '', dob: data.Date_of_Birth || '', age: data.Age || '', phone: data.Phone_Number || '-'
  };
  $('#printID').text(d.id);
  $('#printName').text(`${d.title} ${d.firstname} ${d.lastname}`.trim());
  $('#printDob').text(`${d.dob} (${d.age} ປີ)`);
  $('#printPhone').text(d.phone);
  $('#qrcodeDisplay').empty();
  new QRCode(document.getElementById('qrcodeDisplay'), {
    text: d.id, width: 65, height: 65, colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H
  });
  Swal.close();
  window.executePrint('print-area');
};

window.openQRScanner = function () {
  $('#qrScannerModal').modal('show');
  setTimeout(() => {
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, window.onScanSuccess, () => { });
  }, 400);
};

window.closeQRScanner = function () {
  $('#qrScannerModal').modal('hide');
  if (html5QrCode) {
    try { html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => html5QrCode.clear()); }
    catch (e) { html5QrCode.clear(); }
  }
};

window.onScanSuccess = function (t) {
  window.closeQRScanner();
  setTimeout(() => {
    $('#patientTable').DataTable().search(t).draw();
    Swal.fire({ title: 'ພົບລະຫັດ!', text: t, icon: 'success', timer: 1500, showConfirmButton: false });
  }, 500);
};

window.sendToTriageFlow = async function (id, n) {
  const result = await Swal.fire({
    title: 'ສົ່ງເຂົ້າ Triage?',
    text: `ສົ່ງ ${n} ໄປຈຸດຊັກປະຫວັດ?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ສົ່ງເຂົ້າຄິວ',
    confirmButtonColor: '#f59e0b'
  });
  if (result.isConfirmed) {
    Swal.fire({ title: 'ກຳລັງສົ່ງເຂົ້າຄິວ...', didOpen: () => Swal.showLoading() });
    // Test if Visits table is accessible first
    const { data: testVisit, error: testErr } = await supabaseClient.from(dbTable('Visits')).select('Visit_ID').limit(1);
    if (testErr) {
      const isNoTable = testErr.message && testErr.message.includes('does not exist');
      return Swal.fire('ຜິດພາດ!',
        isNoTable ? `ບໍ່ພົບ table "Visits" ໃນ Supabase.\nກາລຸນາສ້າງ table ຊື່ "Visits" ໃນ Supabase Dashboard.`
                  : `ບໍ່ສາມາດເຂົ້າເຖິງ table Visits: ${testErr.message}`,
        'error');
    }
    const vId = await window.generateUniqueVisitId();
    const { error } = await supabaseClient.from(dbTable('Visits')).insert({
      Visit_ID: vId, Date: new Date().toISOString(),
      Patient_ID: id, Patient_Name: n, Status: 'Triage'
    });
    if (error) {
      const isRls = error.message && (error.message.includes('row-level security') || error.message.includes('permission denied') || error.code === '42501');
      const isNoTable = error.message && error.message.includes('does not exist');
      let msg = error.message;
      if (isRls) msg = `ບໍ່ມີສິດ INSERT ໃນ table Visits.\n\nກາລຸນາໄປ Supabase Dashboard → Table Editor → Visits → RLS Policies → ເພີ່ມ Policy ໃຫ້ anon role`;
      if (isNoTable) msg = `ບໍ່ພົບ table "Visits" ໃນ Supabase.\n\nກາລຸນາກວດສອບຊື່ table ໃນ Supabase Dashboard.`;
      Swal.fire('ຜິດພາດ!', msg, 'error');
    } else {
      window.logAction('Add', 'Send to Triage: ' + n + ' (' + id + ')', 'Triage');
      Swal.fire('ສຳເລັດ!', 'ສົ່ງເຂົ້າ Triage ແລ້ວ', 'success');
    }
  }
};

window.submitTriageForm = function (e) {
  if (e) e.preventDefault();
  const fd = {};
  new FormData($('#triageForm')[0]).forEach((v, k) => fd[k] = v);
  
  // ⚠️ BP, Department, Height are now OPTIONAL (not required)
  let bp = fd.v_bp || "";
  let dept = fd.v_department || "";
  let height = fd.v_height || "";
  
  // Only validate BP format if provided
  if (bp && bp.includes('/')) {
    let [s, d] = bp.split('/').map(Number);
    if (!isNaN(s) && !isNaN(d)) {
      if (s >= 140 || d >= 90) {
        Swal.fire({
          title: 'ແຈ້ງເຕືອນຄວາມດັນ!',
          html: `<h4 class="text-danger fw-bold mb-3">ຄວາມດັນສູງ (${bp})</h4><p>ບັນທຶກຕໍ່ໄປແທ້ບໍ່?</p>`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#ef4444',
          confirmButtonText: 'ບັນທຶກ'
        }).then(r => {
          if (r.isConfirmed) window.executeTriageSave(fd);
        });
        return;
      } else if (s <= 90 || d <= 60) {
        Swal.fire({
          title: 'ແຈ້ງເຕືອນຄວາມດັນ!',
          html: `<h4 class="text-warning fw-bold mb-3">ຄວາມດັນຕ່ຳ (${bp})</h4><p>ບັນທຶກຕໍ່ໄປແທ້ບໍ່?</p>`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#ef4444',
          confirmButtonText: 'ບັນທຶກ'
        }).then(r => {
          if (r.isConfirmed) window.executeTriageSave(fd);
        });
        return;
      }
    }
  }
  
  window.executeTriageSave(fd);
};

window.executeTriageSave = async function (fd) {
  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });
  fd.v_department = String(fd.v_department || '').trim() || 'OPD ທົ່ວໄປ';

  console.log('=== TRIAGE SAVE DEBUG ===');
  console.log('Visit ID:', fd.visitId);
  console.log('Patient ID:', fd.patientId);
  console.log('Department:', fd.v_department);
  console.log('BP:', fd.v_bp);
  console.log('Symptoms:', fd.v_symptoms);

  const parsedBp = window.ipdParseBloodPressure(fd.v_bp);
  const bmiValue = window.ipdCalculateBmiValue(fd.v_weight, fd.v_height);
  const recordedAt = new Date().toISOString();
  const opdVitalPayload = {
    Vital_ID: window.ipdId('OPDVS'),
    Visit_ID: fd.visitId,
    Patient_ID: fd.patientId || null,
    Recorded_At: recordedAt,
    Temperature: fd.v_temp || null,
    BP_Systolic: parsedBp.systolic,
    BP_Diastolic: parsedBp.diastolic,
    Pulse: fd.v_pulse || null,
    Respiration: fd.v_resp || null,
    SpO2: fd.v_spo2 || null,
    Weight: fd.v_weight || null,
    Height: fd.v_height || null,
    BMI: bmiValue,
    Symptoms: fd.v_symptoms || null,
    Notes: fd.v_notes || null,
    Recorded_By: window.ipdCurrentUserName ? window.ipdCurrentUserName() : (currentUser?.name || currentUser?.id || null),
    Created_At: recordedAt,
    Updated_At: recordedAt
  };
  const vitalRes = await supabaseClient.from(dbTable('OPD_Vital_Signs')).insert([opdVitalPayload]);
  if (vitalRes.error && !window.ipdNeedsMigration?.(vitalRes.error)) {
    Swal.fire('ຜິດພາດ!', vitalRes.error.message, 'error');
    return;
  }
  if (vitalRes.error) console.warn('OPD vital signs table is not available yet. Apply IPD clinical migration.', vitalRes.error);

  // Use both Visit_ID and Patient_ID to ensure we update the correct record
  let query = supabaseClient.from(dbTable('Visits')).update({
    Status: 'Waiting OPD', BP: fd.v_bp, Temp: fd.v_temp,
    Weight: fd.v_weight, Height: fd.v_height,
    BMI: bmiValue, Pulse: fd.v_pulse, SpO2: fd.v_spo2,
    Department: fd.v_department, Symptoms: fd.v_symptoms
  }).eq('Visit_ID', fd.visitId);

  // If Patient_ID is provided, add it to the filter for extra safety
  if (fd.patientId) {
    query = query.eq('Patient_ID', fd.patientId);
    console.log('Using Patient_ID filter for safety');
  }

  const { data, error } = await query.select();

  console.log('Update result - Data:', data);
  console.log('Update result - Error:', error);
  console.log('========================');

  if (error) {
    Swal.fire('ຜິດພາດ!', error.message, 'error');
  } else {
    $('#triageModal').modal('hide');
    window.logAction('Save', 'Triage saved - Visit ' + fd.visitId, 'Triage');
    Swal.fire('ສຳເລັດ!', 'ສົ່ງເຂົ້າຫ້ອງກວດແລ້ວ', 'success');
    window.loadTriageQueue();
    window.loadQueue();
  }
};

window.openEMRLabModal = function () {
  currentEMRLabSearchQuery = '';
  window.syncEMRLabPickerSelectionFromCurrentLabs();
  if (document.getElementById('emrLabSearchInput')) document.getElementById('emrLabSearchInput').value = '';
  window.renderEMRLabPicker();
  if (document.activeElement) document.activeElement.blur();
  $('#emrLabModal').modal('show');
};

window.addLabToEMRList = function () {
  currentEMRLabs = window.normalizeEMRLabSelection(currentEMRLabPickerSelection).map(name => ({ name }));
  window.renderEMRLabTable();
  $('#emrLabModal').modal('hide');
};

window.renderEMRLabTable = function () {
  let h = '';
  if (currentEMRLabs.length === 0) {
    h = `<div class="emr-order-empty">
            <i class="fas fa-flask"></i>
            <strong>ຍັງບໍ່ມີລາຍການ Lab</strong>
            <span>ກົດປຸ່ມ "ເພີ່ມ Lab" ເພື່ອເລືອກລາຍການກວດ</span>
          </div>`;
  } else {
    currentEMRLabs.forEach((x, i) => {
      h += `<div class="emr-order-item">
              <div class="emr-order-item-main">
                <div class="emr-order-item-title"><i class="fas fa-vial"></i><span>${x.name}</span></div>
                <div class="emr-order-meta">
                  <span class="emr-order-chip"><i class="fas fa-circle-info"></i>ພ້ອມສົ່ງກວດ</span>
                </div>
              </div>
              <button type="button" class="btn btn-outline-danger emr-order-delete" onclick="window.removeEMRLab(${i})" title="ລຶບລາຍການ">
                <i class="fas fa-times"></i>
              </button>
            </div>`;
    });
  }
  $('#emrLabTableBody').html(h);
  $('#emrLabTabCount').text(currentEMRLabs.length);
};

window.removeEMRLab = function (i) { currentEMRLabs.splice(i, 1); window.renderEMRLabTable(); };

window.openEMRDrugModal = function () {
  $('#emrAddDrugQty').val(1);
  $('#emrAddDrugDose').val('1');
  $('#emrAddDrugUnit,#emrAddDrugUsage').prop('selectedIndex', 0);
  $('#emrAddDrugSelect').val(null).trigger('change');
  if (document.activeElement) document.activeElement.blur();
  $('#emrDrugModal').modal('show');
};

window.addDrugToEMRList = function () {
  let d = $('#emrAddDrugSelect').select2('data');
  if (!d || d.length === 0 || !d[0].id) return Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາເລືອກຢາກ່ອນ', 'warning');
  currentEMRDrugs.push({
    name: d[0].text,
    qty: $('#emrAddDrugQty').val() + ' ' + $('#emrAddDrugUnit').val(),
    dose: $('#emrAddDrugDose').val(),
    usage: $('#emrAddDrugUsage').val()
  });
  window.renderEMRDrugTable();
  $('#emrDrugModal').modal('hide');
};

window.renderEMRDrugTable = function () {
  let h = '';
  if (currentEMRDrugs.length === 0) {
    h = `<div class="emr-order-empty">
            <i class="fas fa-pills"></i>
            <strong>ຍັງບໍ່ມີລາຍການຢາ</strong>
            <span>ເພີ່ມ prescription ເພື່ອສະແດງ dose ແລະ usage ແບບມາດຖານ</span>
          </div>`;
  } else {
    currentEMRDrugs.forEach((x, i) => {
      h += `<div class="emr-order-item">
              <div class="emr-order-item-main">
                <div class="emr-order-item-title"><i class="fas fa-capsules"></i><span>${x.name}</span></div>
                <div class="emr-order-meta">
                  <span class="emr-order-chip"><i class="fas fa-box"></i>${x.qty}</span>
                  <span class="emr-order-chip"><i class="fas fa-syringe"></i>ໃຊ້ຄັ້ງລະ ${x.dose || '1'}</span>
                  <span class="emr-order-chip"><i class="fas fa-clock"></i>${x.usage || 'ບໍ່ລະບຸວິທີໃຊ້'}</span>
                </div>
              </div>
              <button type="button" class="btn btn-outline-danger emr-order-delete" onclick="window.removeEMRDrug(${i})" title="ລຶບລາຍການ">
                <i class="fas fa-times"></i>
              </button>
            </div>`;
    });
  }
  $('#emrDrugTableBody').html(h);
  $('#emrRxTabCount').text(currentEMRDrugs.length);
};

window.resetEMRWorkflowTabs = function () {
  const tabButtons = document.querySelectorAll('#emrWorkflowTabs .nav-link');
  const tabPanes = document.querySelectorAll('#emrWorkflowTabContent .tab-pane');
  if (!tabButtons.length || !tabPanes.length) return;

  tabButtons.forEach((button, index) => {
    const isActive = index === 0;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  tabPanes.forEach((pane, index) => {
    const isActive = index === 0;
    pane.classList.toggle('show', isActive);
    pane.classList.toggle('active', isActive);
  });
};

window.removeEMRDrug = function (i) { currentEMRDrugs.splice(i, 1); window.renderEMRDrugTable(); };

window.calculateBMI = function () {
  let w = parseFloat($('#v_weight').val());
  let h = parseFloat($('#v_height').val());
  if (w > 0 && h > 0) {
    let bmi = (w / Math.pow(h / 100, 2)).toFixed(1);
    let status = bmi >= 25 ? " (ຕຸ້ຍ)" : (bmi < 18.5 ? " (ຈ່ອຍ)" : " (ປົກກະຕິ)");
    $('#v_bmi').val(bmi + status);
  } else {
    $('#v_bmi').val("");
  }
};

window.ipdParseBloodPressure = function (bp) {
  const raw = String(bp || '').trim();
  if (!raw || !raw.includes('/')) return { systolic: null, diastolic: null };
  const [sys, dia] = raw.split('/').map(part => parseInt(part, 10));
  return {
    systolic: Number.isFinite(sys) ? sys : null,
    diastolic: Number.isFinite(dia) ? dia : null
  };
};

window.ipdCalculateBmiValue = function (weight, height) {
  const w = Number(weight);
  const h = Number(height);
  if (!(w > 0) || !(h > 0)) return null;
  return Number((w / Math.pow(h / 100, 2)).toFixed(1));
};

window._fetchTriageQueue = async function (sDate, eDate) {
  try {
    if (!sDate) sDate = window.getLocalStr(new Date());
    if (!eDate) eDate = sDate;
    const range = window.getLocalDateRangeIsoBounds(sDate, eDate);

    // 1. Fetch Visits (Paginated)
    let visits = [];
    let startRange = 0;
    while (true) {
      const { data: chunk, error: vError } = await supabaseClient.from(dbTable('Visits'))
        .select('*')
        .gte('Date', range.startIso)
        .lte('Date', range.endIso)
        .order('Date', { ascending: true })
        .range(startRange, startRange + 999);
      
      if (vError) throw vError;
      if (!chunk || chunk.length === 0) break;
      visits = visits.concat(chunk);
      if (chunk.length < 1000) break;
      startRange += 1000;
      if (visits.length >= 10000) break; // Hard safety cap
    }

    const duplicateVisitMap = {};
    visits.forEach(v => {
      if (!v?.Visit_ID) return;
      duplicateVisitMap[v.Visit_ID] = (duplicateVisitMap[v.Visit_ID] || 0) + 1;
    });

    // Keep only the latest record per Visit_ID and show only triage-stage rows.
    const visitById = {};
    visits.forEach(v => {
      if (!v?.Visit_ID || !v?.Patient_ID) return;
      if (window.isSuspiciousDuplicateVisit(v, duplicateVisitMap)) return;
      const existing = visitById[v.Visit_ID];
      if (!existing) {
        visitById[v.Visit_ID] = v;
        return;
      }
      const existingTime = existing.Date ? new Date(existing.Date).getTime() : 0;
      const nextTime = v.Date ? new Date(v.Date).getTime() : 0;
      if (nextTime >= existingTime) visitById[v.Visit_ID] = v;
    });

    visits = Object.values(visitById).filter(v => {
      const status = window.normalizeVisitStatus(v.Status);
      return ['Triage', 'Calling Triage', 'Waiting Triage', 'Waiting OPD', 'Calling OPD', 'Waiting Lab', 'Calling Lab', 'Completed', 'Done', 'Pharmacy', 'Transfer', 'Admit'].includes(status);
    });

    if (visits.length === 0) return [];

    // 2. Fetch unique Patient IDs with photo (optional backup)
    const pIds = [...new Set(visits.map(v => v.Patient_ID).filter(id => !!id))];
    let pMap = {};
    if (pIds.length > 0) {
      for (let i = 0; i < pIds.length; i += 100) {
        const chunkIds = pIds.slice(i, i + 100);
        const { data: patients, error: pError } = await supabaseClient.from(dbTable('Patients'))
          .select('Patient_ID, Age, Photo_URL, Gender')
          .in('Patient_ID', chunkIds);
        if (!pError && patients) {
          patients.forEach(p => pMap[p.Patient_ID] = p);
        }
      }
    }

    // 3. Determine isNew - First visit = NEW, 2nd+ visit = RETURNING
    let hasPreviousVisitMap = {};
    if (pIds.length > 0) {
      console.log('=== CHECKING PREVIOUS VISITS ===');
      console.log('Patient IDs to check:', pIds);
      console.log('Current visits being processed:', visits.map(v => ({ visitId: v.Visit_ID, patientId: v.Patient_ID, date: v.Date })));
      
      // First: Count visits per patient in current batch
      const patientVisitCount = {};
      const patientVisits = {}; // Track visits per patient
      visits.forEach(v => {
        if (!patientVisits[v.Patient_ID]) patientVisits[v.Patient_ID] = [];
        patientVisits[v.Patient_ID].push(v);
        patientVisitCount[v.Patient_ID] = (patientVisitCount[v.Patient_ID] || 0) + 1;
      });
      
      console.log('Patient visit counts in current batch:', patientVisitCount);
      
      // For patients with multiple visits in current batch:
      // - Sort by Date
      // - First visit = NEW, 2nd+ = RETURNING
      Object.keys(patientVisits).forEach(pid => {
        if (patientVisitCount[pid] > 1) {
          const sortedVisits = patientVisits[pid].sort((a, b) => new Date(a.Date) - new Date(b.Date));
          // First visit is NEW (don't mark), 2nd+ visits are RETURNING
          sortedVisits.slice(1).forEach((v, idx) => {
            const visitKey = `${v.Patient_ID}|${v.Date}`;
            hasPreviousVisitMap[visitKey] = true; // Mark specific visit as returning
            console.log(`Visit ${idx + 2} for ${pid} (${v.Date}) marked as returning`);
          });
        }
      });
      
      // Second: Check database for any other visits before current batch
      for (let i = 0; i < pIds.length; i += 100) {
        const chunkIds = pIds.slice(i, i + 100);
        
        // Query ALL visits for these patients (no date filter)
        const { data: allPatientVisits, error: pvError } = await supabaseClient
          .from(dbTable('Visits'))
          .select('Visit_ID, Patient_ID, Date')
          .in('Patient_ID', chunkIds)
          .order('Date', { ascending: true });
        
        console.log(`Checked ${chunkIds.length} patients, found ${allPatientVisits?.length || 0} total visits`);
        
        if (pvError) {
          console.error('Previous Visit Query Error:', pvError);
        } else if (allPatientVisits) {
          // Create unique keys for current visits
          const currentVisitKeys = new Set(
            visits.map(v => `${v.Patient_ID}|${v.Date}`)
          );
          
          console.log('Current visit keys:', Array.from(currentVisitKeys));
          
          // For each patient, check if they have visits in the database
          // that are NOT in the current batch
          const patientPrevVisits = {};
          allPatientVisits.forEach(v => {
            const visitKey = `${v.Patient_ID}|${v.Date}`;
            if (!currentVisitKeys.has(visitKey)) {
              // This is a previous visit (not in current batch)
              patientPrevVisits[v.Patient_ID] = true;
            }
          });
          
          // Mark ALL current visits of patients who have previous visits as "returning"
          visits.forEach(v => {
            const visitKey = `${v.Patient_ID}|${v.Date}`;
            if (patientPrevVisits[v.Patient_ID]) {
              hasPreviousVisitMap[visitKey] = true;
              console.log(`All visits for ${v.Patient_ID} marked as returning (has previous history)`);
            }
          });
          
          console.log('All patient visits:', allPatientVisits);
        }
      }
      
      console.log('Visits marked as returning:', Object.keys(hasPreviousVisitMap));
      console.log('================================');
    }

    // 4. Merge & Filter
    return visits
      .filter(r => !!r.Patient_ID) // Filter out junk/null Patient_ID
      .map((r, i) => {
        let dObj = new Date(r.Date);
        let p = pMap[r.Patient_ID];
        const visitKey = `${r.Patient_ID}|${r.Date}`;
        return {
          rowIdx: r.Visit_ID, visitId: r.Visit_ID,
          date: r.Date ? dObj.toLocaleDateString('en-GB') : '-',
          time: r.Date ? dObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-',
          patientId: r.Patient_ID, patientName: r.Patient_Name,
          status: window.normalizeVisitStatus(r.Status), department: r.Department || 'OPD',
          isNew: !hasPreviousVisitMap[visitKey], // Check visit-specific key
          // Prefer record data (Visits), fallback to patient profile
          age: r.Age || p?.Age || 0,
          gender: r.Gender || p?.Gender || '',
          photoUrl: p?.Photo_URL || '',
          bp: r.BP, temp: r.Temp, weight: r.Weight, height: r.Height,
          bmi: r.BMI, pulse: r.Pulse, spo2: r.SpO2, symptoms: r.Symptoms
        };
      });
  } catch (err) {
    console.error('Triage Fetch Error:', err);
    return [];
  }
};

window._fetchOpdQueue = async function (sDate, eDate) {
  try {
    if (!sDate) sDate = window.getLocalStr(new Date());
    if (!eDate) eDate = sDate;
    const range = window.getLocalDateRangeIsoBounds(sDate, eDate);

    // 1. Fetch Visits with range (Paginated)
    let visitsInRange = [];
    let startRange = 0;
    while (true) {
      const { data: chunk, error } = await supabaseClient.from(dbTable('Visits')).select('*')
        .gte('Date', range.startIso)
        .lte('Date', range.endIso)
        .order('Date', { ascending: true })
        .range(startRange, startRange + 999);

      if (error) { console.error("OPD Fetch Range Error:", error); break; }
      if (!chunk || chunk.length === 0) break;
      visitsInRange = visitsInRange.concat(chunk);
      if (chunk.length < 1000) break;
      startRange += 1000;
      if (visitsInRange.length >= 5000) break; // Safety cap
    }

    // 2. Fallbacks (only if range is empty)
    let rawVisits = visitsInRange || [];
    if (rawVisits.length === 0) {
      console.warn('OPD Main query returned 0 results, using fallback...');
      
      // Recover ONLY active patients from TODAY who might be "lost"
      // We filter by today's date to avoid showing old records
      const { data: visitsActive } = await supabaseClient.from(dbTable('Visits'))
        .select('*')
        .in('Status', ['Waiting OPD', 'Calling OPD', 'Waiting Lab', 'Calling Lab', 'Triage', 'Waiting Triage'])
        .order('Date', { ascending: false })
        .limit(200);

      // Filter fallback results to TODAY only
      const today = sDate;
      rawVisits = (visitsActive || []).filter(v => {
        if (!v.Date) return true; // Include NULL dates (might be today's records)
        const visitDate = window.getLocalDateKey(v.Date);
        return visitDate === today;
      });
      
      console.log(`OPD Fallback: ${rawVisits.length} visits found for today`);
    }
    
    const duplicateVisitMap = {};
    rawVisits.forEach(v => {
      if (!v?.Visit_ID) return;
      duplicateVisitMap[v.Visit_ID] = (duplicateVisitMap[v.Visit_ID] || 0) + 1;
    });

    // Keep the latest record per Visit_ID, then exclude only Triage-stage rows.
    const visitById = {};
    rawVisits.forEach(v => {
      if (!v?.Visit_ID || !v?.Patient_ID) return;
      if (window.isSuspiciousDuplicateVisit(v, duplicateVisitMap)) return;
      const existing = visitById[v.Visit_ID];
      if (!existing) {
        visitById[v.Visit_ID] = v;
        return;
      }
      const existingTime = existing.Date ? new Date(existing.Date).getTime() : 0;
      const nextTime = v.Date ? new Date(v.Date).getTime() : 0;
      if (nextTime >= existingTime) visitById[v.Visit_ID] = v;
    });

    const data = Object.values(visitById).filter(v => {
      const normalizedStatus = window.normalizeVisitStatus(v.Status);
      if (!normalizedStatus) {
        return !!v.Department && !/triage/i.test(v.Department);
      }
      return !['Triage', 'Calling Triage', 'Waiting Triage'].includes(normalizedStatus);
    });

    if (data.length === 0) return [];

    const pIds = [...new Set(data.map(v => v.Patient_ID).filter(id => !!id))];
    
    let pMap = {};
    if (pIds.length > 0) {
      for (let i = 0; i < pIds.length; i += 100) {
        const chunkIds = pIds.slice(i, i + 100);
        const { data: patients } = await supabaseClient.from(dbTable('Patients'))
          .select('Patient_ID, Age, Photo_URL, Gender')
          .in('Patient_ID', chunkIds);
        if (patients) patients.forEach(p => pMap[p.Patient_ID] = p);
      }
    }

    let hasPreviousVisitMap = {};
    if (pIds.length > 0) {
      // First: Count visits per patient in current batch
      const patientVisitCount = {};
      const patientVisits = {};
      data.forEach(v => {
        if (!patientVisits[v.Patient_ID]) patientVisits[v.Patient_ID] = [];
        patientVisits[v.Patient_ID].push(v);
        patientVisitCount[v.Patient_ID] = (patientVisitCount[v.Patient_ID] || 0) + 1;
      });
      
      // For patients with multiple visits: sort by Date, 1st=NEW, 2nd+=RETURNING
      Object.keys(patientVisits).forEach(pid => {
        if (patientVisitCount[pid] > 1) {
          const sortedVisits = patientVisits[pid].sort((a, b) => new Date(a.Date) - new Date(b.Date));
          sortedVisits.slice(1).forEach((v, idx) => {
            const visitKey = `${v.Patient_ID}|${v.Date}`;
            hasPreviousVisitMap[visitKey] = true;
          });
        }
      });
      
      // Second: Check database for any other visits
      for (let i = 0; i < pIds.length; i += 100) {
        const chunkIds = pIds.slice(i, i + 100);
        const { data: allPatientVisits, error: pvError } = await supabaseClient
          .from(dbTable('Visits'))
          .select('Visit_ID, Patient_ID, Date')
          .in('Patient_ID', chunkIds)
          .order('Date', { ascending: true });

        if (pvError) {
          console.error('OPD Previous Visit Query Error:', pvError);
        } else if (allPatientVisits) {
          const currentVisitKeys = new Set(
            data.map(v => `${v.Patient_ID}|${v.Date}`)
          );
          
          const patientPrevVisits = {};
          allPatientVisits.forEach(v => {
            const visitKey = `${v.Patient_ID}|${v.Date}`;
            if (!currentVisitKeys.has(visitKey)) {
              patientPrevVisits[v.Patient_ID] = true;
            }
          });
          
          data.forEach(v => {
            const visitKey = `${v.Patient_ID}|${v.Date}`;
            if (patientPrevVisits[v.Patient_ID]) {
              hasPreviousVisitMap[visitKey] = true;
            }
          });
        }
      }
    }

    return data.map((r, i) => {
      let dObj = new Date(r.Date);
      let p = pMap[r.Patient_ID];
      const visitKey = `${r.Patient_ID}|${r.Date}`;
      return {
        rowIdx: r.Visit_ID, visitId: r.Visit_ID,
        date: r.Date ? dObj.toLocaleDateString('en-GB') : '-',
        time: r.Date ? dObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-',
        patientId: r.Patient_ID, patientName: r.Patient_Name,
        status: window.normalizeVisitStatus(r.Status), department: r.Department || 'OPD',
        isNew: !hasPreviousVisitMap[visitKey], // Check visit-specific key
        // Prefer record data (Visits), fallback to patient profile
        age: r.Age || p?.Age || 0,
        gender: r.Gender || p?.Gender || '',
        photoUrl: p?.Photo_URL || '',
        dischargeStatus: r.Discharge_Status, doctor: r.Doctor_Name,
        nurse: r.Nurse_Name,
        symptoms: r.Symptoms, bp: r.BP, temp: r.Temp, weight: r.Weight, height: r.Height,
        pe: r.Physical_Exam, diagnosis: r.Diagnosis, advice: r.Advice, followup: r.Follow_Up,
        labOrdersStr: r.Lab_Orders_JSON, prescriptionStr: r.Prescription_JSON,
        site: r.Site, type: r.Visit_Type, services: r.Services_List
      };
    });
  } catch (err) {
    console.error("OPD Overall Fetch Error:", err);
    return [];
  }
};

window.loadTriageQueue = async function () {
  let sDate = $('#triageStartDate').val();
  let eDate = $('#triageEndDate').val();
  if ($.fn.DataTable.isDataTable('#triageTable')) $('#triageTable').DataTable().destroy();
  $('#triageTableBody').html('<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-danger spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');
  const q = await window._fetchTriageQueue(sDate, eDate);
  currentTriageData = q || [];
  if ($.fn.DataTable.isDataTable('#triageTable')) $('#triageTable').DataTable().destroy();
  let h = '';
  if (q && q.length > 0) {
    q.forEach((r, i) => {
      const status = r.status || '';
      let isCalling = status === 'Calling Triage';
      let sb = status === 'Triage' || isCalling ? '<span class="badge bg-warning text-dark"><i class="fas fa-hourglass-half"></i> ລໍຖ້າວັດແທກ</span>' : `<span class="badge bg-success"><i class="fas fa-check-circle"></i> ໄປ ${r.department} ແລ້ວ</span>`;
      if (isCalling) sb = '<span class="badge bg-danger animate__animated animate__flash animate__infinite"><i class="fas fa-volume-up"></i> ກຳລັງເອີ້ນ...</span>';
      
      let nb = r.isNew
        ? '<span class="badge patient-badge patient-badge-new ms-2">ຄົນເຈັບໃໝ່</span>'
        : '<span class="badge patient-badge patient-badge-returning ms-2">ຄົນເຈັບເກົ່າ</span>';
      let btnHtml = `<button class="btn btn-sm btn-info text-white shadow-sm me-1" onclick="window.viewTriage(${i})" title="ເບິ່ງລາຍລະອຽດ"><i class="fas fa-eye"></i></button>`;
      if (r.status === 'Triage' || isCalling) {
        btnHtml += `<button class="btn btn-sm btn-danger fw-bold shadow-sm me-1" onclick="window.openTriage(${i})" title="ວັດແທກ"><i class="fas fa-stethoscope"></i> ວັດແທກ</button>`;
      } else {
        btnHtml += `<button class="btn btn-sm btn-primary shadow-sm me-1" onclick="window.openTriage(${i})" title="ແກ້ໄຂ"><i class="fas fa-edit"></i></button>`;
      }
      // Add Call Button
      btnHtml += `<button class="btn btn-sm btn-dark shadow-sm me-1" onclick="window.triggerPublicCall('${r.visitId}', '${r.patientId}', 'ຊັກປະຫວັດ (Triage)')" title="ເອີ້ນຄິວ"><i class="fas fa-volume-up"></i></button>`;
      
      btnHtml += `<button class="btn btn-sm btn-outline-info shadow-sm me-1 btn-timeline" data-pid="${r.patientId}" title="ປະຫວັດການກວດ"><i class="fas fa-history"></i></button>
                         <button class="btn btn-sm btn-outline-danger shadow-sm me-1" onclick="window.deleteVisitFlow('${r.visitId}', '${r.patientId}')" title="ລຶບ"><i class="fas fa-trash"></i></button>
                         <button class="btn btn-sm btn-secondary text-white shadow-sm" onclick="window.printOPDCard('triage', ${i})" title="ພິມໃບ OPD"><i class="fas fa-file-medical"></i></button>`;
      h += `<tr class="${isCalling ? 'table-danger' : ''}">
                    <td class="text-muted">${r.date}</td>
                    <td class="fw-bold">${r.time}</td>
                    <td><div class="fw-bold text-primary">${r.patientName} ${nb}</div><div class="small text-muted">${r.patientId}</div></td>
                    <td><span class="badge bg-secondary rounded-pill">${r.age} ປີ</span></td>
                    <td>${sb}</td>
                    <td class="text-center"><div class="d-flex gap-1 justify-content-center">${btnHtml}</div></td>
                  </tr>`;
    });
  }
  $('#triageTableBody').html(h);
  $('#triageTable').DataTable({ responsive: true, pageLength: 10, language: { search: "ຄົ້ນຫາ:", emptyTable: "ບໍ່ມີຄິວ Triage" } });
};

window.viewTriage = function (i) {
  let r = currentTriageData[i];
  let isDone = r.status !== 'Triage';
  let statusBadge = isDone
    ? `<span class="badge bg-success fs-6 px-3 py-2"><i class="fas fa-check-circle me-1"></i> ສົ່ງຫ້ອງກວດແລ້ວ</span>`
    : `<span class="badge bg-warning text-dark fs-6 px-3 py-2"><i class="fas fa-hourglass-half me-1"></i> ລໍຖ້າວັດແທກ</span>`;
  let newBadge = r.isNew
    ? `<span class="badge patient-badge patient-badge-new ms-2">ຄົນເຈັບໃໝ່</span>`
    : `<span class="badge patient-badge patient-badge-returning ms-2">ຄົນເຈັບເກົ່າ</span>`;

  const makeStat = (label, val, unit, colorClass = '') =>
    `<div class="col-6 col-md-4 mb-3">
            <div class="triage-view-stat-card text-center h-100">
                <div class="small text-muted fw-bold mb-1">${label}</div>
                <div class="fw-bold triage-view-stat-value ${colorClass}">${val || '<span class="text-muted">-</span>'}</div>
                ${unit ? `<div class="small text-muted">${unit}</div>` : ''}
            </div>
        </div>`;

  // Blood pressure color logic
  let bpColor = 'primary';
  if (r.bp && r.bp.includes('/')) {
    let parts = r.bp.split('/').map(Number);
    if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        if (parts[0] >= 140 || parts[1] >= 90) bpColor = 'triage-stat-danger';
        else if (parts[0] <= 90 || parts[1] <= 60) bpColor = 'triage-stat-warn';
        else bpColor = 'triage-stat-ok';
    }
  }

  let vitalsHtml = isDone ? `
        <div class="row g-2">
          ${makeStat('<i class="fas fa-heart me-1"></i> BP', r.bp, 'mmHg', bpColor)}
          ${makeStat('<i class="fas fa-thermometer-half me-1"></i> Temp', r.temp ? r.temp + ' °C' : null, null, parseFloat(r.temp) >= 37.5 ? 'triage-stat-danger' : 'triage-stat-info')}
          ${makeStat('<i class="fas fa-tint me-1"></i> Pulse', r.pulse, 'bpm', 'triage-stat-warn')}
          ${makeStat('<i class="fas fa-lungs me-1"></i> SpO2', r.spo2 ? r.spo2 + ' %' : null, null, parseFloat(r.spo2) < 95 ? 'triage-stat-danger' : 'triage-stat-ok')}
          ${makeStat('<i class="fas fa-weight me-1"></i> Weight', r.weight, 'kg', 'triage-stat-muted')}
          ${makeStat('<i class="fas fa-ruler-vertical me-1"></i> Height', r.height, 'cm', 'triage-stat-muted')}
        </div>
        ${r.symptoms ? `<div class="triage-view-note mt-2"><b><i class="fas fa-comment-medical me-1"></i> ອາການເບື້ອງຕົ້ນ:</b> ${r.symptoms}</div>` : ''}
    ` : `<div class="text-center py-4">
        <i class="fas fa-hourglass-half fa-3x text-muted mb-3 d-block"></i>
        <p class="text-muted">ຍັງບໍ່ໄດ້ວັດ Vital Signs</p>
    </div>`;

  Swal.fire({
      title: `<span class="triage-view-title"><i class="fas fa-heartbeat me-2"></i>${r.patientName} ${newBadge}</span>`,
    html: `
          <div class="text-start triage-view-shell">
            <div class="triage-view-header mb-3">
                    <div class="d-flex align-items-center gap-3">
                <div class="triage-view-avatar">
                  ${r.photoUrl ? `<img src="${r.photoUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas fa-user text-muted"></i>`}
                        </div>
                        <div>
                  <div class="fw-bold fs-6">${r.patientId}</div>
                  <div class="small text-muted"><i class="fas fa-clock me-1"></i>${r.date} ${r.time}</div>
                  <div class="small mt-1"><span class="badge patient-badge patient-badge-neutral">${r.gender || '-'}</span> <span class="badge patient-badge patient-badge-age">${r.age} ປີ</span></div>
                        </div>
                    </div>
              <div class="text-end triage-view-meta">
                        ${statusBadge}
                <div class="small mt-1 text-muted"><i class="fas fa-door-open me-1"></i>${r.department || 'OPD'}</div>
                    </div>
                </div>
                ${vitalsHtml}
            </div>`,
    width: '600px',
      confirmButtonText: isDone ? '<i class="fas fa-edit me-1"></i> ແກ້ໄຂ' : '<i class="fas fa-stethoscope me-1"></i> ວັດແທກຕອນນີ້',
      confirmButtonColor: '#1B6BB0',
    showCancelButton: true,
    cancelButtonText: 'ປິດ',
      customClass: { popup: 'shadow-lg triage-view-popup' }
  }).then(res => { if (res.isConfirmed) window.openTriage(i); });
};

window.openTriage = function (i) {
  let r = currentTriageData[i];
  $('#vPatientId').text(r.patientId);
  $('#vPatientName').text(r.patientName);

  if (r.photoUrl) {
    $('#v_p_photo').attr('src', r.photoUrl).show();
    $('#v_p_photo_placeholder').hide();
  } else {
    $('#v_p_photo').hide();
    $('#v_p_photo_placeholder').show();
  }

  $('#triageForm')[0].reset();
  $('input[name="v_bp"]').removeClass('border-danger text-danger bg-danger border-warning text-dark bg-warning bg-opacity-10 border-success text-success fw-bold');

  // IMPORTANT: Set Visit_ID and Patient_ID AFTER reset (reset clears all form fields including hidden inputs)
  $('#vRowIdx').val(r.rowIdx);
  $('#vPatientIdHidden').val(r.patientId); // Store patientId for safe update/delete
  console.log('Triage Modal - Visit ID:', r.rowIdx, 'Patient ID:', r.patientId);

  // Always populate fields if data exists (to support editing old records)
  $('input[name="v_bp"]').val(r.bp || '').trigger('input');
  $('input[name="v_temp"]').val(r.temp || '');
  $('input[name="v_weight"]').val(r.weight || '');
  $('input[name="v_height"]').val(r.height || '');
  $('input[name="v_pulse"]').val(r.pulse || '');
  $('input[name="v_spo2"]').val(r.spo2 || '');
  $('textarea[name="v_symptoms"]').val(r.symptoms || '');
  $('select[name="v_department"]').val(r.department || '');
  window.calculateBMI();

  // Clear "Calling" status if opening
  if (r.status === 'Calling Triage') {
    supabaseClient.from(dbTable('Visits')).update({ Status: 'Triage' }).eq('Visit_ID', r.visitId).eq('Patient_ID', r.patientId);
  }

  if (document.activeElement) document.activeElement.blur();
  $('#triageModal').modal('show');
};

window.deleteVisitFlow = async function (visitId, patientId) {
  // Validate ID before deleting
  if (!visitId || visitId === '' || visitId === 'undefined' || visitId === 'null') {
    console.error('deleteVisitFlow: Invalid Visit_ID!', visitId);
    Swal.fire('ຜິດພາດ!', 'ບໍ່ສາມາດລຶບໄດ້: ບໍ່ມີ Visit ID', 'error');
    return;
  }
  
  console.log('=== DELETE VISIT DEBUG ===');
  console.log('Deleting Visit ID:', visitId);
  console.log('Patient ID:', patientId);
  console.log('Type:', typeof visitId);
  
  const r = await Swal.fire({ 
    title: 'ລຶບຄິວ?', 
    text: `Visit ID: ${visitId}\nPatient ID: ${patientId || 'N/A'}`,
    icon: 'warning', 
    showCancelButton: true, 
    confirmButtonColor: '#ef4444', 
    confirmButtonText: 'ລຶບ',
    cancelButtonText: 'ຍົກເລີກ'
  });
  
  if (r.isConfirmed) {
    Swal.fire({ title: 'ກຳລັງລຶບ...', didOpen: () => Swal.showLoading() });
    
    // Use both Visit_ID and Patient_ID to ensure we delete the correct record
    let query = supabaseClient.from(dbTable('Visits')).delete().eq('Visit_ID', visitId);
    
    // If Patient_ID is provided, add it to the filter for extra safety
    if (patientId) {
      query = query.eq('Patient_ID', patientId);
      console.log('Using Patient_ID filter for safety');
    }
    
    const { data, error, count } = await query.select();
    
    console.log('Delete result - Data:', data);
    console.log('Delete result - Error:', error);
    console.log('Delete result - Count:', count);
    console.log('=========================');
    
    if (error) {
      console.error('Delete error:', error);
      Swal.fire('ຜິດພາດ!', error.message, 'error');
    } else {
      if (count && count > 1) {
        console.warn('WARNING: Multiple records deleted! Visit_ID may not be unique in database.');
        Swal.fire('ຄຳເຕືອນ!', `ລຶບ ${count} ລາຍການ (Visit_ID ອາດຈະຊ້ຳກັນ)`, 'warning');
      } else {
        Swal.fire('ສຳເລັດ!', 'ລຶບແລ້ວ', 'success');
      }
      window.loadTriageQueue();
      window.loadQueue();
    }
  }
};

// ============================================================
// OPD Follow-up / Observation (separate from IPD admissions)
// ============================================================
const OPD_OBSERVATION_TABLE = 'opd_observations';
const OPD_OBSERVATION_NOTES_TABLE = 'opd_observation_notes';
window.observationRows = [];
window.observationPatientsById = {};
window.observationNotes = [];
window.currentObservationId = null;

window.obsFrom = function (tableName) {
  return supabaseClient.from(tableName);
};

window.obsEscape = function (value) {
  return window.ipdEscape ? window.ipdEscape(value) : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
};

window.obsActiveStatuses = ['WAITING', 'UNDER_OBSERVATION'];

window.obsGetOccupiedBedIds = async function () {
  try {
    const { data, error } = await window.obsFrom(OPD_OBSERVATION_TABLE)
      .select('bed_id,status')
      .in('status', window.obsActiveStatuses)
      .not('bed_id', 'is', null);
    if (error) return new Set();
    return new Set((data || []).map(r => String(r.bed_id)));
  } catch (e) { return new Set(); }
};

window.obsActiveObservationByBedId = async function () {
  try {
    const { data, error } = await window.obsFrom(OPD_OBSERVATION_TABLE)
      .select('*')
      .in('status', window.obsActiveStatuses)
      .not('bed_id', 'is', null);
    if (error) return {};
    const map = {};
    (data || []).forEach(r => { if (r.bed_id) map[String(r.bed_id)] = r; });
    return map;
  } catch (e) { return {}; }
};

window.obsDurationHours = function (row) {
  if (!row?.start_datetime) return 0;
  const start = new Date(row.start_datetime).getTime();
  const end = row.end_datetime ? new Date(row.end_datetime).getTime() : Date.now();
  if (!start || Number.isNaN(start) || Number.isNaN(end)) return Number(row.duration_hours || 0);
  return Math.max(0, (end - start) / 3600000);
};

window.obsFormatDuration = function (row) {
  const hours = window.obsDurationHours(row);
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

window.obsStatusBadge = function (status) {
  const s = String(status || 'WAITING').toUpperCase();
  const cls = {
    WAITING: 'bg-secondary',
    UNDER_OBSERVATION: 'bg-info',
    COMPLETED: 'bg-success',
    TRANSFER_TO_IPD: 'bg-warning text-dark',
    DISCHARGED: 'bg-dark'
  }[s] || 'bg-secondary';
  return `<span class="badge ${cls}">${window.obsEscape(s.replace(/_/g, ' '))}</span>`;
};

window.obsPatientName = function (row) {
  const p = window.observationPatientsById[row?.patient_id] || window.observationPatientsById[row?.hn] || null;
  return [p?.First_Name, p?.Last_Name].filter(Boolean).join(' ') || row?.patient_name || row?.patient_id || row?.hn || '-';
};

window.fetchObservationPatients = async function (rows) {
  window.observationPatientsById = {};
  const ids = [...new Set((rows || []).flatMap(r => [r.patient_id, r.hn]).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supabaseClient.from(dbTable('Patients')).select('*').in('Patient_ID', chunk);
    if (error) {
      console.warn('Observation patient lookup failed:', error);
      continue;
    }
    (data || []).forEach(p => { window.observationPatientsById[p.Patient_ID] = p; });
  }
};

window.fetchObservationRows = async function (sDate, eDate) {
  const { data, error } = await window.obsFrom(OPD_OBSERVATION_TABLE)
    .select('*')
    .order('start_datetime', { ascending: false })
    .limit(500);
  if (error) throw error;
  const startKey = sDate || window.getLocalStr(new Date());
  const endKey = eDate || startKey;
  return (data || []).filter(row => {
    if (window.obsActiveStatuses.includes(String(row.status || '').toUpperCase())) return true;
    const key = String(row.start_datetime || '').slice(0, 10);
    return key >= startKey && key <= endKey;
  });
};

window.loadObservationPage = async function () {
  const isListView = $('#view-opd_observation_list:visible').length > 0;
  const isBoardView = $('#view-opd_observation:visible').length > 0;
  const sDate = (isListView ? $('#obsListStartDate').val() : $('#obsStartDate').val()) || window.getLocalStr(new Date());
  const eDate = (isListView ? $('#obsListEndDate').val() : $('#obsEndDate').val()) || sDate;
  if (isListView && $('#observationTable').length) {
    if ($.fn.DataTable.isDataTable('#observationTable')) $('#observationTable').DataTable().destroy();
    $('#observationTable tbody').html('<tr><td colspan="9" class="text-center py-4"><div class="spinner-border text-info spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');
  }
  try {
    await window.fetchIpdWardBedData?.();
    window.observationRows = await window.fetchObservationRows(sDate, eDate);
    await window.fetchObservationPatients(window.observationRows);
    await window.updateObservationStats(sDate, eDate);
    if (isBoardView && $('#obsBedBoard').length) await window.renderObsBedBoard();
    if (isListView && $('#observationTable').length) window.renderObservationTable();
  } catch (err) {
    console.error('Observation load failed:', err);
    if (isListView && $('#observationTable').length) {
      $('#observationTable tbody').html(`<tr><td colspan="9" class="text-center text-danger py-4">${window.obsEscape(err.message || err)}</td></tr>`);
    }
  }
};

window.renderObsBedBoard = async function () {
  const $board = $('#obsBedBoard');
  if (!$board.length) return;
  const state = window.ipdWardBedState || { wards: [], rooms: [], beds: [] };
  const obsWards = (state.wards || []).filter(w => window.ipdIsObsWard(w));
  if (!obsWards.length) {
    $('#obsTotalBeds, #obsOccupiedBeds, #obsAvailableBeds, #obsReservedBeds').text('0');
    $board.html(`<div class="ipd-empty-state"><div><i class="fas fa-bed fa-2x mb-3 d-block"></i>${window.obsEscape(window.t('obs.noObsWardHint'))}</div></div>`);
    return;
  }
  const obsByBed = await window.obsActiveObservationByBedId();
  const activeObsRows = Object.values(obsByBed || {});
  if (activeObsRows.length) {
    const seenObservationIds = new Set((window.observationRows || []).map(row => String(row.observation_id || '')));
    window.observationRows = [
      ...(window.observationRows || []),
      ...activeObsRows.filter(row => !seenObservationIds.has(String(row.observation_id || '')))
    ];
    await window.fetchObservationPatients(window.observationRows);
  }
  const wardIds = new Set(obsWards.map(w => String(w.Ward_ID)));
  const obsRooms = (state.rooms || []).filter(r => wardIds.has(String(r.Ward_ID)));
  const obsBeds = (state.beds || []).filter(b => wardIds.has(String(b.Ward_ID)));
  const obsBedStatus = (bed) => obsByBed[String(bed.Bed_ID)] ? 'Occupied' : (window.ipdBedStatus?.(bed) || 'Available');
  $('#obsTotalBeds').text(obsBeds.length);
  $('#obsOccupiedBeds').text(obsBeds.filter(b => obsBedStatus(b) === 'Occupied').length);
  $('#obsAvailableBeds').text(obsBeds.filter(b => obsBedStatus(b) === 'Available').length);
  $('#obsReservedBeds').text(obsBeds.filter(b => obsBedStatus(b) === 'Reserved').length);

  const obsActionMenu = (bed, obsRow, status) => {
    const menuId = `obsBedActions${window.obsEscape(String(bed.Bed_ID).replace(/[^a-zA-Z0-9]/g, ''))}`;
    const bedIdArg = JSON.stringify(String(bed.Bed_ID || '')).replace(/"/g, '&quot;');
    if (!obsRow) {
      if (status === 'Available') {
        return `<div class="ipd-bed-actions-row">
          <div class="dropdown ipd-bed-action-wrap">
            <button class="btn btn-success dropdown-toggle ipd-bed-action-trigger btn-obs-add" type="button" id="${menuId}" data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-auto-close="true" aria-expanded="false">
              <i class="fas fa-bolt me-1"></i>${window.obsEscape(window.t('common.action'))}
            </button>
            <ul class="dropdown-menu dropdown-menu-end ipd-bed-action-menu" aria-labelledby="${menuId}">
              <li><a class="dropdown-item text-success btn-obs-add" href="#" onclick="window.openObservationFromBoard(${bedIdArg}); return false;"><i class="fas fa-notes-medical me-2"></i>${window.obsEscape(window.t('obs.startObservation'))}</a></li>
              <li><a class="dropdown-item text-secondary btn-ipd-config-edit" href="#" onclick="window.changeObservationBedStatus(${bedIdArg}, 'Maintenance'); return false;"><i class="fas fa-tools me-2"></i>${window.obsEscape(window.t('ipd.maintenance'))}</a></li>
            </ul>
          </div>
        </div>`;
      }
      const maintenanceItems = status === 'Cleaning' || status === 'Maintenance' || status === 'Reserved'
        ? `<ul class="dropdown-menu dropdown-menu-end ipd-bed-action-menu" aria-labelledby="${menuId}">
            ${status === 'Reserved' ? `<li><a class="dropdown-item text-success btn-obs-add" href="#" onclick="window.openObservationFromBoard(${bedIdArg}); return false;"><i class="fas fa-notes-medical me-2"></i>${window.obsEscape(window.t('obs.startObservation'))}</a></li>` : ''}
            <li><a class="dropdown-item text-success btn-ipd-config-edit" href="#" onclick="window.changeObservationBedStatus(${bedIdArg}, 'Available'); return false;"><i class="fas fa-check me-2"></i>${window.obsEscape(window.t('ipd.markAvailable'))}</a></li>
            ${status !== 'Maintenance' ? `<li><a class="dropdown-item text-secondary btn-ipd-config-edit" href="#" onclick="window.changeObservationBedStatus(${bedIdArg}, 'Maintenance'); return false;"><i class="fas fa-tools me-2"></i>${window.obsEscape(window.t('ipd.maintenance'))}</a></li>` : ''}
          </ul>` : '';
      if (maintenanceItems) {
        const triggerClass = status === 'Cleaning' ? 'btn-warning' : status === 'Reserved' ? 'btn-primary' : 'btn-secondary';
        return `<div class="ipd-bed-actions-row">
          <div class="dropdown ipd-bed-action-wrap">
            <button class="btn ${triggerClass} dropdown-toggle ipd-bed-action-trigger" type="button" id="${menuId}" data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-auto-close="true" aria-expanded="false">
              <i class="fas fa-bolt me-1"></i>${window.obsEscape(window.t('common.action'))}
            </button>
            ${maintenanceItems}
          </div>
        </div>`;
      }
      return `<div class="ipd-bed-actions-row">
        <button type="button" class="btn btn-secondary ipd-bed-action-trigger" disabled>
          <i class="fas fa-info-circle me-1"></i>${window.obsEscape(window.ipdTranslateValue(status))}
        </button>
      </div>`;
    }
    const statusColor = {
      Available: 'btn-success',
      Occupied: 'btn-dark',
      Reserved: 'btn-primary',
      Cleaning: 'btn-warning',
      Maintenance: 'btn-secondary',
      Inactive: 'btn-secondary'
    }[status] || 'btn-primary';
    const obsIdArg = JSON.stringify(String(obsRow.observation_id || '')).replace(/"/g, '&quot;');
    return `<div class="ipd-bed-actions-row">
      <div class="dropdown ipd-bed-action-wrap">
        <button class="btn ${statusColor} dropdown-toggle ipd-bed-action-trigger btn-obs-view" type="button" id="${menuId}" data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-auto-close="true" aria-expanded="false">
          <i class="fas fa-bolt me-1"></i>${window.obsEscape(window.t('common.action'))}
        </button>
        <ul class="dropdown-menu dropdown-menu-end ipd-bed-action-menu" aria-labelledby="${menuId}">
          <li><a class="dropdown-item text-dark btn-obs-view" href="#" onclick="window.openObservationDetail(${obsIdArg}); return false;"><i class="fas fa-file-medical me-2"></i>${window.obsEscape(window.t('obs.openObservation'))}</a></li>
          <li><a class="dropdown-item text-primary btn-obs-view" href="#" onclick="window.openObservationTransferModal(${obsIdArg}); return false;"><i class="fas fa-exchange-alt me-2"></i>${window.obsEscape(window.t('ipd.transferBed'))}</a></li>
          <li><a class="dropdown-item text-danger btn-obs-note" href="#" onclick="window.openObservationNoteFromBoard(${obsIdArg}, 'VITAL_SIGN'); return false;"><i class="fas fa-heartbeat me-2"></i>${window.obsEscape(window.t('obs.addVital'))}</a></li>
          <li><a class="dropdown-item text-primary btn-obs-note" href="#" onclick="window.openObservationNoteFromBoard(${obsIdArg}, 'DOCTOR_NOTE'); return false;"><i class="fas fa-user-md me-2"></i>${window.obsEscape(window.t('obs.doctorNote'))}</a></li>
          <li><a class="dropdown-item text-success btn-obs-note" href="#" onclick="window.openObservationNoteFromBoard(${obsIdArg}, 'NURSING_NOTE'); return false;"><i class="fas fa-user-nurse me-2"></i>${window.obsEscape(window.t('obs.nursingNote'))}</a></li>
          <li><a class="dropdown-item text-warning btn-obs-note" href="#" onclick="window.openObservationNoteFromBoard(${obsIdArg}, 'PROCEDURE'); return false;"><i class="fas fa-procedures me-2"></i>${window.obsEscape(window.t('obs.procedure'))}</a></li>
          <li><a class="dropdown-item text-warning btn-obs-convert" href="#" onclick="window.convertObservationToIpd(${obsIdArg}); return false;"><i class="fas fa-bed me-2"></i>${window.obsEscape(window.t('obs.convertToIpd'))}</a></li>
          <li><a class="dropdown-item text-secondary btn-obs-discharge" href="#" onclick="window.dischargeObservation(${obsIdArg}); return false;"><i class="fas fa-sign-out-alt me-2"></i>${window.obsEscape(window.t('ipd.dischargeReleaseBed'))}</a></li>
        </ul>
      </div>
    </div>`;
  };

  const renderWardGroup = (ward) => {
    const wardBeds = obsBeds.filter(b => String(b.Ward_ID) === String(ward.Ward_ID));
    if (!wardBeds.length) return '';
    const occupied = wardBeds.filter(b => obsBedStatus(b) === 'Occupied').length;
    const available = wardBeds.filter(b => obsBedStatus(b) === 'Available').length;
    const cleaning = wardBeds.filter(b => obsBedStatus(b) === 'Cleaning').length;
    const maintenance = wardBeds.filter(b => obsBedStatus(b) === 'Maintenance').length;
    const wardRooms = obsRooms.filter(r => String(r.Ward_ID) === String(ward.Ward_ID));
    let inner = `<section class="ipd-ward-group ipd-board-mode-detail">
      <div class="ipd-ward-header">
        <div class="ipd-ward-title">
          <span class="ipd-ward-icon"><i class="fas fa-hospital"></i></span>
          <div>
            <strong>${window.obsEscape(ward.Ward_Name || ward.Ward_ID)}</strong>
            <small>${window.obsEscape(ward.Ward_ID)} | ${wardBeds.length} ${window.obsEscape(window.t('ipd.beds'))}</small>
          </div>
        </div>
        <div class="ipd-ward-metrics">
          <span class="is-occupied">${occupied}/${wardBeds.length} ${window.obsEscape(window.t('ipd.occupied'))}</span>
          <span class="is-available">${available} ${window.obsEscape(window.t('ipd.available'))}</span>
          <span class="is-cleaning">${cleaning} ${window.obsEscape(window.t('ipd.cleaning'))}</span>
          <span class="is-maintenance">${maintenance} ${window.obsEscape(window.t('ipd.maintenance'))}</span>
        </div>
      </div>`;

    wardRooms.forEach(room => {
      const roomBeds = wardBeds.filter(b => String(b.Room_ID) === String(room.Room_ID));
      if (!roomBeds.length) return;
      inner += `<div class="ipd-room-section">
        <div class="ipd-room-title">
          <div class="ipd-room-title-left">
            <span><i class="fas fa-door-open me-1"></i>${window.obsEscape(window.t('ipd.room'))} ${window.obsEscape(room.Room_Number || '-')}</span>
          </div>
          <small>${window.obsEscape(window.ipdTranslateValue(room.Room_Type || 'General'))} | ${roomBeds.length} ${window.obsEscape(window.t('ipd.beds'))}</small>
        </div>
        <div class="ipd-bed-grid">`;

      roomBeds.forEach(bed => {
        const obsRow = obsByBed[String(bed.Bed_ID)];
        const status = obsBedStatus(bed);
        const hours = obsRow ? Number(obsRow.duration_hours || window.obsDurationHours(obsRow) || 0) : 0;
        const overSix = !!obsRow && hours >= 6;
        const patientName = obsRow ? window.obsPatientName(obsRow) : '';
        const displayStatus = overSix ? `<span class="ipd-status-badge ipd-status-maintenance">6h+</span>` : window.ipdStatusBadge(status);
        const patientDetails = obsRow ? `<div class="ipd-bed-meta">
            <div class="ipd-bed-patient-name" title="${window.obsEscape(patientName)}">${window.obsEscape(patientName || '-')}</div>
            <div class="ipd-bed-line"><span>HN</span> ${window.obsEscape(obsRow.hn || obsRow.patient_id || '-')}</div>
            ${obsRow.diagnosis ? `<div class="ipd-bed-line" title="${window.obsEscape(obsRow.diagnosis)}"><i class="fas fa-stethoscope text-muted me-1"></i>${window.obsEscape(obsRow.diagnosis)}</div>` : ''}
            ${obsRow.doctor_id ? `<div class="ipd-bed-line" title="${window.obsEscape(obsRow.doctor_id)}"><i class="fas fa-user-md text-muted me-1"></i>${window.obsEscape(obsRow.doctor_id)}</div>` : ''}
            <div class="ipd-bed-line"><i class="fas fa-clock text-muted me-1"></i>${window.obsEscape(window.obsFormatDuration(obsRow))}${overSix ? ` <span class="badge bg-warning text-dark ms-1">6h+</span>` : ''}</div>
          </div>` : `<div class="ipd-bed-meta ipd-bed-empty-meta">
            <div class="text-muted small">${window.obsEscape(window.ipdTranslateValue(bed.Bed_Type || 'Standard'))}</div>
          </div>`;
        inner += `<article class="ipd-bed-card status-${status.toLowerCase()}">
          <div class="ipd-bed-top">
            <div>
              <div class="ipd-bed-number">${window.obsEscape(bed.Bed_Number || '-')}</div>
            </div>
            ${displayStatus}
          </div>
          ${patientDetails}
          <div class="ipd-bed-actions">${obsActionMenu(bed, obsRow, status)}</div>
        </article>`;
      });
      inner += '</div></div>';
    });

    inner += '</section>';
    return inner;
  };

  const groupsHtml = obsWards.map(renderWardGroup).filter(Boolean).join('');
  const html = groupsHtml ? `<section class="ipd-board-segment ipd-board-segment-general">
    <header class="ipd-board-segment-header">
      <div class="ipd-board-segment-icon"><i class="fas fa-hospital-symbol"></i></div>
      <div class="ipd-board-segment-titles">
        <strong>${window.obsEscape(window.t('obs.bedBoardTitle'))}</strong>
        <small>${window.obsEscape(window.t('obs.bedBoardSubtitle'))} · ${obsWards.length} ${window.obsEscape(window.t('ipd.wardsCount'))}</small>
      </div>
    </header>
    <div class="ipd-board-segment-body">${groupsHtml}</div>
  </section>` : '';
  $board.html(html || `<div class="ipd-empty-state">${window.obsEscape(window.t('obs.noObsWardHint'))}</div>`);
  window.applyButtonPermissions?.();
};

window.updateObservationStats = async function (sDate, eDate) {
  const today = window.getLocalStr(new Date());
  const todayRange = window.getLocalDayIsoBounds(today);
  try {
    const [opdRes, obsRes, ipdRes] = await Promise.all([
      supabaseClient.from(dbTable('Visits')).select('Visit_ID', { count: 'exact', head: true }).gte('Date', todayRange.startIso).lte('Date', todayRange.endIso),
      window.obsFrom(OPD_OBSERVATION_TABLE).select('observation_id,status,start_datetime', { count: 'exact' }).in('status', window.obsActiveStatuses),
      supabaseClient.from(dbTable('Admissions')).select('*').order('Created_At', { ascending: false }).limit(1000)
    ]);
    const admissions = ipdRes.data || [];
    const activeIpd = admissions.filter(a => window.ipdIsActiveAdmission(a)).length;
    const admissionsToday = admissions.filter(a => window.ipdAdmissionDate(a) === today).length;
    const dischargesToday = admissions.filter(a => window.ipdDischargeDate(a) === today).length;
    $('#obsKpiOpdToday').text(opdRes.count || 0);
    $('#obsKpiActive').text(obsRes.count ?? (obsRes.data || []).length);
    $('#obsKpiActiveIpd').text(activeIpd);
    $('#obsKpiAdmissionsToday').text(admissionsToday);
    $('#obsKpiDischargesToday').text(dischargesToday);
  } catch (err) {
    console.warn('Observation stats failed:', err);
  }
};

window.renderObservationTable = function () {
  if (!$('#observationTable').length) return;
  if ($.fn.DataTable.isDataTable('#observationTable')) $('#observationTable').DataTable().destroy();
  const rows = window.observationRows || [];
  const html = rows.map(row => {
    const active = window.obsActiveStatuses.includes(String(row.status || '').toUpperCase());
    const sixHour = active && window.obsDurationHours(row) >= 6;
    const duration = `${window.obsFormatDuration(row)}${sixHour ? ' <span class="badge bg-warning text-dark ms-1">6h+</span>' : ''}`;
    return `<tr class="${sixHour ? 'table-warning' : ''}">
      <td><code>${window.obsEscape(row.observation_id)}</code></td>
      <td class="fw-bold">${window.obsEscape(row.hn || row.patient_id || '-')}</td>
      <td>${window.obsEscape(window.obsPatientName(row))}</td>
      <td>${window.obsEscape(row.doctor_id || '-')}</td>
      <td>${window.obsEscape(row.diagnosis || '-')}</td>
      <td>${window.obsEscape(window.ipdFormatDateTime ? window.ipdFormatDateTime(row.start_datetime) : row.start_datetime)}</td>
      <td class="fw-bold">${duration}</td>
      <td>${window.obsStatusBadge(row.status)}</td>
      <td class="text-center">
        <div class="d-flex justify-content-center gap-1">
          <button class="btn btn-sm btn-info text-white btn-obs-view" onclick="window.openObservationDetail('${window.obsEscape(row.observation_id)}')" title="${window.obsEscape(window.t('obs.openObservation'))}"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm btn-primary btn-obs-view" onclick="window.openObservationTransferModal('${window.obsEscape(row.observation_id)}')" title="${window.obsEscape(window.t('ipd.transferBed'))}"><i class="fas fa-exchange-alt"></i></button>
          <button class="btn btn-sm btn-warning btn-obs-convert" onclick="window.convertObservationToIpd('${window.obsEscape(row.observation_id)}')" title="${window.obsEscape(window.t('obs.convertToIpd'))}"><i class="fas fa-bed"></i></button>
          <button class="btn btn-sm btn-secondary btn-obs-discharge" onclick="window.dischargeObservation('${window.obsEscape(row.observation_id)}')" title="${window.obsEscape(window.t('obs.discharge'))}"><i class="fas fa-sign-out-alt"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
  $('#observationTable tbody').html(html);
  $('#observationTable').DataTable({ responsive: true, pageLength: 10, language: { search: 'ຄົ້ນຫາ:', emptyTable: window.t('obs.noData') } });
  window.applyButtonPermissions?.();
};

window.openObservationFromVisit = async function (queueIndex, sourceRows = queueDataStore, options = {}) {
  const q = (sourceRows || queueDataStore || [])[queueIndex];
  if (!q) return;
  await window.ipdLoadProviders?.();
  await window.fetchIpdWardBedData?.();
  const doctorDefault = q.doctor || (currentUser?.role === 'doctor' ? currentUser.name : '') || window.ipdCurrentUserName?.() || '';

  // Build OPD-observation bed picker (only beds in wards with Ward_Type='OPD_Observation' that are Available)
  const state = window.ipdWardBedState || { wards: [], rooms: [], beds: [] };
  const obsWardIds = new Set((state.wards || []).filter(w => window.ipdIsObsWard(w)).map(w => String(w.Ward_ID)));
  const occupiedBedIds = await window.obsGetOccupiedBedIds();
  const availableObsBeds = (state.beds || []).filter(b => obsWardIds.has(String(b.Ward_ID)) && window.ipdBedStatus(b) === 'Available' && !occupiedBedIds.has(String(b.Bed_ID)));
  const bedOptions = '<option value="">-- ' + window.obsEscape(window.t('obs.bedOptional')) + ' --</option>' + availableObsBeds.map(b => {
    const ward = (state.wards || []).find(w => String(w.Ward_ID) === String(b.Ward_ID));
    const room = (state.rooms || []).find(r => String(r.Room_ID) === String(b.Room_ID));
    const label = `${ward?.Ward_Name || b.Ward_ID} / ${room?.Room_Number || b.Room_ID} / ${b.Bed_Number || b.Bed_ID}`;
    const selected = options.bedId && String(options.bedId) === String(b.Bed_ID) ? ' selected' : '';
    return `<option value="${window.obsEscape(b.Bed_ID)}" data-ward="${window.obsEscape(b.Ward_ID)}" data-room="${window.obsEscape(b.Room_ID)}"${selected}>${window.obsEscape(label)}</option>`;
  }).join('');
  const noObsBedsWarning = availableObsBeds.length === 0 && obsWardIds.size === 0
    ? `<div class="full"><div class="alert alert-info py-2 px-3 mb-0" style="font-size:12.5px;"><i class="fas fa-info-circle me-1"></i> ${window.obsEscape(window.t('obs.noObsWardHint'))}</div></div>` : '';

  const result = await Swal.fire({
    title: window.t('obs.createTitle'),
    width: 760,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">HN</label><input class="form-control" value="${window.obsEscape(q.patientId || '')}" readonly></div>
      <div><label class="form-label fw-bold">${window.obsEscape(window.t('ipd.patientName'))}</label><input class="form-control" value="${window.obsEscape(q.patientName || '')}" readonly></div>
      <div><label class="form-label fw-bold">${window.obsEscape(window.t('ipd.doctor'))}</label><input id="obsCreateDoctor" class="form-control" value="${window.obsEscape(doctorDefault)}"></div>
      <div><label class="form-label fw-bold">${window.obsEscape(window.t('obs.startTime'))}</label><input type="datetime-local" id="obsCreateStart" class="form-control" value="${new Date().toISOString().slice(0, 16)}"></div>
      <div class="full"><label class="form-label fw-bold"><i class="fas fa-bed me-1 text-warning"></i>${window.obsEscape(window.t('obs.assignBed'))}</label><select id="obsCreateBed" class="form-select">${bedOptions}</select></div>
      <div class="full"><label class="form-label fw-bold">${window.obsEscape(window.t('ipd.diagnosis'))}</label><textarea id="obsCreateDiagnosis" class="form-control" rows="2">${window.obsEscape(q.diagnosis || '')}</textarea></div>
      ${noObsBedsWarning}
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const $bed = $('#obsCreateBed option:selected');
      return {
        doctor: $('#obsCreateDoctor').val().trim(),
        start: $('#obsCreateStart').val(),
        diagnosis: $('#obsCreateDiagnosis').val().trim(),
        bedId: $bed.val() || null,
        wardId: $bed.data('ward') || null,
        roomId: $bed.data('room') || null
      };
    }
  });
  if (!result.isConfirmed) return;
  const observationId = window.ipdId ? window.ipdId('OBS') : `OBS${Date.now()}`;
  const payload = {
    observation_id: observationId,
    visit_id: q.visitId || null,
    hn: q.patientId || null,
    patient_id: q.patientId || null,
    doctor_id: result.value.doctor || null,
    start_datetime: result.value.start ? new Date(result.value.start).toISOString() : new Date().toISOString(),
    diagnosis: result.value.diagnosis || null,
    status: 'UNDER_OBSERVATION',
    bed_id: result.value.bedId || null,
    ward_id: result.value.wardId || null,
    room_id: result.value.roomId || null,
    created_by: currentUser?.name || currentUser?.id || null
  };
  const { error } = await window.obsFrom(OPD_OBSERVATION_TABLE).insert([payload]);
  if (error) return Swal.fire(window.t('common.error'), error.message, 'error');
  await window.obsFrom(OPD_OBSERVATION_NOTES_TABLE).insert([{
    observation_id: observationId,
    note_type: 'DOCTOR_NOTE',
    note_text: result.value.diagnosis || 'Doctor assessment / start observation',
    recorded_by: result.value.doctor || currentUser?.name || currentUser?.id || null
  }]);
  window.logAction?.('Add', `Create OPD Observation ${observationId} from visit ${q.visitId}`, 'OPD Observation');
  Swal.fire(window.t('common.saved'), window.t('obs.saved'), 'success');
  window.loadView('opd_observation');
};

window.openObservationFromBoard = async function (preferredBedId = null) {
  try {
    const today = window.getLocalStr(new Date());
    const queueRows = await window._fetchOpdQueue(today, today);
    const { data: activeObs, error: obsErr } = await window.obsFrom(OPD_OBSERVATION_TABLE)
      .select('visit_id,status')
      .in('status', window.obsActiveStatuses);
    if (obsErr) throw obsErr;
    const activeVisitIds = new Set((activeObs || []).map(row => String(row.visit_id || '')).filter(Boolean));
    const candidates = (queueRows || []).filter(row => row.visitId && !activeVisitIds.has(String(row.visitId)));
    if (!candidates.length) {
      await Swal.fire(window.t('obs.startObservation'), window.t('obs.noOpdCandidates'), 'info');
      return;
    }
    const options = candidates.map((row, index) => {
      const label = [
        row.time || '',
        row.patientId || '',
        row.patientName || '',
        row.department || '',
        row.status || ''
      ].filter(Boolean).join(' - ');
      return `<option value="${index}">${window.obsEscape(label)}</option>`;
    }).join('');
    const result = await Swal.fire({
      title: window.t('obs.selectVisitForObservation'),
      width: 650,
      html: `<select id="obsBoardVisitSelect" class="form-select">${options}</select>`,
      showCancelButton: true,
      confirmButtonText: window.t('obs.startObservation'),
      cancelButtonText: window.t('common.cancel'),
      preConfirm: () => Number($('#obsBoardVisitSelect').val())
    });
    if (!result.isConfirmed) return;
    await window.openObservationFromVisit(result.value, candidates, { bedId: preferredBedId });
  } catch (err) {
    console.error('Open observation from board failed:', err);
    await Swal.fire('Error', err.message || String(err), 'error');
  }
};

window.obsRowById = function (observationId) {
  return (window.observationRows || []).find(row => String(row.observation_id) === String(observationId)) || null;
};

window.obsBedById = function (bedId) {
  return (window.ipdWardBedState?.beds || []).find(bed => String(bed.Bed_ID) === String(bedId)) || null;
};

window.updateObservationPhysicalBedStatus = async function (bedId, nextStatus, options = {}) {
  const bed = window.obsBedById(bedId) || window.ipdBedById?.(bedId);
  if (!bed) {
    if (!options.silent) await Swal.fire(window.t('common.error'), window.t('ipd.noBedMatch'), 'warning');
    return false;
  }
  const activeByBed = await window.obsActiveObservationByBedId();
  if (activeByBed[String(bedId)] && !options.allowActive) {
    if (!options.silent) await Swal.fire(window.t('ipd.cannotChangeStatus'), window.t('ipd.occupiedToAvailableBlocked'), 'warning');
    return false;
  }
  const now = new Date().toISOString();
  const payload = {
    Bed_Status: nextStatus,
    Status: nextStatus,
    Last_Status_Updated_At: now,
    Updated_At: now
  };
  if (nextStatus !== 'Reserved') {
    Object.assign(payload, {
      Reserved_Patient_ID: null,
      Reserved_Patient_HN: null,
      Reserved_Patient_Name: null,
      Reserved_Phone: null,
      Reserved_By: null,
      Reserved_At: null,
      Reserved_From: null,
      Reserved_Until: null,
      Reservation_Reason: null,
      Reservation_Notes: null
    });
  }
  if (['Available', 'Cleaning', 'Maintenance', 'Inactive'].includes(nextStatus)) {
    Object.assign(payload, {
      Current_Patient_ID: null,
      Current_Patient_HN: null,
      Current_IPD_Admission_ID: null
    });
  }
  const res = await window.ipdMutate('Beds', 'update', payload, { Bed_ID: bed.Bed_ID }, { Status: nextStatus });
  if (res.error) {
    if (!options.silent) await Swal.fire(window.t('common.error'), res.error.message, 'error');
    return false;
  }
  window.logAction?.('Update', `OPD Observation bed ${bed.Bed_ID} -> ${nextStatus}`, 'OPD Observation');
  return true;
};

window.changeObservationBedStatus = async function (bedId, nextStatus) {
  const ok = await window.updateObservationPhysicalBedStatus(bedId, nextStatus);
  if (!ok) return;
  await window.loadObservationPage();
  await Swal.fire(window.t('common.saved'), window.ipdTranslateValue(nextStatus), 'success');
};

window.openObservationTransferModal = async function (observationId) {
  const row = window.obsRowById(observationId);
  if (!row || !window.obsActiveStatuses.includes(String(row.status || '').toUpperCase())) {
    return Swal.fire(window.t('ipd.cannotTransfer'), window.t('obs.noData'), 'warning');
  }
  await window.fetchIpdWardBedData?.();
  const state = window.ipdWardBedState || { wards: [], rooms: [], beds: [] };
  const obsWardIds = new Set((state.wards || []).filter(w => window.ipdIsObsWard(w)).map(w => String(w.Ward_ID)));
  const activeByBed = await window.obsActiveObservationByBedId();
  const destinations = (state.beds || []).filter(b => {
    if (!obsWardIds.has(String(b.Ward_ID))) return false;
    if (String(b.Bed_ID) === String(row.bed_id || '')) return false;
    if (activeByBed[String(b.Bed_ID)]) return false;
    return ['Available', 'Reserved'].includes(window.ipdBedStatus(b));
  });
  if (!destinations.length) return Swal.fire(window.t('ipd.noDestinationBed'), window.t('ipd.noDestinationBedText'), 'warning');
  const patientName = window.obsPatientName(row);
  const destinationOptions = destinations.map(b => {
    const ward = (state.wards || []).find(w => String(w.Ward_ID) === String(b.Ward_ID));
    const room = (state.rooms || []).find(r => String(r.Room_ID) === String(b.Room_ID));
    return `<option value="${window.obsEscape(b.Bed_ID)}">${window.obsEscape(ward?.Ward_Name || b.Ward_ID)} / ${window.obsEscape(window.t('ipd.room'))} ${window.obsEscape(room?.Room_Number || b.Room_ID)} / ${window.obsEscape(window.t('ipd.bedNo'))} ${window.obsEscape(b.Bed_Number)}</option>`;
  }).join('');

  const result = await Swal.fire({
    title: window.t('ipd.transferTitle'),
    width: 720,
    html: `<div class="ipd-form-grid">
      <div class="full"><label class="form-label fw-bold">${window.obsEscape(window.t('obs.openObservation'))}</label><input class="form-control" value="${window.obsEscape(row.observation_id)} - ${window.obsEscape(patientName)}" readonly></div>
      <div class="full"><label class="form-label fw-bold">${window.obsEscape(window.t('ipd.destinationBed'))}</label><select class="form-select" id="obsTransferDestination">${destinationOptions}</select></div>
      <div><label class="form-label fw-bold">${window.obsEscape(window.t('ipd.transferDateTime'))}</label><input type="datetime-local" class="form-control" id="obsTransferDateTime" value="${new Date().toISOString().slice(0, 16)}"></div>
      <div><label class="form-label fw-bold">${window.obsEscape(window.t('ipd.transferredBy'))}</label><input class="form-control" id="obsTransferBy" value="${window.obsEscape(currentUser?.name || currentUser?.id || '')}"></div>
      <div class="full"><label class="form-label fw-bold">${window.obsEscape(window.t('ipd.reason'))}</label><input class="form-control" id="obsTransferReason"></div>
      <div class="full"><label class="form-label fw-bold">${window.obsEscape(window.t('ipd.note'))}</label><textarea class="form-control" id="obsTransferNote" rows="2"></textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('ipd.transfer'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => ({
      destinationBedId: $('#obsTransferDestination').val(),
      movementDateTime: $('#obsTransferDateTime').val(),
      reason: $('#obsTransferReason').val().trim(),
      note: $('#obsTransferNote').val().trim(),
      createdBy: $('#obsTransferBy').val().trim()
    })
  });
  if (!result.isConfirmed) return;
  await window.transferObservationBed(row, result.value);
};

window.transferObservationBed = async function (row, form) {
  const destinationBed = window.obsBedById(form.destinationBedId) || window.ipdBedById?.(form.destinationBedId);
  if (!destinationBed || !['Available', 'Reserved'].includes(window.ipdBedStatus(destinationBed))) {
    return Swal.fire(window.t('ipd.cannotTransfer'), window.t('ipd.destinationAvailableText'), 'warning');
  }
  const sourceBed = row.bed_id ? (window.obsBedById(row.bed_id) || window.ipdBedById?.(row.bed_id)) : null;
  if (sourceBed) {
    await window.updateObservationPhysicalBedStatus(sourceBed.Bed_ID, 'Cleaning', { allowActive: true, silent: true });
  }
  await window.updateObservationPhysicalBedStatus(destinationBed.Bed_ID, 'Available', { silent: true });
  const { error } = await window.obsFrom(OPD_OBSERVATION_TABLE).update({
    ward_id: destinationBed.Ward_ID || null,
    room_id: destinationBed.Room_ID || null,
    bed_id: destinationBed.Bed_ID || null
  }).eq('observation_id', row.observation_id);
  if (error) return Swal.fire(window.t('common.error'), error.message, 'error');

  const sourceLabel = sourceBed ? (sourceBed.Bed_Number || sourceBed.Bed_ID) : window.t('obs.noBedAssigned');
  const destinationLabel = destinationBed.Bed_Number || destinationBed.Bed_ID;
  await window.obsFrom(OPD_OBSERVATION_NOTES_TABLE).insert([{
    observation_id: row.observation_id,
    note_type: 'NURSING_NOTE',
    note_datetime: form.movementDateTime ? new Date(form.movementDateTime).toISOString() : new Date().toISOString(),
    note_text: `Transfer bed: ${sourceLabel} -> ${destinationLabel}${form.reason ? ` | Reason: ${form.reason}` : ''}${form.note ? ` | ${form.note}` : ''}`,
    recorded_by: form.createdBy || currentUser?.name || currentUser?.id || null
  }]);
  window.logAction?.('Update', `Transfer OPD Observation ${row.observation_id} bed ${sourceLabel} -> ${destinationLabel}`, 'OPD Observation');
  await window.loadObservationPage();
  await window.openObservationDetail(row.observation_id);
  await Swal.fire(window.t('ipd.transfer'), window.t('ipd.transferredSuccess'), 'success');
};

window.openObservationNoteFromBoard = async function (observationId, noteType) {
  await window.openObservationDetail(observationId);
  await window.openObservationNoteModal(noteType);
};

window.obsDetailTargets = function () {
  const listVisible = $('#view-opd_observation_list:visible').length > 0;
  return listVisible
    ? {
        panel: '#observationListDetailPanel',
        title: '#obsListDetailTitle',
        meta: '#obsListDetailMeta',
        alert: '#obsListSixHourAlert',
        timeline: '#observationListTimeline'
      }
    : {
        panel: '#observationDetailPanel',
        title: '#obsDetailTitle',
        meta: '#obsDetailMeta',
        alert: '#obsSixHourAlert',
        timeline: '#observationTimeline'
      };
};

window.openObservationDetail = async function (observationId) {
  window.currentObservationId = observationId;
  const row = (window.observationRows || []).find(r => String(r.observation_id) === String(observationId));
  if (!row) return;
  const targets = window.obsDetailTargets();
  $('#observationDetailPanel, #observationListDetailPanel').hide();
  $(targets.panel).show();
  $(targets.title).text(`${row.observation_id} - ${window.obsPatientName(row)}`);
  $(targets.meta).text(`HN ${row.hn || row.patient_id || '-'} | ${row.doctor_id || '-'} | ${row.diagnosis || '-'}`);
  const sixHour = window.obsActiveStatuses.includes(String(row.status || '').toUpperCase()) && window.obsDurationHours(row) >= 6;
  $(targets.alert)
    .toggle(!!sixHour)
    .html(`<strong>${window.obsEscape(window.t('obs.sixHourAlert'))}</strong> <button class="btn btn-sm btn-warning ms-2 btn-obs-convert" onclick="window.convertObservationToIpd('${window.obsEscape(row.observation_id)}')">${window.obsEscape(window.t('obs.convertToIpd'))}</button>`);
  const { data, error } = await window.obsFrom(OPD_OBSERVATION_NOTES_TABLE)
    .select('*')
    .eq('observation_id', observationId)
    .order('note_datetime', { ascending: true });
  if (error) {
    $(targets.timeline).html(`<div class="alert alert-danger">${window.obsEscape(error.message)}</div>`);
    return;
  }
  window.observationNotes = data || [];
  window.renderObservationTimeline(row, window.observationNotes);
  window.applyButtonPermissions?.();
};

window.closeObservationDetail = function () {
  window.currentObservationId = null;
  $('#observationDetailPanel, #observationListDetailPanel').hide();
};

window.renderObservationTimeline = function (row, notes) {
  const iconMap = {
    VITAL_SIGN: 'fas fa-heartbeat text-danger',
    DOCTOR_NOTE: 'fas fa-user-md text-primary',
    NURSING_NOTE: 'fas fa-user-nurse text-success',
    MEDICATION: 'fas fa-pills text-success',
    PROCEDURE: 'fas fa-procedures text-warning'
  };
  const events = [{
    at: row.start_datetime,
    type: 'Arrival',
    icon: 'fas fa-door-open text-info',
    title: 'Arrival / Start Observation',
    body: row.diagnosis || '-',
    by: row.doctor_id || row.created_by || ''
  }];
  (notes || []).forEach(n => {
    const vital = n.note_type === 'VITAL_SIGN'
      ? [`T ${n.temp || '-'}`, `BP ${n.bp || '-'}`, `P ${n.pulse || '-'}`, `RR ${n.rr || '-'}`, `SpO2 ${n.spo2 || '-'}`, `Pain ${n.pain_score || '-'}`].join(' | ')
      : '';
    const med = n.note_type === 'MEDICATION' ? n.medication : '';
    const proc = n.note_type === 'PROCEDURE' ? n.procedure_name : '';
    events.push({
      at: n.note_datetime,
      type: n.note_type,
      icon: iconMap[n.note_type] || 'fas fa-note-sticky text-secondary',
      title: n.note_type.replace(/_/g, ' '),
      body: vital || med || proc || n.note_text || '-',
      by: n.recorded_by || ''
    });
  });
  if (row.end_datetime) {
    events.push({
      at: row.end_datetime,
      type: row.status,
      icon: row.status === 'TRANSFER_TO_IPD' ? 'fas fa-bed text-warning' : 'fas fa-sign-out-alt text-dark',
      title: row.status === 'TRANSFER_TO_IPD' ? 'Transfer to IPD' : 'Discharge',
      body: row.ipd_admission_id ? `IPD: ${row.ipd_admission_id}` : row.status,
      by: ''
    });
  }
  events.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
  const targets = window.obsDetailTargets();
  $(targets.timeline).html(events.map(e => `<div class="obs-timeline-item">
    <div class="obs-timeline-dot"><i class="${e.icon}"></i></div>
    <div class="obs-timeline-card">
      <div class="d-flex justify-content-between gap-2">
        <strong>${window.obsEscape(e.title)}</strong>
        <span class="text-muted small">${window.obsEscape(window.ipdFormatDateTime ? window.ipdFormatDateTime(e.at) : e.at)}</span>
      </div>
      <div class="mt-1">${window.obsEscape(e.body || '-')}</div>
      ${e.by ? `<div class="text-muted small mt-1">${window.obsEscape(e.by)}</div>` : ''}
    </div>
  </div>`).join(''));
};

window.obsProviderMultiOptions = function (roleFilter) {
  const all = window.ipdProvidersCache || [];
  const wanted = Array.isArray(roleFilter) ? roleFilter.map(r => String(r).toLowerCase()) : [String(roleFilter || '').toLowerCase()];
  const roleMatches = (roleValue) => {
    const role = String(roleValue || '').toLowerCase();
    return wanted.some(w =>
      role === w ||
      role.includes(w) ||
      (w === 'doctor' && (role.includes('ແພດ') || role.includes('ຫມໍ') || role.includes('ໝໍ'))) ||
      (w === 'nurse' && role.includes('ພະຍາບານ'))
    ) || role === 'admin';
  };
  const list = all.filter(p => roleMatches(p.role));
  const currentId = currentUser?.id ? String(currentUser.id) : '';
  if (!list.length) {
    return `<option value="" disabled>${window.obsEscape(window.t('ipd.selectProvider'))}</option>`;
  }
  return list.map(p => {
    const selected = currentId && String(p.id) === currentId ? ' selected' : '';
    const label = `${p.name || p.id || '-'}${p.role ? ` (${p.role})` : ''}`;
    return `<option value="${window.obsEscape(p.id)}" data-name="${window.obsEscape(p.name || p.id || '')}" data-role="${window.obsEscape(p.role || '')}"${selected}>${window.obsEscape(label)}</option>`;
  }).join('');
};

window.obsSelectedProviderNames = function (selector) {
  return ($(selector).find('option:selected').map((_, opt) => $(opt).data('name') || $(opt).text() || $(opt).val()).get() || [])
    .map(v => String(v || '').trim())
    .filter(Boolean);
};

window.openObservationNoteModal = async function (noteType) {
  const observationId = window.currentObservationId;
  if (!observationId) return;
  const type = String(noteType || 'NURSING_NOTE').toUpperCase();
  const needsProviderDropdown = ['DOCTOR_NOTE', 'NURSING_NOTE'].includes(type);
  if (needsProviderDropdown) await window.ipdLoadProviders?.();
  const typeLabel = window.t(type === 'VITAL_SIGN' ? 'obs.addVital' : type === 'DOCTOR_NOTE' ? 'obs.doctorNote' : type === 'MEDICATION' ? 'obs.medication' : type === 'PROCEDURE' ? 'obs.procedure' : 'obs.nursingNote');
  const vitalHtml = type === 'VITAL_SIGN' ? `
      <div><label class="form-label fw-bold">Temp</label><input id="obsNoteTemp" class="form-control"></div>
      <div><label class="form-label fw-bold">BP</label><input id="obsNoteBp" class="form-control" placeholder="120/80"></div>
      <div><label class="form-label fw-bold">Pulse</label><input id="obsNotePulse" class="form-control"></div>
      <div><label class="form-label fw-bold">RR</label><input id="obsNoteRr" class="form-control"></div>
      <div><label class="form-label fw-bold">SpO2</label><input id="obsNoteSpo2" class="form-control"></div>
      <div><label class="form-label fw-bold">Pain Score</label><input id="obsNotePain" class="form-control" type="number" min="0" max="10"></div>` : '';
  const providerHtml = needsProviderDropdown
    ? `<div class="full"><label class="form-label fw-bold">${window.obsEscape(window.t(type === 'DOCTOR_NOTE' ? 'obs.selectDoctors' : 'obs.selectNurses'))}</label><select id="obsNoteProviders" class="form-select" multiple size="6">${window.obsProviderMultiOptions(type === 'DOCTOR_NOTE' ? ['doctor'] : ['nurse'])}</select><div class="form-text">${window.obsEscape(window.t('obs.multiSelectHint'))}</div></div>`
    : `<div><label class="form-label fw-bold">${window.obsEscape(window.t('ipd.by'))}</label><input id="obsNoteBy" class="form-control" value="${window.obsEscape(currentUser?.name || currentUser?.id || '')}"></div>`;
  const extraHtml = type === 'PROCEDURE'
      ? `<div class="full"><label class="form-label fw-bold">${window.obsEscape(window.t('obs.procedure'))}</label><input id="obsNoteProcedure" class="form-control"></div>`
      : '';
  const result = await Swal.fire({
    title: typeLabel,
    width: 760,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">${window.obsEscape(window.t('ipd.dateTime'))}</label><input type="datetime-local" id="obsNoteAt" class="form-control" value="${new Date().toISOString().slice(0, 16)}"></div>
      ${providerHtml}
      ${vitalHtml}
      ${extraHtml}
      <div class="full"><label class="form-label fw-bold">Note</label><textarea id="obsNoteText" class="form-control" rows="3"></textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const selectedProviders = needsProviderDropdown ? window.obsSelectedProviderNames('#obsNoteProviders') : [];
      const recordedBy = needsProviderDropdown ? selectedProviders.join(', ') : ($('#obsNoteBy').val() || '').trim();
      if (needsProviderDropdown && !recordedBy) {
        Swal.showValidationMessage(window.t('obs.selectProviderRequired'));
        return false;
      }
      return {
        note_datetime: $('#obsNoteAt').val() ? new Date($('#obsNoteAt').val()).toISOString() : new Date().toISOString(),
        recorded_by: recordedBy,
        note_text: $('#obsNoteText').val().trim(),
        temp: $('#obsNoteTemp').val() || null,
        bp: $('#obsNoteBp').val() || null,
        pulse: $('#obsNotePulse').val() || null,
        rr: $('#obsNoteRr').val() || null,
        spo2: $('#obsNoteSpo2').val() || null,
        pain_score: $('#obsNotePain').val() || null,
        medication: null,
        procedure_name: $('#obsNoteProcedure').val() || null
      };
    }
  });
  if (!result.isConfirmed) return;
  const payload = {
    id: window.ipdId ? window.ipdId('OBSN') : `OBSN${Date.now()}`,
    observation_id: observationId,
    note_type: type,
    ...result.value
  };
  const { error } = await window.obsFrom(OPD_OBSERVATION_NOTES_TABLE).insert([payload]);
  if (error) return Swal.fire(window.t('common.error'), error.message, 'error');
  window.logAction?.('Add', `Observation note ${type} - ${observationId}`, 'OPD Observation');
  await window.openObservationDetail(observationId);
};

window.dischargeObservation = async function (observationId) {
  const row = (window.observationRows || []).find(r => String(r.observation_id) === String(observationId));
  if (!row || ['DISCHARGED', 'TRANSFER_TO_IPD'].includes(String(row.status || '').toUpperCase())) return;
  const confirm = await Swal.fire({
    title: window.t('obs.discharge'),
    text: row.observation_id,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: window.t('obs.discharge'),
    cancelButtonText: window.t('common.cancel')
  });
  if (!confirm.isConfirmed) return;
  if (row.bed_id) {
    await window.updateObservationPhysicalBedStatus(row.bed_id, 'Cleaning', { allowActive: true, silent: true });
  }
  const { error } = await window.obsFrom(OPD_OBSERVATION_TABLE).update({
    status: 'DISCHARGED',
    end_datetime: new Date().toISOString(),
    bed_id: null,
    room_id: null,
    ward_id: null
  }).eq('observation_id', observationId);
  if (error) return Swal.fire(window.t('common.error'), error.message, 'error');
  window.logAction?.('Update', `Discharge OPD Observation ${observationId}`, 'OPD Observation');
  Swal.fire(window.t('common.saved'), window.t('obs.discharged'), 'success');
  await window.loadObservationPage();
  window.closeObservationDetail();
};

window.convertObservationToIpd = async function (observationId) {
  const row = (window.observationRows || []).find(r => String(r.observation_id) === String(observationId));
  if (!row || String(row.status || '').toUpperCase() === 'TRANSFER_TO_IPD') return;
  const duration = window.obsDurationHours(row);
  const message = duration >= 6 ? window.t('obs.sixHourAlert') : 'Observation is under 6 hours. Continue conversion?';
  const confirm = await Swal.fire({
    title: window.t('obs.convertToIpd'),
    text: message,
    icon: duration >= 6 ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: window.t('obs.convertToIpd'),
    cancelButtonText: window.t('common.cancel')
  });
  if (!confirm.isConfirmed) return;

  const patient = window.observationPatientsById[row.patient_id] || window.observationPatientsById[row.hn] || {};
  const patientName = [patient.First_Name, patient.Last_Name].filter(Boolean).join(' ') || row.patient_id || row.hn || '';
  const admissionId = window.ipdId('IPD');
  const now = new Date();
  const payload = {
    Admission_ID: admissionId,
    Patient_ID: row.patient_id || row.hn || null,
    Patient_Name: patientName,
    Admitting_Doctor: row.doctor_id || null,
    Diagnosis_Admission: row.diagnosis || null,
    Admission_Date: window.getLocalStr(now),
    Admission_Time: now.toTimeString().slice(0, 5),
    Ward_ID: null,
    Room_ID: null,
    Bed_ID: null,
    Status: 'Admitted',
    Source_Visit_ID: row.visit_id || null,
    Admission_Source: 'OPD Observation',
    Notes: `Converted from OPD Observation ${row.observation_id}`,
    Created_At: now.toISOString()
  };
  const res = await window.ipdMutate('Admissions', 'insert', payload, null, payload);
  if (res.error) return Swal.fire(window.t('common.error'), res.error.message, 'error');
  await window.copyLatestOpdVitalsToIpdAdmission(admissionId, payload.Patient_ID);
  if (row.bed_id) {
    await window.updateObservationPhysicalBedStatus(row.bed_id, 'Cleaning', { allowActive: true, silent: true });
  }
  const upd = await window.obsFrom(OPD_OBSERVATION_TABLE).update({
    status: 'TRANSFER_TO_IPD',
    end_datetime: now.toISOString(),
    ipd_admission_id: admissionId,
    converted_at: now.toISOString(),
    bed_id: null,
    room_id: null,
    ward_id: null
  }).eq('observation_id', observationId);
  if (upd.error) console.warn('Observation transfer status update failed:', upd.error);
  window.logAction?.('Update', `Convert OPD Observation ${observationId} to IPD ${admissionId}`, 'OPD Observation');
  Swal.fire(window.t('common.saved'), window.t('obs.converted'), 'success').then(() => {
    window.loadView('ipd_ward_bed');
  });
};

window.updateReportObservationStats = async function (sDate, eDate) {
  if (!$('#repObservation').length) return;
  try {
    const range = window.getLocalDateRangeIsoBounds(sDate, eDate);
    const { count, error } = await window.obsFrom(OPD_OBSERVATION_TABLE)
      .select('observation_id', { count: 'exact', head: true })
      .gte('start_datetime', range.startIso)
      .lte('start_datetime', range.endIso);
    if (error) throw error;
    $('#repObservation').text(count || 0);
  } catch (err) {
    console.warn('Report observation stat failed:', err);
    $('#repObservation').text('0');
  }
};

// ============================================================
// OPD doctor-room notifications (Supabase Realtime)
// ============================================================
let opdQueueChannel = null;
let opdQueuePollInterval = null;
const opdNotifiedVisitIds = new Set();
let opdActiveRoomAlerts = [];
const OPD_MY_ROOM_KEY = 'his_opd_my_room';

window.getOpdMyRoom = function () {
  try { return localStorage.getItem(OPD_MY_ROOM_KEY) || ''; } catch (e) { return ''; }
};
window.saveOpdMyRoom = function (value) {
  try { localStorage.setItem(OPD_MY_ROOM_KEY, value || ''); } catch (e) {}
  window.requestOpdNotificationPermission();
  window.seedOpdNotifiedVisits();
  if (typeof window.loadQueue === 'function' && $('#view-opd').is(':visible')) window.loadQueue();
  if (typeof window.checkAlerts === 'function') window.checkAlerts();
};

window.populateOpdMyRoomFilter = function () {
  const $sel = $('#opdMyRoomFilter');
  if (!$sel.length) return;
  const rooms = (masterDataStore?.Department || []).map(d => d.value).filter(Boolean);
  const currentVal = window.getOpdMyRoom();
  let html = '<option value="">🔔 ທຸກຫ້ອງ</option>';
  rooms.forEach(r => { html += `<option value="${r}" ${r === currentVal ? 'selected' : ''}>${r}</option>`; });
  $sel.html(html).val(currentVal);
};

window.normalizeOpdRoomName = function (value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
};

window.isOpdRoomMatch = function (department, selectedRoom = window.getOpdMyRoom()) {
  const room = window.normalizeOpdRoomName(selectedRoom);
  if (!room) return true;
  return window.normalizeOpdRoomName(department) === room;
};

window.isWaitingOpdStatus = function (status) {
  return window.normalizeVisitStatus(status) === 'Waiting OPD';
};

window.seedOpdNotifiedVisits = async function () {
  opdNotifiedVisitIds.clear();
  try {
    const { data } = await supabaseClient.from(dbTable('Visits'))
      .select('Visit_ID,Department')
      .eq('Status', 'Waiting OPD')
      .limit(1000);
    (data || []).forEach(r => {
      if (r.Visit_ID && window.isOpdRoomMatch(r.Department)) opdNotifiedVisitIds.add(r.Visit_ID);
    });
  } catch (e) {
    console.warn('seed waiting OPD failed:', e);
  }
};

window.handleOpdQueueNotification = function (row) {
  if (!row || !window.isWaitingOpdStatus(row.Status)) return;
  const visitId = row.Visit_ID;
  if (!visitId || opdNotifiedVisitIds.has(visitId)) return;
  if (!window.isOpdRoomMatch(row.Department)) return;

  opdNotifiedVisitIds.add(visitId);
  const patientName = row.Patient_Name || row.Patient_ID || '-';
  const department = String(row.Department || '').trim() || 'OPD';
  window.showOpdQueueToast(patientName, department);
  window.playOpdNotificationSound();
  window.showOpdDesktopNotification(patientName, department);
  if (typeof window.checkAlerts === 'function') window.checkAlerts();
};

window.pollOpdQueueNotifications = async function () {
  try {
    const today = window.getLocalStr ? window.getLocalStr(new Date()) : new Date().toISOString().split('T')[0];
    const todayRange = window.getLocalDayIsoBounds(today);
    const { data, error } = await supabaseClient.from(dbTable('Visits'))
      .select('Visit_ID,Patient_ID,Patient_Name,Department,Status,Date')
      .eq('Status', 'Waiting OPD')
      .gte('Date', todayRange.startIso)
      .lte('Date', todayRange.endIso)
      .order('Date', { ascending: false })
      .limit(100);
    if (error) throw error;
    (data || []).reverse().forEach(row => window.handleOpdQueueNotification(row));
  } catch (e) {
    console.warn('OPD notification poll failed:', e);
  }
};

window.setupOpdQueueRealtime = async function () {
  if (opdQueueChannel) {
    try { supabaseClient.removeChannel(opdQueueChannel); } catch (e) {}
    opdQueueChannel = null;
  }
  if (opdQueuePollInterval) {
    clearInterval(opdQueuePollInterval);
    opdQueuePollInterval = null;
  }

  // Seed with currently-existing "Waiting OPD" visit IDs so we only notify on NEW arrivals
  await window.seedOpdNotifiedVisits();

  opdQueueChannel = supabaseClient.channel('opd-queue-notifications')
    .on('postgres_changes', { event: '*', schema: 'public', table: dbTable('Visits') }, payload => {
      const row = payload.new || payload.old;
      if (!row) return;
      if ($('#view-opd').is(':visible')) window.loadQueue();
      window.handleOpdQueueNotification(row);
    })
    .subscribe();

  // Realtime can be unavailable depending on Supabase project settings; poll as a quiet fallback.
  opdQueuePollInterval = setInterval(window.pollOpdQueueNotifications, 15000);
};

window.teardownOpdQueueRealtime = function () {
  if (opdQueueChannel) {
    try { supabaseClient.removeChannel(opdQueueChannel); } catch (e) {}
    opdQueueChannel = null;
  }
  if (opdQueuePollInterval) {
    clearInterval(opdQueuePollInterval);
    opdQueuePollInterval = null;
  }
  opdNotifiedVisitIds.clear();
  opdActiveRoomAlerts = [];
};

window.showOpdQueueToast = function (patientName, department) {
  let $c = $('#opdToastContainer');
  if (!$c.length) {
    $('body').append('<div id="opdToastContainer" class="opd-toast-container"></div>');
    $c = $('#opdToastContainer');
  }
  const toastId = 'opdToast_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const safeName = String(patientName).replace(/</g, '&lt;');
  const safeDept = String(department).replace(/</g, '&lt;');
  $c.append(
    `<div id="${toastId}" class="opd-toast" onclick="document.getElementById('${toastId}').remove()">
       <div class="opd-toast-icon"><i class="fas fa-user-md"></i></div>
       <div class="opd-toast-body">
         <div class="opd-toast-title">ມີຄົນເຈັບໃໝ່ສົ່ງມາ</div>
         <div class="opd-toast-text"><strong>${safeName}</strong> → <span class="opd-toast-dept">${safeDept}</span></div>
       </div>
       <button class="opd-toast-close" onclick="event.stopPropagation();document.getElementById('${toastId}').remove()">&times;</button>
     </div>`
  );
  setTimeout(() => { const el = document.getElementById(toastId); if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); } }, 8000);
};

let opdAudioCtx = null;
window.unlockOpdAudio = function () {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!opdAudioCtx) opdAudioCtx = new AudioCtx();
    if (opdAudioCtx.state === 'suspended') opdAudioCtx.resume();
  } catch (e) {}
};
document.addEventListener('click', window.unlockOpdAudio, { once: false, passive: true });
document.addEventListener('keydown', window.unlockOpdAudio, { once: false, passive: true });

window.playOpdNotificationSound = function () {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!opdAudioCtx) opdAudioCtx = new AudioCtx();
    if (opdAudioCtx.state === 'suspended') opdAudioCtx.resume();
    const ctx = opdAudioCtx;
    const playTone = (freq, startOffset, duration, gainPeak = 0.5) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + startOffset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    };
    // Hospital ding-dong style: 4 pulses, attention-grabbing
    playTone(880, 0.00, 0.18);
    playTone(1320, 0.22, 0.22);
    playTone(880, 0.50, 0.18);
    playTone(1320, 0.72, 0.30);
  } catch (e) { console.warn('Audio notification failed:', e); }
};

window.requestOpdNotificationPermission = function () {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch (e) {}
  }
};

window.showOpdDesktopNotification = function (patientName, department) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification('🔔 ມີຄົນເຈັບໃໝ່ໃນຫ້ອງກວດ', {
      body: `${patientName} → ${department}`,
      tag: 'opd-new-patient',
      requireInteraction: false
    });
    setTimeout(() => { try { n.close(); } catch (e) {} }, 8000);
  } catch (e) { /* ignore */ }
};

window.triggerOpdTestNotification = function () {
  window.unlockOpdAudio();
  window.showOpdQueueToast('ທົດສອບ — ນາງສາວ ສຸກ', window.getOpdMyRoom() || 'OPD ທົ່ວໄປ');
  window.playOpdNotificationSound();
  window.showOpdDesktopNotification('ທົດສອບ — ນາງສາວ ສຸກ', window.getOpdMyRoom() || 'OPD ທົ່ວໄປ');
};

window.loadQueue = async function () {
  try {
    let sDate = $('#opdStartDate').val();
    let eDate = $('#opdEndDate').val();
    if ($.fn.DataTable.isDataTable('#queueTable')) $('#queueTable').DataTable().destroy();
    $('#queueTableBody').html('<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-info spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');
    window.populateOpdMyRoomFilter();

    const allQueueRows = await window._fetchOpdQueue(sDate, eDate);
    const myRoom = window.getOpdMyRoom();
    const q = myRoom
      ? (allQueueRows || []).filter(r => window.isOpdRoomMatch(r.department, myRoom))
      : (allQueueRows || []);
    queueDataStore = q;
    if ($.fn.DataTable.isDataTable('#queueTable')) $('#queueTable').DataTable().destroy();
    let h = '';
    if (q && q.length > 0) {
      q.forEach((r, i) => {
        const status = window.normalizeVisitStatus(r.status);

        let b = '', a = '';
        let isCalling = status.startsWith('Calling');
        
        if (status === 'Waiting OPD' || status === 'Calling OPD') {
          b = isCalling ? '<span class="badge bg-danger animate__animated animate__flash animate__infinite"><i class="fas fa-volume-up"></i> ກຳລັງເອີ້ນ...</span>' : '<span class="badge bg-warning text-dark"><i class="fas fa-user-clock"></i> ລໍຖ້າກວດ</span>';
          a = `<button class="btn btn-sm btn-outline-info shadow-sm me-1 btn-timeline" data-pid="${r.patientId}" title="ປະຫວັດການກວດ"><i class="fas fa-history"></i></button>
                        <button class="btn btn-sm btn-info text-white fw-bold me-1" onclick="window.openEMR(${i})"><i class="fas fa-stethoscope"></i> ເປີດກວດ</button>
                        <button class="btn btn-sm btn-outline-warning fw-bold me-1 btn-obs-add" onclick="window.openObservationFromVisit(${i})" title="${window.obsEscape(window.t('obs.startObservation'))}"><i class="fas fa-notes-medical"></i></button>
                        <button class="btn btn-sm btn-dark text-white me-1" onclick="window.triggerPublicCall('${r.visitId}', '${r.patientId}', '${r.department || 'ຫ້ອງກວດ (OPD)'}')" title="ເອີ້ນຄິວ"><i class="fas fa-volume-up"></i></button>
                        <button class="btn btn-sm btn-secondary text-white" onclick="window.printOPDCard('opd', ${i})"><i class="fas fa-file-medical"></i> ພິມ</button>`;
        } else if (status === 'Waiting Lab' || status === 'Calling Lab') {
          b = isCalling ? '<span class="badge bg-danger animate__animated animate__flash animate__infinite"><i class="fas fa-volume-up"></i> ກຳລັງເອີ້ນ...</span>' : '<span class="badge bg-primary"><i class="fas fa-flask"></i> ລໍຖ້າຜົນແລັບ</span>';
          a = `<button class="btn btn-sm btn-outline-info shadow-sm me-1 btn-timeline" data-pid="${r.patientId}" title="ປະຫວັດການກວດ"><i class="fas fa-history"></i></button>
                        <button class="btn btn-sm btn-primary text-white fw-bold me-1" onclick="window.openEMR(${i})"><i class="fas fa-edit"></i> ອ່ານຜົນແລັບ</button>
                        <button class="btn btn-sm btn-outline-warning fw-bold me-1 btn-obs-add" onclick="window.openObservationFromVisit(${i})" title="${window.obsEscape(window.t('obs.startObservation'))}"><i class="fas fa-notes-medical"></i></button>
                        <button class="btn btn-sm btn-dark text-white me-1" onclick="window.triggerPublicCall('${r.visitId}', '${r.patientId}', '${r.department || 'ຫ້ອງກວດ (OPD)'}')" title="ເອີ້ນຄິວ"><i class="fas fa-volume-up"></i></button>
                        <button class="btn btn-sm btn-secondary text-white" onclick="window.printOPDCard('opd', ${i})"><i class="fas fa-file-medical"></i> ພິມ</button>`;
        } else {
          b = `<span class="badge bg-success"><i class="fas fa-check-circle"></i> ປິດຈົບ (${r.dischargeStatus || 'ກວດສຳເລັດ'})</span>`;
          a = `<button class="btn btn-sm btn-outline-info shadow-sm me-1 btn-timeline" data-pid="${r.patientId}" title="ປະຫວັດການກວດ"><i class="fas fa-history"></i></button>
                       <button class="btn btn-sm btn-success text-white fw-bold me-1" onclick="window.viewEMR(${i})" title="ເບິ່ງລາຍລະອຽດການກວດ"><i class="fas fa-eye"></i></button>
                       <button class="btn btn-sm btn-primary text-white fw-bold me-1" onclick="window.openEMR(${i})" title="ແກ້ໄຂການກວດ"><i class="fas fa-edit"></i></button>
                       <button class="btn btn-sm btn-outline-warning fw-bold me-1 btn-obs-add" onclick="window.openObservationFromVisit(${i})" title="${window.obsEscape(window.t('obs.startObservation'))}"><i class="fas fa-notes-medical"></i></button>
                       <button class="btn btn-sm btn-secondary text-white" onclick="window.printOPDCard('opd', ${i})"><i class="fas fa-print"></i></button>`;
        }
        let nb = r.isNew ? '<span class="badge bg-success ms-2">ໃໝ່</span>' : '<span class="badge bg-secondary ms-2">ເກົ່າ</span>';
        let dateTimeStr = (r.date ? r.date + ' ' : '') + r.time;
        h += `<tr class="${isCalling ? 'table-danger' : ''}">
                      <td class="text-muted small">${dateTimeStr}</td>
                      <td class="text-dark fw-bold">${r.patientId}</td>
                      <td><div class="fw-bold text-primary">${r.patientName} ${nb}</div></td>
                      <td><span class="badge bg-light text-dark border px-2 py-1">${r.department}</span></td>
                      <td>${b}</td>
                      <td class="text-center"><div class="d-flex gap-1 justify-content-center">${a}</div></td>
                    </tr>`;
      });
    }
    $('#queueTableBody').html(h);
    $('#queueTable').DataTable({ responsive: true, pageLength: 10, language: { search: "ຄົ້ນຫາ:", emptyTable: "ບໍ່ມີຄິວລໍຖ້າ" } });
    window.applyButtonPermissions?.();
  } catch (err) {
    console.error("Critical loadQueue Error:", err);
    let msg = err.message || "Unknown error";
    $('#queueTableBody').html(`<tr><td colspan="6" class="text-center py-4 text-danger">ເກີດຂໍ້ຜິດພາດໃນການໂຫຼດຂໍ້ມູນ: <br><small>${msg}</small></td></tr>`);
  }
};

window.viewEMR = function (i) {
  let q = queueDataStore[i];
  if (!q) return;

  let labList = "ບໍ່ມີການສັ່ງກວດ", drugList = "ບໍ່ມີການສັ່ງຢາ";
  try {
    let labs = q.labOrdersStr ? JSON.parse(q.labOrdersStr) : [];
    if (labs.length > 0) {
      labList = "<ul class='mb-0 text-start ps-3'>";
      labs.forEach(l => labList += `<li>${l.name}</li>`);
      labList += "</ul>";
    }
  } catch (e) { }

  try {
    let drugs = q.prescriptionStr ? JSON.parse(q.prescriptionStr) : [];
    if (drugs.length > 0) {
      drugList = "<ul class='mb-0 text-start ps-3'>";
      drugs.forEach(d => drugList += `<li><b>${d.name}</b>: <span class="badge bg-secondary">${d.qty}</span> (${d.usage})</li>`);
      drugList += "</ul>";
    }
  } catch (e) { }

  let htmlBody = `
        <div class="text-start" style="font-size: 14px; line-height: 1.6;">
            <div class="row border-bottom pb-2 mb-2 align-items-center">
                <div class="col-6 d-flex align-items-center gap-2">
                    <div style="width: 45px; height: 45px; border-radius: 50%; overflow: hidden; background: #f1f5f9; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
                        ${q.photoUrl ? `<img src="${q.photoUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas fa-user text-muted"></i>`}
                    </div>
                    <div>
                        <b><i class="fas fa-user text-primary"></i> ຄົນເຈັບ:</b> ${q.patientName} <br>
                        <small class="text-muted">(${q.patientId}) - ${q.gender || '-'}, ${q.age} ປີ</small>
                    </div>
                </div>
                <div class="col-6 text-end"><b><i class="far fa-clock text-info"></i> ເວລາ:</b> ${q.time}</div>
            </div>
            <p><b><i class="fas fa-user-md text-primary"></i> ແພດຜູ້ກວດ:</b> <span class="text-primary fw-bold">${q.doctor || '-'}</span> ${q.nurse ? `<span class="ms-3"><b><i class="fas fa-user-nurse text-info"></i> ພະຍາບານ:</b> ${q.nurse}</span>` : ''}</p>
            <p><b><i class="fas fa-comment-medical text-danger"></i> ອາການເບື້ອງຕົ້ນ (CC):</b><br> ${q.symptoms || '-'}</p>
            <div class="bg-light p-2 rounded mb-3 border">
                <b><i class="fas fa-heartbeat text-danger"></i> Vitals:</b> 
                BP: <span class="text-primary fw-bold">${q.bp || '-'}</span> | 
                Temp: <span class="text-danger fw-bold">${q.temp ? q.temp + ' °C' : '-'}</span> | 
                Wt: <span class="text-success fw-bold">${q.weight ? q.weight + ' kg' : '-'}</span>
            </div>
            <p><b><i class="fas fa-search text-dark"></i> ຜົນການກວດ (PE):</b><br> ${q.pe || '-'}</p>
            <p><b><i class="fas fa-stethoscope text-danger"></i> ການວິນິດໄສ (Dx):</b><br> <span class="text-danger fw-bold">${q.diagnosis || '-'}</span></p>
            <div class="row mt-3">
                <div class="col-md-6 mb-2">
                    <div class="border border-primary rounded p-2 h-100">
                        <b class="text-primary"><i class="fas fa-flask"></i> ລາຍການແລັບ:</b>
                        <div class="mt-1">${labList}</div>
                    </div>
                </div>
                <div class="col-md-6 mb-2">
                    <div class="border border-success rounded p-2 h-100">
                        <b class="text-success"><i class="fas fa-pills"></i> ລາຍການຢາ:</b>
                        <div class="mt-1">${drugList}</div>
                    </div>
                </div>
            </div>
            <p class="mt-3 mb-1"><b><i class="fas fa-comment-dots text-warning"></i> ຄຳແນະນຳ:</b> ${q.advice || '-'}</p>
            <p class="mb-1"><b><i class="fas fa-calendar-check text-info"></i> ນັດໝາຍ:</b> ${q.followup || '-'}</p>
            <p class="mb-0"><b><i class="fas fa-clipboard-check text-success"></i> ສະຖານະ:</b> <span class="badge bg-success">${q.dischargeStatus || '-'}</span></p>
        </div>
    `;

  Swal.fire({
    title: '<i class="fas fa-file-medical-alt text-primary"></i> ຂໍ້ມູນການກວດພະຍາດ',
    html: htmlBody,
    width: '700px',
    showCloseButton: true,
    focusConfirm: false,
    confirmButtonText: 'ປິດ',
    confirmButtonColor: '#64748b'
  });
};

window.handleSiteChange = function () {
  let site = $('#emrSite').val();
  if (!site) site = 'In-site';
  let typeSelect = $('#emrDeptType');
  typeSelect.empty();
  let options = [];
  if (site === 'In-site' || site === 'In-Site') {
    options = (masterDataStore['PatientType_InSite'] && masterDataStore['PatientType_InSite'].length > 0) ? masterDataStore['PatientType_InSite'].map(x => x.value) : ['OPD'];
  } else {
    options = (masterDataStore['PatientType_Onsite'] && masterDataStore['PatientType_Onsite'].length > 0) ? masterDataStore['PatientType_Onsite'].map(x => x.value) : ['Checkup Corporation', 'Individual First Aid', 'Corporation First Aid', 'HomeCare'];
  }
  let h = '';
  options.forEach(opt => h += `<option value="${opt}">${opt}</option>`);
  typeSelect.html(h);
};

window.handleServiceSelectionChange = function () {
  let selectedServices = $('#emrService').val() || [];
  let specialists = new Set();
  let revenues = new Set();

  selectedServices.forEach(svcName => {
    let match = servicesDataStore.find(s => (s.service || s.Services_List || '') === svcName);
    if (match) {
      let specialist = match.specialist || match.Mapped_Specialist || '';
      let revenue = match.revenue || match.Revenue_Group || '';
      if (specialist && specialist !== '-') specialists.add(specialist);
      if (revenue && revenue !== '-') revenues.add(revenue);
    }
  });

  $('#emrSpecialist').val(Array.from(specialists).join(', '));
  $('#emrRevenue').val(Array.from(revenues).join(', '));
};

window.setEMRDischargeStatusValue = function (value) {
  const select = $('#emrDischargeStatus');
  const normalizedValue = (value || '').trim();
  if (!select.length) return;

  if (!normalizedValue) {
    select.val('').trigger('change');
    return;
  }

  const hasOption = select.find('option').toArray().some(option => option.value === normalizedValue);
  if (!hasOption) {
    select.append(new Option(normalizedValue, normalizedValue, false, false));
  }

  select.val(normalizedValue).trigger('change');
};

window.resolveVisitStatusFromDischarge = function (dischargeStatus) {
  const value = (dischargeStatus || '').trim();
  if (!value) return '';

  const statusMap = {
    "ລໍຖ້າຜົນແລັບ (Waiting Lab)": "Waiting Lab",
    "ສົ່ງຕໍ່ (Transfer)": "Transfer",
    "ກວດສຳເລັດ / ກັບບ້ານ": "Completed",
    "ຮັບຢາກັບບ້ານ": "Pharmacy",
    "ສົ່ງເຂົ້າຕິດຕາມ OPD": "OPD Observation",
    "ສົ່ງເຂົ້ານອນ IPD": "Admit IPD"
  };

  if (statusMap[value]) return statusMap[value];

  const normalized = value.toLowerCase();
  if (normalized.includes('waiting lab') || value.includes('ລໍຖ້າຜົນແລັບ')) return 'Waiting Lab';
  if (normalized.includes('transfer') || value.includes('ສົ່ງຕໍ່')) return 'Transfer';
  if (normalized.includes('observation') || value.includes('ຕິດຕາມ OPD')) return 'OPD Observation';
  if (normalized.includes('admit ipd') || value.includes('ນອນ IPD')) return 'Admit IPD';
  if (normalized.includes('pharmacy') || normalized.includes('rx') || value.includes('ຮັບຢາ')) return 'Pharmacy';
  return 'Completed';
};

window.openEMR = function (i) {
  let q = queueDataStore[i];
  $('#emrRowIdx').val(q.rowIdx);
  $('#emrPatientId').text(q.patientId);
  $('#emrPatientName').text(q.patientName);

  if (q.photoUrl) {
    $('#emr_p_photo').attr('src', q.photoUrl).show();
    $('#emr_p_photo_placeholder').hide();
  } else {
    $('#emr_p_photo').hide();
    $('#emr_p_photo_placeholder').show();
  }

  if (q.allergy && q.allergy.trim() !== "" && q.allergy !== "ບໍ່ມີ" && q.allergy !== "-") {
    $('#emrAllergy').text(q.allergy).removeClass('text-secondary').addClass('text-danger');
    $('#emrAllergyBox').removeClass('bg-light border-secondary').addClass('bg-danger bg-opacity-10 border-danger');
    $('#emrAllergyIcon').removeClass('text-secondary').addClass('text-danger');
  } else {
    $('#emrAllergy').text("ບໍ່ມີປະຫວັດການແພ້").removeClass('text-danger').addClass('text-secondary');
    $('#emrAllergyBox').removeClass('bg-danger bg-opacity-10 border-danger').addClass('bg-light border-secondary');
    $('#emrAllergyIcon').removeClass('text-danger').addClass('text-secondary');
  }

  $('#emrCC').text(q.symptoms || "-");
  $('#emrBp').removeClass('text-danger text-warning text-success fw-bold').addClass('text-dark');
  if (q.bp) {
    $('#emrBp').text(q.bp + " mmHg");
    let [s, d] = q.bp.split('/').map(Number);
    if (!isNaN(s) && !isNaN(d)) {
      if (s >= 140 || d >= 90) $('#emrBp').addClass('text-danger fw-bold');
      else if (s <= 90 || d <= 60) $('#emrBp').addClass('text-warning text-dark fw-bold');
      else $('#emrBp').addClass('text-success fw-bold');
    }
  } else {
    $('#emrBp').text("-");
  }

  $('#emrTemp').removeClass('text-danger text-success fw-bold').addClass('text-dark');
  if (q.temp) {
    $('#emrTemp').text(q.temp + " °C");
    let t = parseFloat(q.temp);
    if (!isNaN(t)) {
      if (t >= 37.5) $('#emrTemp').addClass('text-danger fw-bold');
      else $('#emrTemp').addClass('text-success fw-bold');
    }
  } else {
    $('#emrTemp').text("-");
  }

  $('#emrWeight').text(q.weight ? q.weight + " kg" : "-");
  
  // Add Height and BMI display
  let heightText = q.height ? q.height + " cm" : "-";
  let bmiText = "-";
  if (q.weight && q.height) {
    let w = parseFloat(q.weight);
    let h = parseFloat(q.height) / 100; // convert to meters
    if (w > 0 && h > 0) {
      let bmi = w / (h * h);
      bmiText = bmi.toFixed(1);
    }
  }
  $('#emrHeight').text(heightText);
  $('#emrBmi').text(bmiText);
  
  $('#emrPE').val(q.pe || '');
  $('#emrDiagnosis').val(q.diagnosis || '');
  $('#emrAdvice').val(q.advice || '');
  $('#emrFollowup').val(q.followup || '');
  window.setEMRDischargeStatusValue(q.dischargeStatus || '');
  $('#emrDoctor').val(q.doctor || (currentUser ? currentUser.name : ''));

  let os = '';
  let siteOptions = masterDataStore['Site'] ? masterDataStore['Site'].map(x => x.value) : ['In-site', 'Onsite'];
  siteOptions.forEach(x => os += `<option value="${x}">${x}</option>`);
  $('#emrSite').html(os).val(q.site || "In-site");
  window.handleSiteChange();

  if (q.type) {
    if (!Array.from($('#emrDeptType')[0].options).some(o => o.value === q.type)) {
      $('#emrDeptType').append(`<option value="${q.type}">${q.type}</option>`);
    }
    $('#emrDeptType').val(q.type);
  }

  $('#emrService').val(q.services ? q.services.split(',').map(x => x.trim()) : null).trigger('change');

  try { currentEMRLabs = q.labOrdersStr ? JSON.parse(q.labOrdersStr) : []; } catch (e) { currentEMRLabs = []; }
  try { currentEMRDrugs = q.prescriptionStr ? JSON.parse(q.prescriptionStr) : []; } catch (e) { currentEMRDrugs = []; }

  window.renderEMRLabTable();
  window.renderEMRDrugTable();
  window.resetEMRWorkflowTabs();

  // Clear "Calling" status if opening
  if (q.status === 'Calling OPD' || q.status === 'Calling Lab') {
    let resetStatus = q.status === 'Calling OPD' ? 'Waiting OPD' : 'Waiting Lab';
    supabaseClient.from(dbTable('Visits')).update({ Status: resetStatus }).eq('Visit_ID', q.visitId).eq('Patient_ID', q.patientId);
  }

  if (document.activeElement) document.activeElement.blur();
  $('#emrModal').modal('show');
};

window.submitEMRForm = async function (e) {
  if (e) e.preventDefault();
  let ds = $('#emrDischargeStatus').val();
  if (!ds) return Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາເລືອກສະຖານະປິດຈົບການກວດ', 'warning');

  let dx = $('#emrDiagnosis').val();
  if (ds !== "ລໍຖ້າຜົນແລັບ (Waiting Lab)" && dx.trim() === "") {
    return Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນ ການວິນິດໄສ (Diagnosis) ກ່ອນທີ່ຈະປິດຈົບການກວດ!', 'warning');
  }

  let docName = $('#emrDoctor').val() || (currentUser ? currentUser.name : 'Doctor');
  let presJson = currentEMRDrugs.length > 0 ? JSON.stringify(currentEMRDrugs) : "";
  let labJson = currentEMRLabs.length > 0 ? JSON.stringify(currentEMRLabs) : "";

  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });

  let visitId = $('#emrRowIdx').val();
  let patientId = $('#emrPatientId').text().trim();
  let mainStatus = window.resolveVisitStatusFromDischarge(ds);

  const { error: updateError } = await supabaseClient.from(dbTable('Visits')).update({
    Status: mainStatus, Symptoms: $('#emrCC').text(), Diagnosis: dx,
    Prescription_JSON: presJson, Doctor_Name: docName,
    Visit_Type: $('#emrDeptType').val() || 'OPD', Site: $('#emrSite').val() || 'In-site',
    Physical_Exam: $('#emrPE').val() || '', Advice: $('#emrAdvice').val() || '', Follow_Up: $('#emrFollowup').val() || '',
    Services_List: $('#emrService').val() ? $('#emrService').val().join(', ') : '',
    Mapped_Specialist: $('#emrSpecialist').val() || '', Revenue_Group: $('#emrRevenue').val() || '',
    Lab_Orders_JSON: labJson, Discharge_Status: ds || ''
  }).eq('Visit_ID', visitId).eq('Patient_ID', patientId);

  if (updateError) {
    Swal.fire('ຜິດພາດ!', updateError.message, 'error');
    return;
  }

  // Branch side-effects based on chosen discharge status
  if (mainStatus === 'OPD Observation') {
    await window.handleEmrSendToObservation({ visitId, patientId, doctor: docName, diagnosis: dx });
  } else if (mainStatus === 'Admit IPD') {
    await window.handleEmrSendToIpd({ visitId, patientId, patientName: $('#emrPatientName').text().trim(), doctor: docName, diagnosis: dx });
    return; // handleEmrSendToIpd navigates to bed board
  }

  $('#emrModal').modal('hide');
  window.loadQueue();
  window.logAction('Save', 'EMR saved - Visit ' + visitId + ' (' + mainStatus + ')', 'OPD');
  Swal.fire({ title: 'ສຳເລັດ!', text: 'ບັນທຶກແລ້ວ', icon: 'success', timer: 1500, showConfirmButton: false });
};

window.handleEmrSendToObservation = async function ({ visitId, patientId, doctor, diagnosis }) {
  try {
    const observationId = window.ipdId ? window.ipdId('OBS') : `OBS${Date.now()}`;
    const payload = {
      observation_id: observationId,
      visit_id: visitId || null,
      hn: patientId || null,
      patient_id: patientId || null,
      doctor_id: doctor || null,
      start_datetime: new Date().toISOString(),
      diagnosis: diagnosis || null,
      status: 'UNDER_OBSERVATION',
      created_by: currentUser?.name || currentUser?.id || null
    };
    const { error } = await window.obsFrom(OPD_OBSERVATION_TABLE).insert([payload]);
    if (error) { console.warn('Auto-create observation failed:', error); return; }
    await window.obsFrom(OPD_OBSERVATION_NOTES_TABLE).insert([{
      observation_id: observationId,
      note_type: 'DOCTOR_NOTE',
      note_text: diagnosis || 'EMR closed → observation',
      recorded_by: doctor || null
    }]);
    window.logAction?.('Add', `EMR → Observation ${observationId} (visit ${visitId})`, 'OPD Observation');
  } catch (err) { console.warn('handleEmrSendToObservation error:', err); }
};

window.handleEmrSendToIpd = async function ({ visitId, patientId, patientName, doctor, diagnosis }) {
  const admissionId = window.ipdId('IPD');
  const now = new Date();
  const payload = {
    Admission_ID: admissionId,
    Patient_ID: patientId || null,
    Patient_Name: patientName || patientId || '',
    Admitting_Doctor: doctor || null,
    Diagnosis_Admission: diagnosis || null,
    Admission_Date: window.getLocalStr(now),
    Admission_Time: now.toTimeString().slice(0, 5),
    Ward_ID: null, Room_ID: null, Bed_ID: null,
    Status: 'Admitted',
    Source_Visit_ID: visitId || null,
    Admission_Source: 'EMR Discharge',
    Notes: `Admitted from EMR visit ${visitId}`,
    Created_At: now.toISOString()
  };
  const res = await window.ipdMutate('Admissions', 'insert', payload, null, payload);
  if (res.error) {
    Swal.fire('ຜິດພາດ!', `ບັນທຶກ EMR ສຳເລັດແຕ່ສ້າງ IPD admission ບໍ່ໄດ້: ${res.error.message}`, 'error');
    return;
  }
  await window.copyLatestOpdVitalsToIpdAdmission?.(admissionId, patientId);
  window.logAction?.('Add', `EMR → IPD admission ${admissionId} (visit ${visitId})`, 'OPD');
  $('#emrModal').modal('hide');
  Swal.fire({
    title: 'ສ້າງ IPD ແລ້ວ',
    html: `Admission: <strong>${window.ipdEscape(admissionId)}</strong><br><small class="text-muted">ກະລຸນາມອບຕຽງໃຫ້ຄົນເຈັບ</small>`,
    icon: 'success',
    timer: 2200,
    showConfirmButton: false
  }).then(() => window.loadView('ipd_ward_bed'));
};

window.printOPDCard = async function (s, i) {
  let v = (s === 'triage') ? currentTriageData[i] : queueDataStore[i];
  if (!v) return;

  Swal.fire({ title: 'ກຳລັງສ້າງໃບ OPD...', didOpen: () => Swal.showLoading() });

  try {
    const { data: d, error } = await supabaseClient
      .from(dbTable('Patients'))
      .select('*')
      .eq('Patient_ID', v.patientId)
      .single();

    if (error || !d) {
      Swal.close();
      return Swal.fire('ຜິດພາດ', 'ບໍ່ພົບຂໍ້ມູນຄົນເຈັບໃນລະບົບ', 'error');
    }

    let h1 = document.getElementById('print-opd-header-1');
    let h2 = document.getElementById('print-opd-header-2');
    let f1 = document.getElementById('print-opd-footer-1');
    let f2 = document.getElementById('print-opd-footer-2');

    if (systemSettings.opdHeaderUrl) {
      if (h1) { h1.src = systemSettings.opdHeaderUrl; h1.style.display = 'block'; }
      if (h2) { h2.src = systemSettings.opdHeaderUrl; h2.style.display = 'block'; }
    } else {
      if (h1) { h1.src = ''; h1.setAttribute('src', ''); h1.style.display = 'none'; }
      if (h2) { h2.src = ''; h2.setAttribute('src', ''); h2.style.display = 'none'; }
    }

    if (systemSettings.opdFooterUrl) {
      if (f1) { f1.src = systemSettings.opdFooterUrl; f1.style.display = 'block'; }
      if (f2) { f2.src = systemSettings.opdFooterUrl; f2.style.display = 'block'; }
    } else {
      if (f1) { f1.src = ''; f1.setAttribute('src', ''); f1.style.display = 'none'; }
      if (f2) { f2.src = ''; f2.setAttribute('src', ''); f2.style.display = 'none'; }
    }

    let safeSetText = function (id, text) {
      let el = document.getElementById(id);
      if (el) el.innerText = text;
    };

    safeSetText('popd_cn', d.Patient_ID || "-");
    safeSetText('popd_orgid', d.Organization_ID || "-");
    safeSetText('popd_orgname', d.Name_Org || "-");
    safeSetText('popd_datetime', `${v.date || window.getLocalStr(new Date())} ${v.time || ""}`);
    safeSetText('popd_vid', v.visitId || "-");
    safeSetText('popd_dept', v.department || "-");
    safeSetText('popd_name', d.First_Name || "");
    safeSetText('popd_surname', d.Last_Name || "");
    safeSetText('popd_age', d.Age || "-");
    safeSetText('popd_dob', d.Date_of_Birth || "-");
    safeSetText('popd_gender', d.Gender || "-");
    safeSetText('popd_nation', d.Nationality || "-");
    safeSetText('popd_job', d.Occupation || "-");
    safeSetText('popd_village', d.Address || "-");
    safeSetText('popd_district', d.District || "-");
    safeSetText('popd_prov', d.Province || "-");
    safeSetText('popd_phone', d.Phone_Number || "-");
    safeSetText('popd_cc', v.symptoms || "-");
    safeSetText('popd_temp', v.temp ? v.temp + " °C" : "-");
    safeSetText('popd_bp', v.bp || "-");
    safeSetText('popd_pr', v.pulse || "-");
    safeSetText('popd_spo2', v.spo2 ? v.spo2 + " %" : "-");
    safeSetText('popd_w', v.weight ? v.weight + " kg" : "-");
    safeSetText('popd_h', v.height ? v.height + " cm" : "-");

    let bmiText = "-";
    if (v.weight && v.height) {
      let w = parseFloat(v.weight), h = parseFloat(v.height);
      if (w > 0 && h > 0) {
        let bmi = w / Math.pow(h / 100, 2);
        bmiText = bmi.toFixed(1) + (bmi >= 25 ? " (ຕຸ້ຍ)" : bmi < 18.5 ? " (ຈ່ອຍ)" : " (ປົກກະຕິ)");
      }
    }

    safeSetText('popd_bmi', bmiText);
    safeSetText('popd_allergy', d.Drug_Allergy || "ບໍ່ມີ");
    safeSetText('popd_disease', d.Underlying_Disease || "ບໍ່ມີ");

    Swal.close();
    window.executePrint('opd-print-area');

  } catch (err) {
    Swal.close();
    console.error("Print Error:", err);
    Swal.fire('ຂໍ້ຜິດພາດ', 'ເກີດບັນຫາໃນການຈັດກຽມເອກະສານ', 'error');
  }
};

window.openApptModal = function () {
  $('#apptForm')[0].reset();
  $('#typePatient').prop('checked', true);
  window.toggleApptCustomerType();
  $('#a_id').val('');
  $('#a_date').val(window.getLocalStr(new Date()));
  if (document.activeElement) document.activeElement.blur();
  $('#apptModal').modal('show');
};

window.toggleApptCustomerType = function () {
  let o = $('#typeOrg').is(':checked');
  if (o) {
    $('#boxApptPatient').hide();
    $('#boxApptOrg').show();
    $('#a_patient').val(null).trigger('change');
  } else {
    $('#boxApptPatient').show();
    $('#boxApptOrg').hide();
    $('#a_org').val(null).trigger('change');
  }
  $('#a_target_id, #a_target_name').val('');
};

window.openPatientVacModal = function () {
  $('#patientVacForm')[0].reset();
  $('#pv_patient').val(null).trigger('change');
  $('#pv_date').val(window.getLocalStr(new Date()));
  if (document.activeElement) document.activeElement.blur();
  $('#patientVacModal').modal('show');
};

window.delPatient = async function (id) {
  let r = await Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ລຶບ' });
  if (r.isConfirmed) {
    const { error } = await supabaseClient.from(dbTable('Patients')).delete().eq('Patient_ID', id);
    if (error) {
      Swal.fire('Error', error.message, 'error');
    } else {
      window.initPatientTable();
      window.logAction('Delete', `ລຶບຄົນເຈັບ: ${id}`, 'Patients');
      Swal.fire('ສຳເລັດ!', 'ລຶບຂໍ້ມູນຄົນເຈັບແລ້ວ', 'success');
    }
  }
};

window.loadAppointments = async function () {
  if ($.fn.DataTable.isDataTable('#apptTable')) $('#apptTable').DataTable().destroy();
  $('#apptTable tbody').html('<tr><td colspan="8" class="text-center py-4"><div class="spinner-border text-warning spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');

  try {
    const { data: r, error } = await supabaseClient.from(dbTable('Appointments')).select('*').order('Appt_Date', { ascending: true });

    if (error) {
      console.error('Error:', error);
      Swal.fire('Error', error.message, 'error');
      return;
    }

    if ($.fn.DataTable.isDataTable('#apptTable')) $('#apptTable').DataTable().destroy();
    let h = '';
    if (r && r.length > 0) {
      r.forEach(a => {
        let bs = '', ac = '';
        if (a.Status === 'Completed') {
          bs = '<span class="badge bg-success">ສຳເລັດ</span>';
          ac = `<button class="btn btn-sm btn-outline-danger shadow-sm" onclick="window.deleteAppt('${a.Appt_ID}')"><i class="fas fa-trash"></i></button>`;
        } else if (a.Status === 'Cancelled') {
          bs = '<span class="badge bg-secondary">ຍົກເລີກ</span>';
          ac = `<button class="btn btn-sm btn-outline-danger shadow-sm" onclick="window.deleteAppt('${a.Appt_ID}')"><i class="fas fa-trash"></i></button>`;
        } else if (a.Status === 'Missed') {
          bs = '<span class="badge bg-dark">ຂາດນັດ</span>';
          ac = `<button class="btn btn-sm btn-outline-danger shadow-sm" onclick="window.deleteAppt('${a.Appt_ID}')"><i class="fas fa-trash"></i></button>`;
        } else if (a.Status === 'Overdue') {
          bs = '<span class="badge bg-danger">ກາຍກຳນົດ!</span>';
          ac = `<button class="btn btn-sm btn-success shadow-sm me-1" onclick="window.completeAppt('${a.Appt_ID}')"><i class="fas fa-check"></i></button><button class="btn btn-sm btn-dark shadow-sm me-1" onclick="window.missedAppt('${a.Appt_ID}')"><i class="fas fa-user-slash"></i></button><button class="btn btn-sm btn-secondary shadow-sm" onclick="window.cancelAppt('${a.Appt_ID}')"><i class="fas fa-times"></i></button>`;
        } else {
          bs = '<span class="badge bg-warning text-dark">ລໍຖ້າ</span>';
          ac = `<button class="btn btn-sm btn-success shadow-sm me-1" onclick="window.completeAppt('${a.Appt_ID}')"><i class="fas fa-check"></i></button><button class="btn btn-sm btn-dark shadow-sm me-1" onclick="window.missedAppt('${a.Appt_ID}')"><i class="fas fa-user-slash"></i></button><button class="btn btn-sm btn-secondary shadow-sm" onclick="window.cancelAppt('${a.Appt_ID}')"><i class="fas fa-times"></i></button>`;
        }
        let ty = a.Type === 'Vaccine' ? '<span class="badge border border-success text-success"><i class="fas fa-syringe"></i> ວັກຊີນ</span>' : '<span class="badge border border-primary text-primary"><i class="fas fa-stethoscope"></i> ທົ່ວໄປ</span>';
        let pt = (a.Patient_ID && a.Patient_ID.startsWith('ORG')) ? `<i class="fas fa-building text-success me-1"></i> ${a.Patient_Name}` : `<i class="fas fa-user text-primary me-1"></i> ${a.Patient_Name}`;
        let rowColor = a.Status === 'Overdue' ? 'text-danger' : 'text-primary';

        h += `<tr>
                        <td class="${rowColor} fw-bold">${a.Appt_Date || ''}</td>
                        <td>${a.Appt_Time || ''}</td>
                        <td>${ty}</td>
                        <td class="fw-bold">${pt}</td>
                        <td>${a.Reason || ''}</td>
                        <td class="text-muted small">${a.Doctor || ''}</td>
                        <td>${bs}</td>
                        <td class="text-center"><div class="d-flex justify-content-center">${ac}</div></td>
                      </tr>`;
      });
    }
    $('#apptTable tbody').html(h);
    $('#apptTable').DataTable({ responsive: true, pageLength: 10, order: [[0, "asc"]], language: { search: "ຄົ້ນຫາ:", emptyTable: "ຍັງບໍ່ມີຂໍ້ມູນ" } });
  } catch (err) {
    console.error('Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

window.submitApptForm = async function (e) {
  if (e) e.preventDefault();
  if (!$('#a_target_id').val()) return Swal.fire('ແຈ້ງເຕືອນ', 'ເລືອກລູກຄ້າກ່ອນ', 'warning');
  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });

  let isEdit = $('#a_id').val() !== '';
  let row = {
    Target_ID: $('#a_target_id').val(), Target_Name: $('#a_target_name').val(),
    Appt_Date: $('#a_date').val(), Appt_Time: $('#a_time').val(),
    Type: $('#a_type').val(), Reason: $('#a_reason').val(), Doctor_Name: $('#a_doctor').val()
  };

  let res;
  if (isEdit) {
    res = await supabaseClient.from(dbTable('Appointments')).update(row).eq('Appt_ID', $('#a_id').val());
  } else {
    res = await supabaseClient.from(dbTable('Appointments')).insert(row);
  }

  if (res.error) {
    Swal.fire('ຜິດພາດ!', res.error.message, 'error');
  } else {
    $('#apptModal').modal('hide');
    window.loadAppointments();
    window.checkAlerts();
    Swal.fire('ສຳເລັດ!', 'ບັນທຶກແລ້ວ', 'success');
  }
};

window.deleteAppt = async function (id) {
  let r = await Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ລຶບ' });
  if (r.isConfirmed) {
    await supabaseClient.from(dbTable('Appointments')).delete().eq('Appt_ID', id);
    window.loadAppointments();
  }
};

window.completeAppt = async function (id) {
  await supabaseClient.from(dbTable('Appointments')).update({ Status: 'Completed' }).eq('Appt_ID', id);
  window.loadAppointments();
  window.checkAlerts();
};

window.missedAppt = async function (id) {
  let r = await Swal.fire({ title: 'ຂາດນັດ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ຢືນຍັນ' });
  if (r.isConfirmed) {
    await supabaseClient.from(dbTable('Appointments')).update({ Status: 'Missed' }).eq('Appt_ID', id);
    window.loadAppointments();
    window.checkAlerts();
  }
};

window.cancelAppt = async function (id) {
  let r = await Swal.fire({ title: 'ຍົກເລີກ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ຍົກເລີກນັດ' });
  if (r.isConfirmed) {
    await supabaseClient.from(dbTable('Appointments')).update({ Status: 'Cancelled' }).eq('Appt_ID', id);
    window.loadAppointments();
    window.checkAlerts();
  }
};

window.generateIntervalInputs = function () {
  let d = parseInt($('#v_doses').val()) || 1;
  let v = ($('#v_interval_hidden').val() || "").split(',');
  let c = $('#intervalInputsContainer');
  c.empty();
  if (d <= 1) {
    c.hide();
    return;
  }
  c.css('display', 'flex').html('<p class="w-100 mb-2 text-info fw-bold small"><i class="fas fa-clock me-1"></i> ກຳນົດໄລຍະຫ່າງການສັກ (ມື້):</p>');
  for (let i = 1; i < d; i++) {
    c.append(`<div class="col-6 mb-2"><label class="form-label small text-muted mb-1">ເຂັມ ${i} -> ເຂັມ ${i + 1}</label><input type="number" class="form-control form-control-sm border-info interval-input" value="${v[i - 1] ? v[i - 1].trim() : '0'}" required min="0"></div>`);
  }
};

window.loadVaccineMaster = async function () {
  if ($.fn.DataTable.isDataTable('#vacMasterTable')) $('#vacMasterTable').DataTable().destroy();
  $('#vacMasterTable tbody').html('<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');

  try {
    const { data: r, error } = await supabaseClient.from(dbTable('Vaccines_Master')).select('*');
    if (error) { console.error('Error:', error); Swal.fire('Error', error.message, 'error'); return; }

    vaccinesMasterList = r || [];
    if ($.fn.DataTable.isDataTable('#vacMasterTable')) $('#vacMasterTable').DataTable().destroy();

    let o = '<option value="">-- ເລືອກວັກຊີນ --</option>';
    if (r) r.forEach(v => o += `<option value="${v.Vaccine_Name}">${v.Vaccine_Name}</option>`);
    $('#pv_vaccine').html(o);

    let h = '';
    if (r && r.length > 0) {
      r.forEach(v => {
        let intv = (!v.Interval_Days || v.Interval_Days === "0") ? '<span class="text-muted">-</span>' : `<span class="text-info small">${v.Interval_Days.toString().split(',').join(' ມື້, ')} ມື້</span>`;
        h += `<tr>
                        <td class="text-center"><input type="checkbox" class="form-check-input bulk-check-vacMaster" value="${v.Vac_ID}"></td>
                        <td class="fw-bold text-primary">${v.Vaccine_Name}</td>
                        <td>${v.Disease}</td>
                        <td><span class="badge bg-secondary rounded-pill px-3">${v.Total_Doses} ໂດສ</span></td>
                        <td>${intv}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-primary shadow-sm me-1" onclick="window.editVacMaster('${v.Vac_ID}','${v.Vaccine_Name}','${v.Disease}','${v.Total_Doses}','${v.Interval_Days}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger shadow-sm" onclick="window.delVacMaster('${v.Vac_ID}')"><i class="fas fa-trash"></i></button>
                        </td>
                      </tr>`;
      });
    }
    $('#vacMasterTable tbody').html(h);
    $('#vacMasterTable').DataTable({ responsive: true, pageLength: 10, language: { search: "ຄົ້ນຫາ:", emptyTable: "ບໍ່ມີຂໍ້ມູນ" } });
  } catch (err) {
    console.error('Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

window.loadPatientVaccines = async function () {
  if ($.fn.DataTable.isDataTable('#patientVacTable')) $('#patientVacTable').DataTable().destroy();
  $('#patientVacTable tbody').html('<tr><td colspan="9" class="text-center py-4"><div class="spinner-border text-success spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');

  try {
    const { data: r, error } = await supabaseClient.from(dbTable('Patient_Vaccines')).select('*').order('Date_Given', { ascending: false });
    if (error) { console.error('Error:', error); Swal.fire('Error', error.message, 'error'); return; }

    if ($.fn.DataTable.isDataTable('#patientVacTable')) $('#patientVacTable').DataTable().destroy();
    let h = '';
    let tStr = window.getLocalStr(new Date());
    if (r && r.length > 0) {
      r.forEach(x => {
        let nextDue = x.Next_Appointment_Date || x.Next_Due_Date || "-";
        let nd = nextDue !== "-" ? `<span class="text-info fw-bold"><i class="far fa-calendar-alt"></i> ${nextDue}</span>` : '<span class="text-muted">-</span>';
        let vm = vaccinesMasterList.find(v => v.Vaccine_Name === x.Vaccine_Name || v.name === x.Vaccine_Name);
        let td = vm ? parseInt(vm.Total_Doses || vm.doses) : 1;
        let cd = parseInt(x.Dose_Number) || 1;
        let sb = "";

        if (cd >= td) {
          sb = '<span class="badge bg-success">ສຳເລັດ (ຄົບໂດສ)</span>';
        } else {
          if (nextDue < tStr && nextDue !== "-") {
            sb = `<span class="badge bg-danger">ກາຍກຳນົດເຂັມ ${cd + 1}!</span>`;
          } else {
            sb = `<span class="badge bg-warning text-dark">ລໍຖ້າເຂັມ ${cd + 1}</span>`;
          }
        }

        h += `<tr>
                        <td>${x.Date_Given || ''}</td>
                        <td class="fw-bold">${x.Patient_Name || ''}</td>
                        <td class="text-success fw-bold">${x.Vaccine_Name || ''}</td>
                        <td><span class="text-primary fw-bold">${x.Lot_Number || '-'}</span></td>
                        <td><span class="badge bg-primary rounded-pill">ໂດສທີ ${cd}/${td}</span></td>
                        <td class="text-muted small">${x.Given_By || ''}</td>
                        <td>${nd}</td>
                        <td class="text-center">${sb}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-info text-white shadow-sm me-1" onclick="window.printVacCard('${x.Patient_ID}','${x.Patient_Name}','${x.Vaccine_Name}','${cd}/${td}','${x.Date_Given}','${nextDue}')"><i class="fas fa-print"></i></button>
                            <button class="btn btn-sm btn-outline-danger shadow-sm" onclick="window.delPatientVac('${x.Record_ID}')"><i class="fas fa-trash"></i></button>
                        </td>
                      </tr>`;
      });
    }
    $('#patientVacTable tbody').html(h);
    $('#patientVacTable').DataTable({
      responsive: true,
      pageLength: 10,
      order: [[0, "desc"], [1, "desc"]],
      language: {
        search: "ຄົ້ນຫາ:",
        lengthMenu: "ສະແດງ _MENU_",
        info: "ສະແດງ _START_ ຫາ _END_ ຈາກ _TOTAL_ ລາຍການ",
        paginate: { previous: "ກ່ອນໜ້າ", next: "ຕໍ່ໄປ" },
        emptyTable: "ບໍ່ມີຂໍ້ມູນ"
      }
    });
  } catch (err) {
    console.error('Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

window.openVacMasterModal = function () {
  $('#vacMasterForm')[0].reset();
  $('#v_id, #v_interval_hidden').val('');
  window.generateIntervalInputs();
  $('#vacMasterModal').modal('show');
};

window.editVacMaster = function (id, n, d, ds, i) {
  $('#v_id').val(id);
  $('#v_name').val(n);
  $('#v_disease').val(d);
  $('#v_doses').val(ds);
  $('#v_interval_hidden').val(i || '');
  window.generateIntervalInputs();
  $('#vacMasterModal').modal('show');
};

window.delVacMaster = async function (id) {
  let r = await Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ລຶບ' });
  if (r.isConfirmed) {
    const { error } = await supabaseClient.from(dbTable('Vaccines_Master')).delete().eq('Vac_ID', id);
    if (error) {
      Swal.fire('Error', error.message, 'error');
    } else {
      window.loadVaccineMaster();
      Swal.fire('ສຳເລັດ!', 'ລຶບວັກຊີນແລ້ວ', 'success');
    }
  }
};

window.submitVacMasterForm = async function (e) {
  if (e) e.preventDefault();
  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });
  let a = [];
  $('.interval-input').each(function () { a.push($(this).val()); });

  let isEdit = $('#v_id').val() !== '';
  let row = {
    Vaccine_Name: $('#v_name').val(), Disease_Target: $('#v_disease').val(),
    Total_Doses: parseInt($('#v_doses').val()) || 1, Dose_Interval: a.join(',')
  };

  if (isEdit) {
    const { error } = await supabaseClient.from(dbTable('Vaccines_Master')).update(row).eq('Vac_ID', $('#v_id').val());
    if (error) return Swal.fire('Error', error.message, 'error');
  } else {
    const { error } = await supabaseClient.from(dbTable('Vaccines_Master')).insert(row);
    if (error) return Swal.fire('Error', error.message, 'error');
  }

  $('#vacMasterModal').modal('hide');
  window.loadVaccineMaster();
  Swal.fire('ສຳເລັດ!', '', 'success');
};

window.calculateNextVacDate = function () {
  let vn = $('#pv_vaccine').val();
  let dg = $('#pv_date').val();
  let cd = parseInt($('#pv_dose').val()) || 1;
  if (!vn || !dg) return;

  let vm = vaccinesMasterList.find(x => x.name === vn);
  if (!vm) return;

  let md = parseInt(vm.doses) || 1;
  let iv = (vm.interval || "0").toString().split(',');

  if (cd >= md || iv.length === 0 || iv[0] === "0") {
    $('#pv_next_date').val('').prop('disabled', true);
    $('#pv_auto_appt').prop('checked', false).prop('disabled', true);
  } else {
    let ad = parseInt(iv[cd - 1]);
    if (isNaN(ad) || ad <= 0) {
      $('#pv_next_date').val('').prop('disabled', true);
    } else {
      $('#pv_next_date').prop('disabled', false);
      $('#pv_auto_appt').prop('disabled', false).prop('checked', true);
      let g = new Date(dg);
      g.setDate(g.getDate() + ad);
      $('#pv_next_date').val(window.getLocalStr(g));
    }
  }
};

window.printVacCard = function (id, n, vn, ds, dg, nd) {
  Swal.fire({ title: 'ກຳລັງສ້າງບັດ...', didOpen: () => Swal.showLoading() });
  $('#pVacHospName').text(systemSettings.hospitalName || "Clinic");
  $('#pVacCN').text(id);
  $('#pVacName').text(n);
  $('#pVacTitle').text(vn);
  $('#pVacDose').text(ds);
  $('#pVacGiven').text(dg);

  if (!nd || nd === "-") {
    $('#pVacNextDate').text("ສຳເລັດ (ຄົບໂດສ)").css('color', '#1B6BB0');
  } else {
    $('#pVacNextDate').text(nd).css('color', '#dc2626');
  }
  Swal.close();
  window.executePrint('vac-print-area');
};



window.submitPatientVacForm = async function (e) {
  if (e) e.preventDefault();
  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });

  let pid = $('#pv_patient_id').val();
  let pname = $('#pv_patient_name').val();
  let vac = $('#pv_vaccine').val();
  let ndate = $('#pv_next_date').val();
  let autoAppt = $('#pv_auto_appt').is(':checked');

  const { error } = await supabaseClient.from(dbTable('Patient_Vaccines')).insert({
    Patient_ID: pid, Patient_Name: pname, Vaccine_Name: vac,
    Dose_Number: parseInt($('#pv_dose').val()) || 1, Lot_Number: $('#pv_lot').val(),
    Date_Given: $('#pv_date').val(), Next_Appointment_Date: ndate,
    Given_By: $('#pv_doctor').val()
  });

  if (error) {
    Swal.fire('ຜິດພາດ!', error.message, 'error');
    return;
  }

  if (autoAppt && ndate) {
    await supabaseClient.from(dbTable('Appointments')).insert({
      Target_ID: pid, Target_Name: pname, Type: 'Vaccine',
      Appt_Date: ndate, Appt_Time: '09:00',
      Reason: 'ນັດໝາຍວັກຊີນ: ' + vac, Doctor_Name: 'System', Status: 'Waiting'
    });
  }

  $('#patientVacModal').modal('hide');
  window.loadPatientVaccines();
  window.checkAlerts();
  window.loadAppointments();
  Swal.fire('ສຳເລັດ!', '', 'success');
};

window.delPatientVac = async function (id) {
  let r = await Swal.fire({ title: 'ລຶບປະຫວັດ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ລຶບ' });
  if (r.isConfirmed) {
    await supabaseClient.from(dbTable('Patient_Vaccines')).delete().eq('Record_ID', id);
    window.loadPatientVaccines();
  }
};

window.loadDrugsMaster = async function () {
  if ($.fn.DataTable.isDataTable('#drugTable')) $('#drugTable').DataTable().destroy();
  $('#drugTable tbody').html('<tr><td colspan="4" class="text-center py-4"><div class="spinner-border text-success spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');

  try {
    const { data: r, error } = await supabaseClient.from(dbTable('Drugs_Master')).select('*');

    // 🚨 ດັກຈັບ Error ຕາມ Antigravity ສັ່ງ
    if (error) {
      console.error('Error:', error);
      Swal.fire('Error', error.message, 'error');
      return;
    }

    if ($.fn.DataTable.isDataTable('#drugTable')) $('#drugTable').DataTable().destroy();
    let h = '';
    if (r && r.length > 0) {
      r.forEach(x => {
        // ອີງຕາມ Column ໃນ CSV: Drug_ID, Drug_Name, Description
        h += `<tr>
                        <td class="text-center"><input type="checkbox" class="form-check-input bulk-check-drugs" value="${x.Drug_ID}"></td>
                        <td class="fw-bold text-success">${x.Drug_Name}</td>
                        <td>${x.Description}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-primary shadow-sm me-1" onclick="window.editDrugMaster('${x.Drug_ID}','${x.Drug_Name}','${x.Description}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger shadow-sm" onclick="window.delDrugMaster('${x.Drug_ID}')"><i class="fas fa-trash"></i></button>
                        </td>
                      </tr>`;
      });
    }
    $('#drugTable tbody').html(h);
    $('#drugTable').DataTable({ responsive: true, pageLength: 10, language: { search: "ຄົ້ນຫາ:", emptyTable: "ບໍ່ມີຂໍ້ມູນ" } });
  } catch (err) {
    console.error('System Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

window.openDrugMasterModal = function () {
  $('#drugMasterForm')[0].reset();
  $('#dr_id').val('');
  $('#drugMasterModal').modal('show');
};

window.editDrugMaster = function (id, n, d) {
  $('#dr_id').val(id);
  $('#dr_name').val(n);
  $('#dr_desc').val(d);
  $('#drugMasterModal').modal('show');
};

window.delDrugMaster = async function (id) {
  let r = await Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ລຶບ' });
  if (r.isConfirmed) {
    await supabaseClient.from(dbTable('Drugs_Master')).delete().eq('Drug_ID', id);
    window.loadDrugsMaster();
  }
};

window.submitDrugMasterForm = async function (e) {
  if (e) e.preventDefault();
  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });

  const isEdit = $('#dr_id').val() !== '';
  const row = { Drug_Name: $('#dr_name').val(), Description: $('#dr_desc').val() };

  try {
    if (isEdit) {
      const { error } = await supabaseClient.from(dbTable('Drugs_Master')).update(row).eq('Drug_ID', $('#dr_id').val());
      if (error) throw error;
    } else {
      row.Drug_ID = await window.generateNextMasterID('Drugs_Master', 'Drug_ID', 'DRUG', 3);
      const { error } = await supabaseClient.from(dbTable('Drugs_Master')).insert(row);
      if (error) throw error;
    }
    $('#drugMasterModal').modal('hide');
    window.loadDrugsMaster();
    window.preloadDropdownData();
    Swal.fire('ສຳເລັດ!', '', 'success');
  } catch (err) {
    Swal.fire('ຜິດພາດ', err.message || String(err), 'error');
  }
};

window.loadLabsMaster = async function () {
  if ($.fn.DataTable.isDataTable('#labTable')) $('#labTable').DataTable().destroy();
  $('#labTable tbody').html('<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');

  try {
    const { data: r, error } = await supabaseClient.from(dbTable('Labs_Master')).select('*');

    if (error) {
      console.error('Error:', error);
      Swal.fire('Error', error.message, 'error');
      return;
    }

    if ($.fn.DataTable.isDataTable('#labTable')) $('#labTable').DataTable().destroy();
    let h = '';
    const rows = window.applyLabCategoriesToList((r || []).map(x => ({ ...x, id: x.Lab_ID, category: '' })));
    if (rows.length > 0) {
      rows.forEach(x => {
        const safeName = encodeURIComponent(x.Lab_Name || '');
        const safeDesc = encodeURIComponent(x.Description || '');
        const safeCategory = encodeURIComponent(x.category || '');
        h += `<tr>
                        <td class="text-center"><input type="checkbox" class="form-check-input bulk-check-labs" value="${x.Lab_ID}"></td>
                        <td class="fw-bold text-primary">${x.Lab_Name}</td>
                        <td>${x.category || '<span class="text-muted">-</span>'}</td>
                        <td>${x.Description}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-primary shadow-sm me-1" onclick="window.editLabMaster('${x.Lab_ID}','${safeName}','${safeDesc}','${safeCategory}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger shadow-sm" onclick="window.delLabMaster('${x.Lab_ID}')"><i class="fas fa-trash"></i></button>
                        </td>
                      </tr>`;
      });
    }
    $('#labTable tbody').html(h);
    $('#labTable').DataTable({ responsive: true, pageLength: 10, language: { search: "ຄົ້ນຫາ:", emptyTable: "ບໍ່ມີຂໍ້ມູນ" } });
  } catch (err) {
    console.error('System Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

window.openLabMasterModal = function () {
  $('#labMasterForm')[0].reset();
  $('#lb_id').val('');
  $('#lb_category').val('');
  $('#labMasterModal').modal('show');
};

window.editLabMaster = function (id, n, d, category) {
  $('#lb_id').val(id);
  $('#lb_name').val(decodeURIComponent(n || ''));
  $('#lb_desc').val(decodeURIComponent(d || ''));
  $('#lb_category').val(decodeURIComponent(category || ''));
  $('#labMasterModal').modal('show');
};

window.delLabMaster = async function (id) {
  let r = await Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ລຶບ' });
  if (r.isConfirmed) {
    await supabaseClient.from(dbTable('Labs_Master')).delete().eq('Lab_ID', id);
    await window.deleteLabCategoryMappings(id);
    await window.loadMasterDataGlobal();
    window.loadLabsMaster();
    window.preloadDropdownData();
  }
};

window.submitLabMasterForm = async function (e) {
  if (e) e.preventDefault();
  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });

  let isEdit = $('#lb_id').val() !== '';
  let category = ($('#lb_category').val() || '').trim();
  let row = {
    Lab_Name: $('#lb_name').val(), Description: $('#lb_desc').val()
  };

  try {
    let labId = $('#lb_id').val();
    if (isEdit) {
      const { error } = await supabaseClient.from(dbTable('Labs_Master')).update(row).eq('Lab_ID', labId);
      if (error) throw error;
    } else {
      row.Lab_ID = await window.generateNextMasterID('Labs_Master', 'Lab_ID', 'LAB', 3);
      const { data, error } = await supabaseClient.from(dbTable('Labs_Master')).insert(row).select('Lab_ID').single();
      if (error) throw error;
      labId = data?.Lab_ID;
    }

    const mappingResult = await window.saveLabCategoryMapping(labId, category);
    if (mappingResult.error) throw mappingResult.error;

    await window.loadMasterDataGlobal();
    $('#labMasterModal').modal('hide');
    window.loadLabsMaster();
    window.preloadDropdownData();
    Swal.fire('ສຳເລັດ!', '', 'success');
  } catch (error) {
    Swal.fire('Error', error.message, 'error');
  }
};

window.loadUsers = async function () {
  if ($.fn.DataTable.isDataTable('#userTable')) $('#userTable').DataTable().destroy();
  $('#userTable tbody').html('<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-dark spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');

  try {
    const { data: u, error } = await supabaseClient.from(dbTable('Users')).select('*');

    // 🚨 ດັກຈັບ Error ຕາມ Antigravity
    if (error) {
      console.error('Error:', error);
      Swal.fire('Error', error.message, 'error');
      return;
    }

    if ($.fn.DataTable.isDataTable('#userTable')) $('#userTable').DataTable().destroy();
    let h = '';
    if (u && u.length > 0) {
      u.forEach(x => {
        let sb = x.Status === 'active' ? '<span class="badge bg-success rounded-pill px-3">ເປີດໃຊ້ງານ</span>' : '<span class="badge bg-danger rounded-pill px-3">ປິດໃຊ້ງານ</span>';
        h += `<tr>
                        <td class="text-center"><input type="checkbox" class="form-check-input bulk-check-users" value="${x.ID}"></td>
                        <td class="fw-bold">${x.Name}</td>
                        <td class="text-muted">${x.Email}</td>
                        <td><span class="badge ${x.Role === 'admin' ? 'bg-primary' : 'bg-secondary'} rounded-pill px-3 text-uppercase">${x.Role}</span></td>
                        <td>${sb}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-info text-white shadow-sm me-1" onclick="window.openButtonPermModal('${x.ID}','${x.Name}')" title="ກຳນົດສິດປຸ່ມ"><i class="fas fa-fingerprint"></i></button>
                            <button class="btn btn-sm btn-primary shadow-sm me-1" onclick="window.openEditUserModal('${x.ID}','${x.Name}','${x.Email}','${x.Role}','${x.Permissions || ''}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger shadow-sm rounded" onclick="window.deleteUserRow('${x.ID}')"><i class="fas fa-trash"></i></button>
                        </td>
                      </tr>`;
      });
    }
    $('#userTable tbody').html(h);
    $('#userTable').DataTable({ responsive: true, pageLength: 10, language: { search: "ຄົ້ນຫາ:", emptyTable: "ບໍ່ມີຂໍ້ມູນ" } });
  } catch (err) {
    console.error('Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

// Load users when users tab is shown
$(document).on('shown.bs.tab', '#users-tab', function () {
  window.loadUsers();
});

// Load activity log when log tab is shown
$(document).on('shown.bs.tab', '#log-tab', function () {
  if (!$('#logStartDate').val()) {
    const today = window.getLocalStr(new Date());
    $('#logStartDate').val(today);
    $('#logEndDate').val(today);
  }
  window.loadActivityLog();
});

window.openAddUserModal = function () {
  $('#addUserForm')[0].reset();
  $('#u_id').val('');
  $('#userModalTitle').html('<i class="fas fa-user-plus me-2"></i>ເພີ່ມຜູ້ໃຊ້ລະບົບ');
  $('#u_pass').prop('required', true);
  window.togglePermissionsBox();
  $('#addUserModal').modal('show');
};

window.openEditUserModal = function (id, n, e, r, p) {
  $('#u_id').val(id);
  $('#u_name').val(n);
  $('#u_email').val(e);
  $('#u_role').val(r);
  $('#u_pass').prop('required', false);
  $('#userModalTitle').html('<i class="fas fa-user-edit me-2"></i>ແກ້ໄຂຜູ້ໃຊ້ລະບົບ');
  
  // Reset all checkboxes first
  $('.permission-check').prop('checked', false);
  
  // Set permissions
  if (p && p !== 'all') {
    let pa = p.split(',');
    $('.permission-check').each(function () {
      $(this).prop('checked', pa.includes($(this).val()));
    });
  } else if (p === 'all') {
    $('.permission-check').prop('checked', true);
  }
  
  window.togglePermissionsBox();
  $('#addUserModal').modal('show');
};

window.togglePermissionsBox = function () {
  let role = $('#u_role').val();
  
  // Hide permissions for Admin (has all permissions)
  if (role === 'admin') {
    $('#permBox').hide();
    $('.permission-check').prop('checked', true);
    return;
  }
  
  $('#permBox').show();
  
  // Preset permissions by role
  const rolePermissions = {
    'doctor': 'dashboard,report,patients,triage,opd,opd_observation,labs,drugs,appointments,vaccines,activity_log',
    'nurse': 'dashboard,patients,triage,opd_observation,appointments,vaccines',
    'lab': 'dashboard,report,labs',
    'pharmacy': 'dashboard,report,drugs',
    'reception': 'dashboard,patients,appointments,orgs',
    'cashier': 'dashboard,report,patients',
    'staff': 'dashboard,patients',
    '': '' // No role selected
  };
  
  // Auto-select permissions based on role
  let perms = rolePermissions[role] || '';
  $('.permission-check').prop('checked', false);
  
  if (perms) {
    perms.split(',').forEach(perm => {
      $(`.permission-check[value="${perm}"]`).prop('checked', true);
    });
  }
};

window.selectAllPermissions = function () {
  $('.permission-check').prop('checked', true);
};

window.deselectAllPermissions = function () {
  $('.permission-check').prop('checked', false);
};

// ==========================================
// BUTTON PERMISSIONS HELPER FUNCTIONS
// ==========================================

// Check if user has permission for a specific button
window.can = function (module, action) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin' || currentUser.permissions === 'all') return true;
  
  const buttonPerms = currentUser.buttonPermissions;
  if (!buttonPerms || !buttonPerms[module]) return false;
  
  return buttonPerms[module][action] === true;
};

// Hide/show buttons based on permissions
window.applyButtonPermissions = function () {
  if (!currentUser || currentUser.role === 'admin' || currentUser.permissions === 'all') return;
  
  const buttonPerms = currentUser.buttonPermissions;
  if (!buttonPerms) return;
  
  // Patients buttons
  if (!window.can('patients', 'view')) $('.btn-patient-view, .btn-view-patient').hide();
  if (!window.can('patients', 'add')) $('.btn-add-patient, #btnAddPatient').hide();
  if (!window.can('patients', 'edit')) $('.btn-patient-edit, .btn-edit-patient').hide();
  if (!window.can('patients', 'delete')) $('.btn-patient-delete, .btn-delete-patient').hide();
  if (!window.can('patients', 'triage')) $('.btn-triage, .btn-send-triage').hide();
  if (!window.can('patients', 'print_qr')) $('.btn-print-qr, .btn-qr-card').hide();
  
  // Triage buttons
  if (!window.can('triage', 'view')) $('.btn-triage-view').hide();
  if (!window.can('triage', 'edit')) $('.btn-triage-edit, .btn-vital-signs').hide();
  if (!window.can('triage', 'delete')) $('.btn-triage-delete').hide();
  if (!window.can('triage', 'call')) $('.btn-call-triage, .btn-volume-up').hide();
  
  // OPD buttons
  if (!window.can('opd', 'view')) $('.btn-opd-view, .btn-view-emr').hide();
  if (!window.can('opd', 'edit')) $('.btn-opd-edit, .btn-open-emr').hide();
  if (!window.can('opd', 'delete')) $('.btn-opd-delete').hide();
  if (!window.can('opd', 'print')) $('.btn-opd-print, .btn-print-opd').hide();

  // OPD Follow-up / Observation buttons
  if (!window.can('opd_observation', 'view')) $('.btn-obs-view').hide();
  if (!window.can('opd_observation', 'add')) $('.btn-obs-add').hide();
  if (!window.can('opd_observation', 'note')) $('.btn-obs-note').hide();
  if (!window.can('opd_observation', 'convert')) $('.btn-obs-convert').hide();
  if (!window.can('opd_observation', 'discharge')) $('.btn-obs-discharge').hide();
  
  // Labs buttons
  if (!window.can('labs', 'view')) $('.btn-labs-view').hide();
  if (!window.can('labs', 'add')) $('.btn-labs-add').hide();
  if (!window.can('labs', 'edit')) $('.btn-labs-edit').hide();
  if (!window.can('labs', 'delete')) $('.btn-labs-delete').hide();
  
  // Drugs buttons
  if (!window.can('drugs', 'view')) $('.btn-drugs-view').hide();
  if (!window.can('drugs', 'add')) $('.btn-drugs-add').hide();
  if (!window.can('drugs', 'edit')) $('.btn-drugs-edit').hide();
  if (!window.can('drugs', 'delete')) $('.btn-drugs-delete').hide();
  
  // Appointments buttons
  if (!window.can('appointments', 'view')) $('.btn-appt-view').hide();
  if (!window.can('appointments', 'add')) $('.btn-add-appt').hide();
  if (!window.can('appointments', 'edit')) $('.btn-appt-edit').hide();
  if (!window.can('appointments', 'delete')) $('.btn-appt-delete, .btn-delete-appt').hide();

  // IPD buttons (ward/bed board + chart)
  if (!window.can('ipd', 'admit')) $('.btn-ipd-admit').hide();
  if (!window.can('ipd', 'transfer')) $('.btn-ipd-transfer').hide();
  if (!window.can('ipd', 'discharge')) $('.btn-ipd-discharge').hide();
  if (!window.can('ipd', 'chart_edit')) $('.btn-ipd-chart-edit').hide();

  // IPD Config buttons (Settings → Ward/Room/Bed CRUD)
  if (!window.can('ipd_config', 'add')) $('.btn-ipd-config-add').hide();
  if (!window.can('ipd_config', 'edit')) $('.btn-ipd-config-edit').hide();
  if (!window.can('ipd_config', 'delete')) $('.btn-ipd-config-delete').hide();
};

// ==========================================
// BUTTON PERMISSIONS MANAGEMENT
// ==========================================

window.openButtonPermModal = async function (userId, userName) {
  $('#permUserId').val(userId);
  $('#permUserName').text(userName);
  
  // Reset all checkboxes
  $('.btn-perm-check').prop('checked', false);
  
  try {
    // Fetch user's button permissions
    const { data, error } = await supabaseClient
      .from(dbTable('Users'))
      .select('ButtonPermissions')
      .eq('ID', userId)
      .single();
    
    if (error) {
      console.error('Error fetching permissions:', error);
      Swal.fire('Error', 'ບໍ່ສາມາດໂຫຼດສິດໄດ້: ' + error.message, 'error');
      return;
    }
    
    // Set checkboxes based on permissions
    if (data && data.ButtonPermissions) {
      const perms = data.ButtonPermissions;
      
      // Iterate through all modules and their buttons
      Object.keys(perms).forEach(module => {
        const buttons = perms[module];
        Object.keys(buttons).forEach(button => {
          if (buttons[button] === true) {
            $(`.btn-perm-check[value="${module}.${button}"]`).prop('checked', true);
          }
        });
      });
    }
    
    $('#buttonPermModal').modal('show');
    
  } catch (err) {
    console.error('Error:', err);
    Swal.fire('Error', 'ເກີດຂໍ້ຜິດພາດ: ' + err.message, 'error');
  }
};

window.selectAllButtonPermissions = function () {
  $('.btn-perm-check').prop('checked', true);
};

window.deselectAllButtonPermissions = function () {
  $('.btn-perm-check').prop('checked', false);
};

window.resetToRoleDefaults = function () {
  const role = $('#u_role').val() || 'staff';
  
  const roleDefaults = {
    'admin': {
      patients: { view: true, add: true, edit: true, delete: true, triage: true, print_qr: true },
      triage: { view: true, edit: true, delete: true, call: true },
      opd: { view: true, edit: true, delete: true, print: true },
      opd_observation: { view: true, add: true, note: true, convert: true, discharge: true },
      labs: { view: true, add: true, edit: true, delete: true },
      drugs: { view: true, add: true, edit: true, delete: true },
      appointments: { view: true, add: true, edit: true, delete: true },
      ipd: { view: true, admit: true, transfer: true, discharge: true, chart_edit: true },
      ipd_config: { view: true, add: true, edit: true, delete: true }
    },
    'doctor': {
      patients: { view: true, add: true, edit: true, delete: false, triage: true, print_qr: true },
      triage: { view: true, edit: true, delete: false, call: true },
      opd: { view: true, edit: true, delete: false, print: true },
      opd_observation: { view: true, add: true, note: true, convert: true, discharge: true },
      labs: { view: true, add: true, edit: true, delete: false },
      drugs: { view: true, add: true, edit: true, delete: false },
      appointments: { view: true, add: true, edit: true, delete: false },
      ipd: { view: true, admit: true, transfer: true, discharge: true, chart_edit: true },
      ipd_config: { view: false, add: false, edit: false, delete: false }
    },
    'nurse': {
      patients: { view: true, add: false, edit: false, delete: false, triage: true, print_qr: false },
      triage: { view: true, edit: true, delete: false, call: true },
      opd: { view: false, edit: false, delete: false, print: false },
      opd_observation: { view: true, add: true, note: true, convert: false, discharge: false },
      labs: { view: false, add: false, edit: false, delete: false },
      drugs: { view: false, add: false, edit: false, delete: false },
      appointments: { view: true, add: true, edit: false, delete: false },
      ipd: { view: true, admit: true, transfer: true, discharge: false, chart_edit: true },
      ipd_config: { view: false, add: false, edit: false, delete: false }
    },
    'lab': {
      patients: { view: true, add: false, edit: false, delete: false, triage: false, print_qr: false },
      triage: { view: false, edit: false, delete: false, call: false },
      opd: { view: false, edit: false, delete: false, print: false },
      opd_observation: { view: false, add: false, note: false, convert: false, discharge: false },
      labs: { view: true, add: true, edit: true, delete: false },
      drugs: { view: false, add: false, edit: false, delete: false },
      appointments: { view: false, add: false, edit: false, delete: false },
      ipd: { view: false, admit: false, transfer: false, discharge: false, chart_edit: false },
      ipd_config: { view: false, add: false, edit: false, delete: false }
    },
    'pharmacy': {
      patients: { view: true, add: false, edit: false, delete: false, triage: false, print_qr: false },
      triage: { view: false, edit: false, delete: false, call: false },
      opd: { view: false, edit: false, delete: false, print: false },
      opd_observation: { view: false, add: false, note: false, convert: false, discharge: false },
      labs: { view: false, add: false, edit: false, delete: false },
      drugs: { view: true, add: true, edit: true, delete: false },
      appointments: { view: false, add: false, edit: false, delete: false },
      ipd: { view: false, admit: false, transfer: false, discharge: false, chart_edit: false },
      ipd_config: { view: false, add: false, edit: false, delete: false }
    },
    'reception': {
      patients: { view: true, add: true, edit: false, delete: false, triage: false, print_qr: true },
      triage: { view: false, edit: false, delete: false, call: false },
      opd: { view: false, edit: false, delete: false, print: false },
      opd_observation: { view: false, add: false, note: false, convert: false, discharge: false },
      labs: { view: false, add: false, edit: false, delete: false },
      drugs: { view: false, add: false, edit: false, delete: false },
      appointments: { view: true, add: true, edit: false, delete: false },
      ipd: { view: true, admit: true, transfer: false, discharge: false, chart_edit: false },
      ipd_config: { view: false, add: false, edit: false, delete: false }
    },
    'cashier': {
      patients: { view: true, add: false, edit: false, delete: false, triage: false, print_qr: false },
      triage: { view: false, edit: false, delete: false, call: false },
      opd: { view: false, edit: false, delete: false, print: false },
      opd_observation: { view: false, add: false, note: false, convert: false, discharge: false },
      labs: { view: false, add: false, edit: false, delete: false },
      drugs: { view: false, add: false, edit: false, delete: false },
      appointments: { view: true, add: false, edit: false, delete: false },
      ipd: { view: true, admit: false, transfer: false, discharge: false, chart_edit: false },
      ipd_config: { view: false, add: false, edit: false, delete: false }
    },
    'staff': {
      patients: { view: true, add: false, edit: false, delete: false, triage: false, print_qr: false },
      triage: { view: false, edit: false, delete: false, call: false },
      opd: { view: false, edit: false, delete: false, print: false },
      opd_observation: { view: false, add: false, note: false, convert: false, discharge: false },
      labs: { view: false, add: false, edit: false, delete: false },
      drugs: { view: false, add: false, edit: false, delete: false },
      appointments: { view: true, add: false, edit: false, delete: false },
      ipd: { view: false, admit: false, transfer: false, discharge: false, chart_edit: false },
      ipd_config: { view: false, add: false, edit: false, delete: false }
    }
  };
  
  const defaults = roleDefaults[role] || {};
  
  // Reset all checkboxes
  $('.btn-perm-check').prop('checked', false);
  
  // Set default permissions
  Object.keys(defaults).forEach(module => {
    const buttons = defaults[module];
    Object.keys(buttons).forEach(button => {
      if (buttons[button] === true) {
        $(`.btn-perm-check[value="${module}.${button}"]`).prop('checked', true);
      }
    });
  });
};

window.saveButtonPermissions = async function () {
  const userId = $('#permUserId').val();
  const userName = $('#permUserName').text();
  
  // Build permissions object
  const permissions = {
    patients: {
      view: $('#perm_patients_view').is(':checked'),
      add: $('#perm_patients_add').is(':checked'),
      edit: $('#perm_patients_edit').is(':checked'),
      delete: $('#perm_patients_delete').is(':checked'),
      triage: $('#perm_patients_triage').is(':checked'),
      print_qr: $('#perm_patients_print_qr').is(':checked')
    },
    triage: {
      view: $('#perm_triage_view').is(':checked'),
      edit: $('#perm_triage_edit').is(':checked'),
      delete: $('#perm_triage_delete').is(':checked'),
      call: $('#perm_triage_call').is(':checked')
    },
    opd: {
      view: $('#perm_opd_view').is(':checked'),
      edit: $('#perm_opd_edit').is(':checked'),
      delete: $('#perm_opd_delete').is(':checked'),
      print: $('#perm_opd_print').is(':checked')
    },
    opd_observation: {
      view: $('#perm_opd_observation_view').is(':checked'),
      add: $('#perm_opd_observation_add').is(':checked'),
      note: $('#perm_opd_observation_note').is(':checked'),
      convert: $('#perm_opd_observation_convert').is(':checked'),
      discharge: $('#perm_opd_observation_discharge').is(':checked')
    },
    labs: {
      view: $('#perm_labs_view').is(':checked'),
      add: $('#perm_labs_add').is(':checked'),
      edit: $('#perm_labs_edit').is(':checked'),
      delete: $('#perm_labs_delete').is(':checked')
    },
    drugs: {
      view: $('#perm_drugs_view').is(':checked'),
      add: $('#perm_drugs_add').is(':checked'),
      edit: $('#perm_drugs_edit').is(':checked'),
      delete: $('#perm_drugs_delete').is(':checked')
    },
    appointments: {
      view: $('#perm_appointments_view').is(':checked'),
      add: $('#perm_appointments_add').is(':checked'),
      edit: $('#perm_appointments_edit').is(':checked'),
      delete: $('#perm_appointments_delete').is(':checked')
    },
    ipd: {
      view: $('#perm_ipd_view').is(':checked'),
      admit: $('#perm_ipd_admit').is(':checked'),
      transfer: $('#perm_ipd_transfer').is(':checked'),
      discharge: $('#perm_ipd_discharge').is(':checked'),
      chart_edit: $('#perm_ipd_chart_edit').is(':checked')
    },
    ipd_config: {
      view: $('#perm_ipd_config_view').is(':checked'),
      add: $('#perm_ipd_config_add').is(':checked'),
      edit: $('#perm_ipd_config_edit').is(':checked'),
      delete: $('#perm_ipd_config_delete').is(':checked')
    }
  };
  
  try {
    const { error } = await supabaseClient
      .from(dbTable('Users'))
      .update({ ButtonPermissions: permissions })
      .eq('ID', userId);
    
    if (error) {
      Swal.fire('Error', 'ບໍ່ສາມາດບັນທຶກສິດໄດ້: ' + error.message, 'error');
      return;
    }
    
    $('#buttonPermModal').modal('hide');
    window.logAction('Edit', `ແກ້ໄຂສິດປຸ່ມ: ${userName}`, 'Users');
    Swal.fire('ສຳເລັດ!', 'ບັນທຶກສິດປຸ່ມແລ້ວ', 'success');
    
  } catch (err) {
    console.error('Error:', err);
    Swal.fire('Error', 'ເກີດຂໍ້ຜິດພາດ: ' + err.message, 'error');
  }
};

window.deleteUserRow = async function (id) {
  let r = await Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ລຶບ' });
  if (r.isConfirmed) {
    const { error } = await supabaseClient.from(dbTable('Users')).delete().eq('ID', id);
    if (error) {
      Swal.fire('Error', error.message, 'error');
    } else {
      window.loadUsers();
      window.logAction('Delete', 'Delete User ID: ' + id, 'Users');
      Swal.fire('ສຳເລັດ!', 'ລຶບຜູ້ໃຊ້ແລ້ວ', 'success');
    }
  }
};

window.submitUserForm = async function (e) {
  if (e) e.preventDefault();
  let p = [];
  $('.permission-check:checked').each(function () { p.push($(this).val()); });

  let isEdit = $('#u_id').val() !== '';
  let email = $('#u_email').val();
  let password = $('#u_pass').val();
  let role = $('#u_role').val();
  let perms = role === 'admin' ? 'all' : p.join(',');

  let row = {
    Name: $('#u_name').val(), Email: email, Role: role, Permissions: perms, Status: 'active'
  };
  if (password) {
    const passwordHash = await window.hashPassword(password);
    row.Password_Hash = passwordHash;
  }

  if (isEdit) {
    let { error } = await supabaseClient.from(dbTable('Users')).update(row).eq('ID', $('#u_id').val());
    if (error) { Swal.fire('Error', error.message, 'error'); return; }

    $('#addUserModal').modal('hide');
    window.logAction('Edit', 'Edit User: ' + $('#u_name').val() + ' (' + role + ')', 'Users');
    window.loadUsers();
    Swal.fire('ສຳເລັດ', 'ບັນທຶກແລ້ວ', 'success');
  } else {
    let { error } = await supabaseClient.from(dbTable('Users')).insert(row);
    if (error) { Swal.fire('Error', error.message, 'error'); return; }

    $('#addUserModal').modal('hide');
    window.logAction('Add', 'Add User: ' + $('#u_name').val() + ' (' + role + ')', 'Users');
    window.loadUsers();

    Swal.fire({
      title: 'ສຳເລັດ (ຂັ້ນຕອນທີ 1)',
      html: `ສ້າງຂໍ້ມູນຜູ້ໃຊ້ໃນລະບົບແລ້ວ.<br><br><b class="text-danger">ສຳຄັນ:</b> ທ່ານຕ້ອງໄປທີ່ໜ້າຈໍ <b>Supabase Dashboard > Authentication > Add User</b> ເພື່ອສ້າງລະຫັດຜ່ານສຳລັບອີເມວ <b>${email}</b> ນີ້ ກ່ອນທີ່ພະນັກງານຈະເຂົ້າສູ່ລະບົບໄດ້.`,
      icon: 'info'
    });
  }
};

window.fetchOrg = async function () {
  let c = $('#p_org_id').val();
  if (!c) {
    $('#p_org_name, #p_discount_show').val('');
    return;
  }
  const { data, error } = await supabaseClient.from(dbTable('Organizations')).select('*').eq('Org_Code', c).limit(1);
  if (data && data.length > 0) {
    $('#p_org_name').val(data[0].Org_Name);
    $('#p_discount_show').val(data[0].Discount || "ບໍ່ມີສ່ວນຫຼຸດ");
  } else {
    $('#p_org_name').val('❌ ບໍ່ພົບ');
    $('#p_discount_show').val('');
  }
};

window._masterDataFallback = {
  Title: ["ທ່ານ","ນາງ","ນາງສາວ","ດຣ.","ທ່ານ ດຣ.","ນາງ ດຣ.","ພ.ທ.","ຜ.ສ."],
  Gender: ["ຊາຍ","ຍິງ","ອື່ນໆ"],
  BloodType: ["A+","A-","B+","B-","AB+","AB-","O+","O-"],
  Nationality: ["ລາວ","ໄທ","ຈີນ","ຫວຽດນາມ","ກຳປູເຈຍ","ມຽນມາ","ສິງກະໂປ","ມາເລເຊຍ","ຍີ່ປຸ່ນ","ເກົາຫຼີ","ອັງກິດ","ອາເມລິກາ","ຝຣັ່ງ","ອື່ນໆ"],
  Occupation: ["ພະນັກງານລັດ","ພະນັກງານເອກະຊົນ","ທຸລະກິດສ່ວນຕົວ","ຊາວນາ","ນັກສຶກສາ","ຄ້າຂາຍ","ທ່ອງທ່ຽວ","ຫວ່າງງານ","ອື່ນໆ"],
  Shift: ["ເຊົ້າ (08:00-16:00)","ແລງ (16:00-24:00)","ດຶກ (00:00-08:00)"],
  Channel: ["ໂທລະສັບ","ສອດ","Facebook","Line","ຍາດພີ່ນ້ອງແນະນຳ","ຜ່ານ ຮພ. ອື່ນ","ສື່ໂຄສະນາ","ອື່ນໆ"],
  InsCompany: ["ບໍ່ມີ","LSMI","PVI","Axa","Prudential","Allianz","BCEL-AXA","ອື່ນໆ"],
  Department: ["OPD ທົ່ວໄປ","ຫ້ອງສຸກເສີນ","ຫ້ອງຜ່າຕັດ","ຫ້ອງເດັກ","ກວດສະເພາະທາງ","ທັນຕະກຳ","ຕາ ຫູ ຄໍ ຈະມູກ"],
  LabCategory: window.emrLabCategoryConfig.map(item => item.label),
  DrugUnit: ["ເມັດ (Tab)","ແຄັບຊູນ (Cap)","ມິນລິລິດ (ml)","ກຣາມ (g)","ຫຼອດ (Amp)","ຕຸກ (Bottle)","ຊອງ (Sachet)","Dose","ບ່ວງ (Spoon)"],
  DrugUsage: ["ac (ກ່ອນອາຫານ 30 ນາທີ)","pc (ຫຼັງອາຫານ 15-30 ນາທີ)","am (ຕອນເຊົ້າ)","pm (ຕອນແລງ)","hs (ກ່ອນນອນ)","bid (ວັນລະ 2 ຄັ້ງ)","tid (ວັນລະ 3 ຄັ້ງ)","qid (ວັນລະ 4 ຄັ້ງ)","prn (ກິນເວລາເຈັບ)","od (ວັນລະ 1 ຄັ້ງ)","stat (ກິນທັນທີ)"],
};

window.loadMasterDataGlobalCallback = function (data) {
  masterDataStore = data || {};
  let missingCategories = [];
  ['Department', 'Shift', 'Title', 'Gender', 'Nationality', 'Occupation', 'BloodType', 'InsCompany', 'Channel', 'Doctor', 'Site', 'PatientType_InSite', 'PatientType_Onsite', 'DrugUnit', 'DrugUsage', 'LabCategory'].forEach(c => {
    let o = '<option value="">-- ເລືອກ --</option>';
    const sourceData = masterDataStore[c] || (window._masterDataFallback[c] ? window._masterDataFallback[c].map(v => ({ value: v })) : null);
    if (!masterDataStore[c] && window._masterDataFallback[c]) missingCategories.push(c);
    if (sourceData) {
      sourceData.forEach(i => o += `<option value="${i.value}">${i.value}</option>`);
    }
    $('.dyn-' + c).html(o);
  });
  if (missingCategories.length > 0) {
    console.warn('MasterData: ໃຊ້ຂໍ້ມູນ fallback ສຳລັບ:', missingCategories.join(', '));
    console.warn('ກວດສອບ RLS Policy ຂອງ table MasterData ໃນ Supabase Dashboard');
  }
  if (document.getElementById('masterCategory')) window.loadMasterList();
};

window.seedMasterDefaults = async function () {
  const defaults = {
    DrugUsage: [
      "ac (ກ່ອນອາຫານ 30 ນາທີ)", "pc (ຫຼັງອາຫານ 15-30 ນາທີ)", "am (ຕອນເຊົ້າ)", "pm (ຕອນແລງ)", "hs (ກ່ອນນອນ)",
      "bid (ວັນລະ 2 ຄັ້ງ ເຊົ້າ-ແລງ)", "tid (ວັນລະ 3 ຄັ້ງ ເຊົ້າ-ສວຍ-ແລງ)", "qid (ວັນລະ 4 ຄັ້ງ ເຊົ້າ-ສວຍ-ແລງ-ກ່ອນນອນ)",
      "q4h (ທຸກໆ 4 ຊົ່ວໂມງ)", "prn (ກິນເວລາເຈັບ/ເປັນໄຂ້)", "po (ຢາກິນ)", "iv (ສີດເຂົ້າເສັ້ນເລືອດ)",
      "im (ສີດເຂົ້າກ້າມ)", "od (ວັນລະ 1 ຄັ້ງ)", "stat (ກິນທັນທີ)"
    ],
    DrugUnit: ["ເມັດ (Tab)", "ແຄັບຊູນ (Cap)", "ມິນລິລິດ (ml)", "ກຣາມ (g)", "ຫຼອດ (Amp)", "ຕຸກ (Bottle)", "ຊອງ (Sachet)", "Dose", "ບ່ວງ (Spoon)"],
    Title: ["ທ່ານ", "ນາງ", "ນາງສາວ", "ດຣ.", "ທ່ານ ດຣ.", "ນາງ ດຣ.", "ພ.ທ.", "ຜ.ສ."],
    Gender: ["ຊາຍ", "ຍິງ", "ອື່ນໆ"],
    BloodType: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    Nationality: ["ລາວ", "ໄທ", "ຈີນ", "ຫວຽດນາມ", "ກຳປູເຈຍ", "ມຽນມາ", "ສິງກະໂປ", "ມາເລເຊຍ", "ຍີ່ປຸ່ນ", "ເກົາຫຼີ", "ອັງກິດ", "ອາເມລິກາ", "ຝຣັ່ງ", "ອື່ນໆ"],
    Occupation: ["ພະນັກງານລັດ", "ພະນັກງານເອກະຊົນ", "ທຸລະກິດສ່ວນຕົວ", "ຊາວນາ", "ນັກສຶກສາ", "ຄ້າຂາຍ", "ທ່ອງທ່ຽວ", "ຫວ່າງງານ", "ອື່ນໆ"],
    Shift: ["ເຊົ້າ (08:00-16:00)", "ແລງ (16:00-24:00)", "ດຶກ (00:00-08:00)"],
    Channel: ["ໂທລະສັບ", "ສອດ", "Facebook", "Line", "ຍາດພີ່ນ້ອງແນະນຳ", "ຜ່ານ ຮພ. ອື່ນ", "ສື່ໂຄສະນາ", "ອື່ນໆ"],
    InsCompany: ["ບໍ່ມີ", "LSMI", "PVI", "Axa", "Prudential", "Allianz", "BCEL-AXA", "ອື່ນໆ"],
    Department: ["OPD ທົ່ວໄປ", "ຫ້ອງສຸກເສີນ", "ຫ້ອງຜ່າຕັດ", "ຫ້ອງເດັກ", "ກວດສະເພາະທາງ", "ທັນຕະກຳ", "ຕາ ຫູ ຄໍ ຈະມູກ"],
  };

  try {
    if (localStorage.getItem('his_master_seeded_v1') === '1') return;

    const entries = Object.entries(defaults);
    const existsResults = await Promise.all(
      entries.map(([category]) =>
        supabaseClient.from(dbTable('MasterData')).select('ID', { head: true, count: 'exact' }).eq('Category', category)
      )
    );

    const missing = entries.filter((_, i) => (existsResults[i].count || 0) === 0);
    if (missing.length === 0) {
      localStorage.setItem('his_master_seeded_v1', '1');
      return;
    }

    const allRows = missing.flatMap(([category, values]) => values.map(v => ({ Category: category, Value: v })));
    console.log(`Seeding ${missing.length} categories (${allRows.length} rows)...`);
    await supabaseClient.from(dbTable('MasterData')).insert(allRows);
    localStorage.setItem('his_master_seeded_v1', '1');
  } catch (err) {
    console.error("Seeding error:", err);
  }
};

window.resetMasterDefaults = async function () {
  const c = $('#masterCategory').val();
  const seededCategories = ['DrugUsage', 'DrugUnit', 'Title', 'Gender', 'BloodType', 'Nationality', 'Occupation', 'Shift', 'Channel', 'InsCompany', 'Department'];
  if (!seededCategories.includes(c)) {
    return Swal.fire('ແຈ້ງເຕືອນ', 'ຟັງຊັນນີ້ໃຊ້ໄດ້ສະເພາະກັບ category ທີ່ມີຂໍ້ມູນມາດຕະຖານ', 'info');
  }

  const r = await Swal.fire({
    title: 'ຢືນຢັນການ Reset?',
    text: "ລະບົບຈະເພີ່ມຂໍ້ມູນມາດຕະຖານເຂົ້າໄປໃໝ່ (ຂໍ້ມູນເດີມທີ່ທ່ານເພີ່ມເອງຈະຍັງຢູ່)",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ຕົກລົງ',
    cancelButtonText: 'ຍົກເລີກ'
  });

  if (r.isConfirmed) {
    Swal.fire({ title: 'ກຳລັງ Reset...', didOpen: () => Swal.showLoading() });
    await window.seedMasterDefaults();
    await window.loadMasterDataGlobal();
    Swal.fire('ສຳເລັດ!', 'ເພີ່ມຂໍ້ມູນມາດຕະຖານໃຫ້ແລ້ວ', 'success');
  }
};

window.loadMasterDataGlobal = async function () {
  try {
    const { data, error } = await supabaseClient.from(dbTable('MasterData')).select('*');
    if (error) {
      console.error('Error:', error);
      Swal.fire('Error', error.message, 'error');
      return;
    }

    let formattedMasterData = {};
    if (data) {
      data.forEach(item => {
        if (!formattedMasterData[item.Category]) formattedMasterData[item.Category] = [];
        formattedMasterData[item.Category].push({ id: item.ID, value: item.Value });
      });
    }
    window.loadMasterDataGlobalCallback(formattedMasterData);
  } catch (err) {
    console.error('Error:', err);
  }
};

window.masterCategoryGroups = [
  {
    key: 'clinical',
    label: 'ຫ້ອງກວດ',
    icon: 'fa-stethoscope',
    summary: 'ໝວດຂໍ້ມູນສຳລັບການກວດ ແລະ ແພດ',
    categories: [
      { key: 'Department', label: 'ຫ້ອງກວດ', description: 'ຈັດການຊື່ພະແນກ ແລະ ຫ້ອງກວດ' },
      { key: 'Doctor', label: 'ລາຍຊື່ແພດ', description: 'ເພີ່ມແລະຈັດການຊື່ແພດໃນລະບົບ' },
      { key: 'Nurse', label: 'ລາຍຊື່ພະຍາບານ', description: 'ເພີ່ມແລະຈັດການຊື່ພະຍາບານໃນລະບົບ' },
      { key: 'LabCategory', label: 'ໝວດ Lab', description: 'ຈັດການລາຍຊື່ໝວດການກວດທີ່ໃຊ້ໃນ checkbox picker' }
    ]
  },
  {
    key: 'patient',
    label: 'ຄົນເຈັບ',
    icon: 'fa-user-injured',
    summary: 'ຂໍ້ມູນພື້ນຖານໃນ registration ແລະ profile ຄົນເຈັບ',
    categories: [
      { key: 'Title', label: 'ຄຳນຳໜ້າ', description: 'ຄຳນຳໜ້າຊື່ໃນ profile ຄົນເຈັບ' },
      { key: 'Gender', label: 'ເພດ', description: 'ຕົວເລືອກເພດສຳລັບ registration' },
      { key: 'Nationality', label: 'ສັນຊາດ', description: 'ລາຍການສັນຊາດທີ່ໃຊ້ໃນລະບົບ' },
      { key: 'Occupation', label: 'ອາຊີບ', description: 'ຂໍ້ມູນອາຊີບສຳລັບຄົນເຈັບ' },
      { key: 'BloodType', label: 'ໝວດເລືອດ', description: 'ມາດຕະຖານໝວດເລືອດໃນທາງການແພດ' }
    ]
  },
  {
    key: 'billing',
    label: 'ອົງກອນ/ການຕະຫຼາດ',
    icon: 'fa-building',
    summary: 'ຂໍ້ມູນອົງກອນ, ປະກັນໄພ ແລະ ຊ່ອງທາງມາຮອດ',
    categories: [
      { key: 'InsCompany', label: 'ບໍລິສັດປະກັນໄພ', description: 'ລາຍຊື່ບໍລິສັດປະກັນ/ອົງກອນຄູ່ສັນຍາ' },
      { key: 'Channel', label: 'ຊ່ອງທາງຮູ້ຈັກ', description: 'ຊ່ອງທາງທີ່ຄົນເຈັບຮູ້ຈັກໂຮງໝໍ' }
    ]
  },
  {
    key: 'location',
    label: 'ສະຖານທີ່',
    icon: 'fa-location-dot',
    summary: 'ຂໍ້ມູນ site ແລະ ປະເພດຄົນເຈັບຕາມສະຖານທີ່',
    categories: [
      { key: 'Site', label: 'ສະຖານທີ່', description: 'ສາຂາ ຫຼື site ທີ່ໃຊ້ໃນລະບົບ' },
      { key: 'PatientType_InSite', label: 'ປະເພດຄົນເຈັບ (In-site)', description: 'ປະເພດຄົນເຈັບພາຍໃນ site' },
      { key: 'PatientType_Onsite', label: 'ປະເພດຄົນເຈັບ (On-site)', description: 'ປະເພດຄົນເຈັບນອກ site' }
    ]
  },
  {
    key: 'pharmacy',
    label: 'ຢາ',
    icon: 'fa-pills',
    summary: 'ມາດຕະຖານຫົວໜ່ວຍຢາ ແລະ ວິທີໃຊ້',
    categories: [
      { key: 'DrugUnit', label: 'ຫົວໜ່ວຍຢາ', description: 'ໜ່ວຍນັບຢາທີ່ໃຊ້ໃນ prescription' },
      { key: 'DrugUsage', label: 'ວິທີກິນ/ໃຊ້', description: 'ຄຳສັ່ງການໃຊ້ຢາມາດຕະຖານ' }
    ]
  },
  {
    key: 'operations',
    label: 'ການປະຕິບັດງານ',
    icon: 'fa-clock',
    summary: 'ຂໍ້ມູນ shift ແລະ ຕາຕະລາງການເຮັດວຽກ',
    categories: [
      { key: 'Shift', label: 'ກະເວນ', description: 'ເວລາກະເວນຂອງພະນັກງານໂຮງໝໍ' }
    ]
  }
];

window.masterCategoryMeta = window.masterCategoryGroups.reduce((acc, group) => {
  group.categories.forEach(category => {
    acc[category.key] = { ...category, groupKey: group.key, groupLabel: group.label };
  });
  return acc;
}, {});

window.activeMasterGroupKey = window.activeMasterGroupKey || window.masterCategoryGroups[0].key;

window.renderMasterCategoryUI = function () {
  const groupHost = document.getElementById('masterGroupTabs');
  const categoryHost = document.getElementById('masterCategoryButtons');
  const categorySelect = document.getElementById('masterCategory');
  if (!groupHost || !categoryHost || !categorySelect) return;

  const currentCategory = categorySelect.value;
  const selectedMeta = window.masterCategoryMeta[currentCategory];
  if (selectedMeta) window.activeMasterGroupKey = selectedMeta.groupKey;

  const activeGroup = window.masterCategoryGroups.find(group => group.key === window.activeMasterGroupKey) || window.masterCategoryGroups[0];

  groupHost.innerHTML = window.masterCategoryGroups.map(group => `
    <button type="button" class="master-topic-tab ${group.key === activeGroup.key ? 'active' : ''}" onclick="window.selectMasterGroup('${group.key}')">
      <div class="topic-icon"><i class="fas ${group.icon}"></i></div>
      <strong>${group.label}</strong>
      <span>${group.summary}</span>
    </button>
  `).join('');

  categoryHost.innerHTML = activeGroup.categories.map(category => `
    <button type="button" class="master-category-btn ${category.key === currentCategory ? 'active' : ''}" onclick="window.selectMasterCategory('${category.key}')">
      <strong>${category.label}</strong>
      <span>${category.description}</span>
    </button>
  `).join('');

  if (!currentCategory || !window.masterCategoryMeta[currentCategory]) {
    window.selectMasterCategory(activeGroup.categories[0].key);
    return;
  }

  $('#masterActiveCategoryName').text(window.masterCategoryMeta[currentCategory].label);
  $('#masterActiveCategoryDesc').text(window.masterCategoryMeta[currentCategory].description);
};

window.selectMasterGroup = function (groupKey) {
  window.activeMasterGroupKey = groupKey;
  const group = window.masterCategoryGroups.find(item => item.key === groupKey) || window.masterCategoryGroups[0];
  const currentCategory = $('#masterCategory').val();
  const stillBelongs = group.categories.some(category => category.key === currentCategory);
  if (!stillBelongs) {
    window.selectMasterCategory(group.categories[0].key);
    return;
  }
  window.renderMasterCategoryUI();
};

window.selectMasterCategory = function (categoryKey) {
  $('#masterCategory').val(categoryKey);
  const meta = window.masterCategoryMeta[categoryKey];
  if (meta) {
    window.activeMasterGroupKey = meta.groupKey;
    $('#masterActiveCategoryName').text(meta.label);
    $('#masterActiveCategoryDesc').text(meta.description);
  }
  window.renderMasterCategoryUI();
  window.loadMasterList();
};

window.loadMasterList = function () {
  let c = $('#masterCategory').val();
  if (!c) {
    $('#masterItemCount').text('0');
    $('#masterListUl').html(`
      <li class="list-group-item border-0 master-empty-state">
        <i class="fas fa-layer-group"></i>
        <strong>ເລືອກຫົວຂໍ້ກ່ອນ</strong>
        <span>ເລືອກ category ຈາກແຖບດ້ານຊ້າຍເພື່ອເບິ່ງລາຍການ</span>
      </li>`);
    return;
  }
  let h = '';
  const items = masterDataStore[c] || [];
  $('#masterItemCount').text(items.length);
  if (items.length > 0) {
    items.forEach(i => {
      h += `<li class="list-group-item d-flex justify-content-between align-items-center border-0 border-bottom mb-1 bg-transparent">
                    <span class="fw-bold text-dark">${i.value}</span> 
                    <div class="d-flex gap-2">
                      <button class="btn btn-sm btn-outline-warning shadow-sm rounded-circle" style="width:30px;height:30px;padding:0;" onclick="window.editMaster(${i.id}, '${i.value.replace(/'/g, "\\'")}')" title="ແກ້ໄຂ"><i class="fas fa-edit"></i></button>
                      <button class="btn btn-sm btn-outline-danger shadow-sm rounded-circle" style="width:30px;height:30px;padding:0;" onclick="window.delMaster(${i.id})" title="ລຶບ"><i class="fas fa-trash"></i></button>
                    </div>
                  </li>`;
    });
  } else {
    h = `<li class="list-group-item border-0 master-empty-state">
          <i class="fas fa-folder-open"></i>
          <strong>ຍັງບໍ່ມີຂໍ້ມູນໃນໝວດນີ້</strong>
          <span>ເພີ່ມລາຍການໃໝ່ຈາກຊ່ອງດ້ານເທິງໄດ້ເລີຍ</span>
        </li>`;
  }
  $('#masterListUl').html(h);
};

// Auto-sync a logged-in doctor/nurse user into the Master Data Doctor/Nurse list.
// Idempotent — does nothing if the user's name already exists in that category.
window.syncCurrentUserToMasterData = async function (user) {
  try {
    if (!user || !user.name) return;
    const roleMap = { doctor: 'Doctor', nurse: 'Nurse' };
    const category = roleMap[String(user.role || '').toLowerCase()];
    if (!category) return;
    const name = String(user.name).trim();
    if (!name) return;
    const { data, error } = await supabaseClient
      .from(dbTable('MasterData'))
      .select('ID')
      .eq('Category', category)
      .eq('Value', name)
      .limit(1);
    if (error) { console.warn('syncCurrentUserToMasterData lookup failed:', error.message); return; }
    if (data && data.length) return;
    const ins = await supabaseClient.from(dbTable('MasterData')).insert({ Category: category, Value: name });
    if (ins.error) { console.warn('syncCurrentUserToMasterData insert failed:', ins.error.message); return; }
    console.log(`[MasterData] Auto-synced ${category} "${name}" from login.`);
  } catch (err) {
    console.warn('syncCurrentUserToMasterData error:', err);
  }
};

window.addMaster = async function () {
  let c = $('#masterCategory').val();
  let v = $('#newMasterVal').val();
  if (!c) {
    return Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາເລືອກໝວດຂໍ້ມູນກ່ອນ', 'info');
  }
  if (!v) return;
  $('#newMasterVal').val('');

  let { error } = await supabaseClient.from(dbTable('MasterData')).insert({ Category: c, Value: v });
  if (!error) {
    window.loadMasterDataGlobal(); // Reloads and updates UI
  } else {
    Swal.fire('Error', error.message, 'error');
  }
};

window.delMaster = async function (id) {
  let r = await Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ລຶບ' });
  if (r.isConfirmed) {
    const { error } = await supabaseClient.from(dbTable('MasterData')).delete().eq('ID', id);
    if (error) {
      Swal.fire('Error', error.message, 'error');
    } else {
      window.loadMasterDataGlobal();
    }
  }
};

window.editMaster = async function (id, oldVal) {
  const { value: newVal } = await Swal.fire({
    title: 'ແກ້ໄຂຂໍ້ມູນ',
    input: 'text',
    inputValue: oldVal,
    showCancelButton: true,
    confirmButtonText: 'ບັນທຶກ',
    cancelButtonText: 'ຍົກເລີກ',
    inputValidator: (value) => {
      if (!value) return 'ກະລຸນາປ້ອນຂໍ້ມູນ!';
    }
  });

  if (newVal && newVal !== oldVal) {
    Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });
    const { error } = await supabaseClient.from(dbTable('MasterData')).update({ Value: newVal }).eq('ID', id);
    if (error) {
      Swal.fire('ຜິດພາດ!', error.message, 'error');
    } else {
      Swal.fire('ສຳເລັດ!', 'ແກ້ໄຂຂໍ້ມູນແລ້ວ', 'success');
      window.loadMasterDataGlobal();
    }
  }
};

window.loadOrgs = async function () {
  if ($.fn.DataTable.isDataTable('#orgTable')) $('#orgTable').DataTable().destroy();
  $('#orgTable tbody').html('<tr><td colspan="8" class="text-center py-4"><div class="spinner-border text-info spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');

  try {
    const { data: orgs, error } = await supabaseClient.from(dbTable('Organizations')).select('*');

    // 🚨 ດັກຈັບ Error ຕາມ Antigravity
    if (error) {
      console.error('Error:', error);
      Swal.fire('Error', error.message, 'error');
      return;
    }

    if ($.fn.DataTable.isDataTable('#orgTable')) $('#orgTable').DataTable().destroy();
    let h = '';
    if (orgs && orgs.length > 0) {
      orgs.forEach(o => {
        let st = o.Status === 'Active' ? `<span class="badge bg-success rounded-pill px-3 shadow-sm" style="cursor:pointer" onclick="window.toggleOrg('${o.Org_ID}','${o.Status}')"><i class="fas fa-check me-1"></i> Active</span>` : `<span class="badge bg-danger rounded-pill px-3 shadow-sm" style="cursor:pointer" onclick="window.toggleOrg('${o.Org_ID}','${o.Status}')"><i class="fas fa-times me-1"></i> Inactive</span>`;
        let sd = o.Discount ? String(o.Discount).replace(/[\r\n]+/g, " ").replace(/'/g, "\\'").replace(/"/g, "&quot;") : "";
        h += `<tr>
                        <td class="text-center"><input type="checkbox" class="form-check-input bulk-check-orgs" value="${o.Org_ID}"></td>
                        <td class="text-primary fw-bold">${o.Org_Code || '-'}</td>
                        <td class="text-muted">${o.Cus_ID_Ex || '-'}</td>
                        <td>${o.Name || '-'}</td>
                        <td class="fw-bold">${o.Org_Name || '-'}</td>
                        <td class="small text-danger" style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${sd || ''}">${sd || '-'}</td>
                        <td>${st}</td>
                        <td class="text-center"><button class="btn btn-sm btn-primary shadow-sm" onclick="window.editOrg('${o.Org_ID}','${o.Cus_ID_Ex}','${o.Name}','${o.Org_Name}','${o.Org_Code}','${sd}')"><i class="fas fa-edit"></i> ແກ້ໄຂ</button></td>
                      </tr>`;
      });
    }
    $('#orgTable tbody').html(h);
    $('#orgTable').DataTable({ responsive: true, pageLength: 10, language: { search: "ຄົ້ນຫາ:", emptyTable: "ບໍ່ມີຂໍ້ມູນ" } });
  } catch (err) {
    console.error('Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

window.toggleOrg = async function (id, currentStatus) {
  let newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
  await supabaseClient.from(dbTable('Organizations')).update({ Status: newStatus }).eq('Org_ID', id);
  window.loadOrgs();
  window.preloadDropdownData();
  window.refreshPatientOrgDropdown();
};

window.submitOrgForm = async function (e) {
  if (e) e.preventDefault();
  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });

  const isEdit = $('#o_rowIdx').val() !== '';
  const row = {
    Cus_ID_Ex: $('#o_cusId').val(),
    Name: $('#o_name').val(),
    Org_Name: $('#o_orgName').val(),
    Org_Code: $('#o_orgCode').val(),
    Discount: $('#o_discount').val()
  };

  try {
    if (isEdit) {
      const { error } = await supabaseClient.from(dbTable('Organizations')).update(row).eq('Org_ID', $('#o_rowIdx').val());
      if (error) throw error;
    } else {
      row.Status = 'Active';
      row.Org_ID = (row.Org_Code || '').trim() || await window.generateNextMasterID('Organizations', 'Org_ID', 'ORG', 3);
      const { error } = await supabaseClient.from(dbTable('Organizations')).insert(row);
      if (error) throw error;
    }
    $('#orgModal').modal('hide');
    window.loadOrgs();
    window.preloadDropdownData();
    window.refreshPatientOrgDropdown();
    Swal.fire('ສຳເລັດ!', '', 'success');
  } catch (err) {
    Swal.fire('ຜິດພາດ', err.message || String(err), 'error');
  }
};

window.openOrgModal = async function () {
  $('#orgForm')[0].reset();
  $('#o_rowIdx').val('');
  try {
    const nextCode = await window.generateNextMasterID('Organizations', 'Org_Code', 'ORG', 3);
    $('#o_orgCode').val(nextCode);
  } catch (e) { /* fallback: leave blank */ }
  $('#orgModal').modal('show');
};

window.editOrg = function (r, c, n, on, oc, d) {
  $('#o_rowIdx').val(r);
  $('#o_cusId').val(c);
  $('#o_name').val(n);
  $('#o_orgName').val(on);
  $('#o_orgCode').val(oc);
  $('#o_discount').val(d);
  $('#orgModal').modal('show');
};

window.submitSettingsForm = async function (e) {
  if (e) e.preventDefault();
  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });

  // ດຶງຄ່າຈາກຟອມໜ້າເວັບ
  let ns = {
    HospitalName: $('#setHospitalName').val(),
    LogoUrl: $('#setLogoUrl').val(),
    OpdHeaderUrl: $('#setOpdHeaderUrl').val(),
    OpdFooterUrl: $('#setOpdFooterUrl').val(),
    RememberLastModule: $('#setRememberLastModule').length ? String($('#setRememberLastModule').is(':checked')) : String(systemSettings.rememberLastModule || false)
  };

  // ປ່ຽນຮູບແບບໃຫ້ກາຍເປັນ Array ເພື່ອໃຊ້ບັນທຶກລົງ Table ແບບ Upsert
  let updates = Object.keys(ns).map(k => ({
    Key: k,
    Value: ns[k]
  }));

  try {
    const { error } = await supabaseClient
      .from(dbTable('Settings'))
      .upsert(updates, { onConflict: 'Key' });

    // 🚨 ເພີ່ມລະບົບແຈ້ງເຕືອນ Error ຕາມທີ່ Antigravity ແນະນຳ
    if (error) {
      console.error('Error:', error);
      Swal.fire('Error', error.message, 'error');
      return;
    }

    // ອັບເດດຄ່າໃນລະບົບ
    systemSettings = {
      hospitalName: ns.HospitalName,
      logoUrl: ns.LogoUrl,
      opdHeaderUrl: ns.OpdHeaderUrl,
      opdFooterUrl: ns.OpdFooterUrl,
      rememberLastModule: window.normalizeBooleanSetting(ns.RememberLastModule)
    };
    $('#sidebarBrandName').text(ns.HospitalName);
    window.logAction('Save', 'System Settings saved: ' + ns.HospitalName, 'Settings');

    Swal.fire('ສຳເລັດ!', 'ບັນທຶກການຕັ້ງຄ່າແລ້ວ', 'success');

  } catch (err) {
    console.error('System Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

// ຟັງຊັນສຳລັບດຶງຄ່າຕັ້ງຄ່າມາສະແດງ
window.loadSettingsData = async function () {
  try {
    const { data, error } = await supabaseClient.from(dbTable('Settings')).select('*');
    if (error) {
      console.error('Error:', error);
      Swal.fire('Error', error.message, 'error');
      return;
    }

    let s = {};
    if (data) {
      data.forEach(row => {
        if (row.Key === 'HospitalName') s.hospitalName = row.Value;
        if (row.Key === 'LogoUrl') s.logoUrl = row.Value;
        if (row.Key === 'OpdHeaderUrl') s.opdHeaderUrl = row.Value;
        if (row.Key === 'OpdFooterUrl') s.opdFooterUrl = row.Value;
        if (row.Key === 'RememberLastModule') s.rememberLastModule = window.normalizeBooleanSetting(row.Value);
      });
    }

    systemSettings = s;
    $('#setHospitalName').val(s.hospitalName || "");
    $('#setLogoUrl').val(s.logoUrl || "");
    $('#setOpdHeaderUrl').val(s.opdHeaderUrl || "");
    $('#setOpdFooterUrl').val(s.opdFooterUrl || "");
    $('#setRememberLastModule').prop('checked', !!s.rememberLastModule);

    if (typeof window.loadMasterList === 'function') window.loadMasterList();
  } catch (err) {
    console.error('Error:', err);
  }
};

window.loadLocationsMasterView = async function () {
  if ($.fn.DataTable.isDataTable('#locationTable')) $('#locationTable').DataTable().destroy();
  $('#locationTable tbody').html('<tr><td colspan="4" class="text-center py-4"><div class="spinner-border text-info spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');

  try {
    const { data: r, error } = await supabaseClient.from(dbTable('Locations')).select('*');

    if (error) {
      console.error('Error:', error);
      Swal.fire('Error', error.message, 'error');
      return;
    }

    locationsDataStore = r || [];
    if ($.fn.DataTable.isDataTable('#locationTable')) $('#locationTable').DataTable().destroy();

    let o = '<option value="">-- ເລືອກເມືອງ --</option>';
    if (r) r.forEach(l => o += `<option value="${l.District}">${l.District}</option>`);
    $('#p_district').html(o);

    let h = '';
    if (r && r.length > 0) {
      r.forEach(l => {
        // ອີງຕາມ Column ໃນ CSV: ID, District, Province
        h += `<tr>
                        <td class="text-center"><input type="checkbox" class="form-check-input bulk-check-locations" value="${l.ID}"></td>
                        <td class="fw-bold text-primary">${l.District}</td>
                        <td><span class="badge bg-info text-dark">${l.Province}</span></td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-primary shadow-sm me-1" onclick="window.editLocation('${l.ID}','${l.District}','${l.Province}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger shadow-sm" onclick="window.delLocation('${l.ID}')"><i class="fas fa-trash"></i></button>
                        </td>
                      </tr>`;
      });
    }
    $('#locationTable tbody').html(h);
    $('#locationTable').DataTable({ responsive: true, pageLength: 10, language: { search: "ຄົ້ນຫາ:", emptyTable: "ບໍ່ມີຂໍ້ມູນ" } });
  } catch (err) {
    console.error('System Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

window.openAddLocationModal = function () {
  $('#locationForm')[0].reset();
  $('#l_id').val('');
  $('#locationModal').modal('show');
};

window.editLocation = function (id, d, p) {
  $('#l_id').val(id);
  $('#l_dist').val(d);
  $('#l_prov').val(p);
  $('#locationModal').modal('show');
};

window.delLocation = async function (id) {
  let r = await Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ລຶບ' });
  if (r.isConfirmed) {
    await supabaseClient.from(dbTable('Locations')).delete().eq('ID', id);
    window.loadLocationsMasterView();
  }
};

window.submitLocationForm = async function (e) {
  if (e) e.preventDefault();
  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });

  try {
    let payload = {
      District: $('#l_dist').val(),
      Province: $('#l_prov').val()
    };
    let l_id = $('#l_id').val();

    if (l_id) {
      // ແກ້ໄຂຂໍ້ມູນເກົ່າ
      const { error } = await supabaseClient.from(dbTable('Locations')).update(payload).eq('ID', l_id);
      if (error) { console.error('Error:', error); Swal.fire('Error', error.message, 'error'); return; }
    } else {
      // ເພີ່ມຂໍ້ມູນໃໝ່ (ສ້າງ ID ອັດຕະໂນມັດ)
      payload.ID = 'LOC' + Date.now();
      const { error } = await supabaseClient.from(dbTable('Locations')).insert([payload]);
      if (error) { console.error('Error:', error); Swal.fire('Error', error.message, 'error'); return; }
    }

    $('#locationModal').modal('hide');
    window.loadLocationsMasterView();
    Swal.fire('ສຳເລັດ!', '', 'success');
  } catch (err) {
    console.error('Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

window.delLocation = function (id) {
  Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ລຶບ' }).then(async r => {
    if (r.isConfirmed) {
      try {
        const { error } = await supabaseClient.from(dbTable('Locations')).delete().eq('ID', id);
        if (error) { console.error('Error:', error); Swal.fire('Error', error.message, 'error'); return; }
        window.loadLocationsMasterView();
        Swal.fire('ລຶບແລ້ວ', '', 'success');
      } catch (err) {
        console.error('Error:', err);
        Swal.fire('Error', err.message, 'error');
      }
    }
  });
};

window.loadServicesMasterView = async function () {
  if ($.fn.DataTable.isDataTable('#serviceTable')) $('#serviceTable').DataTable().destroy();
  $('#serviceTable tbody').html('<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-info spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');

  try {
    const { data: r, error } = await supabaseClient.from(dbTable('Service_Lists')).select('*');
    if (error) { console.error('Error:', error); Swal.fire('Error', error.message, 'error'); return; }

    servicesDataStore = r || [];
    if ($.fn.DataTable.isDataTable('#serviceTable')) $('#serviceTable').DataTable().destroy();

    let o = '';
    if (r) r.forEach(s => { o += `<option value="${s.Services_List}">${s.Services_List}</option>`; });
    $('#emrService').empty().append(o).trigger('change');

    let h = '';
    if (r && r.length > 0) {
      r.forEach(s => {
        let safeService = (s.Services_List || "").replace(/'/g, "\\'");
        let safeSpec = (s.Mapped_Specialist || "").replace(/'/g, "\\'");
        let safeRev = (s.Revenue_Group || "").replace(/'/g, "\\'");

        h += `<tr>
                        <td class="text-center"><input type="checkbox" class="form-check-input bulk-check-services" value="${s.ID}"></td>
                        <td class="fw-bold text-primary">${s.Services_List}</td>
                        <td><span class="badge bg-info text-dark">${s.Mapped_Specialist || '-'}</span></td>
                        <td><span class="badge bg-success">${s.Revenue_Group || '-'}</span></td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-primary shadow-sm me-1" onclick="window.editService('${s.ID}','${safeService}','${safeSpec}','${safeRev}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger shadow-sm" onclick="window.delService('${s.ID}')"><i class="fas fa-trash"></i></button>
                        </td>
                      </tr>`;
      });
    }
    $('#serviceTable tbody').html(h);
    $('#serviceTable').DataTable({ responsive: true, pageLength: 10, language: { search: "ຄົ້ນຫາ:", emptyTable: "ບໍ່ມີຂໍ້ມູນ" } });
  } catch (err) {
    console.error('System Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

window.submitServiceForm = async function (e) {
  if (e) e.preventDefault();
  Swal.fire({ title: 'ກຳລັງບັນທຶກ...', didOpen: () => Swal.showLoading() });
  try {
    let payload = {
      Services_List: $('#s_serv').val(),
      Mapped_Specialist: $('#s_spec').val(),
      Revenue_Group: $('#s_rev').val()
    };
    let s_id = $('#s_id').val();

    if (s_id) {
      const { error } = await supabaseClient.from(dbTable('Service_Lists')).update(payload).eq('ID', s_id);
      if (error) { console.error('Error:', error); Swal.fire('Error', error.message, 'error'); return; }
    } else {
      payload.ID = 'SRV' + Date.now();
      const { error } = await supabaseClient.from(dbTable('Service_Lists')).insert([payload]);
      if (error) { console.error('Error:', error); Swal.fire('Error', error.message, 'error'); return; }
    }

    $('#serviceModal').modal('hide');
    window.loadServicesMasterView();
    Swal.fire('ສຳເລັດ!', '', 'success');
  } catch (err) {
    console.error('Error:', err);
    Swal.fire('Error', err.message, 'error');
  }
};

window.delService = function (id) {
  Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ລຶບ' }).then(async r => {
    if (r.isConfirmed) {
      try {
        const { error } = await supabaseClient.from(dbTable('Service_Lists')).delete().eq('ID', id);
        if (error) { console.error('Error:', error); Swal.fire('Error', error.message, 'error'); return; }
        window.loadServicesMasterView();
        Swal.fire('ລຶບແລ້ວ', '', 'success');
      } catch (err) {
        console.error('Error:', err);
        Swal.fire('Error', err.message, 'error');
      }
    }
  });
};

window.openAddServiceModal = function () {
  $('#serviceForm')[0].reset();
  $('#s_id').val('');
  $('#serviceModal').modal('show');
};

window.editService = function (id, sv, sp, rv) {
  $('#s_id').val(id);
  $('#s_serv').val(sv);
  $('#s_spec').val(sp);
  $('#s_rev').val(rv);
  $('#serviceModal').modal('show');
};

window.setBrandName = function (name) {
  var el = document.getElementById('topnavBrandName');
  if (el) {
    el.textContent = name && /one\s+medical/i.test(name) ? 'Luckxay Hospital' : (name || 'Luckxay Hospital');
  }
};

window.excelImportTemplates = {
  patients: {
    fileName: 'HIS_Patients_Import_Template.xlsx',
    sheetName: 'Patients',
    headers: [
      'Patient_ID', 'Old_Patient_ID', 'Title', 'First_Name', 'Last_Name', 'Gender', 'Date_of_Birth', 'Age',
      'Nationality', 'Occupation', 'Blood_Type', 'Phone_Number', 'Email', 'Address',
      'District', 'Province', 'Organization_ID', 'Name_Org', 'Insurance_Code',
      'Insured_Person_Name', 'Drug_Allergy', 'Underlying_Disease', 'Emergency_Name',
      'Emergency_Contact', 'Emergency_Relation', 'Channel', 'Registration_Date', 'Time',
      'Shift', 'Age_Group'
    ]
  },
  orgs: {
    fileName: 'HIS_Organizations_Import_Template.xlsx',
    sheetName: 'Organizations',
    headers: ['Cus_ID_Ex', 'Name', 'Org_Name', 'Org_Code', 'Org_ID', 'Discount']
  },
  locations: {
    fileName: 'HIS_Locations_Import_Template.xlsx',
    sheetName: 'Locations',
    headers: ['District', 'Province']
  },
  services: {
    fileName: 'HIS_Services_Import_Template.xlsx',
    sheetName: 'Services',
    headers: ['Services_List', 'Mapped_Specialist', 'Revenue_Group']
  },
  drugs: {
    fileName: 'HIS_Drugs_Import_Template.xlsx',
    sheetName: 'Drugs',
    headers: ['Drug_Name', 'Description']
  },
  labs: {
    fileName: 'HIS_Labs_Import_Template.xlsx',
    sheetName: 'Labs',
    headers: ['Lab_Name', 'Description', 'Category']
  }
};

window.downloadExcelTemplate = function (type) {
  const config = window.excelImportTemplates?.[type];
  if (!config) return Swal.fire(window.t('common.error'), 'Template not found', 'error');
  if (typeof XLSX === 'undefined') return Swal.fire(window.t('common.error'), 'Excel library is not loaded', 'error');

  const ws = XLSX.utils.aoa_to_sheet([config.headers]);
  ws['!cols'] = config.headers.map(header => ({ wch: Math.max(14, String(header).length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, config.sheetName || 'Template');
  XLSX.writeFile(wb, config.fileName);
};

window.handlePatientExcelUpload = function (e) {
  let file = e.target.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = async function (evt) {
    Swal.fire({ title: 'ກຳລັງປະມວນຜົນ...', didOpen: () => Swal.showLoading() });
    let data = new Uint8Array(evt.target.result);
    let workbook = XLSX.read(data, { type: 'array', cellDates: true });
    let firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    let jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: "" });
    const importHeaders = (jsonData[0] || []).map(h => String(h || '').trim().toLowerCase());
    const headerIndex = {};
    importHeaders.forEach((h, idx) => { if (h) headerIndex[h] = idx; });
    const hasPatientHeader = Object.prototype.hasOwnProperty.call(headerIndex, 'patient_id');
    const getCell = (row, names, fallbackIndex) => {
      if (hasPatientHeader) {
        for (const name of names) {
          const idx = headerIndex[String(name).toLowerCase()];
          if (idx !== undefined) return row[idx];
        }
        return '';
      }
      return row[fallbackIndex];
    };
    const toDateValue = (value) => {
      if (value instanceof Date) {
        return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, '0') + "-" + String(value.getDate()).padStart(2, '0');
      }
      return value || null;
    };
    const toTimeValue = (value) => {
      if (value instanceof Date) return String(value.getHours()).padStart(2, '0') + ":" + String(value.getMinutes()).padStart(2, '0');
      if (typeof value === 'number') {
        let totalSeconds = Math.floor(value * 86400);
        let hours = Math.floor(totalSeconds / 3600);
        let mins = Math.floor((totalSeconds % 3600) / 60);
        return String(hours).padStart(2, '0') + ":" + String(mins).padStart(2, '0');
      }
      return value || '';
    };

    let insertData = [];
    for (let i = 1; i < jsonData.length; i++) {
      let row = jsonData[i];
      const patientId = window.normalizePatientCode(getCell(row, ['Patient_ID', 'New_Patient_ID', 'LXH_ID'], 0));
      if (row.length < 1 || !patientId) continue;
      // Map array columns to Supabase 'Patients' table columns
      // Assumes standard template structure - adjust map if template varies
      let parsedAge = parseInt(getCell(row, ['Age'], 6)) || 0;
      let ageGroup = getCell(row, ['Age_Group'], 28) || '';
      if (parsedAge && !ageGroup) {
        ageGroup = parsedAge <= 15 ? '0-15' : (parsedAge <= 35 ? '16-35' : (parsedAge <= 55 ? '36-55' : '55+'));
      }

      // Map array columns to Supabase 'Patients' table columns accurately based on real Excel structure
      insertData.push({
        Patient_ID: patientId,
        Old_Patient_ID: window.normalizePatientCode(getCell(row, ['Old_Patient_ID', 'Legacy_Patient_ID', 'Old_ID'], '')),
        Title: getCell(row, ['Title'], 1) || '',
        First_Name: getCell(row, ['First_Name'], 2) || '',
        Last_Name: getCell(row, ['Last_Name'], 3) || '',
        Gender: getCell(row, ['Gender'], 4) || '',
        Date_of_Birth: toDateValue(getCell(row, ['Date_of_Birth', 'DOB'], 5)),
        Age: parsedAge,
        Nationality: getCell(row, ['Nationality'], 7) || '',
        Occupation: getCell(row, ['Occupation'], 8) || '',
        Blood_Type: getCell(row, ['Blood_Type'], 9) || '',
        Phone_Number: getCell(row, ['Phone_Number'], 10) || '',
        Email: getCell(row, ['Email'], 11) || '',
        Address: getCell(row, ['Address'], 12) || '',
        District: getCell(row, ['District'], 13) || '',
        Province: getCell(row, ['Province'], 14) || '',
        Organization_ID: getCell(row, ['Organization_ID'], 15) || '',
        Name_Org: getCell(row, ['Name_Org'], 16) || '',
        Insurance_Code: getCell(row, ['Insurance_Code'], 17) || '',
        Insured_Person_Name: getCell(row, ['Insured_Person_Name'], 18) || '',
        Drug_Allergy: getCell(row, ['Drug_Allergy'], 19) || '',
        Underlying_Disease: getCell(row, ['Underlying_Disease'], 20) || '',
        Emergency_Name: getCell(row, ['Emergency_Name'], 21) || '',
        Emergency_Contact: getCell(row, ['Emergency_Contact'], 22) || '',
        Emergency_Relation: getCell(row, ['Emergency_Relation'], 23) || '',
        Channel: getCell(row, ['Channel'], 24) || '',
        Registration_Date: toDateValue(getCell(row, ['Registration_Date'], 25)),
        Time: toTimeValue(getCell(row, ['Time'], 26)),
        Shift: getCell(row, ['Shift'], 27) || '',
        Age_Group: ageGroup
      });
    }

    if (insertData.length > 0) {
      const seen = new Set();
      const deduped = [];
      const dupIds = [];
      insertData.forEach(row => {
        const key = String(row.Patient_ID || '').trim();
        if (!key) return;
        if (seen.has(key)) { dupIds.push(key); return; }
        seen.add(key);
        deduped.push(row);
      });
      const existing = await supabaseClient.from(dbTable('Patients'))
        .select('Patient_ID')
        .in('Patient_ID', deduped.map(r => r.Patient_ID));
      const existingIds = new Set((existing.data || []).map(r => String(r.Patient_ID)));
      const toUpdate = deduped.filter(r => existingIds.has(String(r.Patient_ID)));
      const toInsert = deduped.filter(r => !existingIds.has(String(r.Patient_ID)));
      const { error } = await supabaseClient.from(dbTable('Patients'))
        .upsert(deduped, { onConflict: 'Patient_ID', ignoreDuplicates: false });
      if (!error) {
        const dupNote = dupIds.length ? `<br><small class="text-muted">ຂ້າມຊ້ຳໃນ Excel: ${dupIds.length} ແຖວ</small>` : '';
        Swal.fire({
          title: 'ສຳເລັດ!',
          html: `ນຳເຂົ້າສຳເລັດ <b>${deduped.length}</b> ລາຍການ<br>(ເພີ່ມໃໝ່: ${toInsert.length} | ອັບເດດທີ່ມີຢູ່: ${toUpdate.length})${dupNote}`,
          icon: 'success'
        });
        window.initPatientTable();
        window.preloadDropdownData();
      } else {
        Swal.fire('ຜິດພາດ!', error.message, 'error');
      }
    } else {
      Swal.fire('ຜິດພາດ!', 'ບໍ່ພົບຂໍ້ມູນ', 'error');
    }
    $('#patientExcelInput').val("");
  };
  reader.readAsArrayBuffer(file);
};

window.handleLocationExcelUpload = function (e) {
  let file = e.target.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = async function (evt) {
    Swal.fire({ title: 'ກຳລັງປະມວນຜົນ...', didOpen: () => Swal.showLoading() });
    let data = new Uint8Array(evt.target.result);
    let workbook = XLSX.read(data, { type: 'array' });
    let firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    let jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

    let insertData = [];
    for (let i = 1; i < jsonData.length; i++) {
      let row = jsonData[i];
      if (row.length < 1 || !row[0]) continue;
      insertData.push({ District: row[0], Province: row[1] || '' });
    }

    if (insertData.length > 0) {
      const { error } = await supabaseClient.from(dbTable('Locations')).insert(insertData);
      if (!error) {
        Swal.fire('ສຳເລັດ!', `ນຳເຂົ້າສຳເລັດ ${insertData.length} ລາຍການ`, 'success');
        window.loadLocationsMasterView();
      } else {
        Swal.fire('ຜິດພາດ!', error.message, 'error');
      }
    } else {
      Swal.fire('ຜິດພາດ!', 'ບໍ່ພົບຂໍ້ມູນ', 'error');
    }
    $('#locExcelInput').val("");
  };
  reader.readAsArrayBuffer(file);
};

window.handleExcelUpload = function (e) {
  let file = e.target.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = async function (evt) {
    Swal.fire({ title: 'ກຳລັງປະມວນຜົນ...', didOpen: () => Swal.showLoading() });
    let data = new Uint8Array(evt.target.result);
    let workbook = XLSX.read(data, { type: 'array' });
    let firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    let jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

    let insertData = [];
    for (let i = 1; i < jsonData.length; i++) {
      let row = jsonData[i];
      if (row.length < 1 || !row[0]) continue;
      insertData.push({ Services_List: row[0], Mapped_Specialist: row[1] || '', Revenue_Group: row[2] || '' });
    }

    if (insertData.length > 0) {
      const { error } = await supabaseClient.from(dbTable('Service_Lists')).insert(insertData);
      if (!error) {
        Swal.fire('ສຳເລັດ!', `ນຳເຂົ້າສຳເລັດ ${insertData.length} ລາຍການ`, 'success');
        window.loadServicesMasterView();
      } else {
        Swal.fire('ຜິດພາດ!', error.message, 'error');
      }
    } else {
      Swal.fire('ຜິດພາດ!', 'ບໍ່ພົບຂໍ້ມູນ', 'error');
    }
    $('#excelFileInput').val("");
  };
  reader.readAsArrayBuffer(file);
};

window.handleOrgExcelUpload = function (e) {
  let file = e.target.files[0];
  if (!file) return;

  let reader = new FileReader();
  reader.onload = async function (ev) {
    try {
      let data = new Uint8Array(ev.target.result);
      let workbook = XLSX.read(data, { type: 'array' });
      let firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      let excelRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      if (!excelRows || excelRows.length === 0) {
        Swal.fire('Error', 'ບໍ່ພົບຂໍ້ມູນໃນໄຟລ໌', 'error');
        return;
      }

      Swal.fire({ title: 'ກຳລັງອັບໂຫຼດ...', didOpen: () => { Swal.showLoading() } });

      let insertData = [];
      for (let row of excelRows) {
        let obj = {
          Cus_ID_Ex: row['Cus_ID_Ex'] || '',
          Name: row['Name'] || '',
          Org_Name: row['Org_Name'] || '',
          Org_Code: row['Org_Code'] || row['Org_ID'] || '',
          Discount: row['Discount'] ? String(row['Discount']) : '',
          Status: 'Active'
        };
        if (row['Org_ID']) obj.Org_ID = String(row['Org_ID']);
        insertData.push(obj);
      }

      const missingIdRows = insertData.filter(d => !d.Org_ID);
      if (missingIdRows.length) {
        const ids = await window.generateNextMasterIDs('Organizations', 'Org_ID', 'ORG', 3, missingIdRows.length);
        let k = 0;
        insertData.forEach(d => { if (!d.Org_ID) d.Org_ID = (d.Org_Code || '').trim() || ids[k++]; });
      }

      const { error } = await supabaseClient.from(dbTable('Organizations')).insert(insertData);
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        Swal.fire('ສຳເລັດ', 'ນຳເຂົ້າຂໍ້ມູນອົງກອນສຳເລັດແລ້ວ', 'success');
        window.loadOrgs();
        window.preloadDropdownData();
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'ເກີດຂໍ້ຜິດພາດໃນການອ່ານໄຟລ໌ Excel', 'error');
    }
    $('#orgExcelInput').val('');
  };
  reader.readAsArrayBuffer(file);
};

window.handleDrugExcelUpload = function (e) {
  let f = e.target.files[0];
  if (!f) return;
  let r = new FileReader();
  r.onload = async function (ev) {
    Swal.fire({ title: 'ກຳລັງປະມວນຜົນ...', didOpen: () => Swal.showLoading() });
    let workbook = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
    let firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    let jd = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

    let insertData = [];
    for (let i = 1; i < jd.length; i++) {
      let row = jd[i];
      if (row.length < 1 || !row[0]) continue;
      insertData.push({ Drug_Name: row[0], Description: row[1] || '' });
    }

    if (insertData.length > 0) {
      const ids = await window.generateNextMasterIDs('Drugs_Master', 'Drug_ID', 'DRUG', 3, insertData.length);
      insertData.forEach((d, i) => { d.Drug_ID = ids[i]; });
      const { error } = await supabaseClient.from(dbTable('Drugs_Master')).insert(insertData);
      if (!error) {
        Swal.fire('ສຳເລັດ!', `ນຳເຂົ້າ ${insertData.length} ລາຍການ`, 'success');
        window.loadDrugsMaster();
        window.preloadDropdownData();
      } else {
        Swal.fire('ຜິດພາດ!', error.message, 'error');
      }
    } else {
      Swal.fire('ແຈ້ງເຕືອນ!', 'ບໍ່ພົບຂໍ້ມູນທີ່ຈະນຳເຂົ້າ — ກວດສອບ format ຂອງ Excel', 'warning');
    }
    $('#drugExcelInput').val('');
  };
  r.readAsArrayBuffer(f);
};

window.handleLabExcelUpload = function (e) {
  let f = e.target.files[0];
  if (!f) return;
  let r = new FileReader();
  r.onload = async function (ev) {
    Swal.fire({ title: 'ກຳລັງປະມວນຜົນ...', didOpen: () => Swal.showLoading() });
    let workbook = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
    let firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    let jd = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

    let insertData = [];
    let importCategories = [];
    for (let i = 1; i < jd.length; i++) {
      let row = jd[i];
      if (row.length < 1 || !row[0]) continue;
      const category = String(row[2] || '').trim();
      insertData.push({ Lab_Name: row[0], Description: row[1] || '', category });
      if (category) importCategories.push(category);
    }

    if (insertData.length > 0) {
      const labIds = await window.generateNextMasterIDs('Labs_Master', 'Lab_ID', 'LAB', 3, insertData.length);
      const payload = insertData.map((item, i) => ({ Lab_ID: labIds[i], Lab_Name: item.Lab_Name, Description: item.Description }));
      const { data: insertedRows, error } = await supabaseClient.from(dbTable('Labs_Master')).insert(payload).select('Lab_ID,Lab_Name');
      if (!error) {
        const ensureResult = await window.ensureLabCategoriesExist(importCategories);
        if (ensureResult.error) {
          Swal.fire('ຜິດພາດ!', ensureResult.error.message, 'error');
          $('#labExcelInput').val('');
          return;
        }

        const mappingRows = [];
        (insertedRows || []).forEach((inserted, index) => {
          const category = String(insertData[index]?.category || '').trim();
          if (!category) return;
          mappingRows.push({ Category: 'LabCategoryMapping', Value: JSON.stringify({ labId: inserted.Lab_ID, category }) });
        });

        if (mappingRows.length > 0) {
          const { error: mappingError } = await supabaseClient.from(dbTable('MasterData')).insert(mappingRows);
          if (mappingError) {
            Swal.fire('ຜິດພາດ!', mappingError.message, 'error');
            $('#labExcelInput').val('');
            return;
          }
        }

        await window.loadMasterDataGlobal();
        Swal.fire('ສຳເລັດ!', `ນຳເຂົ້າ ${insertData.length} ລາຍການ`, 'success');
        window.loadLabsMaster();
        window.preloadDropdownData();
      } else {
        Swal.fire('ຜິດພາດ!', error.message, 'error');
      }
    } else {
      Swal.fire('ແຈ້ງເຕືອນ!', 'ບໍ່ພົບຂໍ້ມູນທີ່ຈະນຳເຂົ້າ — ກວດສອບ format ຂອງ Excel', 'warning');
    }
    $('#labExcelInput').val('');
  };
  r.readAsArrayBuffer(f);
};

// Bulk Delete Logic
window.toggleAllCheckboxes = function (masterCheckbox, type) {
  const isChecked = $(masterCheckbox).is(':checked');
  $(`.bulk-check-${type}`).prop('checked', !!isChecked);
};

window.bulkDelete = async function (type) {
  const checked = $(`.bulk-check-${type}:checked`);
  if (checked.length === 0) {
    Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາເລືອກລາຍການທີ່ຕ້ອງການລຶບກ່ອນ', 'warning');
    return;
  }

  const ids = [];
  checked.each(function () {
    ids.push($(this).val());
  });

  const config = {
    'vacMaster': { table: dbTable('Vaccines_Master'), col: 'Vac_ID', reload: window.loadVaccineMaster },
    'drugs': { table: dbTable('Drugs_Master'), col: 'Drug_ID', reload: window.loadDrugsMaster },
    'labs': { table: dbTable('Labs_Master'), col: 'Lab_ID', reload: window.loadLabsMaster },
    'users': { table: dbTable('Users'), col: 'ID', reload: window.loadUsers },
    'orgs': { table: dbTable('Organizations'), col: 'Org_ID', reload: window.loadOrgs },
    'locations': { table: dbTable('Locations'), col: 'ID', reload: window.loadLocationsMasterView },
    'services': { table: dbTable('Service_Lists'), col: 'ID', reload: window.loadServicesMasterView }
  };

  const cfg = config[type];
  if (!cfg) return;

  Swal.fire({
    title: 'ຍືນຍັນການລຶບ?',
    text: `ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບ ${ids.length} ລາຍການທີ່ເລືອກ?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ລຶບເລີຍ',
    cancelButtonText: 'ຍົກເລີກ'
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: 'ກຳລັງລຶບ...', didOpen: () => Swal.showLoading() });
      try {
        const { error } = await supabaseClient.from(cfg.table).delete().in(cfg.col, ids);
        if (error) throw error;

        if (type === 'labs') {
          const mappingResult = await window.deleteLabCategoryMappings(ids);
          if (mappingResult.error) throw mappingResult.error;
          await window.loadMasterDataGlobal();
          window.preloadDropdownData();
        }

        cfg.reload();
        Swal.fire('ສຳເລັດ', 'ລຶບລາຍການທີ່ເລືອກສຳເລັດແລ້ວ', 'success');
      } catch (err) {
        console.error(err);
        Swal.fire('ຂໍ້ຜິດພາດ', err.message, 'error');
      }
    }
  });
};

// ==========================================
// ACTIVITY LOG SYSTEM
// ==========================================

/**
 * logAction — fire-and-forget logger
 * @param {string} action  e.g. 'Login', 'Add', 'Edit', 'Delete', 'Save'
 * @param {string} details e.g. 'Patient P25-0001 (John Doe)'
 * @param {string} module  e.g. 'Patients', 'Triage', 'OPD'
 */
window._activityLogWriteDisabled = false;

window.logAction = function (action, details, module) {
  try {
    if (window._activityLogWriteDisabled) return;
    const userId = currentUser ? currentUser.id : '-';
    const userName = currentUser ? currentUser.name : 'System';
    supabaseClient.from(dbTable('activity_logs')).insert({
      timestamp: new Date().toISOString(),
      user_id: userId,
      user_name: userName,
      action: action,
      details: details || '',
      module: module || ''
    }).then(({ error }) => {
      if (!error) return;
      const msg = (error.message || '').toLowerCase();
      const code = (error.code || '').toString();
      if (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
        window._activityLogWriteDisabled = true;
        return;
      }
      console.warn('logAction error:', error.message);
    });
  } catch (e) {
    console.warn('logAction exception:', e);
  }
};

window.loadActivityLog = async function () {
  const today = window.getLocalStr(new Date());
  if (!$('#logStartDate').val()) $('#logStartDate').val(today);
  if (!$('#logEndDate').val()) $('#logEndDate').val(today);

  let sDate = $('#logStartDate').val();
  let eDate = $('#logEndDate').val();
  let mod = $('#logModuleFilter').val();
  let user = $('#logUserFilter').val().toLowerCase();
  let act = $('#logActionFilter').val();

  if ($.fn.DataTable.isDataTable('#activityLogTable')) $('#activityLogTable').DataTable().destroy();
  $('#activityLogTableBody').html('<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-info spinner-border-sm"></div> ກຳລັງໂຫຼດ...</td></tr>');

  try {
    const range = window.getLocalDateRangeIsoBounds(sDate, eDate);
    let query = supabaseClient
      .from(dbTable('activity_logs'))
      .select('*')
      .gte('timestamp', range.startIso)
      .lte('timestamp', range.endIso)
      .order('timestamp', { ascending: false })
      .limit(500);

    if (mod) query = query.eq('module', mod);
    if (act) query = query.ilike('action', '%' + act + '%');

    const { data: logs, error } = await query;
    if (error) throw error;

    let rows = (logs || []).filter(l => !user || (l.user_name || '').toLowerCase().includes(user));

    // Summary counts
    let cAdd = 0, cEdit = 0, cDel = 0;
    rows.forEach(l => {
      let a = (l.action || '').toLowerCase();
      if (a.includes('add') || a.includes('save') || a.includes('login')) cAdd++;
      else if (a.includes('edit')) cEdit++;
      else if (a.includes('delete')) cDel++;
    });
    $('#logCountTotal').text(rows.length);
    $('#logCountAdd').text(cAdd);
    $('#logCountEdit').text(cEdit);
    $('#logCountDelete').text(cDel);

    // Render rows
    const actionBadge = (a) => {
      let al = (a || '').toLowerCase();
      if (al === 'login') return `<span class="badge bg-primary">${a}</span>`;
      if (al === 'logout') return `<span class="badge bg-secondary">${a}</span>`;
      if (al === 'add' || al === 'save') return `<span class="badge bg-success">${a}</span>`;
      if (al === 'edit') return `<span class="badge bg-warning text-dark">${a}</span>`;
      if (al === 'delete') return `<span class="badge bg-danger">${a}</span>`;
      return `<span class="badge bg-info text-dark">${a}</span>`;
    };

    let h = '';
    rows.forEach(l => {
      let d = new Date(l.timestamp);
      let dateStr = d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      h += `<tr>
                <td class="text-muted small">${dateStr}</td>
                <td><span class="fw-bold">${l.user_name || '-'}</span><br><small class="text-muted">${l.user_id || ''}</small></td>
                <td>${actionBadge(l.action)}</td>
                <td class="small">${l.details || '-'}</td>
                <td><span class="badge bg-light text-dark border">${l.module || '-'}</span></td>
              </tr>`;
    });

    if (rows.length === 0) h = '<tr><td colspan="5" class="text-center py-4 text-muted"><i class="fas fa-inbox me-2"></i>ບໍ່ມີ Log ໃນຊ່ວງວັນທີນີ້</td></tr>';
    $('#activityLogTableBody').html(h);
    $('#activityLogTable').DataTable({
      responsive: true, pageLength: 25,
      language: { search: 'ຄົ້ນຫາ:', emptyTable: 'ບໍ່ມີຂໍ້ມູນ', lengthMenu: 'ສະແດງ _MENU_' }
    });
  } catch (err) {
    console.error('loadActivityLog error:', err);
    $('#activityLogTableBody').html(`<tr><td colspan="5" class="text-center text-danger py-4"><i class="fas fa-exclamation-triangle me-2"></i>${err.message}</td></tr>`);
  }
};

window.exportActivityLogCSV = function () {
  if (!$.fn.DataTable.isDataTable('#activityLogTable')) {
    Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາໂຫຼດ Log ກ່ອນ Export', 'warning');
    return;
  }
  let dt = $('#activityLogTable').DataTable();
  let rows = [['ວັນທີ / ເວລາ', 'ຜູ້ໃຊ້', 'User ID', 'ການກະທຳ', 'ລາຍລະອຽດ', 'Module']];
  dt.rows().data().each(function (r) {
    let cells = [];
    for (let i = 0; i < 5; i++) {
      let div = document.createElement('div');
      div.innerHTML = r[i] || '';
      cells.push(div.innerText.replace(/\n/g, ' ').trim());
    }
    rows.push(cells);
  });
  let csv = rows.map(r => r.map(c => '"' + (c + '').replace(/"/g, '""') + '"').join(',')).join('\n');
  let blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url; a.download = 'Activity_Log_' + window.getLocalStr(new Date()) + '.csv'; a.click();
  URL.revokeObjectURL(url);
};

// ==========================================
// PUBLIC QUEUE & VOICE CALL
// ==========================================
let publicQueueChannel = null;

window.initPublicQueueView = async function () {
  console.log("Initializing Public Queue View...");
  
  // Set Hospital Name
  $('#tvHospitalName').text(systemSettings.hospitalName || "HIS HOSPITAL");
  
  // Update Clock
  setInterval(() => {
    let now = new Date();
    $('#tvClock').text(now.toLocaleTimeString('en-GB', { hour12: false }));
    $('#tvDate').text(now.toLocaleDateString('lo-LA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
  }, 1000);

  // Fetch Initial Data
  window.refreshPublicQueueDisplay();

  // Supabase Real-time Subscription
  if (publicQueueChannel) supabaseClient.removeChannel(publicQueueChannel);
  
  publicQueueChannel = supabaseClient.channel('public-queue-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: dbTable('Visits') }, payload => {
      console.log('Queue Change Detected:', payload);
      window.refreshPublicQueueDisplay();
      
      // If someone was just set to "Calling"
      if (payload.new && payload.new.Status && payload.new.Status.startsWith('Calling')) {
        window.speakQueue(payload.new.Patient_ID, payload.new.Status.replace('Calling ', ''));
      }
    })
    .subscribe();
};

window.refreshPublicQueueDisplay = async function () {
  let today = window.getLocalStr(new Date());
  const todayRange = window.getLocalDayIsoBounds(today);
  const { data: visits, error } = await supabaseClient.from(dbTable('Visits'))
    .select('*')
    .gte('Date', todayRange.startIso)
    .lte('Date', todayRange.endIso)
    .order('Date', { ascending: true });

  if (error) return console.error('refreshPublicQueueDisplay error:', error);

  let opdWait = [];
  let triageWait = [];
  let callingNow = null;

  (visits || []).forEach(v => {
    if (v.Status === 'Waiting OPD' || v.Status === 'Calling OPD') opdWait.push(v);
    else if (v.Status === 'Triage' || v.Status === 'Calling Triage') triageWait.push(v);
    
    if (v.Status.startsWith('Calling')) callingNow = v;
  });

  // Update Calling Now Card
  if (callingNow) {
    $('#callingName').text(callingNow.Patient_Name);
    $('#callingDept').text(callingNow.Status.replace('Calling ', ''));
    $('#callingCard').addClass('animate__animated animate__pulse animate__infinite');
  } else {
    $('#callingName').text('...');
    $('#callingDept').text('ກະລຸນາລໍຖ້າ...');
    $('#callingCard').removeClass('animate__animated animate__pulse animate__infinite');
  }

  // Update OPD List
  let opdHtml = '';
  opdWait.forEach(v => {
    let isCalling = v.Status === 'Calling OPD';
    opdHtml += `
      <div class="queue-item ${isCalling ? 'calling' : ''}">
        <div>
          <div class="fw-bold fs-4">${v.Patient_Name}</div>
          <small class="opacity-50">${v.Patient_ID}</small>
        </div>
        <div class="text-end">
          <span class="badge ${isCalling ? 'bg-danger' : 'bg-info bg-opacity-20 text-info'} fs-5 px-3">
            ${isCalling ? 'ເອີ້ນແລ້ວ' : 'ລໍຖ້າກວດ'}
          </span>
        </div>
      </div>`;
  });
  $('#tvOpdList').html(opdHtml || '<p class="text-center opacity-30 mt-5">ບໍ່ມີຄິວລໍຖ້າ</p>');

  // Update Triage List
  let triageHtml = '';
  triageWait.forEach(v => {
    let isCalling = v.Status === 'Calling Triage';
    triageHtml += `
      <div class="queue-item ${isCalling ? 'calling' : ''}">
        <div>
          <div class="fw-bold fs-4">${v.Patient_Name}</div>
          <small class="opacity-50">${v.Patient_ID}</small>
        </div>
        <div class="text-end">
          <span class="badge ${isCalling ? 'bg-danger' : 'bg-danger bg-opacity-20 text-danger'} fs-5 px-3">
            ${isCalling ? 'ເອີ້ນແລ້ວ' : 'ລໍຖ້າວັດແທກ'}
          </span>
        </div>
      </div>`;
  });
  $('#tvTriageList').html(triageHtml || '<p class="text-center opacity-30 mt-5">ບໍ່ມີຄິວລໍຖ້າ</p>');
};

window.triggerPublicCall = async function (visitId, cn, dept) {
  console.log(`Calling Patient ID: ${cn} to ${dept}`);
  
  // Detemine internal status code
  let newStatus = 'Calling OPD';
  if (dept.includes('Triage')) newStatus = 'Calling Triage';
  else if (dept.includes('Lab')) newStatus = 'Calling Lab';
  
  try {
    // Set to Calling
    const { error } = await supabaseClient.from(dbTable('Visits')).update({ Status: newStatus }).eq('Visit_ID', visitId).eq('Patient_ID', cn);
    if (error) throw error;
    
    // Refresh local views immediately
    if (dept.includes('Triage')) window.loadTriageQueue(); else window.loadQueue();

    // 2. Local Speak
    window.speakQueue(cn, dept);

    Swal.fire({
      title: 'ກຳລັງເອີ້ນ...',
      text: 'ລະຫັດ: ' + cn,
      icon: 'info',
      timer: 2000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });

  } catch (err) {
    console.error('triggerPublicCall error:', err);
    Swal.fire('Error', 'ບໍ່ສາມາດເອີ້ນຄິວໄດ້', 'error');
  }
};

window.speakQueue = function (cn, dept) {
  if (!window.speechSynthesis) return;
  
  let voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    setTimeout(() => window.speakQueue(cn, dept), 100);
    return;
  }

  window.speechSynthesis.cancel();

  // 1. Voice Selection
  let localVoice = voices.find(v => (v.name.includes('Achara') || v.name.includes('Premwadee')) && v.name.includes('Natural'));
  if (!localVoice) localVoice = voices.find(v => v.name.toLowerCase().includes('lao') || v.lang.includes('lo'));
  if (!localVoice) localVoice = voices.find(v => v.lang.includes('lo') && v.name.toLowerCase().includes('female'));
  if (!localVoice) localVoice = voices.find(v => v.lang.includes('lo'));
  if (!localVoice) localVoice = voices.find(v => v.lang.includes('en') && v.name.toLowerCase().includes('female'));

  let enVoice = voices.find(v => (v.name.includes('Sonia') || v.name.includes('Jenny') || v.name.includes('Aria')) && v.name.includes('Natural'));
  if (!enVoice) enVoice = voices.find(v => v.lang.includes('en') && v.name.toLowerCase().includes('female'));
  if (!enVoice) enVoice = voices.find(v => v.lang.includes('en'));

  // 2. Prepare Texts
  let isThai = localVoice && localVoice.lang.includes('th');
  let cleanCN = (cn || '').toUpperCase();
  let cnParts = cleanCN.replace(/^(CN|LXH)/, '').split('');
  let cnSpaced = cnParts.join(' ');

  // Local Text
  let prefix = isThai ? 'ขอเชิญ หมายเลข ' : 'ຂໍເຊີນ ໝາຍເລກ ';
  let cnPrefix = 'L X H ';
  let suffix = isThai ? ' ที่ ' : ' ທີ່ ';

  let cleanDeptLocal = dept.replace('ຊັກປະຫວັດ (Triage)', isThai ? 'จุดคัดกรอง' : 'ຈຸດວັດແທກ').replace('ຫ້ອງກວດ (OPD)', isThai ? 'ห้องตรวจ' : 'ຫ້ອງກວດ');
  let localText = `${prefix}${cnPrefix}${cnSpaced}${suffix}${cleanDeptLocal}`;

  // English Text
  let enDept = dept.replace('ຊັກປະຫວັດ (Triage)', 'Triage Display').replace('ຫ້ອງກວດ (OPD)', 'Examination Room');
  let enText = `Attention please, number, L, X, H, ${cnSpaced}, at, ${enDept}`;

  // 3. Sequential Speaking
  let localMsg = new SpeechSynthesisUtterance(localText);
  localMsg.rate = 0.85;
  if (localVoice) {
    localMsg.voice = localVoice;
    localMsg.lang = localVoice.lang;
    localMsg.pitch = (localVoice.name.includes('Natural') || localVoice.name.includes('Google')) ? 1.05 : 1.25;
  }

  localMsg.onend = function() {
    let enMsg = new SpeechSynthesisUtterance(enText);
    enMsg.rate = 0.9;
    if (enVoice) {
      enMsg.voice = enVoice;
      enMsg.lang = enVoice.lang;
    }
    window.speechSynthesis.speak(enMsg);
  };

  window.speechSynthesis.speak(localMsg);
};

window.showPatientTimeline = async function (patientId) {
  if (!patientId) return;
  $('#patientTimelineModal').modal('show');
  $('#timelineContent').html('<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">ກຳລັງໂຫຼດປະຫວັດ...</p></div>');

  try {
    const { data: p } = await supabaseClient.from(dbTable('Patients')).select('*').eq('Patient_ID', patientId).single();
    if (p) {
        $('#timeline_p_name').text(`${p.First_Name} ${p.Last_Name}`);
        $('#timeline_p_id').text(p.Patient_ID);
        $('#timeline_p_info').text(`${p.Gender} | ${p.Age} ປີ | ${p.Province || '-'}`);
        if (p.Photo_URL) {
            $('#timeline_p_photo').attr('src', p.Photo_URL).show();
            $('#timeline_p_placeholder').hide();
        } else {
            $('#timeline_p_photo').hide();
            $('#timeline_p_placeholder').show();
        }
    }

    let visits = [];
    let startRange = 0;
    while (true) {
      const { data: chunk, error } = await supabaseClient.from(dbTable('Visits'))
        .select('*')
        .eq('Patient_ID', patientId)
        .order('Date', { ascending: false })
        .range(startRange, startRange + 999);
      if (error) break;
      if (!chunk || chunk.length === 0) break;
      visits = visits.concat(chunk);
      if (chunk.length < 1000) break;
      startRange += 1000;
      if (visits.length > 5000) break;
    }

    if (visits.length === 0) {
      $('#timelineContent').html('<div class="text-center py-5 text-muted"><i class="fas fa-folder-open fa-3x mb-3"></i><p>ບໍ່ພົບປະຫວັດການກວດ</p></div>');
      return;
    }

    let h = '';
    visits.forEach(v => {
      let d = new Date(v.Date);
      let dateStr = d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      
      let meds = [];
      try { if (v.Prescription_JSON) meds = JSON.parse(v.Prescription_JSON); } catch(e) {}
      
      let labs = [];
      try { if (v.Lab_Orders_JSON) labs = JSON.parse(v.Lab_Orders_JSON); } catch(e) {}

      let vitals = [];
      if (v.BP) vitals.push(`BP: ${v.BP}`);
      if (v.Temp) vitals.push(`T: ${v.Temp}°C`);
      if (v.Weight) vitals.push(`W: ${v.Weight}kg`);

      h += `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-date">${dateStr}</div>
            <div class="timeline-card">
                <div class="timeline-title">
                    <span><i class="fas fa-stethoscope text-primary me-2"></i>${v.Department || 'OPD'}</span>
                    <span class="badge ${(v.Status || '').includes('ສຳເລັດ') ? 'bg-success' : 'bg-warning'}">${v.Status}</span>
                </div>
                <div class="timeline-body">
                    ${v.Symptoms ? `<div class="mb-2"><b>CC:</b> ${v.Symptoms}</div>` : ''}
                    ${vitals.length > 0 ? `<div class="mb-2"><span class="timeline-tag timeline-tag-vitals"><i class="fas fa-heartbeat me-1"></i>${vitals.join(' | ')}</span></div>` : ''}
                    ${v.Diagnosis ? `<div class="mb-2"><span class="timeline-tag timeline-tag-dx"><i class="fas fa-user-md me-1"></i>Dx: ${v.Diagnosis}</span></div>` : ''}
                    
                    ${meds.length > 0 ? `
                        <div class="mt-2">
                            <div class="small fw-bold text-success mb-1"><i class="fas fa-pills me-1"></i>ລາຍການຢາ:</div>
                            <div class="d-flex flex-wrap gap-1">
                                ${meds.map(m => `<span class="timeline-tag timeline-tag-med">${m.name} (${m.qty} ${m.unit})</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${labs.length > 0 ? `
                        <div class="mt-2">
                            <div class="small fw-bold text-primary mb-1"><i class="fas fa-flask me-1"></i>ລາຍການ Lab:</div>
                            <div class="d-flex flex-wrap gap-1">
                                ${labs.map(l => `<span class="timeline-tag timeline-tag-lab">${l.name || l}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${v.Advice ? `<div class="mt-2 small text-muted font-italic"><b>Advice:</b> ${v.Advice}</div>` : ''}
                </div>
            </div>
        </div>`;
    });
    $('#timelineContent').html(h);
  } catch (err) {
    console.error("Timeline Error:", err);
    $('#timelineContent').html('<div class="text-center py-5 text-danger"><p>ຂໍ້ຜິດພາດໃນການໂຫຼດປະຫວັດ</p></div>');
  }
};
// ========================================================================
// BACKUP & RESTORE UI FUNCTIONS — Private admin UX with CF Functions proxy
// Token stays on Cloudflare server-side — never exposed to browser
// ========================================================================

// ============================================================
// Init backup view — load status & history on page show
// ============================================================
window.initBackupView = function () {
  if (!currentUser || currentUser.role !== 'admin') {
    Swal.fire('ເຂົ້າບໍ່ໄດ້', 'ທ່ານບໍ່ມີສິດເຂົ້າໃຊ້. ສຳຮອງຂໍ້ມູນສຳລັບ admin ເທົ່ານັ້ນ.', 'error');
    window.loadView('dashboard');
    return;
  }
  window.loadLatestBackupStatus();
  window.renderBackupHistory();
};

// ============================================================
// Run manual backup — calls /api/backup/run (Cloudflare Function)
// Fully in-page: loading spinner -> poll -> success/error alert
// NEVER redirects or opens GitHub — everything stays on dashboard
// ============================================================
let _backupPolling = false; // guard against double-clicks

window.runManualBackup = async function () {
  if (!currentUser || currentUser.role !== 'admin') return;
  if (_backupPolling) return; // prevent double-click
  _backupPolling = true;

  const btn = document.getElementById('btnBackupNow');
  btn.disabled = true;

  // Step 1: Get current latest run_id so we can detect a NEW run
  let knownRunId = null;
  try {
    const preResp = await fetch('/api/backup/status');
    if (preResp.status !== 404) {
      const preData = await preResp.json();
      knownRunId = preData.run_id || null;
    }
  } catch (e) { /* ignore — will poll from scratch */ }

  // Show persistent loading SweetAlert
  Swal.fire({
    icon: 'info',
    title: 'ກຳລັງ backup ຂໍ້ມູນ...',
    html: '<i class="fas fa-spinner fa-spin fa-2x mb-3"></i><br>' +
          '<span id="backupPollStatus">ກຳລັງເລີ່ມ workflow...</span><br>' +
          '<span id="backupPollTimer" class="text-muted small"></span>',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    // Step 2: Trigger the backup via API
    const resp = await fetch('/api/backup/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (resp.status === 404) {
      _closeLoadingAlert();
      Swal.fire({
        icon: 'warning',
        title: 'Backup API ບໍ່ພ້ອມ',
        html: 'Backup API ຈະໃຊ້ໄດ້ຫຼັງ deploy ໄປ Cloudflare Pages.<br>' +
              'ສຳລັບ local testing ໃຫ້ຮັນ:<br>' +
              '<code class="small">npm run build && npm run pages:dev</code>',
        confirmButtonText: 'ເຂົ້າໃຈແລ້ວ'
      });
      return;
    }

    const data = await resp.json();
    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    document.getElementById('backupPollStatus').textContent = 'Workflow ຖືກ trigger ແລ້ວ — ກຳລັງລໍຖ້າ...';

    // Step 3: Poll /api/backup/status every 10s until new run completes
    await _pollForNewBackup(knownRunId);

  } catch (err) {
    console.error('Backup trigger failed:', err);
    _closeLoadingAlert();
    const detail = String(err.message || '');
    Swal.fire({
      icon: 'error',
      title: 'Backup ລົ້ມເຫຼວ',
      html: 'ບໍ່ສາມາດເລີ່ມ backup ໄດ້<br><code class="small">' + detail + '</code>',
      confirmButtonText: 'ຕົກລົງ'
    });
  } finally {
    btn.disabled = false;
    _backupPolling = false;
    window.loadLatestBackupStatus();
    window.renderBackupHistory();
  }
};

// Close the persistent loading SweetAlert (if still open)
function _closeLoadingAlert() {
  // Only close if it's our loading alert (has no confirm button)
  if (Swal.isVisible() && !(Swal.getActions() && Swal.getActions().querySelector('.swal2-confirm'))) {
    Swal.close();
  }
}

// Poll /api/backup/status every 10s. Waits for a NEW run to appear
// (run_id different from knownRunId), then waits for that run to finish.
// Max wait = 5 minutes.
async function _pollForNewBackup(knownRunId) {
  const maxWait = 300000;   // 5 min total
  const pollInterval = 10000; // 10s between polls
  let waited = 0;
  let newRunFound = false;

  while (waited < maxWait) {
    try {
      const resp = await fetch('/api/backup/status');
      if (resp.status === 200) {
        const data = await resp.json();
        const currentRunId = data.run_id;

        // Skip if we haven't seen a new run yet
        if (!newRunFound && (!currentRunId || currentRunId === knownRunId)) {
          // Still waiting for GitHub to pick up the dispatch
          const elapsedSec = Math.round(waited / 1000);
          document.getElementById('backupPollStatus').textContent = 'ກຳລັງເລີ່ມ workflow...';
          document.getElementById('backupPollTimer').textContent = elapsedSec + ' ວິນາທີ';
        } else {
          // A new run exists — check if it is done
          newRunFound = true;
          const conclusion = data.conclusion || data.status;
          const elapsedSec = Math.round(waited / 1000);

          if (conclusion === 'success') {
            _closeLoadingAlert();
            window.addBackupHistoryEntry({
              run_id: currentRunId,
              date: data.updated_at,
              filename: 'backup-' + (data.updated_at || new Date().toISOString()).substring(0, 10) + '-manual.zip',
              status: 'success',
            });
            Swal.fire({
              icon: 'success',
              title: 'Backup ສຳເລັດ',
              html: 'ຂໍ້ມູນຖືກ backup ໄປ Supabase Storage ສຳເລັດ<br>' +
                    '<small class="text-muted">' +
                    (data.run_number ? 'Run #' + data.run_number + ' &middot; ' : '') +
                    (data.duration ? data.duration + ' ວິນາທີ' : '') + '</small>',
              confirmButtonText: 'ຕົກລົງ'
            });
            return;
          }

          if (conclusion === 'failure') {
            _closeLoadingAlert();
            window.addBackupHistoryEntry({
              run_id: currentRunId,
              date: data.updated_at,
              filename: 'backup-' + (data.updated_at || new Date().toISOString()).substring(0, 10) + '-manual.zip',
              status: 'failure',
              error: data.error || 'Workflow failed',
            });
            Swal.fire({
              icon: 'error',
              title: 'Backup ບໍ່ສຳເລັດ',
              html: 'Workflow ລົ້ມເຫຼວ<br>' +
                    '<code class="small">' + (data.error || 'Unknown error') + '</code>',
              confirmButtonText: 'ຕົກລົງ'
            });
            return;
          }

          // Still in_progress / queued — update loading alert
          document.getElementById('backupPollStatus').textContent = 'Workflow ກຳລັງຮັນ... (Run #' + (data.run_number || '?') + ')';
          document.getElementById('backupPollTimer').textContent = elapsedSec + ' ວິນາທີ';
        }
      }
    } catch (e) {
      console.warn('Poll error (ignored):', e);
    }

    await new Promise(r => setTimeout(r, pollInterval));
    waited += pollInterval;
  }

  // Timeout — show warning but stay on page
  _closeLoadingAlert();
  Swal.fire({
    icon: 'warning',
    title: 'ໃຊ້ເວລາດົນ',
    html: 'Backup ຍັງຄົງຮັນຢູ່.<br>' +
          'ລະບົບຈະອັບເດດສະຖານະອັດຕະໂນມັດເມື່ອ backup ສຳເລັດ.',
    confirmButtonText: 'ຕົກລົງ'
  });
}

// ============================================================
// Load latest backup status from /api/backup/status
// ============================================================
window.loadLatestBackupStatus = async function () {
  try {
    const resp = await fetch('/api/backup/status');
    // In local dev, API returns 404 — just skip
    if (resp.status === 404) return;
    const data = await resp.json();

    const actualStatus = data.conclusion || data.status;

    if (!actualStatus || actualStatus === 'none' || actualStatus === 'error') {
      $('#latestBackupInfo').html(
        '<div class="text-center py-4 text-muted">' +
        '<i class="fas fa-database fa-3x mb-2 d-block"></i>' +
        '<p class="mb-0">ຍັງບໍ່ມີການ backup. ກົດ <strong>Backup Now</strong> ເພື່ອເລີ່ມ.</p></div>'
      );
      return;
    }

    const statusIcon = actualStatus === 'success'
      ? '<i class="fas fa-check-circle text-success fa-2x me-3"></i>'
      : actualStatus === 'failure'
        ? '<i class="fas fa-times-circle text-danger fa-2x me-3"></i>'
        : '<i class="fas fa-spinner fa-spin text-warning fa-2x me-3"></i>';
    const badgeColor = actualStatus === 'success' ? 'bg-success' :
                       actualStatus === 'failure' ? 'bg-danger' : 'bg-warning';

    const timeStr = data.updated_at ? new Date(data.updated_at).toLocaleString('lo-LA') : '-';

    $('#latestBackupInfo').html(
      '<div class="p-3">' +
        '<div class="d-flex align-items-center">' +
          statusIcon +
          '<div>' +
            '<h5 class="mb-0">Backup ລ່າສຸດ: <span class="badge ' + badgeColor + '">' + actualStatus + '</span></h5>' +
            '<small class="text-muted">' + timeStr +
            (data.run_number ? ' — Run #' + data.run_number : '') +
            (data.duration ? ' &middot; ' + data.duration + 's' : '') +
            '</small>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  } catch (err) {
    console.warn('Failed to load backup status:', err);
  }
};

// ============================================================
// Backup history — stored in localStorage for client-side cache
// ============================================================
const BACKUP_HISTORY_KEY = 'his_backup_history';

window.getBackupHistory = function () {
  try { return JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || '[]'); }
  catch { return []; }
};

window.addBackupHistoryEntry = function (entry) {
  const history = window.getBackupHistory();
  history.unshift({
    id: entry.run_id || Date.now().toString(),
    date: entry.date || new Date().toISOString(),
    filename: entry.filename || '',
    size: entry.size || '-',
    status: entry.status || 'running',
    destination: entry.destination || 'Supabase Storage',
    error: entry.error || null
  });
  if (history.length > 50) history.length = 50;
  localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(history));
};

window.renderBackupHistory = async function () {
  try {
    const resp = await fetch('/api/backup/status');
    // In local dev, API returns 404 — skip API part, show localStorage history
    if (resp.status === 404) {
      window._renderBackupHistoryTable(window.getBackupHistory());
      return;
    }
    const data = await resp.json();

    if (data.run_id) {
      const history = window.getBackupHistory();
      const existing = history.find(function (e) { return e.id === data.run_id; });
      if (existing) {
        existing.status = data.conclusion || data.status;
        existing.error = data.error || null;
        existing.date = data.updated_at || existing.date;
      } else {
        const dateStr = data.updated_at || data.created_at || new Date().toISOString();
        window.addBackupHistoryEntry({
          run_id: data.run_id,
          date: dateStr,
          filename: 'backup-' + dateStr.substring(0, 10) + (data.trigger === 'workflow_dispatch' ? '-manual' : '') + '.zip',
          status: data.conclusion || data.status,
          error: data.error
        });
      }
    }
  } catch (err) {
    console.warn('Failed to fetch status for history:', err);
  }

  // Fetch complete — render whatever history we have
  window._renderBackupHistoryTable(window.getBackupHistory());
};

// ============================================================
// Reusable backup history table renderer — called with or without API data
// ============================================================
window._renderBackupHistoryTable = function (history) {
  if (!history || history.length === 0) {
    $('#backupHistoryBody').html('<tr><td colspan="6" class="text-center py-4 text-muted">' +
      '<i class="fas fa-inbox me-2"></i>ຍັງບໍ່ມີປະຫວັດ backup</td></tr>'
    );
    return;
  }

  var html = '';
  history.forEach(function (entry) {
    var statusBadge = entry.status === 'success'
      ? '<span class="badge bg-success">Success</span>'
      : entry.status === 'failure' ? '<span class="badge bg-danger">Failed</span>'
        : '<span class="badge bg-warning">Running</span>';

    var dateStr = entry.date
      ? new Date(entry.date).toLocaleString('lo-LA', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        }) : '-';

    var errorCell = entry.error
      ? '<span class="text-danger text-truncate d-inline-block" style="max-width:180px;">' + entry.error + '</span>' : '-';

    html += '<tr>' +
      '<td class="text-nowrap">' + dateStr + '</td>' +
      '<td><code class="small">' + entry.filename + '</code></td>' +
      '<td>' + entry.size + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td><small>' + entry.destination + '</small></td>' +
      '<td>' + errorCell + '</td>' +
      '</tr>';
  });

  $('#backupHistoryBody').html(html);
};

// ============================================================
// Show backup logs
// ============================================================
window.showBackupLogs = function () {
  Swal.fire({
    icon: 'info',
    title: 'Backup Logs',
    html: '<p class="text-start">Backup status ຖືກສະແດງຢູ່ໜ້ານີ້.<br>' +
          'Workflow ဖຳລັງຮັນ ຫຼື ສຳເລັດ — ກະລຸນາເບິ່ງສະຖານະຢູ່ດ້ານເທິງ.<br>' +
          'ລະບົບຈະອັບເດດອັດຕະໂນມັດ ທຸກ 10 ວິນາທີ.</p>',
    confirmButtonText: 'ຕົກລົງ'
  });
};

// ============================================================
// Show restore guide
// ============================================================
window.showRestoreGuide = function () {
  Swal.fire({
    icon: 'info',
    title: '<i class="fas fa-book me-2"></i>ວິທີ Restore ຈາກ Backup',
    html: '<div class="text-start" style="font-size:14px;max-height:500px;overflow-y:auto;">' +
      '<p><strong>ຂັ້ນຕອນ Restore:</strong></p>' +
      '<ol>' +
        '<li>ດາວໂຫຼດ backup ZIP ຈາກ Supabase Storage bucket</li>' +
        '<li>Extract ໄດ້ <code>csv/</code> ໂຟເດີ</li>' +
        '<li><strong>Restore CSV:</strong> ດາວໂຫຼດແຕ່ລະ CSV ແລ້ວ import ເຂົ້າ Supabase</li>' +
      '</ol>' +
      '<p class="text-danger mt-2"><i class="fas fa-exclamation-triangle me-1"></i><strong>ເຕືອນ:</strong> ກວດສອບ backup ກ່ອນ restore ສະເໝີ.</p>' +
      '<p class="small text-muted mt-2">ເບິ່ງຄູ່ມືເຕັມ: <code>docs/BACKUP_PRODUCTION.md</code></p>' +
      '</div>',
    width: 600,
    confirmButtonText: 'ຕົກລົງ'
  });
};

// ============================================================
// IPD Ward / Bed Management
// ============================================================
window.ipdWardBedState = {
  wards: [],
  rooms: [],
  beds: [],
  movements: [],
  admissions: [],
  patientsById: {},
  filteredBeds: [],
  filteredAdmissions: [],
  bedViewMode: 'detail'
};

window.ipdEscape = function (value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

window.ipdId = function (prefix) {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
};

window.ipdNormalizeStatus = function (value) {
  const raw = String(value || 'Available').trim();
  const lower = raw.toLowerCase();
  if (lower === 'occupied') return 'Occupied';
  if (lower === 'reserved') return 'Reserved';
  if (lower === 'cleaning') return 'Cleaning';
  if (lower === 'maintenance') return 'Maintenance';
  if (lower === 'inactive') return 'Inactive';
  if (lower === 'active') return 'Available';
  if (lower === 'available') return 'Available';
  return raw || 'Available';
};

window.ipdBedStatus = function (bed) {
  return window.ipdNormalizeStatus(bed?.Bed_Status || bed?.Status || 'Available');
};

window.ipdStatusBadge = function (status) {
  const normalized = window.ipdNormalizeStatus(status);
  return `<span class="ipd-status-badge ipd-status-${normalized.toLowerCase()}">${window.ipdEscape(window.ipdTranslateValue(normalized))}</span>`;
};

window.ipdWardById = function (wardId) {
  return window.ipdWardBedState.wards.find(w => String(w.Ward_ID) === String(wardId)) || null;
};

window.ipdRoomById = function (roomId) {
  return window.ipdWardBedState.rooms.find(r => String(r.Room_ID) === String(roomId)) || null;
};

window.ipdBedById = function (bedId) {
  return window.ipdWardBedState.beds.find(b => String(b.Bed_ID) === String(bedId)) || null;
};

window.ipdIsVipWard = function (ward) {
  return String(ward?.Ward_Type || '').toUpperCase() === 'VIP' || /vip/i.test(String(ward?.Ward_Name || ''));
};

window.ipdIsObsWard = function (ward) {
  const t = String(ward?.Ward_Type || '').toUpperCase();
  return t === 'OPD_OBSERVATION' || t === 'OPD_OBS' || /\bobservation\b/i.test(String(ward?.Ward_Name || ''));
};

window.ipdIsActiveAdmission = function (admission) {
  if (!admission) return false;
  const dischargeDate = String(admission?.Discharge_Date || '').trim();
  const status = String(admission?.Status || '').trim().toLowerCase();
  // Active = no discharge date AND status is not explicitly a closed state.
  // Anything else (including blank, "Admitted", "pending", custom labels) counts as active.
  const closedStatuses = ['discharged', 'discharge', 'closed', 'cancelled', 'canceled', 'transferred out'];
  return !dischargeDate && !closedStatuses.includes(status);
};

window.ipdAdmissionForBed = function (bed) {
  const bedAdmissionId = bed?.Current_IPD_Admission_ID || bed?.current_ipd_admission_id;
  if (bedAdmissionId) {
    const byId = window.ipdWardBedState.admissions.find(a => String(a.Admission_ID) === String(bedAdmissionId));
    if (byId) return byId;
  }
  return window.ipdWardBedState.admissions.find(a =>
    window.ipdIsActiveAdmission(a) &&
    String(a.Ward_ID || '') === String(bed?.Ward_ID || '') &&
    String(a.Room_ID || '') === String(bed?.Room_ID || '') &&
    String(a.Bed_ID || '') === String(bed?.Bed_ID || '')
  ) || null;
};

window.ipdDoctorName = function (admission) {
  return admission?.Admitting_Doctor || admission?.Attending_Doctor || admission?.Doctor_Name || admission?.Doctor || admission?.Physician || '';
};

window.ipdPatientName = function (admission) {
  const patientId = admission?.Patient_ID || '';
  const patient = patientId ? window.ipdWardBedState.patientsById[patientId] : null;
  return admission?.Patient_Name || [patient?.First_Name, patient?.Last_Name].filter(Boolean).join(' ') || patientId || '';
};

window.ipdBedForAdmission = function (admission) {
  if (!admission) return null;
  if (admission.Bed_ID) {
    const assignedBed = window.ipdBedById(admission.Bed_ID);
    if (assignedBed) return assignedBed;
  }
  return window.ipdWardBedState.beds.find(b =>
    String(b.Current_IPD_Admission_ID || b.current_ipd_admission_id || '') === String(admission.Admission_ID || '')
  ) || null;
};

window.ipdAdmissionLocation = function (admission) {
  const linkedBed = window.ipdBedForAdmission(admission);
  const ward = window.ipdWardById(admission?.Ward_ID || linkedBed?.Ward_ID);
  const room = window.ipdRoomById(admission?.Room_ID || linkedBed?.Room_ID);
  const bed = linkedBed || window.ipdBedById(admission?.Bed_ID);
  return {
    ward,
    room,
    bed,
    label: [ward?.Ward_Name, room?.Room_Number, bed?.Bed_Number].filter(Boolean).join(' / ') || '-',
    status: bed ? window.ipdBedStatus(bed) : ''
  };
};

window.ipdBedPatientInfo = function (bed) {
  const admission = window.ipdAdmissionForBed(bed);
  const patientId = bed?.Current_Patient_ID || bed?.current_patient_id || admission?.Patient_ID || '';
  const patient = patientId ? window.ipdWardBedState.patientsById[patientId] : null;
  const patientName = bed?.Current_Patient_Name || window.ipdPatientName(admission) ||
    [patient?.First_Name, patient?.Last_Name].filter(Boolean).join(' ');
  return {
    admission,
    patientId,
    patientName: patientName || '',
    hn: bed?.Current_Patient_HN || bed?.current_patient_hn || admission?.Patient_ID || patientId || '',
    ipdNo: bed?.Current_IPD_Admission_ID || admission?.Admission_ID || '',
    doctor: window.ipdDoctorName(admission),
    admitAt: [admission?.Admission_Date, admission?.Admission_Time].filter(Boolean).join(' '),
    diagnosis: admission?.Diagnosis_Admission || admission?.Diagnosis || admission?.Provisional_Diagnosis || '',
    paymentType: admission?.Payment_Type || admission?.Payment_Method || admission?.Payment || admission?.Insurance_Type || admission?.Payer_Type || ''
  };
};

window.ipdReservationInfo = function (bed) {
  const patientId = bed?.Reserved_Patient_ID || bed?.reserved_patient_id || bed?.Reserved_Patient_HN || bed?.reserved_patient_hn || '';
  const patient = patientId ? window.ipdWardBedState.patientsById[patientId] : null;
  const patientName = bed?.Reserved_Patient_Name || bed?.reserved_patient_name ||
    [patient?.First_Name, patient?.Last_Name].filter(Boolean).join(' ');
  return {
    patientId,
    hn: bed?.Reserved_Patient_HN || bed?.reserved_patient_hn || patientId || '',
    patientName: patientName || '',
    phone: bed?.Reserved_Phone || bed?.reserved_phone || '',
    reservedBy: bed?.Reserved_By || bed?.reserved_by || '',
    reservedAt: bed?.Reserved_At || bed?.reserved_at || '',
    reservedFrom: bed?.Reserved_From || bed?.reserved_from || '',
    reservedUntil: bed?.Reserved_Until || bed?.reserved_until || '',
    reason: bed?.Reservation_Reason || bed?.reservation_reason || '',
    notes: bed?.Reservation_Notes || bed?.reservation_notes || ''
  };
};

window.ipdHasActiveAdmissionForBed = function (bed) {
  const admission = window.ipdAdmissionForBed(bed);
  return !!(admission && window.ipdIsActiveAdmission(admission));
};

window.ipdBedActionItems = function (bed, status, info) {
  const bedId = window.ipdEscape(bed.Bed_ID);
  const editItem = { className: 'btn-outline-primary btn-ipd-config-edit', labelKey: 'ipd.editBed', action: `window.openIpdBedModal('${bedId}')`, icon: 'fas fa-edit' };
  const deleteItem = { className: 'btn-outline-danger btn-ipd-config-delete', labelKey: 'ipd.deleteBed', action: `window.deleteIpdBed('${bedId}')`, icon: 'fas fa-trash' };

  if (status === 'Available') {
    return [
      { className: 'btn-outline-success btn-ipd-admit', labelKey: 'ipd.assignPatient', action: `window.openIpdAssignModal('${bedId}')`, icon: 'fas fa-user-plus' },
      { className: 'btn-outline-primary btn-ipd-admit', labelKey: 'ipd.reserve', action: `window.openIpdReserveModal('${bedId}')`, icon: 'fas fa-bookmark' },
      { className: 'btn-outline-secondary btn-ipd-config-edit', labelKey: 'ipd.maintenance', action: `window.changeIpdBedStatus('${bedId}','Maintenance')`, icon: 'fas fa-tools' },
      editItem,
      deleteItem
    ];
  }

  if (status === 'Reserved') {
    return [
      { className: 'btn-outline-success btn-ipd-admit', labelKey: 'ipd.assignPatient', action: `window.openIpdAssignModal('${bedId}')`, icon: 'fas fa-user-plus' },
      { className: 'btn-outline-primary btn-ipd-admit', labelKey: 'ipd.editReservation', action: `window.openIpdReserveModal('${bedId}')`, icon: 'fas fa-edit' },
      { className: 'btn-outline-danger btn-ipd-admit', labelKey: 'ipd.cancelReservation', action: `window.changeIpdBedStatus('${bedId}','Available')`, icon: 'fas fa-times' },
      { className: 'btn-outline-secondary btn-ipd-config-edit', labelKey: 'ipd.maintenance', action: `window.changeIpdBedStatus('${bedId}','Maintenance')`, icon: 'fas fa-tools' },
      editItem
    ];
  }

  if (status === 'Occupied') {
    return [
      { className: 'btn-outline-dark', labelKey: 'ipd.viewIpdChart', action: `window.viewIpdChart('${window.ipdEscape(info.ipdNo)}')`, icon: 'fas fa-file-medical' },
      { className: 'btn-outline-primary btn-ipd-transfer', labelKey: 'ipd.transferBed', action: `window.openIpdTransferModal('${bedId}')`, icon: 'fas fa-exchange-alt' },
      { className: 'btn-outline-warning btn-ipd-discharge', labelKey: 'ipd.dischargeReleaseBed', action: `window.changeIpdBedStatus('${bedId}','Cleaning')`, icon: 'fas fa-sign-out-alt' },
      editItem
    ];
  }

  if (status === 'Cleaning') {
    return [
      { className: 'btn-outline-success btn-ipd-config-edit', labelKey: 'ipd.markAvailable', action: `window.changeIpdBedStatus('${bedId}','Available')`, icon: 'fas fa-check' },
      { className: 'btn-outline-secondary btn-ipd-config-edit', labelKey: 'ipd.maintenance', action: `window.changeIpdBedStatus('${bedId}','Maintenance')`, icon: 'fas fa-tools' },
      editItem,
      deleteItem
    ];
  }

  if (status === 'Maintenance') {
    return [
      { className: 'btn-outline-success btn-ipd-config-edit', labelKey: 'ipd.markAvailable', action: `window.changeIpdBedStatus('${bedId}','Available')`, icon: 'fas fa-check' },
      editItem,
      deleteItem
    ];
  }

  return [editItem, deleteItem];
};

window.ipdBedActionButtons = function (bed, status, info) {
  const items = window.ipdBedActionItems(bed, status, info);
  if (!items.length) return '';
  const statusColor = {
    Available:   'btn-success',
    Occupied:    'btn-dark',
    Reserved:    'btn-primary',
    Cleaning:    'btn-warning',
    Maintenance: 'btn-secondary',
    Inactive:    'btn-secondary'
  }[status] || 'btn-primary';
  const menuId = `ipdBedMenu${String(bed.Bed_ID).replace(/[^a-zA-Z0-9]/g, '')}`;
  return `<div class="ipd-bed-actions-row">
    <div class="dropdown ipd-bed-action-wrap">
      <button class="btn btn-sm ${statusColor} ipd-bed-action-trigger" id="${menuId}" data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-auto-close="true" aria-expanded="false">
        <i class="fas fa-bolt me-1"></i>${window.ipdEscape(window.t('common.action'))}
        <i class="fas fa-caret-down ms-1"></i>
      </button>
      <ul class="dropdown-menu dropdown-menu-end ipd-bed-action-menu" aria-labelledby="${menuId}">
        ${items.map(item => `<li><button class="dropdown-item ${(item.className || '').replace('btn-outline-', 'text-')}" onclick="${item.action}">
          ${item.icon ? `<i class="${item.icon} me-2"></i>` : ''}${window.ipdEscape(window.t(item.labelKey))}
        </button></li>`).join('')}
      </ul>
    </div>
  </div>`;
};

window.ipdBedActionMenu = function (bed, status, info) {
  const items = window.ipdBedActionItems(bed, status, info);
  if (!items.length) return '';
  const menuId = `ipdBedActions${window.ipdEscape(String(bed.Bed_ID).replace(/[^a-zA-Z0-9]/g, ''))}`;
  return `<div class="dropdown ipd-bed-action-menu" onclick="event.stopPropagation()">
    <button class="btn btn-sm btn-light border" id="${menuId}" data-bs-toggle="dropdown" aria-expanded="false" title="${window.ipdEscape(window.t('common.action'))}">
      <i class="fas fa-ellipsis-h"></i>
    </button>
    <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="${menuId}">
      ${items.map(item => `<li><button class="dropdown-item" onclick="${item.action}">${item.icon ? `<i class="${item.icon} me-2"></i>` : ''}${window.ipdEscape(window.t(item.labelKey))}</button></li>`).join('')}
    </ul>
  </div>`;
};

window.ipdFormatDateTime = function (value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return window.ipdEscape(value);
  return d.toLocaleString('lo-LA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

window.ipdLengthOfStayDays = function (admission) {
  if (!admission?.Admission_Date) return 0;
  const started = new Date(`${admission.Admission_Date}T${admission.Admission_Time || '00:00:00'}`);
  if (Number.isNaN(started.getTime())) return 0;
  return Math.max(1, Math.ceil((Date.now() - started.getTime()) / 86400000));
};

window.ipdLengthOfStay = function (admission) {
  if (!admission?.Admission_Date) return '-';
  const started = new Date(`${admission.Admission_Date}T${admission.Admission_Time || '00:00:00'}`);
  if (Number.isNaN(started.getTime())) return '-';
  const days = Math.max(1, Math.ceil((Date.now() - started.getTime()) / 86400000));
  return window.getAppLanguage() === 'lo' ? `${days} ມື້` : `${days} day${days > 1 ? 's' : ''}`;
};

window.ipdNeedsMigration = function (error) {
  if (!error) return false;
  const msg = String(error.message || error.details || '').toLowerCase();
  return msg.includes('column') || msg.includes('schema cache') || msg.includes('does not exist');
};

window.ipdMutate = async function (tableName, method, payload, match, fallbackPayload) {
  let query = supabaseClient.from(dbTable(tableName));
  let result;
  if (method === 'insert') result = await query.insert([payload]);
  if (method === 'update') {
    result = query.update(payload);
    Object.entries(match || {}).forEach(([key, val]) => { result = result.eq(key, val); });
    result = await result;
  }

  if (result?.error && fallbackPayload && window.ipdNeedsMigration(result.error)) {
    let fallback = supabaseClient.from(dbTable(tableName));
    if (method === 'insert') return await fallback.insert([fallbackPayload]);
    fallback = fallback.update(fallbackPayload);
    Object.entries(match || {}).forEach(([key, val]) => { fallback = fallback.eq(key, val); });
    return await fallback;
  }

  return result;
};

window.fetchLatestOpdVitalForPatient = async function (patientId) {
  if (!patientId) return null;
  const { data, error } = await supabaseClient
    .from(dbTable('OPD_Vital_Signs'))
    .select('*')
    .eq('Patient_ID', patientId)
    .order('Recorded_At', { ascending: false })
    .limit(1);

  if (!error && data?.[0]) return data[0];
  if (error && !window.ipdNeedsMigration(error)) console.warn('OPD vital signs load error:', error);

  const fallback = await supabaseClient
    .from(dbTable('Visits'))
    .select('Visit_ID,Date,Patient_ID,BP,Temp,Pulse,SpO2,Weight,Height,BMI,Symptoms')
    .eq('Patient_ID', patientId)
    .order('Date', { ascending: false })
    .limit(1);
  if (fallback.error || !fallback.data?.[0]) return null;
  const visit = fallback.data[0];
  const bp = window.ipdParseBloodPressure(visit.BP);
  return {
    Visit_ID: visit.Visit_ID,
    Patient_ID: visit.Patient_ID,
    Recorded_At: visit.Date,
    Temperature: visit.Temp,
    BP_Systolic: bp.systolic,
    BP_Diastolic: bp.diastolic,
    Pulse: visit.Pulse,
    Respiration: null,
    SpO2: visit.SpO2,
    Weight: visit.Weight,
    Height: visit.Height,
    BMI: visit.BMI || window.ipdCalculateBmiValue(visit.Weight, visit.Height),
    Pain_Score: null,
    Symptoms: visit.Symptoms,
    Notes: visit.Symptoms,
    Recorded_By: null
  };
};

window.copyLatestOpdVitalsToIpdAdmission = async function (admissionId, patientId) {
  if (!admissionId || !patientId) return null;
  const latest = await window.fetchLatestOpdVitalForPatient(patientId);
  if (!latest) return null;

  const existing = await supabaseClient
    .from(dbTable('IPD_Vital_Signs'))
    .select('Vital_ID')
    .eq('Admission_ID', admissionId)
    .eq('Is_Initial_Assessment', true)
    .limit(1);
  if (!existing.error && existing.data?.length) return existing.data[0];

  const payload = {
    Vital_ID: window.ipdId('VS'),
    Admission_ID: admissionId,
    Recorded_At: latest.Recorded_At || new Date().toISOString(),
    Temperature: latest.Temperature || null,
    BP_Systolic: latest.BP_Systolic || null,
    BP_Diastolic: latest.BP_Diastolic || null,
    Pulse: latest.Pulse || null,
    Respiration: latest.Respiration || null,
    SpO2: latest.SpO2 || null,
    Weight: latest.Weight || null,
    Height: latest.Height || null,
    BMI: latest.BMI || window.ipdCalculateBmiValue(latest.Weight, latest.Height),
    Pain_Score: latest.Pain_Score || null,
    Notes: latest.Notes || latest.Symptoms || 'Initial assessment copied from OPD triage.',
    Recorded_By: latest.Recorded_By || window.ipdCurrentUserName(),
    Source_Visit_ID: latest.Visit_ID || null,
    Source_Vital_ID: latest.Vital_ID || null,
    Source_Type: 'OPD Initial Assessment',
    Is_Initial_Assessment: true,
    Created_By: window.ipdCurrentUserName(),
    Created_At: new Date().toISOString(),
    Updated_At: new Date().toISOString()
  };

  const insertRes = await supabaseClient.from(dbTable('IPD_Vital_Signs')).insert([payload]);
  if (insertRes.error) {
    if (window.ipdNeedsMigration(insertRes.error)) console.warn('IPD vital signs initial assessment not saved. Apply clinical migration.', insertRes.error);
    else console.warn('Initial IPD vital signs copy failed:', insertRes.error);
    return null;
  }

  const admissionPatch = {
    Source_Visit_ID: latest.Visit_ID || null,
    Admission_Source: latest.Visit_ID ? 'OPD' : null,
    Initial_Assessment_Copied_At: new Date().toISOString(),
    Updated_At: new Date().toISOString()
  };
  const admissionRes = await window.ipdMutate('Admissions', 'update', admissionPatch, { Admission_ID: admissionId }, { Updated_At: new Date().toISOString() });
  if (admissionRes.error && !window.ipdNeedsMigration(admissionRes.error)) console.warn('Admission source visit update failed:', admissionRes.error);
  return payload;
};

window.fetchIpdWardBedData = async function () {
  const state = window.ipdWardBedState;
  const [wardsRes, roomsRes, bedsRes, admissionsRes, patientsRes, movementsRes] = await Promise.all([
    supabaseClient.from(dbTable('Wards')).select('*').order('Ward_Name', { ascending: true }),
    supabaseClient.from(dbTable('Rooms')).select('*').order('Room_Number', { ascending: true }),
    supabaseClient.from(dbTable('Beds')).select('*').order('Bed_Number', { ascending: true }),
    supabaseClient.from(dbTable('Admissions')).select('*').order('Created_At', { ascending: false }),
    supabaseClient.from(dbTable('Patients')).select('*').limit(1000),
    supabaseClient.from(dbTable('Bed_Movements')).select('*').order('Movement_Datetime', { ascending: false }).limit(300)
  ]);

  if (wardsRes.error) throw wardsRes.error;
  if (roomsRes.error) throw roomsRes.error;
  if (bedsRes.error) throw bedsRes.error;
  if (admissionsRes.error) console.warn('Admissions load error:', admissionsRes.error);
  if (patientsRes.error) console.warn('Patients load error:', patientsRes.error);
  if (movementsRes.error) console.warn('Bed movements load error:', movementsRes.error);

  state.wards = wardsRes.data || [];
  state.rooms = roomsRes.data || [];
  state.beds = bedsRes.data || [];
  state.admissions = admissionsRes.data || [];
  state.movements = movementsRes.error ? [] : (movementsRes.data || []);
  state.patientsById = {};
  (patientsRes.data || []).forEach(p => { state.patientsById[p.Patient_ID] = p; });
  return state;
};

window.loadIpdWardBedManagement = async function () {
  $('#ipdBedBoard').html(`<div class="text-center py-5"><div class="spinner-border text-primary"></div><div class="text-muted mt-2">${window.ipdEscape(window.t('ipd.loadingData'))}</div></div>`);

  try {
    await window.fetchIpdWardBedData();
    window.populateIpdWardBedFilters();
    window.applyIpdWardBedFilters();
  } catch (err) {
    console.error('IPD load error:', err);
    $('#ipdBedBoard').html(`<div class="alert alert-danger">${window.ipdEscape(window.t('ipd.unableLoadData'))}: ${window.ipdEscape(err.message || err)}</div>`);
  }
};

window.populateIpdWardBedFilters = function () {
  const state = window.ipdWardBedState;
  const selectedWard = $('#ipdFilterWard').val() || '';
  const selectedRoom = $('#ipdFilterRoom').val() || '';
  const selectedDoctor = $('#ipdFilterDoctor').val() || '';

  let wardOptions = `<option value="">${window.t('ipd.allWards')}</option>`;
  state.wards.forEach(w => {
    wardOptions += `<option value="${window.ipdEscape(w.Ward_ID)}">${window.ipdEscape(w.Ward_Name || w.Ward_ID)}</option>`;
  });
  $('#ipdFilterWard').html(wardOptions).val(selectedWard);

  let roomOptions = `<option value="">${window.t('ipd.allRooms')}</option>`;
  state.rooms
    .filter(r => !selectedWard || String(r.Ward_ID) === String(selectedWard))
    .forEach(r => {
      const ward = window.ipdWardById(r.Ward_ID);
      roomOptions += `<option value="${window.ipdEscape(r.Room_ID)}">${window.ipdEscape(r.Room_Number || r.Room_ID)}${ward ? ' - ' + window.ipdEscape(ward.Ward_Name) : ''}</option>`;
    });
  $('#ipdFilterRoom').html(roomOptions).val(selectedRoom);

  const doctorNames = [...new Set(state.admissions
    .filter(a => window.ipdIsActiveAdmission(a))
    .map(a => window.ipdDoctorName(a))
    .filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  let doctorOptions = `<option value="">${window.t('ipd.allDoctors')}</option>`;
  doctorNames.forEach(name => {
    doctorOptions += `<option value="${window.ipdEscape(name)}">${window.ipdEscape(name)}</option>`;
  });
  $('#ipdFilterDoctor').html(doctorOptions).val(selectedDoctor);
};

window.resetIpdWardBedFilters = function () {
  $('#ipdFilterWard, #ipdFilterRoom, #ipdFilterStatus, #ipdFilterBedType, #ipdFilterDoctor').val('');
  $('#ipdFilterSearch').val('');
  window.applyIpdWardBedFilters();
};

window.setIpdBedViewMode = function (mode) {
  const nextMode = mode === 'detail' ? 'detail' : mode === 'floor' ? 'floor' : 'compact';
  window.ipdWardBedState.bedViewMode = nextMode;
  $('#ipdCompactViewBtn').toggleClass('active', nextMode === 'compact');
  $('#ipdDetailViewBtn').toggleClass('active', nextMode === 'detail');
  $('#ipdFloorViewBtn').toggleClass('active', nextMode === 'floor');
  window.renderIpdBedBoard();
};

window.applyIpdWardBedFilters = function () {
  const state = window.ipdWardBedState;
  const wardId = $('#ipdFilterWard').val() || '';
  const roomId = $('#ipdFilterRoom').val() || '';
  const status = $('#ipdFilterStatus').val() || '';
  const bedType = $('#ipdFilterBedType').val() || '';
  const doctor = $('#ipdFilterDoctor').val() || '';
  const search = String($('#ipdFilterSearch').val() || '').trim().toLowerCase();

  window.populateIpdWardBedFilters();

  state.filteredBeds = state.beds.filter(bed => {
    const info = window.ipdBedPatientInfo(bed);
    const reservation = window.ipdReservationInfo(bed);
    const room = window.ipdRoomById(bed.Room_ID);
    const haystack = [
      bed.Bed_ID, bed.Bed_Number, bed.Bed_Type, bed.Notes,
      room?.Room_Number, info.hn, info.patientName, info.ipdNo, info.doctor,
      reservation.hn, reservation.patientName, reservation.phone, reservation.reason, reservation.reservedBy
    ].join(' ').toLowerCase();

    return (!wardId || String(bed.Ward_ID) === String(wardId)) &&
      (!roomId || String(bed.Room_ID) === String(roomId)) &&
      (!status || window.ipdBedStatus(bed) === status) &&
      (!bedType || String(bed.Bed_Type || 'Standard') === bedType) &&
      (!doctor || String(info.doctor) === String(doctor)) &&
      (!search || haystack.includes(search));
  });

  state.filteredAdmissions = state.admissions.filter(admission => {
    if (!window.ipdIsActiveAdmission(admission)) return false;
    const location = window.ipdAdmissionLocation(admission);
    const linkedBed = location.bed;
    const admissionDoctor = window.ipdDoctorName(admission);
    const haystack = [
      admission.Admission_ID,
      admission.Patient_ID,
      window.ipdPatientName(admission),
      admissionDoctor,
      admission.Diagnosis_Admission,
      location.ward?.Ward_Name,
      location.room?.Room_Number,
      linkedBed?.Bed_Number
    ].join(' ').toLowerCase();

    return (!wardId || String(admission.Ward_ID || linkedBed?.Ward_ID || '') === String(wardId)) &&
      (!roomId || String(admission.Room_ID || linkedBed?.Room_ID || '') === String(roomId)) &&
      (!status || location.status === status) &&
      (!bedType || String(linkedBed?.Bed_Type || 'Standard') === bedType) &&
      (!doctor || String(admissionDoctor) === String(doctor)) &&
      (!search || haystack.includes(search));
  });

  window.renderIpdSummaryCards();
  window.renderIpdBedBoard();
  window.renderIpdNurseStation();
  window.renderIpdDoctorCensus();
  window.renderIpdInpatientTable();
  window.renderIpdWardsTable();
  window.renderIpdRoomsTable();
  window.renderIpdBedsTable();
  window.renderIpdMovementTable();
};

window.renderIpdSummaryCards = function () {
  const state = window.ipdWardBedState;
  // Exclude OPD-observation ward beds from the IPD summary so census numbers stay IPD-only
  const obsWardIds = new Set(state.wards.filter(w => window.ipdIsObsWard(w)).map(w => String(w.Ward_ID)));
  const beds = state.beds.filter(b => !obsWardIds.has(String(b.Ward_ID)));
  const count = status => beds.filter(b => window.ipdBedStatus(b) === status).length;

  $('#ipdTotalBeds').text(beds.length);
  $('#ipdAvailableBeds').text(count('Available'));
  $('#ipdOccupiedBeds').text(count('Occupied'));
  $('#ipdReservedBeds').text(count('Reserved'));
};

window.renderIpdBedBoard = function () {
  const state = window.ipdWardBedState;
  const viewMode = ['detail', 'floor'].includes(state.bedViewMode) ? state.bedViewMode : 'compact';
  if (!state.wards.length || !state.rooms.length || !state.beds.length) {
    $('#ipdBedBoard').html(`<div class="ipd-empty-state"><div><i class="fas fa-bed fa-2x mb-3 d-block"></i>${window.ipdEscape(window.t('ipd.noWardBedData'))}</div></div>`);
    return;
  }

  const filteredBedIds = new Set(state.filteredBeds.map(b => String(b.Bed_ID)));
  const isVipWard = window.ipdIsVipWard;
  const isObsWard = window.ipdIsObsWard;
  // IPD bed board excludes OPD-observation wards — those render on the OPD Follow-up page only
  const nonObsWards = state.wards.filter(w => !isObsWard(w));
  const regularWards = nonObsWards.filter(w => !isVipWard(w));
  const vipWards = nonObsWards.filter(isVipWard);

  const renderWardGroup = (ward) => {
    const wardRooms = state.rooms.filter(r => String(r.Ward_ID) === String(ward.Ward_ID));
    const wardBeds = state.beds.filter(b => String(b.Ward_ID) === String(ward.Ward_ID) && filteredBedIds.has(String(b.Bed_ID)));
    if (wardBeds.length === 0) return '';

    const occupied = wardBeds.filter(b => window.ipdBedStatus(b) === 'Occupied').length;
    const available = wardBeds.filter(b => window.ipdBedStatus(b) === 'Available').length;
    const cleaning = wardBeds.filter(b => window.ipdBedStatus(b) === 'Cleaning').length;
    const maintenance = wardBeds.filter(b => window.ipdBedStatus(b) === 'Maintenance').length;

    let inner = `<section class="ipd-ward-group ipd-board-mode-${viewMode}">
      <div class="ipd-ward-header">
        <div class="ipd-ward-title">
          <span class="ipd-ward-icon"><i class="fas ${isVipWard(ward) ? 'fa-crown' : 'fa-hospital'}"></i></span>
          <div>
            <strong>${window.ipdEscape(ward.Ward_Name || ward.Ward_ID)}</strong>
            <small>${window.ipdEscape(ward.Ward_ID)} | ${wardBeds.length} ${window.ipdEscape(window.t('ipd.beds'))}</small>
          </div>
        </div>
        <div class="ipd-ward-metrics">
          <span class="is-occupied">${occupied}/${wardBeds.length} ${window.ipdEscape(window.t('ipd.occupied'))}</span>
          <span class="is-available">${available} ${window.ipdEscape(window.t('ipd.available'))}</span>
          <span class="is-cleaning">${cleaning} ${window.ipdEscape(window.t('ipd.cleaning'))}</span>
          <span class="is-maintenance">${maintenance} ${window.ipdEscape(window.t('ipd.maintenance'))}</span>
        </div>
      </div>`;

    wardRooms.forEach(room => {
      const roomBeds = wardBeds.filter(b => String(b.Room_ID) === String(room.Room_ID));
      if (roomBeds.length === 0) return;
      inner += `<div class="ipd-room-section ${viewMode === 'floor' ? 'ipd-floor-room-section' : ''}">
        <div class="ipd-room-title">
          <div class="ipd-room-title-left">
            <span><i class="fas fa-door-open me-1"></i>${window.ipdEscape(window.t('ipd.room'))} ${window.ipdEscape(room.Room_Number || room.Room_ID)}</span>
          </div>
          <small>${window.ipdEscape(window.ipdTranslateValue(room.Room_Type || 'General'))} | ${roomBeds.length} ${window.ipdEscape(window.t('ipd.beds'))}</small>
        </div>
        <div class="ipd-bed-grid">`;

      roomBeds.forEach(bed => {
        const status = window.ipdBedStatus(bed);
        const info = window.ipdBedPatientInfo(bed);
        const reservation = window.ipdReservationInfo(bed);
        const losDays = window.ipdLengthOfStayDays(info.admission);
        const hasPatient = status === 'Occupied' && window.ipdHasActiveAdmissionForBed(bed);
        if (viewMode === 'floor') {
          inner += `<article class="ipd-floor-bed status-${status.toLowerCase()}" title="${window.ipdEscape(hasPatient ? (info.patientName || '') : window.ipdTranslateValue(bed.Bed_Type || 'Standard'))}">
            <strong>${window.ipdEscape(bed.Bed_Number || bed.Bed_ID)}</strong>
            <span>${window.ipdEscape(hasPatient ? (info.patientName || '') : window.ipdTranslateValue(bed.Bed_Type || 'Standard'))}</span>
          </article>`;
          return;
        }
        if (viewMode === 'compact') {
          inner += `<article class="ipd-bed-card ipd-bed-card-compact status-${status.toLowerCase()}">
            <div class="ipd-compact-card-head">
              <div class="ipd-bed-number">${window.ipdEscape(bed.Bed_Number || bed.Bed_ID)}</div>
              ${window.ipdStatusBadge(status)}
            </div>
            ${hasPatient ? `<div class="ipd-compact-patient">${window.ipdEscape(info.patientName || '')}</div>
              <div class="ipd-compact-meta">HN ${window.ipdEscape(info.hn || '')} - IPD ${window.ipdEscape(info.ipdNo || '')}</div>
              <div class="ipd-compact-meta">${window.ipdEscape(window.ipdLengthOfStay(info.admission))} - ${window.ipdEscape(info.doctor || '')}</div>` :
              status === 'Reserved' ? `<div class="ipd-compact-patient">${window.ipdEscape(reservation.patientName || reservation.hn || window.t('ipd.reserved'))}</div>
                <div class="ipd-compact-meta">${reservation.hn ? `HN ${window.ipdEscape(reservation.hn)} - ` : ''}${window.ipdEscape(reservation.phone || '')}</div>
                <div class="ipd-compact-meta">${window.ipdEscape(reservation.reservedFrom ? window.ipdFormatDateTime(reservation.reservedFrom) : '')}</div>` :
              `<div class="ipd-compact-bedtype">${window.ipdEscape(window.ipdTranslateValue(bed.Bed_Type || 'Standard'))}</div>`}
            <div class="ipd-compact-actions">${window.ipdBedActionMenu(bed, status, info)}</div>
          </article>`;
          return;
        }
        const reservationDetails = status === 'Reserved' ? `<div class="ipd-bed-meta ipd-reservation-meta">
            <div><strong>${window.ipdEscape(window.t('ipd.reservedFor'))}:</strong> ${window.ipdEscape(reservation.patientName || reservation.hn || '-')}</div>
            <div><strong>HN:</strong> ${window.ipdEscape(reservation.hn || '-')} <strong class="ms-2">${window.ipdEscape(window.t('ipd.phone'))}:</strong> ${window.ipdEscape(reservation.phone || '-')}</div>
            <div><strong>${window.ipdEscape(window.t('ipd.expectedAdmit'))}:</strong> ${window.ipdEscape(reservation.reservedFrom ? window.ipdFormatDateTime(reservation.reservedFrom) : '-')}</div>
            <div><strong>${window.ipdEscape(window.t('ipd.reservedBy'))}:</strong> ${window.ipdEscape(reservation.reservedBy || '-')}</div>
            ${reservation.reason ? `<div><strong>${window.ipdEscape(window.t('ipd.reason'))}:</strong> ${window.ipdEscape(reservation.reason)}</div>` : ''}
          </div>` : '';
        const patientDetails = hasPatient ? `<div class="ipd-bed-meta">
            <div class="ipd-bed-patient-name" title="${window.ipdEscape(info.patientName || '')}">${window.ipdEscape(info.patientName || '-')}</div>
            <div class="ipd-bed-line"><span>HN</span> ${window.ipdEscape(info.hn || '-')}</div>
            ${info.diagnosis ? `<div class="ipd-bed-line" title="${window.ipdEscape(info.diagnosis)}"><i class="fas fa-stethoscope text-muted me-1"></i>${window.ipdEscape(info.diagnosis)}</div>` : ''}
            ${info.doctor ? `<div class="ipd-bed-line" title="${window.ipdEscape(info.doctor)}"><i class="fas fa-user-md text-muted me-1"></i>${window.ipdEscape(info.doctor)}</div>` : ''}
            <div class="ipd-bed-line"><i class="fas fa-clock text-muted me-1"></i>${window.ipdEscape(window.ipdLengthOfStay(info.admission))}${losDays >= 7 ? ` <span class="badge bg-warning text-dark ms-1">${window.ipdEscape(window.t('ipd.longStay'))}</span>` : ''}</div>
          </div>` : reservationDetails || `<div class="ipd-bed-meta ipd-bed-empty-meta">
            <div class="text-muted small">${window.ipdEscape(window.ipdTranslateValue(bed.Bed_Type || 'Standard'))}</div>
          </div>`;
        inner += `<article class="ipd-bed-card status-${status.toLowerCase()}">
          <div class="ipd-bed-top">
            <div>
              <div class="ipd-bed-number">${window.ipdEscape(bed.Bed_Number || bed.Bed_ID)}</div>
            </div>
            ${window.ipdStatusBadge(status)}
          </div>
          ${patientDetails}
          <div class="ipd-bed-actions">${window.ipdBedActionButtons(bed, status, info)}</div>
        </article>`;
      });

      inner += '</div></div>';
    });

    inner += '</section>';
    return inner;
  };

  const buildSegment = (wards, kind) => {
    const groupsHtml = wards.map(renderWardGroup).filter(Boolean).join('');
    if (!groupsHtml) return '';
    const titleKey = kind === 'vip' ? 'ipd.vipWardsTitle' : 'ipd.generalWardsTitle';
    const subtitleKey = kind === 'vip' ? 'ipd.vipWardsSubtitle' : 'ipd.generalWardsSubtitle';
    const icon = kind === 'vip' ? 'fa-crown' : 'fa-hospital-symbol';
    return `<section class="ipd-board-segment ipd-board-segment-${kind}">
      <header class="ipd-board-segment-header">
        <div class="ipd-board-segment-icon"><i class="fas ${icon}"></i></div>
        <div class="ipd-board-segment-titles">
          <strong>${window.ipdEscape(window.t(titleKey))}</strong>
          <small>${window.ipdEscape(window.t(subtitleKey))} · ${wards.length} ${window.ipdEscape(window.t('ipd.wardsCount'))}</small>
        </div>
      </header>
      <div class="ipd-board-segment-body">${groupsHtml}</div>
    </section>`;
  };

  const html = buildSegment(regularWards, 'general') + buildSegment(vipWards, 'vip');
  $('#ipdBedBoard').html(html || `<div class="ipd-empty-state">${window.ipdEscape(window.t('ipd.noBedMatch'))}</div>`);
};

window.renderIpdNurseStation = function () {
  const state = window.ipdWardBedState;
  if (!state.wards.length || !state.rooms.length || !state.beds.length) {
    $('#ipdNurseStation').html(`<div class="ipd-empty-state"><div><i class="fas fa-clipboard-list fa-2x mb-3 d-block"></i>${window.ipdEscape(window.t('ipd.noWardBedData'))}</div></div>`);
    return;
  }

  const filteredBedIds = new Set(state.filteredBeds.map(b => String(b.Bed_ID)));
  let html = '<div class="ipd-nurse-station">';

  state.wards.forEach(ward => {
    const wardRooms = state.rooms.filter(r => String(r.Ward_ID) === String(ward.Ward_ID));
    const wardBeds = state.beds.filter(b => String(b.Ward_ID) === String(ward.Ward_ID) && filteredBedIds.has(String(b.Bed_ID)));
    if (!wardBeds.length) return;

    html += `<section class="ipd-nurse-ward">
      <div class="ipd-nurse-ward-head">
        <strong><i class="fas fa-procedures me-2"></i>${window.ipdEscape(ward.Ward_Name || ward.Ward_ID)}</strong>
        <span>${wardBeds.length} ${window.ipdEscape(window.t('ipd.beds'))}</span>
      </div>`;

    wardRooms.forEach(room => {
      const roomBeds = wardBeds.filter(b => String(b.Room_ID) === String(room.Room_ID));
      if (!roomBeds.length) return;

      html += `<div class="ipd-nurse-room">
        <div class="ipd-nurse-room-title">${window.ipdEscape(window.t('ipd.room'))} ${window.ipdEscape(room.Room_Number || room.Room_ID)}</div>
        <div class="ipd-nurse-bed-grid">`;

      roomBeds.forEach(bed => {
        const status = window.ipdBedStatus(bed);
        const info = window.ipdBedPatientInfo(bed);
        const hasPatient = status === 'Occupied' && window.ipdHasActiveAdmissionForBed(bed);
        const losDays = window.ipdLengthOfStayDays(info.admission);
        const warning = status === 'Cleaning' ? window.t('ipd.cleaning') :
          status === 'Maintenance' ? window.t('ipd.maintenance') :
          losDays >= 7 ? window.t('ipd.longStay') : '';

        html += `<article class="ipd-nurse-bed status-${status.toLowerCase()}" onclick="${hasPatient ? `window.viewIpdChart('${window.ipdEscape(info.ipdNo)}')` : ''}">
          <div class="ipd-nurse-bed-top">
            <strong>${window.ipdEscape(bed.Bed_Number || bed.Bed_ID)}</strong>
            ${window.ipdStatusBadge(status)}
          </div>
          <div class="ipd-nurse-patient">${window.ipdEscape(hasPatient ? (info.patientName || '-') : '-')}</div>
          <div class="ipd-nurse-meta">
            <span>${window.ipdEscape(hasPatient ? (info.doctor || '-') : '-')}</span>
            ${warning ? `<span class="ipd-nurse-warning">${window.ipdEscape(warning)}</span>` : ''}
          </div>
        </article>`;
      });

      html += '</div></div>';
    });

    html += '</section>';
  });

  html += '</div>';
  $('#ipdNurseStation').html(html === '<div class="ipd-nurse-station"></div>' ? `<div class="ipd-empty-state">${window.ipdEscape(window.t('ipd.noBedMatch'))}</div>` : html);
};

window.renderIpdDoctorCensus = function () {
  const admissions = window.ipdWardBedState.filteredAdmissions || [];
  if (!admissions.length) {
    $('#ipdDoctorCensus').html(`<div class="ipd-empty-state"><div><i class="fas fa-user-md fa-2x mb-3 d-block"></i>${window.ipdEscape(window.t('ipd.noDoctorCensus'))}</div></div>`);
    return;
  }

  const groups = {};
  admissions.forEach(admission => {
    const doctor = window.ipdDoctorName(admission) || window.t('ipd.unassignedDoctor');
    if (!groups[doctor]) groups[doctor] = [];
    groups[doctor].push(admission);
  });

  const doctorNames = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length || a.localeCompare(b));
  const html = `<div class="ipd-doctor-census-grid">${doctorNames.map(doctor => {
    const rows = groups[doctor]
      .sort((a, b) => window.ipdLengthOfStayDays(b) - window.ipdLengthOfStayDays(a))
      .map(admission => {
        const location = window.ipdAdmissionLocation(admission);
        const patientName = window.ipdPatientName(admission) || '-';
        const losDays = window.ipdLengthOfStayDays(admission);
        return `<div class="ipd-doctor-patient">
          <div class="ipd-doctor-patient-main">
            <div>
              <div class="ipd-doctor-patient-name">${window.ipdEscape(patientName)}</div>
              <div class="text-muted small">HN ${window.ipdEscape(admission.Patient_ID || '-')} / IPD ${window.ipdEscape(admission.Admission_ID || '-')}</div>
            </div>
            ${location.status ? window.ipdStatusBadge(location.status) : `<span class="ipd-status-badge ipd-status-reserved">${window.ipdEscape(window.t('ipd.waitingBed'))}</span>`}
          </div>
          <div class="ipd-doctor-patient-meta">
            <span><i class="fas fa-bed"></i>${window.ipdEscape(location.label)}</span>
            <span><i class="fas fa-calendar-day"></i>${window.ipdEscape(window.ipdLengthOfStay(admission))}</span>
            ${losDays >= 7 ? `<span class="text-warning"><i class="fas fa-clock"></i>${window.ipdEscape(window.t('ipd.longStay'))}</span>` : ''}
            ${admission.Diagnosis_Admission ? `<span><i class="fas fa-stethoscope"></i>${window.ipdEscape(admission.Diagnosis_Admission)}</span>` : ''}
          </div>
          <div class="mt-2">
            <button class="btn btn-sm btn-outline-primary" onclick="window.viewIpdChart('${window.ipdEscape(admission.Admission_ID || '')}')"><i class="fas fa-file-medical me-1"></i>${window.ipdEscape(window.t('ipd.chart'))}</button>
            ${location.bed ? `<button class="btn btn-sm btn-outline-success ms-1" onclick="window.openIpdTransferModal('${window.ipdEscape(location.bed.Bed_ID)}')"><i class="fas fa-exchange-alt me-1"></i>${window.ipdEscape(window.t('ipd.transfer'))}</button>` : ''}
          </div>
        </div>`;
      }).join('');

    return `<section class="ipd-doctor-panel">
      <div class="ipd-doctor-panel-head">
        <div class="ipd-doctor-panel-title">
          <strong><i class="fas fa-user-md me-2"></i>${window.ipdEscape(doctor)}</strong>
          <span>${window.ipdEscape(window.t('ipd.careTeamList'))}</span>
        </div>
        <button class="ipd-doctor-count border-0" onclick="window.filterIpdByDoctor('${window.ipdEscape(doctor === window.t('ipd.unassignedDoctor') ? '' : doctor)}')" title="${window.ipdEscape(window.t('ipd.filterDoctor'))}">${groups[doctor].length}</button>
      </div>
      <div class="ipd-doctor-patient-list">${rows}</div>
    </section>`;
  }).join('')}</div>`;

  $('#ipdDoctorCensus').html(html);
};

window.filterIpdByDoctor = function (doctor) {
  $('#ipdFilterDoctor').val(doctor || '');
  window.applyIpdWardBedFilters();
  const tab = document.querySelector('[data-bs-target="#ipdDoctorCensusTab"]');
  if (tab && window.bootstrap?.Tab) window.bootstrap.Tab.getOrCreateInstance(tab).show();
};

window.renderIpdInpatientTable = function (selector = '#ipdInpatientTable') {
  if (!$(selector).length) return;
  if ($.fn.DataTable.isDataTable(selector)) $(selector).DataTable().destroy();

  const filter = window.ipdInpatientFilter || 'active';
  let admissions;
  if (selector === '#ipdStandaloneInpatientTable' && filter !== 'active') {
    const all = window.ipdWardBedState.admissions || [];
    admissions = filter === 'discharged'
      ? all.filter(a => !window.ipdIsActiveAdmission(a))
      : all.slice();
  } else {
    admissions = window.ipdWardBedState.filteredAdmissions || [];
  }
  const rows = admissions.map(admission => {
    const patientName = window.ipdPatientName(admission) || '-';
    const patient = admission.Patient_ID ? window.ipdWardBedState.patientsById[admission.Patient_ID] : null;
    const location = window.ipdAdmissionLocation(admission);
    const bed = location.bed;
    const ageSex = [patient?.Age, patient?.Gender ? window.ipdTranslateValue(patient.Gender) : ''].filter(Boolean).join(' / ') || '-';
    const isActive = window.ipdIsActiveAdmission(admission);
    const dischargeAt = [admission.Discharge_Date, admission.Discharge_Time].filter(Boolean).join(' ') || (isActive ? '-' : (admission.Discharged_At || '-'));
    const actions = isActive
      ? [
          `<button class="btn btn-sm btn-outline-dark me-1" onclick="window.viewIpdChart('${window.ipdEscape(admission.Admission_ID || '')}')"><i class="fas fa-file-medical me-1"></i>${window.ipdEscape(window.t('ipd.chart'))}</button>`,
          bed ? `<button class="btn btn-sm btn-outline-primary me-1" onclick="window.openIpdTransferModal('${window.ipdEscape(bed.Bed_ID)}')"><i class="fas fa-exchange-alt me-1"></i>${window.ipdEscape(window.t('ipd.transfer'))}</button>` : '',
          bed ? `<button class="btn btn-sm btn-outline-warning" onclick="window.changeIpdBedStatus('${window.ipdEscape(bed.Bed_ID)}','Cleaning')"><i class="fas fa-sign-out-alt me-1"></i>${window.ipdEscape(window.t('ipd.discharge'))}</button>` : ''
        ].join('')
      : `<button class="btn btn-sm btn-outline-info" onclick="window.viewIpdChart('${window.ipdEscape(admission.Admission_ID || '')}')"><i class="fas fa-history me-1"></i>${window.ipdEscape(window.t('ipd.viewHistory'))}</button>`;
    const statusCell = isActive
      ? (location.status ? window.ipdStatusBadge(location.status) : `<span class="ipd-status-badge ipd-status-reserved">${window.ipdEscape(window.t('ipd.waitingBed'))}</span>`)
      : window.ipdStatusBadge('Discharged');

    return `<tr>
      <td><code>${window.ipdEscape(admission.Admission_ID || '-')}</code></td>
      <td>${window.ipdEscape(admission.Patient_ID || '-')}</td>
      <td class="fw-bold">${window.ipdEscape(patientName)}</td>
      <td>${window.ipdEscape(ageSex)}</td>
      <td>${window.ipdEscape(location.ward?.Ward_Name || '-')}</td>
      <td>${window.ipdEscape(location.room?.Room_Number || '-')}</td>
      <td>${window.ipdEscape(location.bed?.Bed_Number || '-')}</td>
      <td>${window.ipdEscape(window.ipdDoctorName(admission) || '-')}</td>
      <td>${window.ipdEscape(admission.Diagnosis_Admission || admission.Diagnosis || '-')}</td>
      <td>${window.ipdEscape([admission.Admission_Date, admission.Admission_Time].filter(Boolean).join(' ') || '-')}</td>
      <td>${window.ipdEscape(dischargeAt)}</td>
      <td>${window.ipdEscape(window.ipdLengthOfStay(admission))}</td>
      <td>${statusCell}</td>
      <td class="text-nowrap">${actions}</td>
    </tr>`;
  }).join('');

  const emptyMessage = (selector === '#ipdStandaloneInpatientTable' && filter === 'discharged')
    ? window.t('ipd.noDischargedData')
    : window.t('ipd.noInpatientData');

  $(`${selector} tbody`).html(rows);
  $(selector).DataTable({
    responsive: true,
    pageLength: 10,
    order: [[9, 'desc']],
    language: { emptyTable: emptyMessage, search: window.getAppLanguage() === 'lo' ? 'ຄົ້ນຫາ:' : 'Search:' }
  });
};

window.prepareIpdUnfilteredState = function () {
  const state = window.ipdWardBedState;
  state.filteredBeds = state.beds.slice();
  state.filteredAdmissions = state.admissions.filter(a => window.ipdIsActiveAdmission(a));
};

window.ipdTodayDateString = function () {
  return new Date().toISOString().slice(0, 10);
};

window.ipdAdmissionDate = function (admission) {
  return String(admission?.Admission_Date || admission?.Created_At || '').slice(0, 10);
};

window.ipdDischargeDate = function (admission) {
  return String(admission?.Discharge_Date || admission?.Discharged_At || '').slice(0, 10);
};

window.loadIpdDashboard = async function () {
  $('#ipdRecentAdmissions, #ipdPendingDischarge, #ipdBedStatusSummary').html(`<div class="text-muted small py-2">${window.ipdEscape(window.t('ipd.loadingData'))}</div>`);
  try {
    await window.fetchIpdWardBedData();
    window.prepareIpdUnfilteredState();
    window.renderIpdDashboard();
  } catch (err) {
    console.error('IPD dashboard load error:', err);
    $('#ipdRecentAdmissions').html(`<div class="alert alert-danger">${window.ipdEscape(err.message || err)}</div>`);
  }
};

window.renderIpdDashboard = function () {
  const state = window.ipdWardBedState;
  const activeAdmissions = state.admissions.filter(a => window.ipdIsActiveAdmission(a));
  const activeBeds = state.beds.filter(b => window.ipdBedStatus(b) !== 'Inactive');
  const countBeds = status => state.beds.filter(b => window.ipdBedStatus(b) === status).length;
  const occupied = countBeds('Occupied');
  const available = countBeds('Available');
  const today = window.ipdTodayDateString();
  const todayAdmissions = state.admissions.filter(a => window.ipdAdmissionDate(a) === today).length;
  const todayDischarges = state.admissions.filter(a => window.ipdDischargeDate(a) === today || String(a.Status || '').toLowerCase() === 'discharged').length;
  const rate = activeBeds.length ? Math.round((occupied / activeBeds.length) * 100) : 0;

  $('#ipdDashTotalAdmissions').text(state.admissions.length);
  $('#ipdDashActiveInpatients').text(activeAdmissions.length);
  $('#ipdDashAvailableBeds').text(available);
  $('#ipdDashOccupiedBeds').text(occupied);
  $('#ipdDashOccupancyRate').text(`${rate}%`);
  $('#ipdDashTodayAdmissions').text(todayAdmissions);
  $('#ipdDashTodayDischarges').text(todayDischarges);

  window.renderIpdDashboardCharts(state.admissions, activeBeds.length, occupied);
  window.renderIpdDashboardLists(activeAdmissions);
};

window.renderIpdDashboardCharts = function (admissions, activeBedCount, occupiedBedCount) {
  if (!document.getElementById('ipdAdmissionsByMonthChart')) {
    $('#view-ipd_dashboard .ipd-chart-box').first().html('<canvas id="ipdAdmissionsByMonthChart"></canvas>');
  }
  if (!document.getElementById('ipdOccupancyTrendChart')) {
    $('#view-ipd_dashboard .ipd-chart-box').eq(1).html('<canvas id="ipdOccupancyTrendChart"></canvas>');
  }
  const monthLabels = [];
  const monthCounts = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    monthLabels.push(key);
    monthCounts.push(admissions.filter(a => window.ipdAdmissionDate(a).startsWith(key)).length);
  }
  window.createChart('ipdAdmissionsByMonthChart', 'bar', monthLabels, monthCounts, ['#0f5f9a'], false);

  const trendLabels = monthLabels;
  const trend = monthLabels.map(key => {
    const monthAdmissions = admissions.filter(a => window.ipdAdmissionDate(a).slice(0, 7) <= key && (!window.ipdDischargeDate(a) || window.ipdDischargeDate(a).slice(0, 7) >= key)).length;
    return activeBedCount ? Math.min(100, Math.round((Math.max(monthAdmissions, occupiedBedCount) / activeBedCount) * 100)) : 0;
  });
  const ctx = document.getElementById('ipdOccupancyTrendChart');
  if (ctx && typeof Chart !== 'undefined') {
    if (chartInstances.ipdOccupancyTrendChart) chartInstances.ipdOccupancyTrendChart.destroy();
    chartInstances.ipdOccupancyTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trendLabels,
        datasets: [{
          data: trend,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.12)',
          fill: true,
          tension: 0.32,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: value => `${value}%` } } }
      }
    });
  }
};

window.renderIpdDashboardLists = function (activeAdmissions) {
  const recentRows = activeAdmissions.slice(0, 6).map(a => {
    const loc = window.ipdAdmissionLocation(a);
    return `<div class="ipd-mini-row"><strong>${window.ipdEscape(window.ipdPatientName(a) || a.Patient_ID || '-')}</strong><span>${window.ipdEscape(a.Admission_ID || '-')} | ${window.ipdEscape(loc.label)}</span></div>`;
  }).join('');
  $('#ipdRecentAdmissions').html(recentRows || `<div class="ipd-empty-inline">${window.ipdEscape(window.t('ipd.noInpatientData'))}</div>`);

  const pendingRows = activeAdmissions
    .filter(a => window.ipdLengthOfStayDays(a) >= 3 || String(a.Discharge_Status || '').toLowerCase().includes('pending'))
    .slice(0, 6)
    .map(a => `<div class="ipd-mini-row"><strong>${window.ipdEscape(window.ipdPatientName(a) || a.Patient_ID || '-')}</strong><span>${window.ipdEscape(window.ipdLengthOfStay(a))} | ${window.ipdEscape(window.ipdDoctorName(a) || '-')}</span></div>`)
    .join('');
  $('#ipdPendingDischarge').html(pendingRows || `<div class="ipd-empty-inline">${window.ipdEscape(window.t('ipd.noInpatientData'))}</div>`);

  const statuses = ['Available', 'Occupied', 'Reserved', 'Cleaning', 'Maintenance', 'Inactive'];
  $('#ipdBedStatusSummary').html(statuses.map(status => {
    const count = window.ipdWardBedState.beds.filter(b => window.ipdBedStatus(b) === status).length;
    return `<div class="ipd-status-summary-row">${window.ipdStatusBadge(status)}<strong>${count}</strong></div>`;
  }).join(''));
};

window.openIpdQuickAdmitModal = async function () {
  await window.ipdLoadProviders();
  const readyBeds = window.ipdWardBedState.beds.filter(b => ['Available', 'Reserved'].includes(window.ipdBedStatus(b)));
  const patients = Object.values(window.ipdWardBedState.patientsById || {})
    .sort((a, b) => String(b.Patient_ID || '').localeCompare(String(a.Patient_ID || '')));
  if (!patients.length) {
    return Swal.fire(window.t('ipd.patientRequired'), window.t('ipd.patientRequiredText'), 'warning');
  }
  const patientLabel = p => {
    const name = [p.First_Name, p.Last_Name].filter(Boolean).join(' ') || p.Patient_ID;
    const oldId = window.normalizePatientCode(p.Old_Patient_ID || '');
    return `${p.Patient_ID}${oldId ? ' / Old: ' + oldId : ''} - ${name}${p.Age ? ' / ' + p.Age : ''}${p.Gender ? ' / ' + window.ipdTranslateValue(p.Gender) : ''}`;
  };
  const patientName = p => [p.First_Name, p.Last_Name].filter(Boolean).join(' ') || p.Patient_ID;
  const patientOptions = `<option value=""></option>` + patients.map(p => {
    const oldId = window.normalizePatientCode(p.Old_Patient_ID || '');
    const searchBlob = [p.Patient_ID, oldId, patientName(p), p.First_Name, p.Last_Name].filter(Boolean).join(' ');
    return `<option value="${window.ipdEscape(p.Patient_ID)}" data-name="${window.ipdEscape(patientName(p))}" data-search="${window.ipdEscape(searchBlob)}">${window.ipdEscape(patientLabel(p))}</option>`;
  }).join('');
  const bedOptions = `<option value="">${window.ipdEscape('-- ' + window.t('ipd.roomBed') + ' --')}</option>` + readyBeds.map(b => {
    const ward = window.ipdWardById(b.Ward_ID);
    const room = window.ipdRoomById(b.Room_ID);
    return `<option value="${window.ipdEscape(b.Bed_ID)}">${window.ipdEscape(ward?.Ward_Name || b.Ward_ID)} / ${window.ipdEscape(room?.Room_Number || b.Room_ID)} / ${window.ipdEscape(b.Bed_Number || b.Bed_ID)}</option>`;
  }).join('');
  const doctorOptions = window.ipdProviderOptions('', ['doctor']);
  const nurseOptions = window.ipdProviderOptions('', ['nurse']);
  const reqMark = '<span class="text-danger">*</span> ';
  const result = await Swal.fire({
    title: window.t('nav.admitPatient'),
    width: 720,
    html: `<div class="ipd-form-grid">
      <div class="full"><label class="form-label fw-bold">${reqMark}${window.ipdEscape(window.t('ipd.patient'))}</label><select class="form-select" id="ipdQuickPatient" required style="width:100%">${patientOptions}</select></div>
      <div class="full"><div class="ipd-selected-patient" id="ipdQuickPatientPreview"></div></div>
      <div><label class="form-label fw-bold">${reqMark}${window.ipdEscape(window.t('ipd.doctor'))}</label><select class="form-select" id="ipdQuickDoctor" required>${doctorOptions}</select></div>
      <div><label class="form-label fw-bold">${reqMark}${window.ipdEscape(window.t('ipd.assistantNurse'))}</label><select class="form-select" id="ipdQuickNurse" required>${nurseOptions}</select></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.admit'))}</label><input type="datetime-local" class="form-control" id="ipdQuickAdmitAt" value="${new Date().toISOString().slice(0, 16)}"></div>
      <div><label class="form-label fw-bold">${reqMark}${window.ipdEscape(window.t('ipd.roomBed'))}</label><select class="form-select" id="ipdQuickBed" required>${bedOptions}</select></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.diagnosis'))}</label><input class="form-control" id="ipdQuickDiagnosis"></div>
    </div>`,
    didOpen: () => {
      const updatePreview = () => {
        const selected = $('#ipdQuickPatient option:selected');
        const val = selected.val();
        $('#ipdQuickPatientPreview').html(val
          ? `<strong>HN ${window.ipdEscape(val)}</strong><span>${window.ipdEscape(selected.data('name') || '-')}</span>`
          : '');
      };
      if (typeof jQuery !== 'undefined' && $.fn.select2) {
        const popup = Swal.getPopup ? $(Swal.getPopup()) : $(document.body);
        $('#ipdQuickPatient').select2({
          dropdownParent: popup,
          placeholder: window.t('ipd.searchHint'),
          allowClear: true,
          width: '100%',
          matcher: (params, data) => {
            const term = String(params.term || '').trim().toLowerCase();
            if (!term) return data;
            const blob = String($(data.element).data('search') || data.text || '').toLowerCase();
            return blob.includes(term) ? data : null;
          }
        });
        $('#ipdQuickPatient').val('').trigger('change');
      }
      $('#ipdQuickPatient').on('change', updatePreview);
      updatePreview();
    },
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const patientId = $('#ipdQuickPatient').val();
      const patient = patientId ? window.ipdWardBedState.patientsById[patientId] : null;
      if (!patientId || !patient) {
        Swal.showValidationMessage(window.t('ipd.patientRequiredText'));
        return false;
      }
      const doctorId = $('#ipdQuickDoctor').val();
      const doctorName = $('#ipdQuickDoctor option:selected').data('name') || '';
      if (!doctorId) { Swal.showValidationMessage(window.t('ipd.doctorRequired')); return false; }
      const nurseId = $('#ipdQuickNurse').val();
      const nurseName = $('#ipdQuickNurse option:selected').data('name') || '';
      if (!nurseId) { Swal.showValidationMessage(window.t('ipd.nurseRequired')); return false; }
      const bedId = $('#ipdQuickBed').val();
      if (!bedId) { Swal.showValidationMessage(window.t('ipd.bedRequired')); return false; }
      return {
        patientId,
        patientName: [patient.First_Name, patient.Last_Name].filter(Boolean).join(' ') || patient.Patient_ID,
        doctor: String(doctorName || '').trim(),
        nurse: String(nurseName || '').trim(),
        admitAt: $('#ipdQuickAdmitAt').val(),
        diagnosis: $('#ipdQuickDiagnosis').val().trim(),
        bedId
      };
    }
  });
  if (!result.isConfirmed) return;
  await window.createIpdQuickAdmission(result.value);
};

window.createIpdQuickAdmission = async function (form) {
  const admissionId = window.ipdId('IPD');
  const admitDate = form.admitAt ? form.admitAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const admitTime = form.admitAt ? form.admitAt.slice(11, 16) : new Date().toISOString().slice(11, 16);
  const bed = form.bedId ? window.ipdBedById(form.bedId) : null;
  const patient = window.ipdWardBedState.patientsById[form.patientId];
  if (!patient) return Swal.fire(window.t('ipd.patientRequired'), window.t('ipd.patientRequiredText'), 'warning');
  const payload = {
    Admission_ID: admissionId,
    Patient_ID: form.patientId,
    Patient_Name: form.patientName || form.patientId,
    Admitting_Doctor: form.doctor || null,
    Admitting_Nurse: form.nurse || null,
    Diagnosis_Admission: form.diagnosis || null,
    Admission_Date: admitDate,
    Admission_Time: admitTime,
    Ward_ID: bed?.Ward_ID || null,
    Room_ID: bed?.Room_ID || null,
    Bed_ID: bed?.Bed_ID || null,
    Status: 'Admitted',
    Created_At: new Date().toISOString()
  };
  const res = await window.ipdMutate('Admissions', 'insert', payload, null, payload);
  if (res.error) return Swal.fire(window.t('common.error'), res.error.message, 'error');
  await window.copyLatestOpdVitalsToIpdAdmission(admissionId, form.patientId);
  if (bed) {
    const now = new Date().toISOString();
    const bedRes = await window.ipdMutate('Beds', 'update', {
      Bed_Status: 'Occupied',
      Status: 'Occupied',
      Current_Patient_ID: form.patientId,
      Current_Patient_HN: form.patientId,
      Current_IPD_Admission_ID: admissionId,
      Reserved_Patient_ID: null,
      Reserved_Patient_HN: null,
      Reserved_Patient_Name: null,
      Reserved_Phone: null,
      Reserved_By: null,
      Reserved_At: null,
      Reserved_From: null,
      Reserved_Until: null,
      Reservation_Reason: null,
      Reservation_Notes: null,
      Last_Status_Updated_At: now,
      Updated_At: now
    }, { Bed_ID: bed.Bed_ID }, { Status: 'Occupied' });
    if (bedRes.error) return Swal.fire(window.t('common.error'), bedRes.error.message, 'error');
    await window.createIpdMovement({
      movementType: 'Assign',
      ipdAdmissionId: admissionId,
      patientId: form.patientId,
      patientHn: form.patientId,
      toBed: bed,
      movementDatetime: form.admitAt,
      note: 'Quick IPD admission',
      createdBy: currentUser?.name || currentUser?.id || ''
    });
  }
  await window.loadIpdWardBedManagement();
  Swal.fire(window.t('common.saved'), window.t('ipd.assignedSuccess'), 'success');
};

window.loadIpdConfigPage = async function () {
  try {
    await window.fetchIpdWardBedData();
    window.prepareIpdUnfilteredState();
    window.renderIpdWardsTable();
    window.renderIpdRoomsTable();
    window.renderIpdBedsTable();
    window.bindIpdConfigTabs();
  } catch (err) {
    console.error('IPD config load error:', err);
    $('#ipdWardsTable tbody, #ipdRoomsTable tbody, #ipdBedsTable tbody').html('');
  }
};

window.bindIpdConfigTabs = function () {
  const $tabs = $('#ipdConfigTabs');
  if (!$tabs.length) return;

  const showPane = (paneId) => {
    $('#view-ipd_config .tab-pane').removeClass('show active').css('display', 'none');
    const $target = $('#view-ipd_config #' + paneId);
    $target.addClass('show active').css('display', 'block');
    $tabs.find('.nav-link').removeClass('active');
    $tabs.find('a[href="#' + paneId + '"]').addClass('active');
    const tableId = { ipdConfigWards: 'ipdWardsTable', ipdConfigRooms: 'ipdRoomsTable', ipdConfigBeds: 'ipdBedsTable' }[paneId];
    if (tableId && $.fn.DataTable.isDataTable('#' + tableId)) {
      $('#' + tableId).DataTable().columns.adjust();
    }
  };

  showPane('ipdConfigWards');

  if ($tabs.data('ipdConfigBound')) return;
  $tabs.data('ipdConfigBound', true);
  $tabs.on('click', 'a[data-bs-toggle="tab"]', function (e) {
    e.preventDefault();
    const href = $(this).attr('href') || '';
    const paneId = href.replace(/^#/, '');
    if (paneId) showPane(paneId);
  });
};

window.loadIpdInpatientListPage = async function () {
  try {
    await window.fetchIpdWardBedData();
    window.prepareIpdUnfilteredState();
    window.ipdInpatientFilter = window.ipdInpatientFilter || 'active';
    window.bindIpdInpatientFilterTabs();
    window.applyIpdInpatientFilterTabUi();
    window.renderIpdInpatientTable('#ipdStandaloneInpatientTable');
  } catch (err) {
    $('#ipdStandaloneInpatientTable tbody').html('');
    console.error('IPD inpatient list load error:', err);
  }
};

window.bindIpdInpatientFilterTabs = function () {
  const $tabs = $('#ipdInpatientFilterTabs');
  if (!$tabs.length || $tabs.data('ipdBound')) return;
  $tabs.data('ipdBound', true);
  $tabs.on('click', '[data-ipd-filter]', function () {
    const next = String($(this).data('ipd-filter') || 'active');
    if (window.ipdInpatientFilter === next) return;
    window.ipdInpatientFilter = next;
    window.applyIpdInpatientFilterTabUi();
    window.renderIpdInpatientTable('#ipdStandaloneInpatientTable');
  });
};

window.applyIpdInpatientFilterTabUi = function () {
  const current = window.ipdInpatientFilter || 'active';
  $('#ipdInpatientFilterTabs [data-ipd-filter]').each(function () {
    const isActive = String($(this).data('ipd-filter')) === current;
    $(this).toggleClass('btn-primary', isActive).toggleClass('btn-outline-secondary', !isActive);
  });
};

window.loadIpdDischargePage = async function () {
  try {
    await window.fetchIpdWardBedData();
    window.prepareIpdUnfilteredState();
    window.renderIpdDischargePage();
  } catch (err) {
    $('#ipdDischargePending').html(`<div class="alert alert-danger">${window.ipdEscape(err.message || err)}</div>`);
  }
};

window.renderIpdDischargePage = function () {
  const activeAdmissions = window.ipdWardBedState.admissions.filter(a => window.ipdIsActiveAdmission(a));
  const pending = activeAdmissions.filter(a => window.ipdLengthOfStayDays(a) >= 3 || String(a.Discharge_Status || '').toLowerCase().includes('pending'));
  $('#ipdDischargePending').html(pending.map(a => {
    const bed = window.ipdAdmissionLocation(a).bed;
    return `<div class="ipd-mini-row">
      <strong>${window.ipdEscape(window.ipdPatientName(a) || a.Patient_ID || '-')}</strong>
      <span>${window.ipdEscape(a.Admission_ID || '-')} | ${window.ipdEscape(window.ipdLengthOfStay(a))}</span>
      ${bed ? `<button class="btn btn-sm btn-outline-warning mt-1" onclick="window.changeIpdBedStatus('${window.ipdEscape(bed.Bed_ID)}','Cleaning')">${window.ipdEscape(window.t('ipd.dischargeReleaseBed'))}</button>` : ''}
    </div>`;
  }).join('') || `<div class="ipd-empty-inline">${window.ipdEscape(window.t('ipd.noInpatientData'))}</div>`);

  const cleaningBeds = window.ipdWardBedState.beds.filter(b => window.ipdBedStatus(b) === 'Cleaning');
  $('#ipdDischargeCleaningBeds').html(cleaningBeds.map(b => {
    const ward = window.ipdWardById(b.Ward_ID);
    const room = window.ipdRoomById(b.Room_ID);
    return `<div class="ipd-mini-row">
      <strong>${window.ipdEscape(b.Bed_Number || b.Bed_ID)}</strong>
      <span>${window.ipdEscape(ward?.Ward_Name || '-')} / ${window.ipdEscape(room?.Room_Number || '-')}</span>
      <button class="btn btn-sm btn-outline-success mt-1" onclick="window.changeIpdBedStatus('${window.ipdEscape(b.Bed_ID)}','Available')">${window.ipdEscape(window.t('ipd.markAvailable'))}</button>
    </div>`;
  }).join('') || `<div class="ipd-empty-inline">No beds are currently in cleaning.</div>`);
};

window.renderIpdWardsTable = function () {
  const $table = $('#ipdWardsTable');
  if ($.fn.DataTable.isDataTable('#ipdWardsTable')) $table.DataTable().destroy();
  $table.find('thead').html(`<tr>
    <th>${window.ipdEscape(window.t('ipd.wardName'))}</th>
    <th>${window.ipdEscape(window.t('ipd.wardType'))}</th>
    <th>${window.ipdEscape(window.t('ipd.floor'))}</th>
    <th>${window.ipdEscape(window.t('ipd.status'))}</th>
    <th class="text-center">${window.ipdEscape(window.t('common.action'))}</th>
  </tr>`);
  const rows = window.ipdWardBedState.wards.map(w => `<tr>
    <td class="fw-bold text-primary">${window.ipdEscape(w.Ward_Name || '-')}</td>
    <td>${window.ipdEscape(w.Ward_Type ? window.ipdTranslateValue(w.Ward_Type) : '-')}</td>
    <td>${window.ipdEscape(w.Floor || '-')}</td>
    <td><span class="badge ${w.Status === 'Inactive' ? 'bg-secondary' : 'bg-success'}">${window.ipdEscape(window.ipdTranslateValue(w.Status || 'Active'))}</span></td>
    <td class="text-center">
      <button class="btn btn-sm btn-primary me-1 btn-ipd-config-edit" title="${window.ipdEscape(window.t('ipd.edit'))}" onclick="window.openIpdWardModal('${window.ipdEscape(w.Ward_ID)}')"><i class="fas fa-edit"></i></button>
      <button class="btn btn-sm btn-outline-secondary me-1 btn-ipd-config-delete" title="${window.ipdEscape(window.t('ipd.disable'))}" onclick="window.deactivateIpdWard('${window.ipdEscape(w.Ward_ID)}')"><i class="fas fa-ban"></i></button>
      <button class="btn btn-sm btn-danger btn-ipd-config-delete" title="${window.ipdEscape(window.t('ipd.delete'))}" onclick="window.deleteIpdWard('${window.ipdEscape(w.Ward_ID)}')"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`).join('');
  $('#ipdWardsTable tbody').html(rows);
  $table.DataTable({ responsive: true, pageLength: 10 });
};

window.renderIpdRoomsTable = function () {
  const $table = $('#ipdRoomsTable');
  if ($.fn.DataTable.isDataTable('#ipdRoomsTable')) $table.DataTable().destroy();
  $table.find('thead').html(`<tr>
    <th>${window.ipdEscape(window.t('ipd.ward'))}</th>
    <th>${window.ipdEscape(window.t('ipd.roomNumber'))}</th>
    <th>${window.ipdEscape(window.t('ipd.roomType'))}</th>
    <th>${window.ipdEscape(window.t('ipd.floor'))}</th>
    <th>${window.ipdEscape(window.t('ipd.status'))}</th>
    <th class="text-center">${window.ipdEscape(window.t('common.action'))}</th>
  </tr>`);
  const rows = window.ipdWardBedState.rooms.map(r => {
    const ward = window.ipdWardById(r.Ward_ID);
    return `<tr>
      <td>${window.ipdEscape(ward?.Ward_Name || r.Ward_ID || '-')}</td>
      <td class="fw-bold text-primary">${window.ipdEscape(r.Room_Number || '-')}</td>
      <td>${window.ipdEscape(r.Room_Type ? window.ipdTranslateValue(r.Room_Type) : '-')}</td>
      <td>${window.ipdEscape(r.Floor || ward?.Floor || '-')}</td>
      <td><span class="badge ${r.Status === 'Maintenance' ? 'bg-warning text-dark' : r.Status === 'Inactive' ? 'bg-secondary' : 'bg-success'}">${window.ipdEscape(window.ipdTranslateValue(r.Status || 'Active'))}</span></td>
      <td class="text-center">
        <button class="btn btn-sm btn-primary me-1 btn-ipd-config-edit" title="${window.ipdEscape(window.t('ipd.edit'))}" onclick="window.openIpdRoomModal('${window.ipdEscape(r.Room_ID)}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-outline-secondary me-1 btn-ipd-config-delete" title="${window.ipdEscape(window.t('ipd.disable'))}" onclick="window.deactivateIpdRoom('${window.ipdEscape(r.Room_ID)}')"><i class="fas fa-ban"></i></button>
        <button class="btn btn-sm btn-danger btn-ipd-config-delete" title="${window.ipdEscape(window.t('ipd.delete'))}" onclick="window.deleteIpdRoom('${window.ipdEscape(r.Room_ID)}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
  $('#ipdRoomsTable tbody').html(rows);
  $table.DataTable({ responsive: true, pageLength: 10 });
};

window.renderIpdBedsTable = function () {
  const $table = $('#ipdBedsTable');
  if ($.fn.DataTable.isDataTable('#ipdBedsTable')) $table.DataTable().destroy();
  $table.find('thead').html(`<tr>
    <th>${window.ipdEscape(window.t('ipd.ward'))}</th>
    <th>${window.ipdEscape(window.t('ipd.room'))}</th>
    <th>${window.ipdEscape(window.t('ipd.bedNo'))}</th>
    <th>${window.ipdEscape(window.t('ipd.bedType'))}</th>
    <th>${window.ipdEscape(window.t('ipd.status'))}</th>
    <th>${window.ipdEscape(window.t('ipd.patient'))}</th>
    <th>${window.ipdEscape(window.t('ipd.doctor'))}</th>
    <th>${window.ipdEscape(window.t('ipd.ipdNo'))}</th>
    <th class="text-center">${window.ipdEscape(window.t('common.action'))}</th>
  </tr>`);
  const rows = window.ipdWardBedState.filteredBeds.map(b => {
    const ward = window.ipdWardById(b.Ward_ID);
    const room = window.ipdRoomById(b.Room_ID);
    const info = window.ipdBedPatientInfo(b);
    const reservation = window.ipdReservationInfo(b);
    const status = window.ipdBedStatus(b);
    return `<tr>
      <td>${window.ipdEscape(ward?.Ward_Name || '-')}</td>
      <td>${window.ipdEscape(room?.Room_Number || '-')}</td>
      <td class="fw-bold text-primary">${window.ipdEscape(b.Bed_Number || '-')}</td>
      <td>${window.ipdEscape(window.ipdTranslateValue(b.Bed_Type || 'Standard'))}</td>
      <td>${window.ipdStatusBadge(status)}</td>
      <td>
        <div class="fw-bold">${window.ipdEscape(info.patientName || (status === 'Reserved' ? (reservation.patientName || reservation.hn) : '') || '-')}</div>
        <div class="text-muted small">${status === 'Reserved' ? `${window.ipdEscape(window.t('ipd.reservedFor'))}: HN ${window.ipdEscape(reservation.hn || '-')}` : `HN ${window.ipdEscape(info.hn || '-')}`}</div>
        ${status === 'Reserved' && reservation.phone ? `<div class="text-muted small">${window.ipdEscape(window.t('ipd.phone'))}: ${window.ipdEscape(reservation.phone)}</div>` : ''}
      </td>
      <td>${window.ipdEscape(info.doctor || '-')}</td>
      <td>${window.ipdEscape(info.ipdNo || '-')}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-primary me-1 btn-ipd-config-edit" title="${window.ipdEscape(window.t('ipd.edit'))}" onclick="window.openIpdBedModal('${window.ipdEscape(b.Bed_ID)}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-outline-secondary me-1 btn-ipd-config-delete" title="${window.ipdEscape(window.t('ipd.disable'))}" onclick="window.changeIpdBedStatus('${window.ipdEscape(b.Bed_ID)}','Inactive')"><i class="fas fa-ban"></i></button>
        <button class="btn btn-sm btn-danger btn-ipd-config-delete" title="${window.ipdEscape(window.t('ipd.delete'))}" onclick="window.deleteIpdBed('${window.ipdEscape(b.Bed_ID)}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
  $('#ipdBedsTable tbody').html(rows);
  $table.DataTable({ responsive: true, pageLength: 10 });
};

window.renderIpdMovementTable = function () {
  if ($.fn.DataTable.isDataTable('#ipdMovementTable')) $('#ipdMovementTable').DataTable().destroy();
  const rows = window.ipdWardBedState.movements.map(m => `<tr>
    <td>${window.ipdFormatDateTime(m.Movement_Datetime || m.movement_datetime || m.Created_At)}</td>
    <td><span class="badge bg-primary">${window.ipdEscape(window.ipdTranslateValue(m.Movement_Type || m.movement_type || '-'))}</span></td>
    <td>${window.ipdEscape(m.IPD_Admission_ID || m.ipd_admission_id || '-')}</td>
    <td>${window.ipdEscape(m.Patient_HN || m.patient_hn || '-')}</td>
    <td>${window.ipdMovementLocation(m, 'From')}</td>
    <td>${window.ipdMovementLocation(m, 'To')}</td>
    <td>${window.ipdEscape(m.Reason || m.reason || m.Note || '-')}</td>
    <td>${window.ipdEscape(m.Created_By || m.created_by || '-')}</td>
  </tr>`).join('');
  $('#ipdMovementTable tbody').html(rows);
  $('#ipdMovementTable').DataTable({
    responsive: true,
    pageLength: 10,
    order: [[0, 'desc']],
    language: {
      emptyTable: 'ຍັງບໍ່ມີປະຫວັດການຍ້າຍຕຽງ',
      search: 'ຄົ້ນຫາ:'
    }
  });
};

window.ipdMovementLocation = function (movement, prefix) {
  const ward = window.ipdWardById(movement[`${prefix}_Ward_ID`]);
  const room = window.ipdRoomById(movement[`${prefix}_Room_ID`]);
  const bed = window.ipdBedById(movement[`${prefix}_Bed_ID`]);
  return window.ipdEscape([ward?.Ward_Name, room?.Room_Number, bed?.Bed_Number].filter(Boolean).join(' / ') || '-');
};

window.openIpdWardModal = async function (wardId) {
  const ward = wardId ? window.ipdWardById(wardId) : {};
  const isEdit = !!wardId;
  const result = await Swal.fire({
    title: isEdit ? window.t('ipd.editWard') : window.t('ipd.addWard'),
    width: 720,
    html: `<div class="ipd-form-grid">
      <input type="hidden" id="ipdWardId" value="${window.ipdEscape(ward?.Ward_ID || window.ipdId('WARD'))}">
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.wardName'))}</label><input class="form-control" id="ipdWardName" value="${window.ipdEscape(ward?.Ward_Name || '')}" required></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.wardType'))}</label><select class="form-select" id="ipdWardType">${window.ipdOptions(['Male','Female','Pediatric','Maternity','ICU','Emergency','Private','General','VIP','OPD_Observation'], ward?.Ward_Type || 'General')}</select></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.floor'))}</label><input class="form-control" id="ipdWardFloor" value="${window.ipdEscape(ward?.Floor || '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.status'))}</label><select class="form-select" id="ipdWardStatus">${window.ipdOptions(['Active','Inactive'], ward?.Status || 'Active')}</select></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.description'))}</label><textarea class="form-control" id="ipdWardDescription" rows="2">${window.ipdEscape(ward?.Description || ward?.Notes || '')}</textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const payload = {
        Ward_ID: $('#ipdWardId').val().trim(),
        Ward_Name: $('#ipdWardName').val().trim(),
        Ward_Type: $('#ipdWardType').val(),
        Floor: $('#ipdWardFloor').val().trim(),
        Department: ward?.Department || 'IPD',
        Status: $('#ipdWardStatus').val(),
        Description: $('#ipdWardDescription').val().trim(),
        Notes: $('#ipdWardDescription').val().trim(),
        Updated_At: new Date().toISOString()
      };
      if (!payload.Ward_Name) {
        Swal.showValidationMessage(window.t('ipd.wardRequired'));
        return false;
      }
      return payload;
    }
  });
  if (!result.isConfirmed) return;

  const payload = result.value;
  const fallback = { Ward_ID: payload.Ward_ID, Ward_Name: payload.Ward_Name, Department: payload.Department, Floor: payload.Floor, Status: payload.Status, Notes: payload.Notes };
  const res = await window.ipdMutate('Wards', isEdit ? 'update' : 'insert', payload, { Ward_ID: payload.Ward_ID }, fallback);
  if (res.error) return Swal.fire(window.t('common.error'), res.error.message, 'error');
  await window.loadIpdWardBedManagement();
  Swal.fire(window.t('common.saved'), window.t('ipd.wardSaved'), 'success');
};

window.openIpdRoomModal = async function (roomId, opts = {}) {
  if (!window.ipdWardBedState.wards.length) return Swal.fire(window.t('ipd.createWardFirst'), window.t('ipd.createWardFirstText'), 'warning');
  const room = roomId ? window.ipdRoomById(roomId) : {};
  const isEdit = !!roomId;
  const isVipWard = window.ipdIsVipWard;
  const vipOnly = !!opts.vipOnly || (isEdit && isVipWard(window.ipdWardById(room?.Ward_ID)));
  const wardList = vipOnly ? window.ipdWardBedState.wards.filter(isVipWard) : window.ipdWardBedState.wards;
  if (vipOnly && !wardList.length) return Swal.fire(window.t('ipd.noVipWard'), window.t('ipd.noVipWardText'), 'warning');
  const autoVipWardId = vipOnly ? String(room?.Ward_ID || wardList[0]?.Ward_ID || '') : '';
  const wardOptions = wardList.map(w => `<option value="${window.ipdEscape(w.Ward_ID)}" ${String(room?.Ward_ID || '') === String(w.Ward_ID) ? 'selected' : ''}>${window.ipdEscape(w.Ward_Name || w.Ward_ID)}</option>`).join('');
  const defaultRoomType = vipOnly ? 'Private' : 'General';
  const title = isEdit
    ? (vipOnly ? window.t('ipd.editVipRoom') : window.t('ipd.editRoom'))
    : (vipOnly ? window.t('ipd.addVipRoom') : window.t('ipd.addRoom'));
  const wardFieldHtml = vipOnly
    ? `<input type="hidden" id="ipdRoomWard" value="${window.ipdEscape(autoVipWardId)}">`
    : `<div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.ward'))}</label><select class="form-select" id="ipdRoomWard">${wardOptions}</select></div>`;
  const result = await Swal.fire({
    title,
    width: 720,
    customClass: vipOnly ? { popup: 'ipd-vip-modal' } : {},
    html: `<div class="ipd-form-grid">
      <input type="hidden" id="ipdRoomId" value="${window.ipdEscape(room?.Room_ID || window.ipdId('ROOM'))}">
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.roomNumber'))}</label><input class="form-control" id="ipdRoomNumber" value="${window.ipdEscape(room?.Room_Number || '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.roomType'))}</label><select class="form-select" id="ipdRoomType">${window.ipdOptions(['Private','Semi-private','General','ICU','Isolation'], room?.Room_Type || defaultRoomType)}</select></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.floor'))}</label><input class="form-control" id="ipdRoomFloor" value="${window.ipdEscape(room?.Floor || '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.status'))}</label><select class="form-select" id="ipdRoomStatus">${window.ipdOptions(['Active','Inactive','Maintenance'], room?.Status || 'Active')}</select></div>
      ${wardFieldHtml}
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.description'))}</label><textarea class="form-control" id="ipdRoomDescription" rows="2">${window.ipdEscape(room?.Description || room?.Notes || '')}</textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const payload = {
        Room_ID: $('#ipdRoomId').val().trim(),
        Ward_ID: $('#ipdRoomWard').val(),
        Room_Number: $('#ipdRoomNumber').val().trim(),
        Room_Type: $('#ipdRoomType').val(),
        Floor: $('#ipdRoomFloor').val().trim(),
        Status: $('#ipdRoomStatus').val(),
        Description: $('#ipdRoomDescription').val().trim(),
        Notes: $('#ipdRoomDescription').val().trim(),
        Updated_At: new Date().toISOString()
      };
      if (!payload.Room_Number) {
        Swal.showValidationMessage(window.t('ipd.roomRequired'));
        return false;
      }
      return payload;
    }
  });
  if (!result.isConfirmed) return;

  const payload = result.value;
  const fallback = { Room_ID: payload.Room_ID, Ward_ID: payload.Ward_ID, Room_Number: payload.Room_Number, Room_Type: payload.Room_Type, Status: payload.Status, Notes: payload.Notes };
  const res = await window.ipdMutate('Rooms', isEdit ? 'update' : 'insert', payload, { Room_ID: payload.Room_ID }, fallback);
  if (res.error) return Swal.fire(window.t('common.error'), res.error.message, 'error');
  await window.loadIpdWardBedManagement();
  Swal.fire(window.t('common.saved'), window.t('ipd.roomSaved'), 'success');
};

window.openIpdVipRoomModal = function (roomId) {
  return window.openIpdRoomModal(roomId || null, { vipOnly: true });
};

window.openIpdBedModal = async function (bedId) {
  if (!window.ipdWardBedState.rooms.length) return Swal.fire(window.t('ipd.createRoomFirst'), window.t('ipd.createRoomFirstText'), 'warning');
  const bed = bedId ? window.ipdBedById(bedId) : {};
  const isEdit = !!bedId;
  const defaultWardId = String(bed?.Ward_ID || window.ipdWardBedState.wards[0]?.Ward_ID || '');
  const roomOptionsForWard = (wardId, selectedRoomId = '') => {
    const rooms = window.ipdWardBedState.rooms.filter(r => String(r.Ward_ID) === String(wardId));
    if (!rooms.length) return `<option value="" disabled selected>${window.ipdEscape(window.t('ipd.createRoomFirst'))}</option>`;
    return rooms.map((r, index) => {
      const selected = String(selectedRoomId || '') === String(r.Room_ID) || (!selectedRoomId && index === 0);
      return `<option value="${window.ipdEscape(r.Room_ID)}" ${selected ? 'selected' : ''}>${window.ipdEscape(r.Room_Number || '-')}</option>`;
    }).join('');
  };
  const wardOptions = window.ipdWardBedState.wards.map(w => {
    const vip = window.ipdIsVipWard(w);
    const label = (vip ? '\u{1F451} ' : '') + (w.Ward_Name || w.Ward_ID) + (vip ? ' [VIP]' : '');
    return `<option value="${window.ipdEscape(w.Ward_ID)}" data-vip="${vip ? '1' : '0'}" ${defaultWardId === String(w.Ward_ID) ? 'selected' : ''}>${window.ipdEscape(label)}</option>`;
  }).join('');
  const roomOptions = roomOptionsForWard(defaultWardId, bed?.Room_ID || '');
  const result = await Swal.fire({
    title: isEdit ? window.t('ipd.editBed') : window.t('ipd.addBed'),
    width: 720,
    html: `<div class="ipd-form-grid">
      <input type="hidden" id="ipdBedId" value="${window.ipdEscape(bed?.Bed_ID || window.ipdId('BED'))}">
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.ward'))}</label><select class="form-select" id="ipdBedWard">${wardOptions}</select></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.room'))}</label><select class="form-select" id="ipdBedRoom">${roomOptions}</select></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.bedNumber'))}</label><input class="form-control" id="ipdBedNumber" value="${window.ipdEscape(bed?.Bed_Number || '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.bedType'))}</label><select class="form-select" id="ipdBedType">${window.ipdOptions(['Standard','ICU','Pediatric','Delivery','Isolation'], bed?.Bed_Type || 'Standard')}</select></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.status'))}</label><select class="form-select" id="ipdBedStatus">${window.ipdOptions(['Available','Occupied','Reserved','Cleaning','Maintenance','Inactive'], window.ipdBedStatus(bed))}</select></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.notes'))}</label><textarea class="form-control" id="ipdBedNotes" rows="2">${window.ipdEscape(bed?.Notes || '')}</textarea></div>
    </div>`,
    didOpen: () => {
      const $popup = $(Swal.getPopup());
      const applyVipAccent = () => {
        const isVip = String($('#ipdBedWard option:selected').data('vip')) === '1';
        $popup.toggleClass('ipd-vip-modal', isVip);
      };
      const refreshRooms = (selectedRoomId = '') => {
        const wardValue = $('#ipdBedWard').val();
        $('#ipdBedRoom').html(roomOptionsForWard(wardValue, selectedRoomId));
      };
      $('#ipdBedWard').on('change', () => { refreshRooms(); applyVipAccent(); });
      refreshRooms(bed?.Room_ID || '');
      applyVipAccent();
    },
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const payload = {
        Bed_ID: $('#ipdBedId').val().trim(),
        Ward_ID: $('#ipdBedWard').val(),
        Room_ID: $('#ipdBedRoom').val(),
        Bed_Number: $('#ipdBedNumber').val().trim(),
        Bed_Type: $('#ipdBedType').val(),
        Bed_Status: $('#ipdBedStatus').val(),
        Status: $('#ipdBedStatus').val(),
        Notes: $('#ipdBedNotes').val().trim(),
        Last_Status_Updated_At: new Date().toISOString(),
        Updated_At: new Date().toISOString()
      };
      if (!payload.Bed_Number) {
        Swal.showValidationMessage(window.t('ipd.bedNumberRequired'));
        return false;
      }
      if (!payload.Room_ID) {
        Swal.showValidationMessage(window.t('ipd.createRoomFirstText'));
        return false;
      }
      const duplicate = window.ipdWardBedState.beds.some(b =>
        String(b.Bed_ID) !== String(payload.Bed_ID) &&
        String(b.Room_ID) === String(payload.Room_ID) &&
        String(b.Bed_Number).toLowerCase() === String(payload.Bed_Number).toLowerCase()
      );
      if (duplicate) {
        Swal.showValidationMessage(window.t('ipd.bedDuplicate'));
        return false;
      }
      if (payload.Status !== 'Reserved') {
        payload.Reserved_Patient_ID = null;
        payload.Reserved_Patient_HN = null;
        payload.Reserved_Patient_Name = null;
        payload.Reserved_Phone = null;
        payload.Reserved_By = null;
        payload.Reserved_At = null;
        payload.Reserved_From = null;
        payload.Reserved_Until = null;
        payload.Reservation_Reason = null;
        payload.Reservation_Notes = null;
      }
      return payload;
    }
  });
  if (!result.isConfirmed) return;

  const payload = result.value;
  const fallback = { Bed_ID: payload.Bed_ID, Ward_ID: payload.Ward_ID, Room_ID: payload.Room_ID, Bed_Number: payload.Bed_Number, Status: payload.Status, Notes: payload.Notes };
  const res = await window.ipdMutate('Beds', isEdit ? 'update' : 'insert', payload, { Bed_ID: payload.Bed_ID }, fallback);
  if (res.error) return Swal.fire(window.t('common.error'), res.error.message, 'error');
  if (isEdit) await window.createIpdMovement({ bed: payload, movementType: 'Maintenance', note: 'Bed record edited' });
  await window.loadIpdWardBedManagement();
  Swal.fire(window.t('common.saved'), window.t('ipd.bedSaved'), 'success');
};

window.ipdOptions = function (options, selected) {
  return options.map(value => `<option value="${window.ipdEscape(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${window.ipdEscape(window.ipdTranslateValue(value))}</option>`).join('');
};

window.openIpdReserveModal = async function (bedId) {
  const bed = window.ipdBedById(bedId);
  if (!bed || !['Available', 'Reserved'].includes(window.ipdBedStatus(bed))) {
    return Swal.fire(window.t('ipd.cannotReserve'), window.t('ipd.reserveAllowedText'), 'warning');
  }

  const reservation = window.ipdReservationInfo(bed);
  const patients = Object.values(window.ipdWardBedState.patientsById || {})
    .sort((a, b) => String(b.Patient_ID || '').localeCompare(String(a.Patient_ID || '')));
  const patientNameForReservation = (p) => [p?.First_Name, p?.Last_Name].filter(Boolean).join(' ') || p?.Patient_ID || '';
  const patientOptions = patients.map(p => {
    const name = patientNameForReservation(p);
    const label = [name, p.Phone_Number].filter(Boolean).join(' / ');
    return `<option value="${window.ipdEscape(p.Patient_ID)}" label="${window.ipdEscape(label)}">${window.ipdEscape(p.Patient_ID)} - ${window.ipdEscape(label)}</option>`;
  }).join('');
  const selectedReservationPatient = patients.find(p => String(p.Patient_ID || '') === String(reservation.hn || reservation.patientId || ''));
  const initialReservationName = selectedReservationPatient ? patientNameForReservation(selectedReservationPatient) : (reservation.patientName || '');
  const initialReservationPhone = selectedReservationPatient ? (selectedReservationPatient.Phone_Number || '') : (reservation.phone || '');

  const result = await Swal.fire({
    title: window.t('ipd.reserveBedTitle'),
    width: 820,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.selectRegisteredHn'))}</label><input class="form-control" id="ipdReserveHn" list="ipdReservePatientList" autocomplete="off" placeholder="${window.ipdEscape(window.t('ipd.searchHnPlaceholder'))}" value="${window.ipdEscape(reservation.hn || reservation.patientId || '')}"><datalist id="ipdReservePatientList">${patientOptions}</datalist></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.patientName'))}</label><input class="form-control" id="ipdReserveName" value="${window.ipdEscape(initialReservationName)}" readonly></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.phone'))}</label><input class="form-control" id="ipdReservePhone" value="${window.ipdEscape(initialReservationPhone)}" readonly></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.expectedAdmit'))}</label><input type="datetime-local" class="form-control" id="ipdReserveFrom" value="${window.ipdFormDateTimeValue(reservation.reservedFrom || new Date())}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.reserveUntil'))}</label><input type="datetime-local" class="form-control" id="ipdReserveUntil" value="${reservation.reservedUntil ? window.ipdFormDateTimeValue(reservation.reservedUntil) : ''}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.reservedBy'))}</label><input class="form-control" id="ipdReserveBy" value="${window.ipdEscape(reservation.reservedBy || window.ipdCurrentUserName())}"></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.reason'))}</label><input class="form-control" id="ipdReserveReason" value="${window.ipdEscape(reservation.reason || '')}"></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.notes'))}</label><textarea class="form-control" id="ipdReserveNotes" rows="2">${window.ipdEscape(reservation.notes || '')}</textarea></div>
    </div>`,
    didOpen: () => {
      const findPatient = (value) => {
        const typed = String(value || '').trim().toLowerCase();
        if (!typed) return null;
        return patients.find(p => String(p.Patient_ID || '').toLowerCase() === typed) || null;
      };
      const fillPatient = () => {
        const selected = findPatient($('#ipdReserveHn').val());
        $('#ipdReserveName').val(selected ? patientNameForReservation(selected) : '');
        $('#ipdReservePhone').val(selected?.Phone_Number || '');
        return selected;
      };
      $('#ipdReserveHn').on('input change blur', fillPatient);
      fillPatient();
    },
    showCancelButton: true,
    confirmButtonText: window.t('ipd.reserve'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const selectedPatient = patients.find(p => String(p.Patient_ID || '').toLowerCase() === String($('#ipdReserveHn').val() || '').trim().toLowerCase());
      if (!selectedPatient) {
        Swal.showValidationMessage(window.t('ipd.patientMustBeRegistered'));
        return false;
      }
      return {
        patientId: selectedPatient.Patient_ID,
        hn: selectedPatient.Patient_ID,
        patientName: patientNameForReservation(selectedPatient),
        phone: selectedPatient.Phone_Number || '',
        reservedFrom: $('#ipdReserveFrom').val(),
        reservedUntil: $('#ipdReserveUntil').val(),
        reservedBy: $('#ipdReserveBy').val().trim(),
        reason: $('#ipdReserveReason').val().trim(),
        notes: $('#ipdReserveNotes').val().trim()
      };
    }
  });
  if (!result.isConfirmed) return;
  await window.reserveIpdBed(bed, result.value);
};

window.reserveIpdBed = async function (bed, form) {
  const now = new Date().toISOString();
  const payload = {
    Bed_Status: 'Reserved',
    Status: 'Reserved',
    Reserved_Patient_ID: form.patientId || null,
    Reserved_Patient_HN: form.hn || null,
    Reserved_Patient_Name: form.patientName || null,
    Reserved_Phone: form.phone || null,
    Reserved_By: form.reservedBy || window.ipdCurrentUserName(),
    Reserved_At: now,
    Reserved_From: form.reservedFrom ? new Date(form.reservedFrom).toISOString() : now,
    Reserved_Until: form.reservedUntil ? new Date(form.reservedUntil).toISOString() : null,
    Reservation_Reason: form.reason || null,
    Reservation_Notes: form.notes || null,
    Last_Status_Updated_At: now,
    Updated_At: now
  };
  const res = await window.ipdMutate('Beds', 'update', payload, { Bed_ID: bed.Bed_ID }, { Status: 'Reserved' });
  if (res.error) return Swal.fire(window.t('common.error'), res.error.message, 'error');

  await window.createIpdMovement({
    movementType: 'Reserve',
    patientId: form.patientId || null,
    patientHn: form.hn || null,
    toBed: bed,
    movementDatetime: form.reservedFrom || now,
    reason: form.reason,
    note: [form.patientName, form.phone, form.notes].filter(Boolean).join(' | '),
    createdBy: form.reservedBy || window.ipdCurrentUserName()
  });

  await window.loadIpdWardBedManagement();
  Swal.fire(window.t('common.saved'), window.t('ipd.reservedSuccess'), 'success');
};

window.openIpdAssignModal = async function (bedId) {
  const bed = window.ipdBedById(bedId);
  if (!bed || !['Available', 'Reserved'].includes(window.ipdBedStatus(bed))) {
    return Swal.fire(window.t('ipd.cannotAssign'), window.t('ipd.assignAllowedText'), 'warning');
  }
  const activeAdmissions = window.ipdWardBedState.admissions.filter(a => window.ipdIsActiveAdmission(a));
  if (!activeAdmissions.length) return Swal.fire(window.t('ipd.noActiveAdmission'), window.t('ipd.noActiveAdmissionText'), 'warning');
  const admissionOptions = activeAdmissions.map(a => `<option value="${window.ipdEscape(a.Admission_ID)}">${window.ipdEscape(a.Admission_ID)} - ${window.ipdEscape(a.Patient_Name || a.Patient_ID || '')}</option>`).join('');

  const result = await Swal.fire({
    title: window.t('ipd.assignTitle'),
    width: 720,
    html: `<div class="ipd-form-grid">
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.ipdAdmission'))}</label><select class="form-select" id="ipdAssignAdmission">${admissionOptions}</select></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.ward'))}</label><input class="form-control" value="${window.ipdEscape(window.ipdWardById(bed.Ward_ID)?.Ward_Name || bed.Ward_ID)}" readonly></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.roomBed'))}</label><input class="form-control" value="${window.ipdEscape(window.ipdRoomById(bed.Room_ID)?.Room_Number || bed.Room_ID)} / ${window.ipdEscape(bed.Bed_Number)}" readonly></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.assignedDateTime'))}</label><input type="datetime-local" class="form-control" id="ipdAssignDateTime" value="${new Date().toISOString().slice(0, 16)}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.assignedBy'))}</label><input class="form-control" id="ipdAssignBy" value="${window.ipdEscape(currentUser?.name || currentUser?.id || '')}"></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.note'))}</label><textarea class="form-control" id="ipdAssignNote" rows="2"></textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('ipd.assign'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => ({
      admissionId: $('#ipdAssignAdmission').val(),
      movementDateTime: $('#ipdAssignDateTime').val(),
      assignedBy: $('#ipdAssignBy').val(),
      note: $('#ipdAssignNote').val()
    })
  });
  if (!result.isConfirmed) return;

  await window.assignIpdPatientToBed(bed, result.value);
};

window.assignIpdPatientToBed = async function (bed, form) {
  const admission = window.ipdWardBedState.admissions.find(a => String(a.Admission_ID) === String(form.admissionId));
  if (!admission) return Swal.fire(window.t('common.error'), window.t('ipd.admissionNotFound'), 'error');
  const now = new Date().toISOString();
  const bedPayload = {
    Bed_Status: 'Occupied',
    Status: 'Occupied',
    Current_Patient_ID: admission.Patient_ID || null,
    Current_Patient_HN: admission.Patient_ID || null,
    Current_IPD_Admission_ID: admission.Admission_ID,
    Reserved_Patient_ID: null,
    Reserved_Patient_HN: null,
    Reserved_Patient_Name: null,
    Reserved_Phone: null,
    Reserved_By: null,
    Reserved_At: null,
    Reserved_From: null,
    Reserved_Until: null,
    Reservation_Reason: null,
    Reservation_Notes: null,
    Last_Status_Updated_At: now,
    Updated_At: now
  };
  const bedFallback = { Status: 'Occupied' };
  const admissionPayload = { Ward_ID: bed.Ward_ID, Room_ID: bed.Room_ID, Bed_ID: bed.Bed_ID, Status: admission.Status || 'Admitted' };

  const bedRes = await window.ipdMutate('Beds', 'update', bedPayload, { Bed_ID: bed.Bed_ID }, bedFallback);
  if (bedRes.error) return Swal.fire(window.t('common.error'), bedRes.error.message, 'error');
  const admissionRes = await window.ipdMutate('Admissions', 'update', admissionPayload, { Admission_ID: admission.Admission_ID }, admissionPayload);
  if (admissionRes.error) console.warn('Admission update error:', admissionRes.error);
  await window.copyLatestOpdVitalsToIpdAdmission(admission.Admission_ID, admission.Patient_ID);

  await window.createIpdMovement({
    movementType: 'Assign',
    admission,
    patientHn: admission.Patient_ID,
    toBed: bed,
    movementDatetime: form.movementDateTime,
    note: form.note,
    createdBy: form.assignedBy
  });
  await window.loadIpdWardBedManagement();
  Swal.fire(window.t('ipd.assign'), window.t('ipd.assignedSuccess'), 'success');
};

window.openIpdTransferModal = async function (sourceBedId) {
  const sourceBed = window.ipdBedById(sourceBedId);
  if (!sourceBed || window.ipdBedStatus(sourceBed) !== 'Occupied') return Swal.fire(window.t('ipd.cannotTransfer'), window.t('ipd.sourceOccupiedText'), 'warning');
  const info = window.ipdBedPatientInfo(sourceBed);
  if (!info.admission || !window.ipdIsActiveAdmission(info.admission)) return Swal.fire(window.t('ipd.cannotTransfer'), window.t('ipd.noLinkedAdmissionText'), 'warning');
  const destinations = window.ipdWardBedState.beds.filter(b => String(b.Bed_ID) !== String(sourceBedId) && ['Available', 'Reserved'].includes(window.ipdBedStatus(b)));
  if (!destinations.length) return Swal.fire(window.t('ipd.noDestinationBed'), window.t('ipd.noDestinationBedText'), 'warning');
  const destinationOptions = destinations.map(b => {
    const ward = window.ipdWardById(b.Ward_ID);
    const room = window.ipdRoomById(b.Room_ID);
    return `<option value="${window.ipdEscape(b.Bed_ID)}">${window.ipdEscape(ward?.Ward_Name || b.Ward_ID)} / ${window.ipdEscape(window.t('ipd.room'))} ${window.ipdEscape(room?.Room_Number || b.Room_ID)} / ${window.ipdEscape(window.t('ipd.bedNo'))} ${window.ipdEscape(b.Bed_Number)}</option>`;
  }).join('');

  const result = await Swal.fire({
    title: window.t('ipd.transferTitle'),
    width: 720,
    html: `<div class="ipd-form-grid">
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.ipdAdmission'))}</label><input class="form-control" value="${window.ipdEscape(info.ipdNo)} - ${window.ipdEscape(info.patientName)}" readonly></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.destinationBed'))}</label><select class="form-select" id="ipdTransferDestination">${destinationOptions}</select></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.transferDateTime'))}</label><input type="datetime-local" class="form-control" id="ipdTransferDateTime" value="${new Date().toISOString().slice(0, 16)}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.transferredBy'))}</label><input class="form-control" id="ipdTransferBy" value="${window.ipdEscape(currentUser?.name || currentUser?.id || '')}"></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.reason'))}</label><input class="form-control" id="ipdTransferReason"></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.note'))}</label><textarea class="form-control" id="ipdTransferNote" rows="2"></textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('ipd.transfer'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => ({
      destinationBedId: $('#ipdTransferDestination').val(),
      movementDateTime: $('#ipdTransferDateTime').val(),
      reason: $('#ipdTransferReason').val(),
      note: $('#ipdTransferNote').val(),
      createdBy: $('#ipdTransferBy').val()
    })
  });
  if (!result.isConfirmed) return;

  await window.transferIpdPatientBed(sourceBed, result.value);
};

window.transferIpdPatientBed = async function (sourceBed, form) {
  const destinationBed = window.ipdBedById(form.destinationBedId);
  const admission = window.ipdAdmissionForBed(sourceBed);
  if (!destinationBed || !['Available', 'Reserved'].includes(window.ipdBedStatus(destinationBed))) return Swal.fire(window.t('ipd.cannotTransfer'), window.t('ipd.destinationAvailableText'), 'warning');
  if (!admission) return Swal.fire(window.t('ipd.cannotTransfer'), window.t('ipd.noLinkedAdmissionText'), 'warning');

  const now = new Date().toISOString();
  const sourceRes = await window.ipdMutate('Beds', 'update', {
    Bed_Status: 'Cleaning',
    Status: 'Cleaning',
    Current_Patient_ID: null,
    Current_Patient_HN: null,
    Current_IPD_Admission_ID: null,
    Last_Status_Updated_At: now,
    Updated_At: now
  }, { Bed_ID: sourceBed.Bed_ID }, { Status: 'Cleaning' });
  if (sourceRes.error) return Swal.fire(window.t('common.error'), sourceRes.error.message, 'error');

  const destRes = await window.ipdMutate('Beds', 'update', {
    Bed_Status: 'Occupied',
    Status: 'Occupied',
    Current_Patient_ID: admission.Patient_ID || null,
    Current_Patient_HN: admission.Patient_ID || null,
    Current_IPD_Admission_ID: admission.Admission_ID,
    Reserved_Patient_ID: null,
    Reserved_Patient_HN: null,
    Reserved_Patient_Name: null,
    Reserved_Phone: null,
    Reserved_By: null,
    Reserved_At: null,
    Reserved_From: null,
    Reserved_Until: null,
    Reservation_Reason: null,
    Reservation_Notes: null,
    Last_Status_Updated_At: now,
    Updated_At: now
  }, { Bed_ID: destinationBed.Bed_ID }, { Status: 'Occupied' });
  if (destRes.error) return Swal.fire(window.t('common.error'), destRes.error.message, 'error');

  await window.ipdMutate('Admissions', 'update', {
    Ward_ID: destinationBed.Ward_ID,
    Room_ID: destinationBed.Room_ID,
    Bed_ID: destinationBed.Bed_ID
  }, { Admission_ID: admission.Admission_ID }, {
    Ward_ID: destinationBed.Ward_ID,
    Room_ID: destinationBed.Room_ID,
    Bed_ID: destinationBed.Bed_ID
  });

  await window.createIpdMovement({
    movementType: 'Transfer',
    admission,
    patientHn: admission.Patient_ID,
    fromBed: sourceBed,
    toBed: destinationBed,
    movementDatetime: form.movementDateTime,
    reason: form.reason,
    note: form.note,
    createdBy: form.createdBy
  });

  await window.loadIpdWardBedManagement();
  Swal.fire(window.t('ipd.transfer'), window.t('ipd.transferredSuccess'), 'success');
};

window.changeIpdBedStatus = async function (bedId, nextStatus) {
  const bed = window.ipdBedById(bedId);
  if (!bed) return;
  const currentStatus = window.ipdBedStatus(bed);
  if (currentStatus === nextStatus) return;
  const info = window.ipdBedPatientInfo(bed);
  if (currentStatus === 'Inactive') return Swal.fire(window.t('ipd.cannotChangeStatus'), window.t('ipd.inactiveNoAction'), 'warning');
  if (nextStatus === 'Occupied') return Swal.fire(window.t('ipd.cannotChangeStatus'), window.t('ipd.directOccupiedBlocked'), 'warning');
  if (currentStatus === 'Occupied' && nextStatus === 'Available') return Swal.fire(window.t('ipd.cannotChangeStatus'), window.t('ipd.occupiedToAvailableBlocked'), 'warning');
  if (currentStatus === 'Occupied' && nextStatus === 'Cleaning' && (!info.admission || !window.ipdIsActiveAdmission(info.admission))) {
    return Swal.fire(window.t('ipd.cannotChangeStatus'), window.t('ipd.dischargeNeedsAdmission'), 'warning');
  }
  if (nextStatus === 'Inactive' && currentStatus === 'Occupied') return Swal.fire(window.t('ipd.cannotDeactivate'), window.t('ipd.occupiedCannotDeactivate'), 'warning');

  const movementType = window.ipdMovementTypeForStatus(currentStatus, nextStatus);
  const now = new Date().toISOString();
  const clearPatient = ['Available', 'Cleaning', 'Maintenance', 'Inactive'].includes(nextStatus);
  const payload = {
    Bed_Status: nextStatus,
    Status: nextStatus,
    Last_Status_Updated_At: now,
    Updated_At: now
  };
  if (clearPatient) {
    payload.Current_Patient_ID = null;
    payload.Current_Patient_HN = null;
    payload.Current_IPD_Admission_ID = null;
  }
  if (nextStatus !== 'Reserved') {
    payload.Reserved_Patient_ID = null;
    payload.Reserved_Patient_HN = null;
    payload.Reserved_Patient_Name = null;
    payload.Reserved_Phone = null;
    payload.Reserved_By = null;
    payload.Reserved_At = null;
    payload.Reserved_From = null;
    payload.Reserved_Until = null;
    payload.Reservation_Reason = null;
    payload.Reservation_Notes = null;
  }

  const res = await window.ipdMutate('Beds', 'update', payload, { Bed_ID: bed.Bed_ID }, { Status: nextStatus });
  if (res.error) return Swal.fire(window.t('common.error'), res.error.message, 'error');

  if (info.admission && nextStatus === 'Cleaning') {
    await window.ipdMutate('Admissions', 'update', { Status: 'Discharged' }, { Admission_ID: info.admission.Admission_ID }, { Status: 'Discharged' });
  }

  await window.createIpdMovement({
    movementType,
    admission: info.admission,
    patientHn: info.hn,
    fromBed: bed,
    toBed: ['Available', 'Maintenance'].includes(nextStatus) ? bed : null,
    note: `${currentStatus} to ${nextStatus}`,
    createdBy: currentUser?.name || currentUser?.id || ''
  });

  await window.loadIpdWardBedManagement();
  Swal.fire(window.t('common.updated'), window.t('ipd.statusChanged'), 'success');
};

window.ipdMovementTypeForStatus = function (fromStatus, toStatus) {
  if (fromStatus === 'Available' && toStatus === 'Occupied') return 'Assign';
  if (fromStatus === 'Occupied' && toStatus === 'Cleaning') return 'Discharge';
  if (fromStatus === 'Cleaning' && toStatus === 'Available') return 'Available';
  if (toStatus === 'Maintenance') return 'Maintenance';
  if (toStatus === 'Available') return 'Available';
  if (toStatus === 'Cleaning') return 'Cleaning';
  return toStatus;
};

window.createIpdMovement = async function (input) {
  const admission = input.admission || null;
  const fromBed = input.fromBed || null;
  const toBed = input.toBed || null;
  const payload = {
    Movement_ID: window.ipdId('MOV'),
    IPD_Admission_ID: admission?.Admission_ID || input.ipdAdmissionId || null,
    Patient_ID: admission?.Patient_ID || input.patientId || null,
    Patient_HN: input.patientHn || admission?.Patient_ID || null,
    Movement_Type: input.movementType || 'Update',
    From_Ward_ID: fromBed?.Ward_ID || null,
    From_Room_ID: fromBed?.Room_ID || null,
    From_Bed_ID: fromBed?.Bed_ID || null,
    To_Ward_ID: toBed?.Ward_ID || null,
    To_Room_ID: toBed?.Room_ID || null,
    To_Bed_ID: toBed?.Bed_ID || null,
    Movement_Datetime: input.movementDatetime ? new Date(input.movementDatetime).toISOString() : new Date().toISOString(),
    Reason: input.reason || null,
    Note: input.note || null,
    Created_By: input.createdBy || currentUser?.id || currentUser?.name || null,
    Created_At: new Date().toISOString()
  };

  const res = await supabaseClient.from(dbTable('Bed_Movements')).insert([payload]);
  if (res.error) console.warn('Movement history not saved. Apply IPD migration if needed:', res.error);
  return res;
};

window.deactivateIpdWard = async function (wardId) {
  const hasRooms = window.ipdWardBedState.rooms.some(r => String(r.Ward_ID) === String(wardId));
  if (hasRooms) return Swal.fire(window.t('ipd.cannotDeleteWard'), window.t('ipd.wardHasRoomsText'), 'warning').then(async () => {
    await window.ipdMutate('Wards', 'update', { Status: 'Inactive', Updated_At: new Date().toISOString() }, { Ward_ID: wardId }, { Status: 'Inactive' });
    window.loadIpdWardBedManagement();
  });
  await window.ipdMutate('Wards', 'update', { Status: 'Inactive', Updated_At: new Date().toISOString() }, { Ward_ID: wardId }, { Status: 'Inactive' });
  await window.loadIpdWardBedManagement();
};

window.deactivateIpdRoom = async function (roomId) {
  const hasBeds = window.ipdWardBedState.beds.some(b => String(b.Room_ID) === String(roomId));
  if (hasBeds) {
    await Swal.fire(window.t('ipd.cannotDeleteRoom'), window.t('ipd.roomHasBedsText'), 'warning');
  }
  await window.ipdMutate('Rooms', 'update', { Status: 'Inactive', Updated_At: new Date().toISOString() }, { Room_ID: roomId }, { Status: 'Inactive' });
  await window.loadIpdWardBedManagement();
};

window.deleteIpdWard = async function (wardId) {
  const ward = window.ipdWardById(wardId);
  const childRooms = window.ipdWardBedState.rooms.filter(r => String(r.Ward_ID) === String(wardId));
  if (childRooms.length) {
    return Swal.fire(window.t('ipd.cannotDeleteWard'), `${window.t('ipd.wardHasRoomsText')} (${childRooms.length})`, 'warning');
  }
  const confirm = await Swal.fire({
    title: window.t('common.warning'),
    html: `${window.ipdEscape(window.t('ipd.confirmDeleteWard'))}<br><strong>${window.ipdEscape(ward?.Ward_Name || wardId)}</strong>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: window.t('ipd.delete'),
    cancelButtonText: window.t('common.cancel'),
    confirmButtonColor: '#dc2626'
  });
  if (!confirm.isConfirmed) return;
  const { error } = await supabaseClient.from(dbTable('Wards')).delete().eq('Ward_ID', wardId);
  if (error) return Swal.fire(window.t('common.error'), error.message, 'error');
  await window.loadIpdWardBedManagement();
  Swal.fire({ title: window.t('common.saved'), icon: 'success', timer: 1100, showConfirmButton: false });
};

window.deleteIpdBed = async function (bedId) {
  const bed = window.ipdBedById(bedId);
  if (!bed) return;
  const status = window.ipdBedStatus(bed);
  if (status === 'Occupied') {
    return Swal.fire(window.t('common.warning'), window.t('ipd.cannotDeleteBedOccupied'), 'warning');
  }
  if (status === 'Reserved') {
    return Swal.fire(window.t('common.warning'), window.t('ipd.cannotDeleteBedReserved'), 'warning');
  }
  const confirm = await Swal.fire({
    title: window.t('common.warning'),
    html: `${window.ipdEscape(window.t('ipd.confirmDeleteBed'))}<br><strong>${window.ipdEscape(bed.Bed_Number || bedId)}</strong>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: window.t('ipd.delete'),
    cancelButtonText: window.t('common.cancel'),
    confirmButtonColor: '#dc2626'
  });
  if (!confirm.isConfirmed) return;
  const { error } = await supabaseClient.from(dbTable('Beds')).delete().eq('Bed_ID', bedId);
  if (error) return Swal.fire(window.t('common.error'), error.message, 'error');
  await window.loadIpdWardBedManagement();
  Swal.fire({ title: window.t('common.saved'), icon: 'success', timer: 1100, showConfirmButton: false });
};

window.deleteIpdRoom = async function (roomId) {
  const room = window.ipdWardBedState.rooms.find(r => String(r.Room_ID) === String(roomId));
  const childBeds = window.ipdWardBedState.beds.filter(b => String(b.Room_ID) === String(roomId));
  if (childBeds.length) {
    return Swal.fire(window.t('ipd.cannotDeleteRoom'), `${window.t('ipd.roomHasBedsText')} (${childBeds.length})`, 'warning');
  }
  const confirm = await Swal.fire({
    title: window.t('common.warning'),
    html: `${window.ipdEscape(window.t('ipd.confirmDeleteRoom'))}<br><strong>${window.ipdEscape(room?.Room_Number || roomId)}</strong>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: window.t('ipd.delete'),
    cancelButtonText: window.t('common.cancel'),
    confirmButtonColor: '#dc2626'
  });
  if (!confirm.isConfirmed) return;
  const { error } = await supabaseClient.from(dbTable('Rooms')).delete().eq('Room_ID', roomId);
  if (error) return Swal.fire(window.t('common.error'), error.message, 'error');
  await window.loadIpdWardBedManagement();
  Swal.fire({ title: window.t('common.saved'), icon: 'success', timer: 1100, showConfirmButton: false });
};

window.ipdClinicalState = {
  admissionId: null,
  admission: null,
  visits: [],
  doctorNotes: [],
  nursingNotes: [],
  vitals: [],
  medicationOrders: [],
  radiology: [],
  procedures: [],
  billing: [],
  dischargeSummary: null,
  rounds: [],
  providers: [],
  movements: [],
  timelineFilter: 'all',
  timelineLimit: 200
};

window.ipdParseJsonArray = function (value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

window.ipdFormDateTimeValue = function (value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 16);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

window.ipdFormDateValue = function (value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
};

window.ipdCurrentUserName = function () {
  return currentUser?.name || currentUser?.username || currentUser?.id || window.t('ipd.doctor');
};

window.ipdClinicalEmpty = function (icon, title, text) {
  return `<div class="ipd-chart-empty-card">
    <i class="${window.ipdEscape(icon || 'fas fa-folder-open')}"></i>
    <strong>${window.ipdEscape(title || '')}</strong>
    <span>${window.ipdEscape(text || window.t('ipd.noChartDataYet'))}</span>
  </div>`;
};

window.ipdClinicalTable = function (headers, rows) {
  return `<div class="table-responsive"><table class="table table-sm table-hover align-middle ipd-clinical-table">
    <thead><tr>${headers.map(h => `<th>${window.ipdEscape(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table></div>`;
};

window.ipdSelectClinical = async function (tableName, admissionId, orderColumn, ascending = false) {
  const query = supabaseClient.from(dbTable(tableName)).select('*').eq('Admission_ID', admissionId);
  const res = await query.order(orderColumn, { ascending });
  if (res.error) {
    if (window.ipdNeedsMigration(res.error)) {
      console.warn(`${tableName} is not available yet. Apply IPD clinical migration.`, res.error);
      return [];
    }
    throw res.error;
  }
  return res.data || [];
};

window.ipdUpsertClinical = async function (tableName, idColumn, payload, existingId) {
  const table = supabaseClient.from(dbTable(tableName));
  const res = existingId
    ? await table.update({ ...payload, Updated_At: new Date().toISOString() }).eq(idColumn, existingId)
    : await table.insert([{ ...payload, Created_At: new Date().toISOString(), Updated_At: new Date().toISOString() }]);
  if (res.error) return Swal.fire(window.t('common.error'), res.error.message, 'error');
  await window.loadIpdClinicalChart(window.ipdCurrentChartAdmissionId);
  Swal.fire({ title: window.t('common.saved'), icon: 'success', timer: 1200, showConfirmButton: false });
};

window.ipdDeleteClinical = async function (tableName, idColumn, id) {
  const confirm = await Swal.fire({
    title: window.t('common.warning'),
    text: window.t('ipd.deleteRecord'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: window.t('ipd.delete'),
    cancelButtonText: window.t('common.cancel')
  });
  if (!confirm.isConfirmed) return;
  const { error } = await supabaseClient.from(dbTable(tableName)).delete().eq(idColumn, id);
  if (error) return Swal.fire(window.t('common.error'), error.message, 'error');
  await window.loadIpdClinicalChart(window.ipdCurrentChartAdmissionId);
};

window.fetchIpdClinicalData = async function (admissionId) {
  if (!window.ipdWardBedState.admissions.length) {
    await window.fetchIpdWardBedData();
    window.prepareIpdUnfilteredState();
  }
  const admission = window.ipdWardBedState.admissions.find(a => String(a.Admission_ID) === String(admissionId));
  if (!admission) throw new Error(window.t('ipd.admissionNotFound'));

  const patientId = admission.Patient_ID || '';
  const [
    visitsRes,
    doctorNotes,
    nursingNotes,
    vitals,
    medicationOrders,
    radiology,
    procedures,
    billing,
    dischargeRows,
    rounds,
    providers
  ] = await Promise.all([
    patientId
      ? supabaseClient.from(dbTable('Visits')).select('Visit_ID,Date,Patient_ID,Patient_Name,Department,Diagnosis,Doctor_Name,Lab_Orders_JSON,Prescription_JSON,BP,Temp,Pulse,SpO2,Discharge_Status,Services_List,Physical_Exam,Advice,Follow_Up').eq('Patient_ID', patientId).order('Date', { ascending: false }).limit(1000)
      : Promise.resolve({ data: [], error: null }),
    window.ipdSelectClinical('IPD_Doctor_Notes', admissionId, 'Note_Datetime'),
    window.ipdSelectClinical('IPD_Nursing_Notes', admissionId, 'Note_Datetime'),
    window.ipdSelectClinical('IPD_Vital_Signs', admissionId, 'Recorded_At'),
    window.ipdSelectClinical('IPD_Medication_Orders', admissionId, 'Ordered_At'),
    window.ipdSelectClinical('IPD_Radiology_Orders', admissionId, 'Request_Datetime'),
    window.ipdSelectClinical('IPD_Procedures', admissionId, 'Procedure_Datetime'),
    window.ipdSelectClinical('IPD_Billing_Items', admissionId, 'Item_Date'),
    window.ipdSelectClinical('IPD_Discharge_Summaries', admissionId, 'Created_At'),
    window.ipdSelectClinical('IPD_Visits', admissionId, 'Visit_Datetime'),
    window.ipdLoadProviders()
  ]);

  if (visitsRes.error) console.warn('IPD linked visits/LIS load error:', visitsRes.error);

  window.ipdClinicalState = {
    admissionId,
    admission,
    visits: visitsRes.error ? [] : (visitsRes.data || []),
    doctorNotes,
    nursingNotes,
    vitals,
    medicationOrders,
    radiology,
    procedures,
    billing,
    dischargeSummary: dischargeRows[0] || null,
    rounds: rounds || [],
    providers: providers || [],
    movements: (window.ipdWardBedState.movements || []).filter(m => String(m.IPD_Admission_ID || '') === String(admissionId)),
    timelineFilter: window.ipdClinicalState.timelineFilter || 'all',
    timelineLimit: window.ipdClinicalState.timelineLimit || 200
  };
  if (window.ipdActiveVisitId) {
    const stillOpen = (rounds || []).find(r => String(r.Visit_ID) === String(window.ipdActiveVisitId) && String(r.Status || 'Open').toLowerCase() === 'open');
    if (!stillOpen) window.ipdActiveVisitId = null;
  }
  return window.ipdClinicalState;
};

window.loadIpdClinicalChart = async function (admissionId) {
  if (!admissionId) return;
  window.ipdCurrentChartAdmissionId = admissionId;
  $('#ipdChartSummaryPanel').html(`<div class="text-muted small py-2">${window.ipdEscape(window.t('ipd.loadingData'))}</div>`);
  try {
    await window.fetchIpdClinicalData(admissionId);
    window.renderIpdChartPage(admissionId);
  } catch (err) {
    console.error('IPD chart load error:', err);
    $('#ipdChartSummaryPanel').html(`<div class="alert alert-danger mb-0">${window.ipdEscape(err.message || err)}</div>`);
  }
};

window.renderIpdChartPage = function (admissionId) {
  const admission = window.ipdWardBedState.admissions.find(a => String(a.Admission_ID) === String(admissionId));
  if (!admission) {
    $('#ipdChartSubtitle').text(window.t('ipd.noActiveChartText'));
    $('#ipdPatientTimeline').html(`<div class="alert alert-warning mb-0">${window.ipdEscape(window.t('ipd.noActiveChartText'))}</div>`);
    return;
  }
  const patientName = window.ipdPatientName(admission) || admission.Patient_ID || '-';
  const readOnly = !window.ipdIsActiveAdmission(admission);
  window.ipdCurrentChartReadOnly = readOnly;
  $('#ipdChartSubtitle').text(`${admission.Admission_ID || '-'} · HN ${admission.Patient_ID || '-'} · ${patientName}`);
  const $banner = $('#ipdChartReadOnlyBanner');
  if (readOnly) {
    const html = `<div id="ipdChartReadOnlyBanner" class="alert alert-info py-2 mb-2"><i class="fas fa-history me-1"></i>${window.ipdEscape(window.t('ipd.historyChartReadOnly'))}</div>`;
    if ($banner.length) $banner.replaceWith(html);
    else $('#ipdChartSubtitle').closest('.ipd-page-header, .ipd-chart-header, .card, .container, body').first().prepend(html);
  } else if ($banner.length) {
    $banner.remove();
  }
  window.renderIpdTimeline();
};

window.viewIpdChart = function (admissionId) {
  if (!admissionId || admissionId === '-') return Swal.fire(window.t('ipd.noIpdChart'), window.t('ipd.noIpdChartText'), 'info');
  const admission = window.ipdWardBedState.admissions.find(a => String(a.Admission_ID) === String(admissionId));
  if (!admission) return Swal.fire(window.t('ipd.noIpdChart'), window.t('ipd.noActiveChartText'), 'info');
  window.ipdCurrentChartAdmissionId = admissionId;
  window.ipdCurrentChartReadOnly = !window.ipdIsActiveAdmission(admission);
  if (window.history?.pushState) window.history.pushState({ view: 'ipd_chart', admissionId }, '', `/ipd/chart/${encodeURIComponent(admissionId)}`);
  window.loadView('ipd_chart');
};

window.renderIpdPatientHeader = function (admission, context = {}) {
  const patientName = context.patientName || window.ipdPatientName(admission) || admission.Patient_ID || '-';
  const location = context.location || window.ipdAdmissionLocation(admission);
  const doctor = context.doctor || window.ipdDoctorName(admission) || '-';
  const diagnosis = context.diagnosis || admission.Diagnosis_Admission || admission.Diagnosis || '-';
  const admitAt = context.admitAt || [admission.Admission_Date, admission.Admission_Time].filter(Boolean).join(' ') || '-';
  const status = admission.Discharge_Date || admission.Discharge_Status ? 'Discharged' : (admission.Status || 'Admitted');
  $('#ipdChartSummaryPanel').html(`<div class="ipd-patient-header-main">
    <div class="ipd-patient-title">
      <span>${window.ipdEscape(window.t('ipd.patient'))}</span>
      <strong>${window.ipdEscape(patientName)}</strong>
      <div>HN ${window.ipdEscape(admission.Patient_ID || '-')} | IPD ${window.ipdEscape(admission.Admission_ID || '-')}</div>
    </div>
    <div class="ipd-patient-header-grid">
      <div><span>${window.ipdEscape(window.t('ipd.diagnosis'))}</span><strong>${window.ipdEscape(diagnosis)}</strong></div>
      <div><span>${window.ipdEscape(window.t('ipd.doctor'))}</span><strong>${window.ipdEscape(doctor)}</strong></div>
      <div><span>${window.ipdEscape(window.t('ipd.wardRoomBed'))}</span><strong>${window.ipdEscape(location.label)}</strong></div>
      <div><span>${window.ipdEscape(window.t('ipd.admissionDate'))}</span><strong>${window.ipdEscape(admitAt)}</strong></div>
      <div><span>${window.ipdEscape(window.t('ipd.los'))}</span><strong>${window.ipdEscape(window.ipdLengthOfStay(admission))}</strong></div>
      <div><span>${window.ipdEscape(window.t('ipd.currentStatus'))}</span><strong>${window.ipdEscape(window.ipdTranslateValue(status))}</strong></div>
    </div>
  </div>`);
};

window.ipdLatestLabEvent = function () {
  const labEvents = [];
  window.ipdClinicalState.visits.forEach(v => {
    window.ipdParseJsonArray(v.Lab_Orders_JSON).forEach(lab => {
      const name = typeof lab === 'string' ? lab : (lab.name || lab.label || lab.Lab_Name || '-');
      const result = typeof lab === 'object' ? (lab.result || lab.Result || lab.value || lab.Value || 'Ordered') : 'Ordered';
      const displayResult = result === 'Ordered' ? window.ipdTranslateValue(result) : result;
      labEvents.push({ at: v.Date, label: `${name}: ${displayResult}` });
    });
  });
  return labEvents.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))[0] || null;
};

window.ipdLatestDoctorNote = function () {
  return window.ipdClinicalState.doctorNotes[0] || null;
};

window.renderIpdClinicalSnapshot = function () {
  const state = window.ipdClinicalState;
  const latestVitals = state.vitals[0] || null;
  const latestLab = window.ipdLatestLabEvent();
  const latestNote = window.ipdLatestDoctorNote();
  const cards = [
    [window.t('ipd.temperature'), latestVitals?.Temperature ? `${latestVitals.Temperature} °C` : '-'],
    ['BP', latestVitals?.BP_Systolic || latestVitals?.BP_Diastolic ? `${latestVitals.BP_Systolic || '-'}/${latestVitals.BP_Diastolic || '-'}` : '-'],
    [window.t('ipd.pulse'), latestVitals?.Pulse || '-'],
    ['SpO2', latestVitals?.SpO2 ? `${latestVitals.SpO2}%` : '-'],
    [window.t('ipd.latestDoctorNote'), latestNote ? (latestNote.Assessment || latestNote.Subjective || window.t('ipd.soapNote')) : '-'],
    [window.t('ipd.latestLabResult'), latestLab?.label || '-'],
  ];
  $('#ipdClinicalSnapshot').html(`<div class="ipd-snapshot-title"><i class="fas fa-stethoscope"></i>${window.ipdEscape(window.t('ipd.clinicalSnapshot'))}</div>
    <div class="ipd-snapshot-grid">${cards.map(([label, value]) => `<div class="ipd-snapshot-card"><span>${window.ipdEscape(label)}</span><strong>${window.ipdEscape(value)}</strong></div>`).join('')}</div>`);
};

// ===== IPD Visit / Ward Round support =====
window.ipdProvidersCache = window.ipdProvidersCache || null;
window.ipdActiveVisitId = window.ipdActiveVisitId || null;

window.ipdLoadProviders = async function (force) {
  if (window.ipdProvidersCache && !force) return window.ipdProvidersCache;
  try {
    const { data, error } = await supabaseClient.from(dbTable('Users'))
      .select('ID,Name,Email,Role,Status')
      .neq('Status', 'inactive');
    if (error) { console.warn('ipdLoadProviders error:', error); return []; }
    window.ipdProvidersCache = (data || []).map(u => ({
      id: String(u.ID),
      name: u.Name || u.Email || `User ${u.ID}`,
      role: String(u.Role || '').toLowerCase()
    }));
    return window.ipdProvidersCache;
  } catch (err) {
    console.warn('ipdLoadProviders failed:', err);
    return [];
  }
};

window.ipdCurrentProviderDefault = function () {
  const list = window.ipdProvidersCache || [];
  if (currentUser?.id) {
    const match = list.find(p => String(p.id) === String(currentUser.id));
    if (match) return match;
  }
  if (currentUser?.name) {
    const match = list.find(p => String(p.name).toLowerCase() === String(currentUser.name).toLowerCase());
    if (match) return match;
  }
  return { id: currentUser?.id || '', name: window.ipdCurrentUserName(), role: String(currentUser?.role || '').toLowerCase() };
};

window.ipdProviderOptions = function (selectedId, roleFilter) {
  const all = window.ipdProvidersCache || [];
  const wanted = Array.isArray(roleFilter) ? roleFilter.map(r => String(r).toLowerCase()) : (roleFilter ? [String(roleFilter).toLowerCase()] : null);
  const list = wanted ? all.filter(p => wanted.includes(p.role) || p.role === 'admin') : all;
  const blank = `<option value="">${window.ipdEscape('-- ' + window.t('ipd.selectProvider') + ' --')}</option>`;
  return blank + list.map(p =>
    `<option value="${window.ipdEscape(p.id)}" data-name="${window.ipdEscape(p.name)}" data-role="${window.ipdEscape(p.role)}" ${String(p.id) === String(selectedId || '') ? 'selected' : ''}>${window.ipdEscape(p.name)} (${window.ipdEscape(p.role || '-')})</option>`
  ).join('');
};

window.ipdResolveProvider = function (providerId, fallbackName) {
  const list = window.ipdProvidersCache || [];
  const match = list.find(p => String(p.id) === String(providerId || ''));
  if (match) return { Provider_ID: match.id, Provider_Name: match.name, Provider_Role: match.role };
  return { Provider_ID: providerId || null, Provider_Name: fallbackName || window.ipdCurrentUserName(), Provider_Role: null };
};

window.ipdVisitOptions = function (selectedId) {
  const rounds = (window.ipdClinicalState.rounds || []);
  const open = rounds.filter(r => String(r.Status || 'Open').toLowerCase() !== 'closed' && String(r.Status || '').toLowerCase() !== 'completed');
  const closed = rounds.filter(r => !open.includes(r));
  const fmt = r => `${window.ipdFormatDateTime(r.Visit_Datetime)} | ${window.ipdEscape(window.ipdTranslateValue(r.Visit_Type) || '-')} | ${window.ipdEscape(r.Provider_Name || '-')}`;
  const blank = `<option value="">${window.ipdEscape('-- ' + window.t('ipd.noRound') + ' --')}</option>`;
  const openGrp = open.length ? `<optgroup label="${window.ipdEscape(window.t('ipd.openRounds'))}">${open.map(r => `<option value="${window.ipdEscape(r.Visit_ID)}" ${String(r.Visit_ID) === String(selectedId || '') ? 'selected' : ''}>${fmt(r)}</option>`).join('')}</optgroup>` : '';
  const closedGrp = closed.length ? `<optgroup label="${window.ipdEscape(window.t('ipd.closedRounds'))}">${closed.map(r => `<option value="${window.ipdEscape(r.Visit_ID)}" ${String(r.Visit_ID) === String(selectedId || '') ? 'selected' : ''}>${fmt(r)}</option>`).join('')}</optgroup>` : '';
  return blank + openGrp + closedGrp;
};

window.ipdRoundVisitFieldsHtml = function (presetVisitId, presetProviderId, roleFilter) {
  const visitId = presetVisitId || window.ipdActiveVisitId || '';
  const provDefault = window.ipdCurrentProviderDefault();
  const providerId = presetProviderId || provDefault.id || '';
  return `<div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.linkedRound'))}</label>
      <select id="ipdEntryVisitId" class="form-select">${window.ipdVisitOptions(visitId)}</select>
      <small class="text-muted">${window.ipdEscape(window.t('ipd.linkedRoundHint'))}</small></div>
    <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.provider'))}</label>
      <select id="ipdEntryProviderId" class="form-select">${window.ipdProviderOptions(providerId, roleFilter)}</select></div>`;
};

window.ipdCollectVisitProvider = function (fallbackName) {
  const visitId = ($('#ipdEntryVisitId').val() || '') || null;
  const providerId = ($('#ipdEntryProviderId').val() || '') || null;
  const providerName = $('#ipdEntryProviderId option:selected').data('name') || fallbackName || window.ipdCurrentUserName();
  const providerRole = $('#ipdEntryProviderId option:selected').data('role') || null;
  return { Visit_ID: visitId, Provider_ID: providerId, Provider_Name: providerName, Provider_Role: providerRole };
};

window.openIpdVisitModal = async function (visitId) {
  if (!window.ipdCurrentChartAdmissionId) {
    Swal.fire(window.t('ipd.noIpdChart'), window.t('ipd.openChartFirst'), 'info');
    return;
  }
  await window.ipdLoadProviders();
  const r = (window.ipdClinicalState.rounds || []).find(row => String(row.Visit_ID) === String(visitId)) || {};
  const provDefault = window.ipdCurrentProviderDefault();
  const providerId = r.Provider_ID || provDefault.id || '';
  const visitTypes = ['Doctor Round', 'Nurse Round', 'Bedside Procedure', 'Consult', 'Emergency Visit'];
  const result = await Swal.fire({
    title: visitId ? window.t('ipd.editRound') : window.t('ipd.startRound'),
    width: 760,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.visitType'))}</label>
        <select id="ipdVisitType" class="form-select">${window.ipdOptions(visitTypes, r.Visit_Type || 'Doctor Round')}</select></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.dateTime'))}</label>
        <input type="datetime-local" id="ipdVisitAt" class="form-control" value="${window.ipdFormDateTimeValue(r.Visit_Datetime || new Date().toISOString())}"></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.provider'))}</label>
        <select id="ipdVisitProvider" class="form-select">${window.ipdProviderOptions(providerId)}</select></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.status'))}</label>
        <select id="ipdVisitStatus" class="form-select">${window.ipdOptions(['Open','Completed','Cancelled'], r.Status || 'Open')}</select></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.endDateTime'))}</label>
        <input type="datetime-local" id="ipdVisitEnd" class="form-control" value="${window.ipdFormDateTimeValue(r.End_Datetime)}"></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.reasonChiefConcern'))}</label>
        <textarea id="ipdVisitReason" class="form-control" rows="2">${window.ipdEscape(r.Reason || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.summaryActionsTaken'))}</label>
        <textarea id="ipdVisitSummary" class="form-control" rows="3">${window.ipdEscape(r.Summary || '')}</textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const provId = $('#ipdVisitProvider').val();
      const provName = $('#ipdVisitProvider option:selected').data('name') || window.ipdCurrentUserName();
      const provRole = $('#ipdVisitProvider option:selected').data('role') || null;
      if (!provId) { Swal.showValidationMessage(window.t('ipd.selectProviderRequired')); return false; }
      return {
        Visit_ID: r.Visit_ID || window.ipdId('IPDV'),
        Admission_ID: window.ipdCurrentChartAdmissionId,
        Visit_Type: $('#ipdVisitType').val(),
        Visit_Datetime: $('#ipdVisitAt').val() ? new Date($('#ipdVisitAt').val()).toISOString() : new Date().toISOString(),
        End_Datetime: $('#ipdVisitEnd').val() ? new Date($('#ipdVisitEnd').val()).toISOString() : null,
        Provider_ID: provId,
        Provider_Name: provName,
        Provider_Role: provRole,
        Reason: $('#ipdVisitReason').val().trim(),
        Summary: $('#ipdVisitSummary').val().trim(),
        Status: $('#ipdVisitStatus').val(),
        Created_By: r.Created_By || window.ipdCurrentUserName()
      };
    }
  });
  if (result.isConfirmed) {
    if (!visitId) window.ipdActiveVisitId = result.value.Visit_ID;
    await window.ipdUpsertClinical('IPD_Visits', 'Visit_ID', result.value, r.Visit_ID);
  }
};

window.closeIpdVisit = async function (visitId) {
  const r = (window.ipdClinicalState.rounds || []).find(row => String(row.Visit_ID) === String(visitId));
  if (!r) return;
  const confirm = await Swal.fire({
    title: window.t('ipd.closeRound'),
    text: window.t('ipd.closeRoundConfirm'),
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: window.t('ipd.closeRound'),
    cancelButtonText: window.t('common.cancel')
  });
  if (!confirm.isConfirmed) return;
  const payload = { ...r, Status: 'Completed', End_Datetime: r.End_Datetime || new Date().toISOString() };
  if (window.ipdActiveVisitId === visitId) window.ipdActiveVisitId = null;
  await window.ipdUpsertClinical('IPD_Visits', 'Visit_ID', payload, r.Visit_ID);
};

window.ipdSetActiveVisit = function (visitId) {
  window.ipdActiveVisitId = visitId || null;
  window.renderIpdVisits();
};

window.ipdCollectActionsForVisit = function (visitId) {
  const s = window.ipdClinicalState;
  const items = [];
  s.doctorNotes.forEach(n => { if (String(n.Visit_ID || '') === String(visitId)) items.push({ at: n.Note_Datetime, type: window.t('ipd.doctorNotes'), icon: 'fas fa-user-md', label: (n.Assessment || n.Subjective || window.t('ipd.soapNote')), by: n.Provider_Name || n.Created_By }); });
  s.nursingNotes.forEach(n => { if (String(n.Visit_ID || '') === String(visitId)) items.push({ at: n.Note_Datetime, type: window.t('ipd.nursingNotes'), icon: 'fas fa-user-nurse', label: n.Notes || '-', by: n.Provider_Name || n.Created_By }); });
  s.vitals.forEach(v => { if (String(v.Visit_ID || '') === String(visitId)) items.push({ at: v.Recorded_At, type: window.t('ipd.vitalSigns'), icon: 'fas fa-heartbeat', label: `T ${v.Temperature || '-'} | BP ${v.BP_Systolic || '-'}/${v.BP_Diastolic || '-'} | P ${v.Pulse || '-'} | SpO2 ${v.SpO2 || '-'}`, by: v.Provider_Name || v.Recorded_By }); });
  s.medicationOrders.forEach(o => { if (String(o.Visit_ID || '') === String(visitId)) items.push({ at: o.Ordered_At, type: window.t('ipd.medicationOrder'), icon: 'fas fa-pills', label: `${o.Drug || '-'} ${o.Dose || ''} ${o.Frequency || ''}`.trim(), by: o.Provider_Name || o.Ordered_By }); });
  s.radiology.forEach(r => { if (String(r.Visit_ID || '') === String(visitId)) items.push({ at: r.Request_Datetime, type: window.t('ipd.radiology'), icon: 'fas fa-x-ray', label: [r.Imaging_Type, r.Body_Part].filter(Boolean).join(' - '), by: r.Provider_Name || r.Ordered_By }); });
  s.procedures.forEach(p => { if (String(p.Visit_ID || '') === String(visitId)) items.push({ at: p.Procedure_Datetime, type: window.t('ipd.procedures'), icon: 'fas fa-procedures', label: p.Procedure_Name || '-', by: p.Provider_Name || p.Performer }); });
  return items.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
};

window.renderIpdVisits = function () {
  const rounds = window.ipdClinicalState.rounds || [];
  if (!rounds.length) {
    $('#ipdVisitsList').html(window.ipdClinicalEmpty('fas fa-stethoscope', window.t('ipd.visitsRounds'), window.t('ipd.noRoundsYet')));
    return;
  }
  const sorted = [...rounds].sort((a, b) => new Date(b.Visit_Datetime || 0) - new Date(a.Visit_Datetime || 0));
  const html = sorted.map(r => {
    const status = String(r.Status || 'Open').toLowerCase();
    const isOpen = status !== 'completed' && status !== 'cancelled' && status !== 'closed';
    const badgeClass = isOpen ? 'bg-success' : (status === 'cancelled' ? 'bg-secondary' : 'bg-dark');
    const roleBadge = r.Provider_Role ? `<span class="badge bg-info text-dark ms-1">${window.ipdEscape(r.Provider_Role)}</span>` : '';
    const actions = window.ipdCollectActionsForVisit(r.Visit_ID);
    const actionRows = actions.length
      ? `<div class="ipd-round-actions">${actions.map(a => `<div class="ipd-round-action"><i class="${window.ipdEscape(a.icon)}"></i><div><div class="ipd-round-action-top"><strong>${window.ipdEscape(a.type)}</strong><span>${window.ipdEscape(window.ipdFormatDateTime(a.at))}</span></div><div class="text-muted small">${window.ipdEscape(a.label || '-')}${a.by ? ` &mdash; ${window.ipdEscape(a.by)}` : ''}</div></div></div>`).join('')}</div>`
      : `<div class="ipd-round-empty text-muted small">${window.ipdEscape(window.t('ipd.noActionsInRound'))}</div>`;
    const closeBtn = isOpen ? `<button class="btn btn-sm btn-outline-success" onclick="window.closeIpdVisit('${window.ipdEscape(r.Visit_ID)}')"><i class="fas fa-check me-1"></i>${window.ipdEscape(window.t('ipd.closeRound'))}</button>` : '';
    const activeBtn = isOpen ? `<button class="btn btn-sm ${String(window.ipdActiveVisitId) === String(r.Visit_ID) ? 'btn-primary' : 'btn-outline-primary'}" onclick="window.ipdSetActiveVisit('${window.ipdEscape(r.Visit_ID)}')"><i class="fas fa-bullseye me-1"></i>${window.ipdEscape(String(window.ipdActiveVisitId) === String(r.Visit_ID) ? window.t('ipd.activeRound') : window.t('ipd.setActiveRound'))}</button>` : '';
    return `<div class="ipd-round-card ${isOpen ? 'ipd-round-open' : 'ipd-round-closed'} ${String(window.ipdActiveVisitId) === String(r.Visit_ID) ? 'ipd-round-active' : ''}">
      <div class="ipd-round-head">
        <div>
          <div class="ipd-round-title"><i class="fas fa-stethoscope me-1"></i>${window.ipdEscape(window.ipdTranslateValue(r.Visit_Type) || window.t('ipd.round'))} <span class="badge ${badgeClass} ms-1">${window.ipdEscape(window.ipdTranslateValue(r.Status || 'Open'))}</span></div>
          <div class="text-muted small">${window.ipdEscape(window.ipdFormatDateTime(r.Visit_Datetime))}${r.End_Datetime ? ` &mdash; ${window.ipdEscape(window.ipdFormatDateTime(r.End_Datetime))}` : ''}</div>
          <div class="mt-1"><span class="fw-bold">${window.ipdEscape(window.t('ipd.provider'))}:</span> ${window.ipdEscape(r.Provider_Name || '-')}${roleBadge}</div>
          ${r.Reason ? `<div class="mt-1"><span class="fw-bold">${window.ipdEscape(window.t('ipd.reasonChiefConcern'))}:</span> ${window.ipdEscape(r.Reason)}</div>` : ''}
          ${r.Summary ? `<div class="mt-1"><span class="fw-bold">${window.ipdEscape(window.t('ipd.summary'))}:</span> ${window.ipdEscape(r.Summary)}</div>` : ''}
        </div>
        <div class="d-flex flex-column gap-1 ipd-round-actions-btns">
          ${activeBtn}
          <button class="btn btn-sm btn-outline-primary" onclick="window.openIpdVisitModal('${window.ipdEscape(r.Visit_ID)}')"><i class="fas fa-edit me-1"></i>${window.ipdEscape(window.t('ipd.edit'))}</button>
          ${closeBtn}
          <button class="btn btn-sm btn-outline-danger" onclick="window.ipdDeleteClinical('IPD_Visits','Visit_ID','${window.ipdEscape(r.Visit_ID)}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      ${actionRows}
    </div>`;
  }).join('');
  $('#ipdVisitsList').html(html);
};

window.ipdTimelineEvent = function ({ at, type, filter, title, body, meta, icon, id, entityType, provider, providerRole, visitId, readOnly }) {
  return {
    at: at || new Date().toISOString(),
    type: type || window.t('ipd.timeline'),
    filter: filter || 'all',
    title: title || type || window.t('ipd.timeline'),
    body: body || '',
    meta: meta || '',
    icon: icon || 'fas fa-circle',
    id: id || null,
    entityType: entityType || null,
    provider: provider || '',
    providerRole: providerRole || '',
    visitId: visitId || '',
    readOnly: !!readOnly
  };
};

window.buildIpdTimelineEvents = function () {
  const state = window.ipdClinicalState;
  const admission = state.admission;
  const events = [];
  const admitAt = admission?.Admission_Date ? `${admission.Admission_Date}T${admission.Admission_Time || '00:00:00'}` : admission?.Created_At;
  events.push(window.ipdTimelineEvent({
    at: admitAt,
    type: window.t('ipd.ipdAdmissionEvent'),
    filter: 'all',
    title: window.t('ipd.ipdAdmissionEvent'),
    body: admission?.Diagnosis_Admission || admission?.Diagnosis || '',
    meta: window.ipdAdmissionLocation(admission).label,
    icon: 'fas fa-hospital-user',
    readOnly: true
  }));

  state.doctorNotes.forEach(n => {
    const titleParts = [window.ipdTranslateValue(n.Visit_Type || 'Doctor Note')];
    if (n.Diagnosis) titleParts.push(`Dx: ${n.Diagnosis}`);
    events.push(window.ipdTimelineEvent({
      at: n.Note_Datetime,
      type: window.t('ipd.doctorNotes'),
      filter: 'doctor',
      title: titleParts.join(' · '),
      body: [
        n.Chief_Complaint && `CC: ${n.Chief_Complaint}`,
        n.Subjective && `S: ${n.Subjective}`,
        n.Objective && `O: ${n.Objective}`,
        n.Assessment && `A: ${n.Assessment}`,
        n.Plan && `P: ${n.Plan}`
      ].filter(Boolean).join('\n'),
      meta: n.Created_By || '',
      icon: 'fas fa-user-md',
      id: n.Note_ID,
      entityType: 'doctor_note',
      provider: n.Provider_Name || n.Created_By,
      providerRole: n.Provider_Role || 'doctor'
    }));
  });

  state.nursingNotes.forEach(n => {
    const bodyParts = [
      n.Patient_Condition && `${window.t('ipd.patientCondition')}: ${n.Patient_Condition}`,
      n.Observation && `${window.t('ipd.observation')}: ${n.Observation}`,
      n.Nursing_Care_Given && `${window.t('ipd.nursingCareGiven')}: ${n.Nursing_Care_Given}`,
      n.Response_To_Treatment && `${window.t('ipd.responseToTreatment')}: ${n.Response_To_Treatment}`,
      (n.Intake || n.Output) && `I/O: ${n.Intake || '-'} / ${n.Output || '-'}`,
      n.Pain_Score != null && n.Pain_Score !== '' && `${window.t('ipd.painScore')}: ${n.Pain_Score}`,
      n.Fall_Risk && `${window.t('ipd.fallRisk')}: ${window.ipdTranslateValue(n.Fall_Risk)}`,
      n.Allergy_Alert && `⚠ ${window.t('ipd.allergyAlert')}: ${n.Allergy_Alert}`,
      n.Medication_Given && `${window.t('ipd.medicationGiven')}: ${n.Medication_Given}`,
      n.Procedure_Done && `${window.t('ipd.procedureDone')}: ${n.Procedure_Done}`,
      n.Notes && n.Notes
    ].filter(Boolean).join('\n');
    events.push(window.ipdTimelineEvent({
      at: n.Note_Datetime,
      type: window.t('ipd.nursingNote'),
      filter: 'nursing',
      title: `${n.Shift ? window.ipdTranslateValue(n.Shift) : window.t('ipd.shift')} ${window.t('ipd.nursingNote')}`,
      body: bodyParts,
      meta: n.Created_By || '',
      icon: 'fas fa-user-nurse',
      id: n.Note_ID,
      entityType: 'nursing_note',
      provider: n.Provider_Name || n.Created_By,
      providerRole: n.Provider_Role || 'nurse'
    }));
  });

  state.vitals.forEach(v => events.push(window.ipdTimelineEvent({
    at: v.Recorded_At,
    type: window.t('ipd.vitalSigns'),
    filter: 'vitals',
    title: v.Is_Initial_Assessment ? `${window.t('ipd.initialAssessment')} - ${window.t('ipd.vitalSigns')}` : window.t('ipd.vitalSigns'),
    body: `T ${v.Temperature || '-'} | BP ${v.BP_Systolic || '-'}/${v.BP_Diastolic || '-'} | P ${v.Pulse || '-'} | RR ${v.Respiration || '-'} | SpO2 ${v.SpO2 || '-'} | BMI ${v.BMI ?? window.ipdCalculateBmiValue(v.Weight, v.Height) ?? '-'} | ${window.t('ipd.painScore')} ${v.Pain_Score ?? '-'}${v.Consciousness ? ` | ${window.t('ipd.consciousness')} ${window.ipdTranslateValue(v.Consciousness)}` : ''}${v.Notes ? ` | ${v.Notes}` : ''}`,
    meta: v.Source_Visit_ID ? `${window.t('ipd.sourceVisit')} ${v.Source_Visit_ID}` : (v.Recorded_By || v.Created_By || ''),
    icon: 'fas fa-heartbeat',
    id: v.Vital_ID,
    entityType: 'vital',
    provider: v.Provider_Name || v.Recorded_By || v.Created_By,
    providerRole: v.Provider_Role || ''
  })));

  state.visits.forEach(v => {
    window.ipdParseJsonArray(v.Lab_Orders_JSON).forEach(lab => {
      const name = typeof lab === 'string' ? lab : (lab.name || lab.label || lab.Lab_Name || '-');
      const result = typeof lab === 'object' ? (lab.result || lab.Result || lab.value || lab.Value || 'Ordered') : 'Ordered';
      events.push(window.ipdTimelineEvent({
        at: v.Date,
        type: result === 'Ordered' ? window.t('ipd.labOrder') : window.t('ipd.labResult'),
        filter: 'labs',
        title: name,
        body: result === 'Ordered' ? window.ipdTranslateValue(result) : result,
        meta: v.Visit_ID || window.t('ipd.linkedOpdLis'),
        icon: 'fas fa-flask',
        provider: v.Doctor_Name,
        readOnly: true
      }));
    });
    window.ipdParseJsonArray(v.Prescription_JSON).forEach(drug => {
      events.push(window.ipdTimelineEvent({
        at: v.Date,
        type: window.t('ipd.medicationOrder'),
        filter: 'meds',
        title: drug.name || drug.Drug || drug.label || window.t('ipd.medicationOrder'),
        body: [drug.dose, drug.usage, drug.qty].filter(Boolean).join(' | '),
        meta: v.Visit_ID || window.t('ipd.linkedOpd'),
        icon: 'fas fa-pills',
        provider: v.Doctor_Name,
        readOnly: true
      }));
    });
  });

  (state.movements || []).forEach(m => events.push(window.ipdTimelineEvent({
    at: m.Movement_Datetime,
    type: window.t('ipd.transfers'),
    filter: 'all',
    title: window.ipdTranslateValue(m.Movement_Type || window.t('ipd.transfer')),
    body: [m.Reason, m.Note].filter(Boolean).join(' | '),
    meta: [m.From_Bed_ID && `${window.t('ipd.from')} ${m.From_Bed_ID}`, m.To_Bed_ID && `${window.t('ipd.to')} ${m.To_Bed_ID}`, m.Created_By].filter(Boolean).join(' | '),
    icon: 'fas fa-exchange-alt',
    readOnly: true
  })));

  if (state.dischargeSummary) {
    const s = state.dischargeSummary;
    events.push(window.ipdTimelineEvent({
      at: [s.Discharge_Date, s.Discharge_Time].filter(Boolean).join('T') || s.Updated_At || s.Created_At,
      type: window.t('ipd.discharge'),
      filter: 'all',
      title: window.t('nav.dischargeSummary'),
      body: s.Final_Diagnosis || s.Condition_On_Discharge || '',
      meta: s.Prepared_By || '',
      icon: 'fas fa-file-medical-alt',
      id: s.Summary_ID,
      entityType: 'discharge'
    }));
  } else if (admission?.Discharge_Date || String(admission?.Status || '').toLowerCase() === 'discharged') {
    events.push(window.ipdTimelineEvent({
      at: [admission.Discharge_Date, admission.Discharge_Time].filter(Boolean).join('T') || admission.Updated_At || admission.Created_At,
      type: window.t('ipd.discharge'),
      filter: 'all',
      title: window.t('ipd.discharge'),
      body: admission.Discharge_Diagnosis || admission.Discharge_Status || '',
      meta: admission.Discharge_Time || '',
      icon: 'fas fa-sign-out-alt',
      readOnly: true
    }));
  }

  return events.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
};

window.setIpdTimelineFilter = function (filter) {
  window.ipdClinicalState.timelineFilter = filter || 'all';
  window.ipdClinicalState.timelineLimit = 200;
  $('#ipdTimelineFilters button').removeClass('active');
  $(`#ipdTimelineFilters button`).filter(function () {
    return String($(this).attr('onclick') || '').includes(`'${window.ipdClinicalState.timelineFilter}'`);
  }).addClass('active');
  window.renderIpdTimeline();
};

window.showMoreIpdTimeline = function () {
  window.ipdClinicalState.timelineLimit = (window.ipdClinicalState.timelineLimit || 200) + 200;
  window.renderIpdTimeline();
};

window.ipdTimelineEntityActions = {
  doctor_note:  { open: 'openIpdDoctorNoteModal',       table: 'IPD_Doctor_Notes',       idCol: 'Note_ID' },
  nursing_note: { open: 'openIpdNursingNoteModal',      table: 'IPD_Nursing_Notes',      idCol: 'Note_ID' },
  vital:        { open: 'openIpdVitalModal',            table: 'IPD_Vital_Signs',        idCol: 'Vital_ID' },
  medication:   { open: 'openIpdMedicationOrderModal',  table: 'IPD_Medication_Orders',  idCol: 'Order_ID' },
  radiology:    { open: 'openIpdRadiologyModal',        table: 'IPD_Radiology_Orders',   idCol: 'Radiology_ID' },
  procedure:    { open: 'openIpdProcedureModal',        table: 'IPD_Procedures',         idCol: 'Procedure_ID' },
  discharge:    { open: 'openIpdDischargeSummaryModal', table: 'IPD_Discharge_Summaries', idCol: 'Summary_ID' }
};

window.ipdFormatLongDate = function (isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return isoDate;
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const monNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monNames[d.getMonth()]} ${d.getFullYear()}`;
};

window.ipdFormatTimeOnly = function (isoDateTime) {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

window.renderIpdTimeline = function () {
  const filter = window.ipdClinicalState.timelineFilter || 'all';
  const limit = window.ipdClinicalState.timelineLimit || 200;
  $('#ipdTimelineFilters button').removeClass('active').filter(function () {
    return String($(this).attr('onclick') || '').includes(`'${filter}'`);
  }).addClass('active');

  const allEvents = window.buildIpdTimelineEvents();
  // Newest first — EMR convention: most recent at top
  const filtered = allEvents
    .filter(event => filter === 'all' || event.filter === filter)
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  const visible = filtered.slice(0, limit);
  if (!visible.length) {
    $('#ipdPatientTimeline').html(window.ipdClinicalEmpty('fas fa-stream', window.t('ipd.patientTimeline'), window.t('ipd.noTimelineEvents')));
    return;
  }

  const grouped = {};
  visible.forEach(event => {
    const d = new Date(event.at);
    const key = Number.isNaN(d.getTime()) ? window.t('ipd.noDate') : d.toISOString().slice(0, 10);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(event);
  });

  const html = Object.entries(grouped).map(([date, events]) => {
    // Within a day, also newest-first
    events.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    return `<section class="ipd-history-day">
      <header class="ipd-history-date-header">
        <div class="ipd-history-date-main">${window.ipdEscape(window.ipdFormatLongDate(date))}</div>
        <div class="ipd-history-date-meta"><span class="ipd-history-event-count">${events.length} ${window.ipdEscape(window.t('ipd.events'))}</span></div>
      </header>
      <div class="ipd-history-items">
        ${events.map(event => {
          const action = window.ipdTimelineEntityActions[event.entityType];
          const canEdit = !event.readOnly && action && event.id;
          const canDelete = canEdit && event.entityType !== 'discharge';
          const editBtn = canEdit
            ? `<button class="btn btn-sm btn-outline-primary" title="${window.ipdEscape(window.t('ipd.edit'))}" onclick="window.${action.open}('${window.ipdEscape(event.id)}')"><i class="fas fa-edit"></i></button>`
            : '';
          const delBtn = canDelete
            ? `<button class="btn btn-sm btn-outline-danger" title="${window.ipdEscape(window.t('ipd.delete'))}" onclick="window.ipdDeleteClinical('${action.table}','${action.idCol}','${window.ipdEscape(event.id)}')"><i class="fas fa-trash"></i></button>`
            : '';
          const roleBadge = event.providerRole
            ? `<span class="badge bg-info text-dark ms-1">${window.ipdEscape(event.providerRole)}</span>`
            : '';
          const visitTag = event.visitId
            ? `<span class="ipd-history-visit-tag" title="${window.ipdEscape(window.t('ipd.linkedRound'))}"><i class="fas fa-stethoscope me-1"></i>${window.ipdEscape(event.visitId)}</span>`
            : '';
          return `<article class="ipd-history-row ipd-history-${window.ipdEscape(event.filter)}">
            <div class="ipd-history-time">
              <div class="ipd-history-time-value">${window.ipdEscape(window.ipdFormatTimeOnly(event.at))}</div>
              <div class="ipd-history-icon"><i class="${window.ipdEscape(event.icon)}"></i></div>
            </div>
            <div class="ipd-history-content">
              <div class="ipd-history-content-top">
                <span class="ipd-history-type-badge ipd-history-type-${window.ipdEscape(event.filter)}">${window.ipdEscape(event.type)}</span>
                <strong class="ipd-history-title">${window.ipdEscape(event.title)}</strong>
              </div>
              ${event.provider ? `<div class="ipd-history-provider"><i class="fas fa-user-md me-1"></i>${window.ipdEscape(event.provider)}${roleBadge}</div>` : ''}
              ${event.body ? `<div class="ipd-history-body">${window.ipdEscape(event.body)}</div>` : ''}
              ${visitTag ? `<div class="ipd-history-tags">${visitTag}</div>` : ''}
            </div>
            <div class="ipd-history-actions">${editBtn}${delBtn}${(!canEdit && !canDelete) ? `<span class="badge bg-secondary" title="${window.ipdEscape(window.t('ipd.readOnly'))}"><i class="fas fa-lock"></i></span>` : ''}</div>
          </article>`;
        }).join('')}
      </div>
    </section>`;
  }).join('');

  $('#ipdPatientTimeline').html(`${html}${filtered.length > visible.length ? `<div class="text-center mt-3"><button class="btn btn-sm btn-outline-primary" onclick="window.showMoreIpdTimeline()">${window.ipdEscape(window.t('ipd.showMore'))} (${visible.length}/${filtered.length})</button></div>` : ''}`);
};

window.renderIpdClinicalSummary = function () {
  const state = window.ipdClinicalState;
  const admission = state.admission;
  const latestVitals = state.vitals[0];
  const activeMeds = state.medicationOrders.filter(o => String(o.Status || 'Active').toLowerCase() === 'active').length;
  const totalBilling = state.billing.reduce((sum, row) => sum + Number(row.Amount || 0), Number(admission.Deposit_Amount || 0));
  const latestOpd = state.visits[0];
  const linkedLabCount = state.visits.reduce((sum, visit) => sum + window.ipdParseJsonArray(visit.Lab_Orders_JSON).length, 0);
  const rows = [
    [window.t('ipd.patient'), window.ipdPatientName(admission)],
    ['HN', admission.Patient_ID || '-'],
    ['IPD No', admission.Admission_ID || '-'],
    [window.t('ipd.diagnosis'), admission.Diagnosis_Admission || admission.Diagnosis || '-'],
    [window.t('ipd.doctor'), window.ipdDoctorName(admission) || '-'],
    [window.t('ipd.wardRoomBed'), window.ipdAdmissionLocation(admission).label],
    [window.t('ipd.admitDateTime'), [admission.Admission_Date, admission.Admission_Time].filter(Boolean).join(' ') || '-'],
    [window.t('ipd.los'), window.ipdLengthOfStay(admission)],
    [window.t('ipd.latestVitals'), latestVitals ? `T ${latestVitals.Temperature || '-'} / BP ${latestVitals.BP_Systolic || '-'}/${latestVitals.BP_Diastolic || '-'} / SpO2 ${latestVitals.SpO2 || '-'}` : window.t('ipd.noVitalsRecorded')],
    [window.t('ipd.activeMedications'), String(activeMeds)],
    [window.t('ipd.linkedOpdVisits'), String(state.visits.length)],
    [window.t('ipd.linkedLisOrders'), String(linkedLabCount)],
    [window.t('ipd.latestOpdDiagnosis'), latestOpd?.Diagnosis || '-'],
    [window.t('ipd.billingTotal'), totalBilling.toLocaleString()],
    [window.t('ipd.status'), window.ipdTranslateValue(admission.Status || 'Admitted')]
  ];
  $('#ipdChartSummaryContent').html(`<div class="ipd-clinical-grid">
    ${rows.map(([label, value]) => `<div class="ipd-clinical-field"><span>${window.ipdEscape(label)}</span><strong>${window.ipdEscape(value)}</strong></div>`).join('')}
  </div>`);
};

window.renderIpdDoctorNotes = function () {
  const rows = window.ipdClinicalState.doctorNotes.map(note => `<div class="ipd-clinical-card">
    <div class="ipd-clinical-card-head">
      <div><strong>${window.ipdEscape(window.ipdFormatDateTime(note.Note_Datetime))}</strong><span>${window.ipdEscape(note.Created_By || '-')}</span></div>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary" onclick="window.viewIpdDoctorNote('${window.ipdEscape(note.Note_ID)}')">${window.ipdEscape(window.t('ipd.view'))}</button>
        <button class="btn btn-outline-primary" onclick="window.openIpdDoctorNoteModal('${window.ipdEscape(note.Note_ID)}')">${window.ipdEscape(window.t('ipd.edit'))}</button>
        <button class="btn btn-outline-danger" onclick="window.ipdDeleteClinical('IPD_Doctor_Notes','Note_ID','${window.ipdEscape(note.Note_ID)}')">${window.ipdEscape(window.t('ipd.delete'))}</button>
      </div>
    </div>
    <div class="ipd-soap-grid">
      <div><span>S</span>${window.ipdEscape(note.Subjective || '-')}</div>
      <div><span>O</span>${window.ipdEscape(note.Objective || '-')}</div>
      <div><span>A</span>${window.ipdEscape(note.Assessment || '-')}</div>
      <div><span>P</span>${window.ipdEscape(note.Plan || '-')}</div>
    </div>
  </div>`).join('');
  $('#ipdDoctorNotesList').html(rows || window.ipdClinicalEmpty('fas fa-user-md', window.t('ipd.doctorNotes'), window.t('ipd.noSoapNotes')));
};

window.viewIpdDoctorNote = function (noteId) {
  const note = window.ipdClinicalState.doctorNotes.find(n => String(n.Note_ID) === String(noteId));
  if (!note) return;
  Swal.fire({
    title: window.t('ipd.soapNote'),
    width: 780,
    html: `<div class="ipd-soap-grid text-start">
      <div><span>S</span>${window.ipdEscape(note.Subjective || '-')}</div>
      <div><span>O</span>${window.ipdEscape(note.Objective || '-')}</div>
      <div><span>A</span>${window.ipdEscape(note.Assessment || '-')}</div>
      <div><span>P</span>${window.ipdEscape(note.Plan || '-')}</div>
    </div>`
  });
};

window.openIpdDoctorNoteModal = async function (noteId) {
  await window.ipdLoadProviders();
  const note = window.ipdClinicalState.doctorNotes.find(n => String(n.Note_ID) === String(noteId)) || {};
  const provDefault = window.ipdCurrentProviderDefault();
  const providerId = note.Provider_ID || provDefault.id || '';
  const visitTypes = ['Initial', 'Daily Round', 'Follow-up', 'Emergency'];
  const result = await Swal.fire({
    title: `<i class="fas fa-user-md text-primary me-2"></i>${window.ipdEscape(noteId ? window.t('ipd.modalDoctorEdit') : window.t('ipd.modalDoctorAdd'))}`,
    width: 900,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.dateTime'))}</label><input type="datetime-local" id="ipdDoctorNoteAt" class="form-control" value="${window.ipdFormDateTimeValue(note.Note_Datetime)}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.visitType'))}</label><select id="ipdDoctorVisitType" class="form-select">${window.ipdOptions(visitTypes, note.Visit_Type || 'Daily Round')}</select></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.provider'))}</label><select id="ipdEntryProviderId" class="form-select">${window.ipdProviderOptions(providerId, ['doctor'])}</select></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.diagnosis'))}</label><input id="ipdDoctorDiagnosis" class="form-control" value="${window.ipdEscape(note.Diagnosis || '')}"></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.chiefComplaint'))}</label><textarea id="ipdDoctorChiefComplaint" class="form-control" rows="2">${window.ipdEscape(note.Chief_Complaint || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">S — ${window.ipdEscape(window.t('ipd.subjective'))}</label><textarea id="ipdDoctorSubjective" class="form-control" rows="2" placeholder="${window.ipdEscape(window.t('ipd.subjectivePlaceholder'))}">${window.ipdEscape(note.Subjective || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">O — ${window.ipdEscape(window.t('ipd.objective'))}</label><textarea id="ipdDoctorObjective" class="form-control" rows="3" placeholder="${window.ipdEscape(window.t('ipd.objectivePlaceholder'))}">${window.ipdEscape(note.Objective || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">A — ${window.ipdEscape(window.t('ipd.assessment'))}</label><textarea id="ipdDoctorAssessment" class="form-control" rows="2">${window.ipdEscape(note.Assessment || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">P — ${window.ipdEscape(window.t('ipd.plan'))}</label><textarea id="ipdDoctorPlan" class="form-control" rows="5" placeholder="${window.ipdEscape(window.t('ipd.planPlaceholder'))}">${window.ipdEscape(note.Plan || '')}</textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const provId = $('#ipdEntryProviderId').val();
      const provName = $('#ipdEntryProviderId option:selected').data('name') || window.ipdCurrentUserName();
      const provRole = $('#ipdEntryProviderId option:selected').data('role') || 'doctor';
      return {
        Note_ID: note.Note_ID || window.ipdId('DN'),
        Admission_ID: window.ipdCurrentChartAdmissionId,
        Note_Datetime: new Date($('#ipdDoctorNoteAt').val()).toISOString(),
        Visit_Type: $('#ipdDoctorVisitType').val(),
        Diagnosis: $('#ipdDoctorDiagnosis').val().trim(),
        Chief_Complaint: $('#ipdDoctorChiefComplaint').val().trim(),
        Subjective: $('#ipdDoctorSubjective').val().trim(),
        Objective: $('#ipdDoctorObjective').val().trim(),
        Assessment: $('#ipdDoctorAssessment').val().trim(),
        Plan: $('#ipdDoctorPlan').val().trim(),
        Provider_ID: provId || null,
        Provider_Role: provRole,
        Created_By: provName || note.Created_By || window.ipdCurrentUserName()
      };
    }
  });
  if (result.isConfirmed) await window.ipdUpsertClinical('IPD_Doctor_Notes', 'Note_ID', result.value, note.Note_ID);
};

window.renderIpdNursingNotes = function () {
  const rows = window.ipdClinicalState.nursingNotes.map(note => `<div class="ipd-clinical-card">
    <div class="ipd-clinical-card-head">
      <div><strong>${window.ipdEscape(note.Shift || 'Shift')}</strong><span>${window.ipdEscape(window.ipdFormatDateTime(note.Note_Datetime))} | ${window.ipdEscape(note.Created_By || '-')}</span></div>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary" onclick="window.viewIpdNursingNote('${window.ipdEscape(note.Note_ID)}')">${window.ipdEscape(window.t('ipd.view'))}</button>
        <button class="btn btn-outline-primary" onclick="window.openIpdNursingNoteModal('${window.ipdEscape(note.Note_ID)}')">${window.ipdEscape(window.t('ipd.edit'))}</button>
        <button class="btn btn-outline-danger" onclick="window.ipdDeleteClinical('IPD_Nursing_Notes','Note_ID','${window.ipdEscape(note.Note_ID)}')">${window.ipdEscape(window.t('ipd.delete'))}</button>
      </div>
    </div>
    <p class="mb-0">${window.ipdEscape(note.Notes || '-')}</p>
  </div>`).join('');
  $('#ipdNursingNotesList').html(rows || window.ipdClinicalEmpty('fas fa-user-nurse', window.t('ipd.nursingNotes'), window.t('ipd.noNursingNotes')));
};

window.viewIpdNursingNote = function (noteId) {
  const note = window.ipdClinicalState.nursingNotes.find(n => String(n.Note_ID) === String(noteId));
  if (!note) return;
  Swal.fire({ title: note.Shift ? window.ipdTranslateValue(note.Shift) : window.t('ipd.nursingNote'), width: 720, html: `<div class="text-start"><p>${window.ipdEscape(note.Notes || '-')}</p><div class="text-muted small">${window.ipdEscape(window.ipdFormatDateTime(note.Note_Datetime))}</div></div>` });
};

window.openIpdNursingNoteModal = async function (noteId) {
  await window.ipdLoadProviders();
  const note = window.ipdClinicalState.nursingNotes.find(n => String(n.Note_ID) === String(noteId)) || {};
  const provDefault = window.ipdCurrentProviderDefault();
  const providerId = note.Provider_ID || provDefault.id || '';
  const fallRiskOpts = ['Low', 'Moderate', 'High'];
  const result = await Swal.fire({
    title: `<i class="fas fa-user-nurse text-success me-2"></i>${window.ipdEscape(noteId ? window.t('ipd.modalNurseEdit') : window.t('ipd.modalNurseAdd'))}`,
    width: 900,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.dateTime'))}</label><input type="datetime-local" id="ipdNursingNoteAt" class="form-control" value="${window.ipdFormDateTimeValue(note.Note_Datetime)}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.shift'))}</label><select id="ipdNursingShift" class="form-select">${window.ipdOptions(['Morning','Evening','Night'], note.Shift || 'Morning')}</select></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.provider'))}</label><select id="ipdEntryProviderId" class="form-select">${window.ipdProviderOptions(providerId, ['nurse'])}</select></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.patientCondition'))}</label><textarea id="ipdNursePatientCondition" class="form-control" rows="2">${window.ipdEscape(note.Patient_Condition || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.observation'))}</label><textarea id="ipdNurseObservation" class="form-control" rows="2">${window.ipdEscape(note.Observation || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.nursingCareGiven'))}</label><textarea id="ipdNurseCare" class="form-control" rows="2">${window.ipdEscape(note.Nursing_Care_Given || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.responseToTreatment'))}</label><textarea id="ipdNurseResponse" class="form-control" rows="2">${window.ipdEscape(note.Response_To_Treatment || '')}</textarea></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.intake'))}</label><input id="ipdNurseIntake" class="form-control" placeholder="e.g. 1500 ml PO + 500 ml IV" value="${window.ipdEscape(note.Intake || '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.output'))}</label><input id="ipdNurseOutput" class="form-control" placeholder="e.g. 1200 ml urine" value="${window.ipdEscape(note.Output || '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.painScore'))}</label><input type="number" min="0" max="10" id="ipdNursePain" class="form-control" value="${window.ipdEscape(note.Pain_Score ?? '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.fallRisk'))}</label><select id="ipdNurseFallRisk" class="form-select"><option value="">-</option>${window.ipdOptions(fallRiskOpts, note.Fall_Risk || '')}</select></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.allergyAlert'))}</label><input id="ipdNurseAllergy" class="form-control" value="${window.ipdEscape(note.Allergy_Alert || '')}"></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.medicationGiven'))}</label><textarea id="ipdNurseMedGiven" class="form-control" rows="2">${window.ipdEscape(note.Medication_Given || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.procedureDone'))}</label><textarea id="ipdNurseProcedureDone" class="form-control" rows="2">${window.ipdEscape(note.Procedure_Done || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.notes'))}</label><textarea id="ipdNursingNotes" class="form-control" rows="3">${window.ipdEscape(note.Notes || '')}</textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const provId = $('#ipdEntryProviderId').val();
      const provName = $('#ipdEntryProviderId option:selected').data('name') || window.ipdCurrentUserName();
      const provRole = $('#ipdEntryProviderId option:selected').data('role') || 'nurse';
      return {
        Note_ID: note.Note_ID || window.ipdId('NN'),
        Admission_ID: window.ipdCurrentChartAdmissionId,
        Note_Datetime: new Date($('#ipdNursingNoteAt').val()).toISOString(),
        Shift: $('#ipdNursingShift').val(),
        Patient_Condition: $('#ipdNursePatientCondition').val().trim(),
        Observation: $('#ipdNurseObservation').val().trim(),
        Nursing_Care_Given: $('#ipdNurseCare').val().trim(),
        Response_To_Treatment: $('#ipdNurseResponse').val().trim(),
        Intake: $('#ipdNurseIntake').val().trim(),
        Output: $('#ipdNurseOutput').val().trim(),
        Pain_Score: $('#ipdNursePain').val() || null,
        Fall_Risk: $('#ipdNurseFallRisk').val() || null,
        Allergy_Alert: $('#ipdNurseAllergy').val().trim(),
        Medication_Given: $('#ipdNurseMedGiven').val().trim(),
        Procedure_Done: $('#ipdNurseProcedureDone').val().trim(),
        Notes: $('#ipdNursingNotes').val().trim(),
        Provider_ID: provId || null,
        Provider_Role: provRole,
        Created_By: provName || note.Created_By || window.ipdCurrentUserName()
      };
    }
  });
  if (result.isConfirmed) await window.ipdUpsertClinical('IPD_Nursing_Notes', 'Note_ID', result.value, note.Note_ID);
};

window.renderIpdVitals = function () {
  const vitals = window.ipdClinicalState.vitals;
  if (!vitals.length) {
    $('#ipdVitalsList').html(window.ipdClinicalEmpty('fas fa-heartbeat', window.t('ipd.vitalSigns'), window.t('ipd.noVitalSigns')));
    window.renderIpdVitalsTrendChart([]);
    return;
  }
  const rows = vitals.map(v => `<tr>
    <td>${window.ipdEscape(window.ipdFormatDateTime(v.Recorded_At))}</td>
    <td>${v.Is_Initial_Assessment ? `<span class="badge bg-info">${window.ipdEscape(window.t('ipd.initialAssessment'))}</span>` : window.ipdEscape(v.Source_Type || window.t('ipd.manual'))}</td>
    <td>${window.ipdEscape(v.Temperature ?? '-')}</td>
    <td>${window.ipdEscape([v.BP_Systolic, v.BP_Diastolic].filter(Boolean).join('/') || '-')}</td>
    <td>${window.ipdEscape(v.Pulse ?? '-')}</td>
    <td>${window.ipdEscape(v.Respiration ?? '-')}</td>
    <td>${window.ipdEscape(v.SpO2 ?? '-')}</td>
    <td>${window.ipdEscape(v.Weight ?? '-')}</td>
    <td>${window.ipdEscape(v.Height ?? '-')}</td>
    <td>${window.ipdEscape(v.BMI ?? window.ipdCalculateBmiValue(v.Weight, v.Height) ?? '-')}</td>
    <td>${window.ipdEscape(v.Pain_Score ?? '-')}</td>
    <td>${window.ipdEscape(v.Notes || '-')}</td>
    <td>${window.ipdEscape(v.Recorded_By || v.Created_By || '-')}</td>
    <td>${window.ipdEscape(v.Source_Visit_ID || '-')}</td>
    <td class="text-nowrap"><button class="btn btn-sm btn-outline-primary me-1" onclick="window.openIpdVitalModal('${window.ipdEscape(v.Vital_ID)}')">${window.ipdEscape(window.t('ipd.edit'))}</button><button class="btn btn-sm btn-outline-danger" onclick="window.ipdDeleteClinical('IPD_Vital_Signs','Vital_ID','${window.ipdEscape(v.Vital_ID)}')">${window.ipdEscape(window.t('ipd.delete'))}</button></td>
  </tr>`).join('');
  $('#ipdVitalsList').html(window.ipdClinicalTable([
    window.t('ipd.dateTime'),
    window.t('ipd.source'),
    window.t('ipd.temperature'),
    'BP',
    window.t('ipd.pulse'),
    window.t('ipd.respiration'),
    'SpO2',
    window.t('ipd.weight'),
    window.t('ipd.height'),
    'BMI',
    window.t('ipd.painScore'),
    window.t('ipd.notes'),
    window.t('ipd.recordedBy'),
    window.t('ipd.sourceVisit'),
    window.t('common.action')
  ], rows));
  window.renderIpdVitalsTrendChart(vitals);
};

window.renderIpdVitalsTrendChart = function (vitals) {
  const canvas = document.getElementById('ipdVitalsTrendChart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (chartInstances.ipdVitalsTrendChart) chartInstances.ipdVitalsTrendChart.destroy();
  const series = [...vitals].reverse();
  chartInstances.ipdVitalsTrendChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: series.map(v => window.ipdFormatDateTime(v.Recorded_At)),
      datasets: [
        { label: 'Temp', data: series.map(v => Number(v.Temperature || 0)), borderColor: '#dc2626', tension: 0.25 },
        { label: 'Pulse', data: series.map(v => Number(v.Pulse || 0)), borderColor: '#2563eb', tension: 0.25 },
        { label: 'SpO2', data: series.map(v => Number(v.SpO2 || 0)), borderColor: '#16a34a', tension: 0.25 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: false } } }
  });
};

window.openIpdVitalModal = async function (vitalId) {
  await window.ipdLoadProviders();
  const v = window.ipdClinicalState.vitals.find(row => String(row.Vital_ID) === String(vitalId)) || {};
  const result = await Swal.fire({
    title: `<i class="fas fa-heartbeat text-danger me-2"></i>${window.ipdEscape(vitalId ? window.t('ipd.modalVitalsEdit') : window.t('ipd.modalVitalsAdd'))}`,
    width: 900,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.dateTime'))}</label><input type="datetime-local" id="ipdVitalAt" class="form-control" value="${window.ipdFormDateTimeValue(v.Recorded_At)}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.temperature'))}</label><input type="number" step="0.1" id="ipdVitalTemp" class="form-control" value="${window.ipdEscape(v.Temperature || '')}"></div>
      <div><label class="form-label fw-bold">BP Systolic</label><input type="number" id="ipdVitalBpSys" class="form-control" value="${window.ipdEscape(v.BP_Systolic || '')}"></div>
      <div><label class="form-label fw-bold">BP Diastolic</label><input type="number" id="ipdVitalBpDia" class="form-control" value="${window.ipdEscape(v.BP_Diastolic || '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.pulse'))}</label><input type="number" id="ipdVitalPulse" class="form-control" value="${window.ipdEscape(v.Pulse || '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.respiration'))}</label><input type="number" id="ipdVitalResp" class="form-control" value="${window.ipdEscape(v.Respiration || '')}"></div>
      <div><label class="form-label fw-bold">SpO2</label><input type="number" id="ipdVitalSpo2" class="form-control" value="${window.ipdEscape(v.SpO2 || '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.weight'))}</label><input type="number" step="0.1" id="ipdVitalWeight" class="form-control" value="${window.ipdEscape(v.Weight || '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.height'))}</label><input type="number" step="0.1" id="ipdVitalHeight" class="form-control" value="${window.ipdEscape(v.Height || '')}"></div>
      <div><label class="form-label fw-bold">BMI</label><input type="number" step="0.1" id="ipdVitalBmi" class="form-control bg-light fw-bold" value="${window.ipdEscape(v.BMI || window.ipdCalculateBmiValue(v.Weight, v.Height) || '')}" readonly></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.painScore'))}</label><input type="number" min="0" max="10" id="ipdVitalPain" class="form-control" value="${window.ipdEscape(v.Pain_Score || '')}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.consciousness'))}</label><select id="ipdVitalConsciousness" class="form-select"><option value="">-</option>${window.ipdOptions(['Alert','Verbal','Pain','Unresponsive','Drowsy','Confused'], v.Consciousness || '')}</select></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.provider'))}</label><select id="ipdEntryProviderId" class="form-select">${window.ipdProviderOptions(v.Provider_ID || (window.ipdCurrentProviderDefault().id || ''), ['doctor','nurse'])}</select></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.notes'))}</label><textarea id="ipdVitalNotes" class="form-control" rows="2">${window.ipdEscape(v.Notes || '')}</textarea></div>
    </div>`,
    didOpen: () => {
      const updateBmi = () => $('#ipdVitalBmi').val(window.ipdCalculateBmiValue($('#ipdVitalWeight').val(), $('#ipdVitalHeight').val()) || '');
      $('#ipdVitalWeight, #ipdVitalHeight').on('input', updateBmi);
      updateBmi();
    },
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const provId = $('#ipdEntryProviderId').val();
      const provName = $('#ipdEntryProviderId option:selected').data('name') || window.ipdCurrentUserName();
      const provRole = $('#ipdEntryProviderId option:selected').data('role') || '';
      return {
        Vital_ID: v.Vital_ID || window.ipdId('VS'),
        Admission_ID: window.ipdCurrentChartAdmissionId,
        Recorded_At: new Date($('#ipdVitalAt').val()).toISOString(),
        Temperature: $('#ipdVitalTemp').val() || null,
        BP_Systolic: $('#ipdVitalBpSys').val() || null,
        BP_Diastolic: $('#ipdVitalBpDia').val() || null,
        Pulse: $('#ipdVitalPulse').val() || null,
        Respiration: $('#ipdVitalResp').val() || null,
        SpO2: $('#ipdVitalSpo2').val() || null,
        Weight: $('#ipdVitalWeight').val() || null,
        Height: $('#ipdVitalHeight').val() || null,
        BMI: window.ipdCalculateBmiValue($('#ipdVitalWeight').val(), $('#ipdVitalHeight').val()),
        Pain_Score: $('#ipdVitalPain').val() || null,
        Consciousness: $('#ipdVitalConsciousness').val() || null,
        Notes: $('#ipdVitalNotes').val().trim(),
        Recorded_By: provName,
        Provider_ID: provId || null,
        Provider_Role: provRole,
        Source_Type: v.Source_Type || 'Manual',
        Is_Initial_Assessment: v.Is_Initial_Assessment || false,
        Source_Visit_ID: v.Source_Visit_ID || null,
        Source_Vital_ID: v.Source_Vital_ID || null,
        Created_By: v.Created_By || provName || window.ipdCurrentUserName()
      };
    }
  });
  if (result.isConfirmed) await window.ipdUpsertClinical('IPD_Vital_Signs', 'Vital_ID', result.value, v.Vital_ID);
};

window.renderIpdMedicationOrders = function () {
  const orders = window.ipdClinicalState.medicationOrders;
  const rows = orders.map(o => `<tr>
    <td>${window.ipdEscape(window.ipdFormatDateTime(o.Ordered_At))}</td>
    <td class="fw-bold">${window.ipdEscape(o.Drug || '-')}</td>
    <td>${window.ipdEscape(o.Dose || '-')}</td>
    <td>${window.ipdEscape(o.Frequency || '-')}</td>
    <td>${window.ipdEscape(o.Route || '-')}</td>
    <td>${window.ipdEscape(o.Duration || '-')}</td>
    <td><span class="badge ${String(o.Status || '').toLowerCase() === 'active' ? 'bg-success' : 'bg-secondary'}">${window.ipdEscape(o.Status || 'Active')}</span></td>
    <td><div class="fw-bold">${window.ipdEscape(o.Provider_Name || o.Ordered_By || '-')}</div>${o.Provider_Role ? `<span class="badge bg-info text-dark">${window.ipdEscape(o.Provider_Role)}</span>` : ''}${o.Visit_ID ? `<div class="text-muted small">${window.ipdEscape(window.t('ipd.round'))}: ${window.ipdEscape(o.Visit_ID)}</div>` : ''}</td>
    <td class="text-nowrap"><button class="btn btn-sm btn-outline-primary me-1" onclick="window.openIpdMedicationOrderModal('${window.ipdEscape(o.Order_ID)}')">${window.ipdEscape(window.t('ipd.edit'))}</button><button class="btn btn-sm btn-outline-danger" onclick="window.ipdDeleteClinical('IPD_Medication_Orders','Order_ID','${window.ipdEscape(o.Order_ID)}')">${window.ipdEscape(window.t('ipd.delete'))}</button></td>
  </tr>`).join('');
  const linkedOpdRows = [];
  window.ipdClinicalState.visits.forEach(v => {
    window.ipdParseJsonArray(v.Prescription_JSON).forEach(drug => {
      linkedOpdRows.push(`<tr class="table-light">
        <td>${window.ipdEscape(window.ipdFormatDateTime(v.Date))}</td>
        <td class="fw-bold">${window.ipdEscape(drug.name || drug.Drug || drug.label || '-')}</td>
        <td>${window.ipdEscape(drug.dose || drug.Dose || '-')}</td>
        <td>${window.ipdEscape(drug.usage || drug.Frequency || '-')}</td>
        <td>${window.ipdEscape(drug.route || '-')}</td>
        <td>${window.ipdEscape(drug.qty || drug.Duration || '-')}</td>
        <td><span class="badge bg-info">Linked OPD</span></td>
        <td>${window.ipdEscape(v.Doctor_Name || '-')}<div class="text-muted small">OPD ${window.ipdEscape(v.Visit_ID || '')}</div></td>
        <td></td>
      </tr>`);
    });
  });
  const allRows = rows + linkedOpdRows.join('');
  $('#ipdMedicationOrdersList').html(allRows
    ? window.ipdClinicalTable([window.t('ipd.ordered'), window.t('ipd.drug'), window.t('ipd.dose'), window.t('ipd.frequencyUsage'), window.t('ipd.route'), window.t('ipd.durationQty'), window.t('ipd.status'), window.t('ipd.providerRound'), window.t('common.action')], [allRows])
    : window.ipdClinicalEmpty('fas fa-pills', window.t('ipd.medicationOrder'), window.t('ipd.noMedicationOrders')));
};

window.openIpdMedicationOrderModal = async function (orderId) {
  await window.ipdLoadProviders();
  const o = window.ipdClinicalState.medicationOrders.find(row => String(row.Order_ID) === String(orderId)) || {};
  const result = await Swal.fire({
    title: orderId ? 'Edit Medication Order' : 'Add Medication Order',
    width: 820,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">Ordered At</label><input type="datetime-local" id="ipdMedAt" class="form-control" value="${window.ipdFormDateTimeValue(o.Ordered_At)}"></div>
      <div><label class="form-label fw-bold">Drug</label><input id="ipdMedDrug" class="form-control" value="${window.ipdEscape(o.Drug || '')}"></div>
      <div><label class="form-label fw-bold">Dose</label><input id="ipdMedDose" class="form-control" value="${window.ipdEscape(o.Dose || '')}"></div>
      <div><label class="form-label fw-bold">Frequency</label><input id="ipdMedFrequency" class="form-control" value="${window.ipdEscape(o.Frequency || '')}"></div>
      <div><label class="form-label fw-bold">Route</label><select id="ipdMedRoute" class="form-select">${window.ipdOptions(['PO','IV','IM','SC','SL','Nebulized','Topical'], o.Route || 'PO')}</select></div>
      <div><label class="form-label fw-bold">Duration</label><input id="ipdMedDuration" class="form-control" value="${window.ipdEscape(o.Duration || '')}"></div>
      <div><label class="form-label fw-bold">Status</label><select id="ipdMedStatus" class="form-select">${window.ipdOptions(['Active','Hold','Stopped','Completed'], o.Status || 'Active')}</select></div>
      ${window.ipdRoundVisitFieldsHtml(o.Visit_ID, o.Provider_ID, ['doctor'])}
      <div class="full"><label class="form-label fw-bold">Notes</label><textarea id="ipdMedNotes" class="form-control" rows="2">${window.ipdEscape(o.Notes || '')}</textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      if (!$('#ipdMedDrug').val().trim()) {
        Swal.showValidationMessage('Drug is required');
        return false;
      }
      const vp = window.ipdCollectVisitProvider(o.Ordered_By);
      return {
        Order_ID: o.Order_ID || window.ipdId('MO'),
        Admission_ID: window.ipdCurrentChartAdmissionId,
        Ordered_At: new Date($('#ipdMedAt').val()).toISOString(),
        Drug: $('#ipdMedDrug').val().trim(),
        Dose: $('#ipdMedDose').val().trim(),
        Frequency: $('#ipdMedFrequency').val().trim(),
        Route: $('#ipdMedRoute').val(),
        Duration: $('#ipdMedDuration').val().trim(),
        Status: $('#ipdMedStatus').val(),
        Ordered_By: vp.Provider_Name,
        Visit_ID: vp.Visit_ID,
        Provider_ID: vp.Provider_ID,
        Provider_Role: vp.Provider_Role,
        Notes: $('#ipdMedNotes').val().trim()
      };
    }
  });
  if (result.isConfirmed) await window.ipdUpsertClinical('IPD_Medication_Orders', 'Order_ID', result.value, o.Order_ID);
};

window.renderIpdLabResults = function () {
  const labRows = [];
  window.ipdClinicalState.visits.forEach(v => {
    const labs = window.ipdParseJsonArray(v.Lab_Orders_JSON);
    labs.forEach(lab => {
      const name = typeof lab === 'string' ? lab : (lab.name || lab.label || lab.Lab_Name || '-');
      const result = typeof lab === 'object' ? (lab.result || lab.Result || lab.value || lab.Value || '') : '';
      labRows.push(`<tr>
        <td>${window.ipdEscape(window.ipdFormatDateTime(v.Date))}</td>
        <td>${window.ipdEscape(v.Visit_ID || '-')}</td>
        <td class="fw-bold">${window.ipdEscape(name)}</td>
        <td>${window.ipdEscape(result || 'Ordered')}</td>
        <td>${window.ipdEscape(v.Doctor_Name || '-')}</td>
      </tr>`);
    });
  });
  $('#ipdLabResultsList').html(labRows.length
    ? window.ipdClinicalTable([window.t('ipd.date'), window.t('ipd.visit'), window.t('ipd.lab'), window.t('ipd.resultStatus'), window.t('ipd.doctor')], labRows)
    : window.ipdClinicalEmpty('fas fa-flask', window.t('ipd.labResults'), window.t('ipd.noLinkedLabs')));
};

window.renderIpdRadiology = function () {
  const rows = window.ipdClinicalState.radiology.map(r => `<tr>
    <td>${window.ipdEscape(window.ipdFormatDateTime(r.Request_Datetime))}</td>
    <td class="fw-bold">${window.ipdEscape(r.Imaging_Type || '-')}</td>
    <td>${window.ipdEscape(r.Body_Part || '-')}</td>
    <td>${window.ipdEscape(r.Status || '-')}</td>
    <td>${window.ipdEscape(r.Result_Text || r.Request_Note || '-')}</td>
    <td><div class="fw-bold">${window.ipdEscape(r.Provider_Name || r.Ordered_By || '-')}</div>${r.Provider_Role ? `<span class="badge bg-info text-dark">${window.ipdEscape(r.Provider_Role)}</span>` : ''}${r.Visit_ID ? `<div class="text-muted small">${window.ipdEscape(window.t('ipd.round'))}: ${window.ipdEscape(r.Visit_ID)}</div>` : ''}</td>
    <td class="text-nowrap"><button class="btn btn-sm btn-outline-primary me-1" onclick="window.openIpdRadiologyModal('${window.ipdEscape(r.Radiology_ID)}')">${window.ipdEscape(window.t('ipd.edit'))}</button><button class="btn btn-sm btn-outline-danger" onclick="window.ipdDeleteClinical('IPD_Radiology_Orders','Radiology_ID','${window.ipdEscape(r.Radiology_ID)}')">${window.ipdEscape(window.t('ipd.delete'))}</button></td>
  </tr>`);
  window.ipdClinicalState.visits.forEach(v => {
    const services = String(v.Services_List || '').split(',').map(s => s.trim()).filter(Boolean);
    services.filter(s => /ultrasound|x-?ray|ct|mri|ekg|echo/i.test(s)).forEach(s => {
      rows.push(`<tr class="table-light"><td>${window.ipdEscape(window.ipdFormatDateTime(v.Date))}</td><td class="fw-bold">${window.ipdEscape(s)}</td><td>-</td><td>Linked OPD</td><td>${window.ipdEscape(v.Diagnosis || '')}</td><td>${window.ipdEscape(v.Doctor_Name || '-')}<div class="text-muted small">OPD ${window.ipdEscape(v.Visit_ID || '')}</div></td><td></td></tr>`);
    });
  });
  $('#ipdRadiologyList').html(rows.length
    ? window.ipdClinicalTable([window.t('ipd.requested'), window.t('ipd.imaging'), window.t('ipd.bodyPart'), window.t('ipd.status'), window.t('ipd.resultNote'), window.t('ipd.providerRound'), window.t('common.action')], rows)
    : window.ipdClinicalEmpty('fas fa-x-ray', window.t('ipd.radiology'), window.t('ipd.noRadiology')));
};

window.openIpdRadiologyModal = async function (radiologyId) {
  await window.ipdLoadProviders();
  const r = window.ipdClinicalState.radiology.find(row => String(row.Radiology_ID) === String(radiologyId)) || {};
  const result = await Swal.fire({
    title: radiologyId ? 'Edit Imaging Request' : 'Add Imaging Request',
    width: 820,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">Request Date/Time</label><input type="datetime-local" id="ipdRadAt" class="form-control" value="${window.ipdFormDateTimeValue(r.Request_Datetime)}"></div>
      <div><label class="form-label fw-bold">Imaging Type</label><input id="ipdRadType" class="form-control" value="${window.ipdEscape(r.Imaging_Type || '')}"></div>
      <div><label class="form-label fw-bold">Body Part</label><input id="ipdRadPart" class="form-control" value="${window.ipdEscape(r.Body_Part || '')}"></div>
      <div><label class="form-label fw-bold">Status</label><select id="ipdRadStatus" class="form-select">${window.ipdOptions(['Requested','In Progress','Reported','Cancelled'], r.Status || 'Requested')}</select></div>
      ${window.ipdRoundVisitFieldsHtml(r.Visit_ID, r.Provider_ID, ['doctor'])}
      <div class="full"><label class="form-label fw-bold">Request Note</label><textarea id="ipdRadRequest" class="form-control" rows="2">${window.ipdEscape(r.Request_Note || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">Result</label><textarea id="ipdRadResult" class="form-control" rows="3">${window.ipdEscape(r.Result_Text || '')}</textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const vp = window.ipdCollectVisitProvider(r.Ordered_By);
      return {
        Radiology_ID: r.Radiology_ID || window.ipdId('RAD'),
        Admission_ID: window.ipdCurrentChartAdmissionId,
        Request_Datetime: new Date($('#ipdRadAt').val()).toISOString(),
        Imaging_Type: $('#ipdRadType').val().trim(),
        Body_Part: $('#ipdRadPart').val().trim(),
        Status: $('#ipdRadStatus').val(),
        Request_Note: $('#ipdRadRequest').val().trim(),
        Result_Text: $('#ipdRadResult').val().trim(),
        Ordered_By: vp.Provider_Name,
        Visit_ID: vp.Visit_ID,
        Provider_ID: vp.Provider_ID,
        Provider_Role: vp.Provider_Role
      };
    }
  });
  if (result.isConfirmed) await window.ipdUpsertClinical('IPD_Radiology_Orders', 'Radiology_ID', result.value, r.Radiology_ID);
};

window.renderIpdProcedures = function () {
  const rows = window.ipdClinicalState.procedures.map(p => `<tr>
    <td>${window.ipdEscape(window.ipdFormatDateTime(p.Procedure_Datetime))}</td>
    <td class="fw-bold">${window.ipdEscape(p.Procedure_Name || '-')}</td>
    <td><div class="fw-bold">${window.ipdEscape(p.Provider_Name || p.Performer || '-')}</div>${p.Provider_Role ? `<span class="badge bg-info text-dark">${window.ipdEscape(p.Provider_Role)}</span>` : ''}${p.Visit_ID ? `<div class="text-muted small">${window.ipdEscape(window.t('ipd.round'))}: ${window.ipdEscape(p.Visit_ID)}</div>` : ''}</td>
    <td>${window.ipdEscape(p.Status || '-')}</td>
    <td>${window.ipdEscape(p.Findings || p.Notes || '-')}</td>
    <td class="text-nowrap"><button class="btn btn-sm btn-outline-primary me-1" onclick="window.openIpdProcedureModal('${window.ipdEscape(p.Procedure_ID)}')">${window.ipdEscape(window.t('ipd.edit'))}</button><button class="btn btn-sm btn-outline-danger" onclick="window.ipdDeleteClinical('IPD_Procedures','Procedure_ID','${window.ipdEscape(p.Procedure_ID)}')">${window.ipdEscape(window.t('ipd.delete'))}</button></td>
  </tr>`).join('');
  $('#ipdProceduresList').html(rows ? window.ipdClinicalTable([window.t('ipd.date'), window.t('ipd.procedures'), window.t('ipd.providerRound'), window.t('ipd.status'), window.t('ipd.findingsNotes'), window.t('common.action')], rows) : window.ipdClinicalEmpty('fas fa-procedures', window.t('ipd.procedures'), window.t('ipd.noProcedures')));
};

window.openIpdProcedureModal = async function (procedureId) {
  await window.ipdLoadProviders();
  const p = window.ipdClinicalState.procedures.find(row => String(row.Procedure_ID) === String(procedureId)) || {};
  const result = await Swal.fire({
    title: procedureId ? 'Edit Procedure' : 'Add Procedure',
    width: 820,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">Date/Time</label><input type="datetime-local" id="ipdProcAt" class="form-control" value="${window.ipdFormDateTimeValue(p.Procedure_Datetime)}"></div>
      <div><label class="form-label fw-bold">Procedure</label><input id="ipdProcName" class="form-control" value="${window.ipdEscape(p.Procedure_Name || '')}"></div>
      <div><label class="form-label fw-bold">Status</label><select id="ipdProcStatus" class="form-select">${window.ipdOptions(['Planned','Completed','Cancelled'], p.Status || 'Completed')}</select></div>
      ${window.ipdRoundVisitFieldsHtml(p.Visit_ID, p.Provider_ID, ['doctor','nurse'])}
      <div class="full"><label class="form-label fw-bold">Findings</label><textarea id="ipdProcFindings" class="form-control" rows="3">${window.ipdEscape(p.Findings || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">Notes</label><textarea id="ipdProcNotes" class="form-control" rows="2">${window.ipdEscape(p.Notes || '')}</textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      if (!$('#ipdProcName').val().trim()) {
        Swal.showValidationMessage('Procedure name is required');
        return false;
      }
      const vp = window.ipdCollectVisitProvider(p.Performer);
      return {
        Procedure_ID: p.Procedure_ID || window.ipdId('PROC'),
        Admission_ID: window.ipdCurrentChartAdmissionId,
        Procedure_Datetime: new Date($('#ipdProcAt').val()).toISOString(),
        Procedure_Name: $('#ipdProcName').val().trim(),
        Performer: vp.Provider_Name,
        Status: $('#ipdProcStatus').val(),
        Findings: $('#ipdProcFindings').val().trim(),
        Notes: $('#ipdProcNotes').val().trim(),
        Visit_ID: vp.Visit_ID,
        Provider_ID: vp.Provider_ID,
        Provider_Role: vp.Provider_Role
      };
    }
  });
  if (result.isConfirmed) await window.ipdUpsertClinical('IPD_Procedures', 'Procedure_ID', result.value, p.Procedure_ID);
};

window.renderIpdBilling = function () {
  const admission = window.ipdClinicalState.admission;
  const rows = [];
  if (Number(admission.Deposit_Amount || 0) > 0) {
    rows.push(`<tr class="table-light"><td>${window.ipdEscape(admission.Admission_Date || '-')}</td><td>Deposit</td><td class="fw-bold">Admission deposit</td><td>1</td><td>${Number(admission.Deposit_Amount).toLocaleString()}</td><td>${Number(admission.Deposit_Amount).toLocaleString()}</td><td>Paid/Deposit</td><td></td></tr>`);
  }
  window.ipdClinicalState.billing.forEach(b => rows.push(`<tr>
    <td>${window.ipdEscape(b.Item_Date || '-')}</td>
    <td>${window.ipdEscape(b.Item_Type || '-')}</td>
    <td class="fw-bold">${window.ipdEscape(b.Description || '-')}</td>
    <td>${window.ipdEscape(b.Quantity ?? '-')}</td>
    <td>${Number(b.Unit_Price || 0).toLocaleString()}</td>
    <td>${Number(b.Amount || 0).toLocaleString()}</td>
    <td>${window.ipdEscape(b.Status || '-')}</td>
    <td class="text-nowrap"><button class="btn btn-sm btn-outline-primary me-1" onclick="window.openIpdBillingItemModal('${window.ipdEscape(b.Billing_ID)}')">${window.ipdEscape(window.t('ipd.edit'))}</button><button class="btn btn-sm btn-outline-danger" onclick="window.ipdDeleteClinical('IPD_Billing_Items','Billing_ID','${window.ipdEscape(b.Billing_ID)}')">${window.ipdEscape(window.t('ipd.delete'))}</button></td>
  </tr>`));
  window.ipdClinicalState.visits.forEach(v => {
    String(v.Services_List || '').split(',').map(s => s.trim()).filter(Boolean).forEach(service => {
      rows.push(`<tr class="table-light">
        <td>${window.ipdEscape(window.ipdFormDateValue(v.Date))}</td>
        <td>Linked OPD</td>
        <td class="fw-bold">${window.ipdEscape(service)}</td>
        <td>1</td>
        <td>-</td>
        <td>-</td>
        <td>${window.ipdEscape(v.Visit_ID || '')}</td>
        <td></td>
      </tr>`);
    });
  });
  const total = window.ipdClinicalState.billing.reduce((sum, b) => sum + Number(b.Amount || 0), Number(admission.Deposit_Amount || 0));
  $('#ipdBillingList').html(rows.length
    ? `${window.ipdClinicalTable([window.t('ipd.date'), window.t('ipd.type'), window.t('ipd.descriptionColumn'), window.t('ipd.quantityShort'), window.t('ipd.unit'), window.t('ipd.amount'), window.t('ipd.status'), window.t('common.action')], rows)}<div class="ipd-billing-total">${window.ipdEscape(window.t('ipd.billingTotal'))}: ${total.toLocaleString()}</div>`
    : window.ipdClinicalEmpty('fas fa-file-invoice-dollar', window.t('ipd.billing'), window.t('ipd.noBillingItems')));
};

window.openIpdBillingItemModal = async function (billingId) {
  const b = window.ipdClinicalState.billing.find(row => String(row.Billing_ID) === String(billingId)) || {};
  const result = await Swal.fire({
    title: billingId ? 'Edit Billing Item' : 'Add Billing Item',
    width: 780,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">Date</label><input type="date" id="ipdBillDate" class="form-control" value="${window.ipdFormDateValue(b.Item_Date)}"></div>
      <div><label class="form-label fw-bold">Type</label><select id="ipdBillType" class="form-select">${window.ipdOptions(['Room','Medication','Lab','Radiology','Procedure','Service','Other'], b.Item_Type || 'Service')}</select></div>
      <div class="full"><label class="form-label fw-bold">Description</label><input id="ipdBillDescription" class="form-control" value="${window.ipdEscape(b.Description || '')}"></div>
      <div><label class="form-label fw-bold">Quantity</label><input type="number" step="0.01" id="ipdBillQty" class="form-control" value="${window.ipdEscape(b.Quantity || 1)}"></div>
      <div><label class="form-label fw-bold">Unit Price</label><input type="number" step="0.01" id="ipdBillUnit" class="form-control" value="${window.ipdEscape(b.Unit_Price || 0)}"></div>
      <div><label class="form-label fw-bold">Status</label><select id="ipdBillStatus" class="form-select">${window.ipdOptions(['Unpaid','Paid','Waived'], b.Status || 'Unpaid')}</select></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => {
      const qty = Number($('#ipdBillQty').val() || 0);
      const unit = Number($('#ipdBillUnit').val() || 0);
      if (!$('#ipdBillDescription').val().trim()) {
        Swal.showValidationMessage('Description is required');
        return false;
      }
      return {
        Billing_ID: b.Billing_ID || window.ipdId('BILL'),
        Admission_ID: window.ipdCurrentChartAdmissionId,
        Item_Date: $('#ipdBillDate').val(),
        Item_Type: $('#ipdBillType').val(),
        Description: $('#ipdBillDescription').val().trim(),
        Quantity: qty,
        Unit_Price: unit,
        Amount: qty * unit,
        Status: $('#ipdBillStatus').val(),
        Created_By: b.Created_By || window.ipdCurrentUserName()
      };
    }
  });
  if (result.isConfirmed) await window.ipdUpsertClinical('IPD_Billing_Items', 'Billing_ID', result.value, b.Billing_ID);
};

window.renderIpdDischargeSummary = function () {
  const s = window.ipdClinicalState.dischargeSummary;
  if (!s) {
    $('#ipdDischargeSummaryView').html(window.ipdClinicalEmpty('fas fa-file-medical-alt', window.t('nav.dischargeSummary'), window.t('ipd.noDischargeSummary')));
    return;
  }
  $('#ipdDischargeSummaryView').html(`<div class="ipd-discharge-doc">
    <div><span>${window.ipdEscape(window.t('ipd.finalDiagnosis'))}</span><p>${window.ipdEscape(s.Final_Diagnosis || '-')}</p></div>
    <div><span>${window.ipdEscape(window.t('ipd.hospitalCourse'))}</span><p>${window.ipdEscape(s.Hospital_Course || '-')}</p></div>
    <div><span>${window.ipdEscape(window.t('ipd.treatmentGiven'))}</span><p>${window.ipdEscape(s.Treatment_Given || '-')}</p></div>
    <div><span>${window.ipdEscape(window.t('ipd.conditionOnDischarge'))}</span><p>${window.ipdEscape(s.Condition_On_Discharge || '-')}</p></div>
    <div><span>${window.ipdEscape(window.t('ipd.dischargeMedications'))}</span><p>${window.ipdEscape(s.Discharge_Medications || '-')}</p></div>
    <div><span>${window.ipdEscape(window.t('ipd.followUp'))}</span><p>${window.ipdEscape(s.Follow_Up || '-')}</p></div>
    <div><span>${window.ipdEscape(window.t('ipd.instructions'))}</span><p>${window.ipdEscape(s.Instructions || '-')}</p></div>
    <div class="text-muted small">${window.ipdEscape(window.t('ipd.preparedBy'))} ${window.ipdEscape(s.Prepared_By || '-')} | ${window.ipdEscape([s.Discharge_Date, s.Discharge_Time].filter(Boolean).join(' ') || '-')}</div>
  </div>`);
};

window.openIpdDischargeSummaryModal = async function () {
  const s = window.ipdClinicalState.dischargeSummary || {};
  const admission = window.ipdClinicalState.admission;
  const result = await Swal.fire({
    title: s.Summary_ID ? window.t('ipd.editDischargeSummary') : window.t('ipd.createDischargeSummary'),
    width: 900,
    html: `<div class="ipd-form-grid">
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.dischargeDate'))}</label><input type="date" id="ipdDsDate" class="form-control" value="${window.ipdEscape(s.Discharge_Date || new Date().toISOString().slice(0, 10))}"></div>
      <div><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.dischargeTime'))}</label><input type="time" id="ipdDsTime" class="form-control" value="${window.ipdEscape(s.Discharge_Time || new Date().toTimeString().slice(0, 5))}"></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.finalDiagnosis'))}</label><textarea id="ipdDsDx" class="form-control" rows="2">${window.ipdEscape(s.Final_Diagnosis || admission.Diagnosis_Admission || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.hospitalCourse'))}</label><textarea id="ipdDsCourse" class="form-control" rows="3">${window.ipdEscape(s.Hospital_Course || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.treatmentGiven'))}</label><textarea id="ipdDsTreatment" class="form-control" rows="2">${window.ipdEscape(s.Treatment_Given || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.conditionOnDischarge'))}</label><textarea id="ipdDsCondition" class="form-control" rows="2">${window.ipdEscape(s.Condition_On_Discharge || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.dischargeMedications'))}</label><textarea id="ipdDsMeds" class="form-control" rows="2">${window.ipdEscape(s.Discharge_Medications || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.followUp'))}</label><textarea id="ipdDsFollow" class="form-control" rows="2">${window.ipdEscape(s.Follow_Up || admission.Follow_Up_Date || '')}</textarea></div>
      <div class="full"><label class="form-label fw-bold">${window.ipdEscape(window.t('ipd.instructions'))}</label><textarea id="ipdDsInstructions" class="form-control" rows="2">${window.ipdEscape(s.Instructions || '')}</textarea></div>
    </div>`,
    showCancelButton: true,
    confirmButtonText: window.t('common.save'),
    cancelButtonText: window.t('common.cancel'),
    preConfirm: () => ({
      Summary_ID: s.Summary_ID || window.ipdId('DS'),
      Admission_ID: window.ipdCurrentChartAdmissionId,
      Final_Diagnosis: $('#ipdDsDx').val().trim(),
      Hospital_Course: $('#ipdDsCourse').val().trim(),
      Treatment_Given: $('#ipdDsTreatment').val().trim(),
      Condition_On_Discharge: $('#ipdDsCondition').val().trim(),
      Discharge_Medications: $('#ipdDsMeds').val().trim(),
      Follow_Up: $('#ipdDsFollow').val().trim(),
      Instructions: $('#ipdDsInstructions').val().trim(),
      Discharge_Date: $('#ipdDsDate').val(),
      Discharge_Time: $('#ipdDsTime').val(),
      Prepared_By: s.Prepared_By || window.ipdCurrentUserName()
    })
  });
  if (result.isConfirmed) await window.ipdUpsertClinical('IPD_Discharge_Summaries', 'Summary_ID', result.value, s.Summary_ID);
};

window.printIpdDischargeSummary = function () {
  const state = window.ipdClinicalState;
  const s = state.dischargeSummary;
  const admission = state.admission;
  if (!admission) return;
  if (!s) return Swal.fire(window.t('common.info'), 'Please prepare discharge summary first.', 'info');
  const loc = window.ipdAdmissionLocation(admission);
  const html = `<!doctype html><html><head><title>Discharge Summary ${window.ipdEscape(admission.Admission_ID)}</title>
    <style>body{font-family:Arial,sans-serif;padding:28px;color:#111827}h1{font-size:22px;margin:0 0 4px}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:16px 0;border:1px solid #d1d5db;padding:12px}.section{margin-top:14px}.section h3{font-size:14px;margin:0 0 4px;border-bottom:1px solid #d1d5db}.section p{white-space:pre-wrap;margin:0}.sign{display:flex;justify-content:space-between;margin-top:44px}</style>
  </head><body>
    <h1>IPD Discharge Summary</h1><div>${window.ipdEscape(admission.Admission_ID || '')}</div>
    <div class="meta">
      <div><b>Patient:</b> ${window.ipdEscape(window.ipdPatientName(admission))}</div><div><b>HN:</b> ${window.ipdEscape(admission.Patient_ID || '-')}</div>
      <div><b>Doctor:</b> ${window.ipdEscape(window.ipdDoctorName(admission) || '-')}</div><div><b>Ward/Room/Bed:</b> ${window.ipdEscape(loc.label)}</div>
      <div><b>Admit:</b> ${window.ipdEscape([admission.Admission_Date, admission.Admission_Time].filter(Boolean).join(' ') || '-')}</div><div><b>Discharge:</b> ${window.ipdEscape([s.Discharge_Date, s.Discharge_Time].filter(Boolean).join(' ') || '-')}</div>
    </div>
    ${[
      ['Final Diagnosis', s.Final_Diagnosis],
      ['Hospital Course', s.Hospital_Course],
      ['Treatment Given', s.Treatment_Given],
      ['Condition on Discharge', s.Condition_On_Discharge],
      ['Discharge Medications', s.Discharge_Medications],
      ['Follow Up', s.Follow_Up],
      ['Instructions', s.Instructions]
    ].map(([label, value]) => `<div class="section"><h3>${window.ipdEscape(label)}</h3><p>${window.ipdEscape(value || '-')}</p></div>`).join('')}
    <div class="sign"><div>Prepared by: ${window.ipdEscape(s.Prepared_By || '-')}</div><div>Doctor signature: __________________</div></div>
  </body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
};
