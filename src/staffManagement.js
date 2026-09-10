const STAFF_STORAGE_KEY = 'his_local_staff_profiles_v1';
const STAFF_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const STAFF_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const STAFF_TYPE_META = Object.freeze({
  doctor: { label: 'ແພດ', icon: 'fa-user-md', tone: 'doctor' },
  nurse: { label: 'ພະຍາບານ', icon: 'fa-user-nurse', tone: 'nurse' },
  lab: { label: 'ແລັບ', icon: 'fa-flask', tone: 'lab' },
  radiology: { label: 'ລັງສີ', icon: 'fa-radiation', tone: 'radiology' },
  pharmacy: { label: 'ການຢາ', icon: 'fa-pills', tone: 'pharmacy' },
  reception: { label: 'ຕ້ອນຮັບ', icon: 'fa-concierge-bell', tone: 'reception' },
  other: { label: 'ອື່ນໆ', icon: 'fa-user', tone: 'other' }
});

const STAFF_STATUS_META = Object.freeze({
  active: { label: 'ກຳລັງເຮັດວຽກ', icon: 'fa-check-circle' },
  on_leave: { label: 'ພັກ/ລາຍາວ', icon: 'fa-clock' },
  inactive: { label: 'ຢຸດເຮັດວຽກ', icon: 'fa-minus-circle' }
});

const STAFF_DEMO_RECORDS = Object.freeze([
  {
    id: 'staff-demo-001', employeeCode: 'DOC-001', fullName: 'ດຣ. ສົມພອນ ພົມມະຈັນ',
    employeeType: 'doctor', department: 'OPD ທົ່ວໄປ', position: 'ແພດປະຈຳ OPD',
    specialty: 'General Practice', phone: '020 5555 0101', email: '', status: 'active', linkedUserId: '', photoData: ''
  },
  {
    id: 'staff-demo-002', employeeCode: 'DOC-002', fullName: 'ດຣ. ມາລີ ວິໄລວົງ',
    employeeType: 'doctor', department: 'ຫ້ອງເດັກ', position: 'ແພດປະຈຳຫ້ອງເດັກ',
    specialty: 'Pediatrics', phone: '020 5555 0102', email: '', status: 'active', linkedUserId: '', photoData: ''
  },
  {
    id: 'staff-demo-003', employeeCode: 'NUR-001', fullName: 'ນ. ຄຳແພງ ສີລາ',
    employeeType: 'nurse', department: 'ພະຍາບານ', position: 'ພະຍາບານວິຊາຊີບ',
    specialty: '', phone: '020 5555 0201', email: '', status: 'active', linkedUserId: '', photoData: ''
  },
  {
    id: 'staff-demo-004', employeeCode: 'LAB-001', fullName: 'ທ. ອານຸສອນ ພິມມະໄຊ',
    employeeType: 'lab', department: 'ແລັບ', position: 'ນັກເຕັກນິກການແພດ',
    specialty: 'Laboratory', phone: '020 5555 0301', email: '', status: 'active', linkedUserId: '', photoData: ''
  },
  {
    id: 'staff-demo-005', employeeCode: 'RAD-001', fullName: 'ນ. ວິລະວັນ ແສງດາວ',
    employeeType: 'radiology', department: 'ລັງສີ', position: 'ນັກລັງສີການແພດ',
    specialty: 'Radiology', phone: '020 5555 0401', email: '', status: 'on_leave', linkedUserId: '', photoData: ''
  }
]);

function clean(value) {
  return String(value ?? '').trim();
}

export function normalizeStaffRecord(source = {}) {
  const type = STAFF_TYPE_META[source.employeeType] ? source.employeeType : 'other';
  const status = STAFF_STATUS_META[source.status] ? source.status : 'active';
  return {
    id: clean(source.id),
    employeeCode: clean(source.employeeCode).toUpperCase(),
    fullName: clean(source.fullName),
    employeeType: type,
    department: clean(source.department),
    position: clean(source.position),
    specialty: clean(source.specialty),
    phone: clean(source.phone),
    email: clean(source.email).toLowerCase(),
    status,
    linkedUserId: clean(source.linkedUserId),
    photoData: clean(source.photoData),
    photoPath: clean(source.photoPath),
    createdAt: clean(source.createdAt),
    updatedAt: clean(source.updatedAt)
  };
}

export function calculateStaffStats(records = []) {
  return records.reduce((stats, source) => {
    const record = normalizeStaffRecord(source);
    stats.total += 1;
    if (record.employeeType === 'doctor') stats.doctors += 1;
    if (record.employeeType === 'nurse') stats.nurses += 1;
    if (record.status === 'active') stats.active += 1;
    return stats;
  }, { total: 0, doctors: 0, nurses: 0, active: 0 });
}

export function filterStaffRecords(records = [], filters = {}) {
  const query = clean(filters.query).toLocaleLowerCase();
  const type = clean(filters.type) || 'all';
  const status = clean(filters.status) || 'all';
  return records.map(normalizeStaffRecord).filter(record => {
    if (type !== 'all' && record.employeeType !== type) return false;
    if (status !== 'all' && record.status !== status) return false;
    if (!query) return true;
    return [record.employeeCode, record.fullName, record.department, record.position, record.specialty, record.phone, record.email]
      .some(value => value.toLocaleLowerCase().includes(query));
  });
}

export function validateStaffPhotoFile(file) {
  if (!file) return { ok: false, message: 'ກະລຸນາເລືອກຮູບ' };
  if (!STAFF_PHOTO_TYPES.has(file.type)) return { ok: false, message: 'ຮອງຮັບສະເພາະ JPG, PNG ແລະ WebP' };
  if (file.size > STAFF_MAX_PHOTO_BYTES) return { ok: false, message: 'ຮູບຕ້ອງມີຂະໜາດບໍ່ເກີນ 5 MB' };
  return { ok: true, message: '' };
}

function cloneDemoRecords() {
  const now = new Date().toISOString();
  return STAFF_DEMO_RECORDS.map(record => normalizeStaffRecord({ ...record, createdAt: now, updatedAt: now }));
}

function initials(name) {
  const parts = clean(name).split(/\s+/).filter(Boolean);
  return parts.slice(-2).map(part => Array.from(part)[0] || '').join('').toUpperCase() || 'ST';
}

function createStaffRecordId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : ((random & 0x3) | 0x8);
    return value.toString(16);
  });
}

function readStaffRecords() {
  try {
    const raw = window.localStorage.getItem(STAFF_STORAGE_KEY);
    if (!raw) {
      const records = cloneDemoRecords();
      window.localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(records));
      return records;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeStaffRecord) : [];
  } catch (error) {
    console.warn('Unable to read local staff records:', error);
    return [];
  }
}

function persistStaffRecords(records) {
  window.localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(records.map(normalizeStaffRecord)));
}

function resizeStaffPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ບໍ່ສາມາດອ່ານຮູບໄດ້'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('ຮູບນີ້ບໍ່ສາມາດເປີດໄດ້'));
      image.onload = () => {
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
        const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 360;
        const context = canvas.getContext('2d');
        context.fillStyle = '#eef5fb';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function installStaffManagement({ escapeHtml = value => String(value ?? ''), backend = null } = {}) {
  const state = { records: [], initialized: false, mode: 'local' };
  window.staffManagementState = state;

  const notify = (title, text, icon = 'info') => {
    if (window.Swal?.fire) return window.Swal.fire({ title, text, icon, confirmButtonText: 'ຕົກລົງ' });
    window.alert([title, text].filter(Boolean).join('\n'));
    return Promise.resolve({ isConfirmed: true });
  };

  const photoMarkup = record => record.photoData
    ? `<img src="${escapeHtml(record.photoData)}" alt="${escapeHtml(record.fullName)}">`
    : `<span aria-hidden="true">${escapeHtml(initials(record.fullName))}</span>`;

  window.initStaffManagement = async function () {
    const useLocal = Boolean(window.isLocalStaffPreview?.()) || !backend;
    state.mode = useLocal ? 'local' : 'supabase';
    const grid = document.getElementById('staffDirectoryGrid');
    if (grid) grid.innerHTML = '<div class="staff-empty-state"><span class="spinner-border spinner-border-sm text-primary" role="status"></span><strong>ກຳລັງໂຫຼດຂໍ້ມູນພະນັກງານ...</strong></div>';
    const badge = document.getElementById('staffPersistenceBadge');
    const resetButton = document.getElementById('staffResetDemoButton');
    const formNote = document.getElementById('staffFormPersistenceNote');
    if (badge) badge.innerHTML = useLocal
      ? '<i class="fas fa-laptop-code"></i> Local test data'
      : '<i class="fas fa-database"></i> Supabase live data';
    badge?.classList.toggle('is-live', !useLocal);
    if (resetButton) resetButton.hidden = !useLocal;
    if (formNote) formNote.innerHTML = useLocal
      ? '<i class="fas fa-info-circle"></i> Local test: ຂໍ້ມູນຈະເກັບໄວ້ໃນ browser ນີ້'
      : '<i class="fas fa-shield-alt"></i> ຂໍ້ມູນຈະບັນທຶກໃນ Supabase ຂອງ HIS';
    try {
      state.records = useLocal ? readStaffRecords() : (await backend.load()).map(normalizeStaffRecord);
      state.initialized = true;
      window.renderStaffDirectory();
    } catch (error) {
      state.initialized = false;
      if (grid) grid.innerHTML = `<div class="staff-empty-state staff-empty-state--error"><i class="fas fa-exclamation-triangle"></i><strong>ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ</strong><span>${escapeHtml(error?.message || 'Unknown error')}</span></div>`;
      await notify('ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ', error?.message || 'ກະລຸນາກວດສອບ Supabase migration', 'error');
    }
  };

  window.renderStaffDirectory = function () {
    if (!state.initialized) state.records = readStaffRecords();
    const stats = calculateStaffStats(state.records);
    const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = String(value); };
    setText('staffTotalCount', stats.total);
    setText('staffDoctorCount', stats.doctors);
    setText('staffNurseCount', stats.nurses);
    setText('staffActiveCount', stats.active);

    const filtered = filterStaffRecords(state.records, {
      query: document.getElementById('staffSearchInput')?.value,
      type: document.getElementById('staffTypeFilter')?.value,
      status: document.getElementById('staffStatusFilter')?.value
    });
    setText('staffFilteredCount', filtered.length);
    const grid = document.getElementById('staffDirectoryGrid');
    if (!grid) return;
    if (!filtered.length) {
      grid.innerHTML = `<div class="staff-empty-state"><i class="fas fa-user-friends"></i><strong>ບໍ່ພົບພະນັກງານ</strong><span>ລອງປ່ຽນຄຳຄົ້ນຫາ ຫຼືເພີ່ມພະນັກງານໃໝ່</span></div>`;
      return;
    }

    grid.innerHTML = filtered.map(record => {
      const typeMeta = STAFF_TYPE_META[record.employeeType] || STAFF_TYPE_META.other;
      const statusMeta = STAFF_STATUS_META[record.status] || STAFF_STATUS_META.active;
      const secondary = [record.position, record.specialty].filter(Boolean).join(' · ') || typeMeta.label;
      const phoneLine = record.phone
        ? `<span title="${escapeHtml(record.phone)}"><i class="fas fa-phone-alt"></i>${escapeHtml(record.phone)}</span>`
        : '';
      return `<article class="staff-profile-card staff-profile-card--${typeMeta.tone}">
        <div class="staff-profile-card-head">
          <div class="staff-avatar">${photoMarkup(record)}</div>
          <div class="staff-profile-identity">
            <div class="staff-code">${escapeHtml(record.employeeCode || '—')}</div>
            <h4>${escapeHtml(record.fullName || '—')}</h4>
            <p>${escapeHtml(secondary)}</p>
          </div>
          <div class="dropdown">
            <button class="staff-more-button" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="ຈັດການ ${escapeHtml(record.fullName)}"><i class="fas fa-ellipsis-h"></i></button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><button class="dropdown-item" type="button" onclick="window.openStaffModal('${escapeHtml(record.id)}')"><i class="fas fa-edit me-2 text-primary"></i>ແກ້ໄຂ</button></li>
              <li><button class="dropdown-item text-danger" type="button" onclick="window.deleteStaffProfile('${escapeHtml(record.id)}')"><i class="fas fa-trash-alt me-2"></i>ລຶບ</button></li>
            </ul>
          </div>
        </div>
        <div class="staff-profile-meta">
          <span><i class="fas fa-hospital"></i>${escapeHtml(record.department || 'ບໍ່ລະບຸພະແນກ')}</span>
          ${phoneLine}
        </div>
        <footer>
          <span class="staff-type-chip"><i class="fas ${typeMeta.icon}"></i>${typeMeta.label}</span>
          <span class="staff-status-chip staff-status-chip--${record.status}"><i class="fas ${statusMeta.icon}"></i>${statusMeta.label}</span>
        </footer>
      </article>`;
    }).join('');
  };

  window.openStaffModal = function (recordId = '') {
    const record = state.records.find(item => item.id === recordId) || normalizeStaffRecord({ status: 'active', employeeType: 'doctor' });
    const values = {
      staffRecordId: record.id,
      staffEmployeeCode: record.employeeCode,
      staffFullName: record.fullName,
      staffEmployeeType: record.employeeType,
      staffDepartment: record.department,
      staffPosition: record.position,
      staffSpecialty: record.specialty,
      staffPhone: record.phone,
      staffEmail: record.email,
      staffStatus: record.status,
      staffLinkedUserId: record.linkedUserId,
      staffPhotoData: record.photoData,
      staffPhotoPath: record.photoPath
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.value = value || '';
    });
    const fileInput = document.getElementById('staffPhotoInput');
    if (fileInput) fileInput.value = '';
    const title = document.getElementById('staffEditorTitle');
    if (title) title.textContent = record.id ? 'ແກ້ໄຂພະນັກງານ' : 'ເພີ່ມພະນັກງານ';
    window.renderStaffPhotoPreview();
    const modalElement = document.getElementById('staffEditorModal');
    if (modalElement && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
  };

  window.renderStaffPhotoPreview = function () {
    const photoData = clean(document.getElementById('staffPhotoData')?.value);
    const fullName = clean(document.getElementById('staffFullName')?.value);
    const preview = document.getElementById('staffPhotoPreview');
    const removeButton = document.getElementById('staffRemovePhotoButton');
    if (preview) preview.innerHTML = photoData
      ? `<img src="${escapeHtml(photoData)}" alt="ຮູບ ${escapeHtml(fullName)}">`
      : `<span>${escapeHtml(initials(fullName))}</span><i class="fas fa-camera"></i>`;
    if (removeButton) removeButton.disabled = !photoData;
  };

  window.handleStaffPhotoChange = async function (event) {
    const file = event?.target?.files?.[0];
    const validation = validateStaffPhotoFile(file);
    if (!validation.ok) {
      if (event?.target) event.target.value = '';
      await notify('ຮູບບໍ່ຖືກຕ້ອງ', validation.message, 'warning');
      return;
    }
    try {
      const photoData = await resizeStaffPhoto(file);
      const input = document.getElementById('staffPhotoData');
      if (input) input.value = photoData;
      window.renderStaffPhotoPreview();
    } catch (error) {
      await notify('ອ່ານຮູບບໍ່ສຳເລັດ', error.message, 'error');
    }
  };

  window.removeStaffPhoto = function () {
    const photoData = document.getElementById('staffPhotoData');
    const photoInput = document.getElementById('staffPhotoInput');
    if (photoData) photoData.value = '';
    const photoPath = document.getElementById('staffPhotoPath');
    if (photoPath) photoPath.value = '';
    if (photoInput) photoInput.value = '';
    window.renderStaffPhotoPreview();
  };

  window.saveStaffProfile = async function (event) {
    event?.preventDefault();
    const form = document.getElementById('staffEditorForm');
    if (!form?.checkValidity()) {
      form?.reportValidity();
      return;
    }
    const existingId = clean(document.getElementById('staffRecordId')?.value);
    const now = new Date().toISOString();
    const existing = state.records.find(item => item.id === existingId);
    const record = normalizeStaffRecord({
      id: existingId || createStaffRecordId(),
      employeeCode: document.getElementById('staffEmployeeCode')?.value,
      fullName: document.getElementById('staffFullName')?.value,
      employeeType: document.getElementById('staffEmployeeType')?.value,
      department: document.getElementById('staffDepartment')?.value,
      position: document.getElementById('staffPosition')?.value,
      specialty: document.getElementById('staffSpecialty')?.value,
      phone: document.getElementById('staffPhone')?.value,
      email: document.getElementById('staffEmail')?.value,
      status: document.getElementById('staffStatus')?.value,
      linkedUserId: document.getElementById('staffLinkedUserId')?.value,
      photoData: document.getElementById('staffPhotoData')?.value,
      photoPath: document.getElementById('staffPhotoPath')?.value,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    });
    if (state.records.some(item => item.id !== record.id && item.employeeCode.toUpperCase() === record.employeeCode.toUpperCase())) {
      await notify('ລະຫັດຊ້ຳ', `ລະຫັດ ${record.employeeCode} ຖືກໃຊ້ແລ້ວ`, 'warning');
      return;
    }
    let savedRecord = record;
    try {
      if (state.mode === 'supabase') savedRecord = normalizeStaffRecord(await backend.save(record, existing));
      const nextRecords = existing
        ? state.records.map(item => item.id === savedRecord.id ? savedRecord : item)
        : [...state.records, savedRecord];
      if (state.mode === 'local') persistStaffRecords(nextRecords);
      state.records = nextRecords;
    } catch (error) {
      const message = state.mode === 'local'
        ? 'ພື້ນທີ່ເກັບຂໍ້ມູນໃນ browser ອາດເຕັມ. ລອງໃຊ້ຮູບທີ່ນ້ອຍລົງ.'
        : (error?.message || 'Supabase save failed');
      await notify('ບັນທຶກບໍ່ສຳເລັດ', message, 'error');
      return;
    }
    window.renderStaffDirectory();
    const modalElement = document.getElementById('staffEditorModal');
    if (modalElement && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modalElement).hide();
    await notify('ບັນທຶກແລ້ວ', state.mode === 'local'
      ? `${savedRecord.fullName} ຖືກບັນທຶກໃນ Local test data`
      : `${savedRecord.fullName} ຖືກບັນທຶກໃນ HIS ແລ້ວ`, 'success');
  };

  window.deleteStaffProfile = async function (recordId) {
    const record = state.records.find(item => item.id === recordId);
    if (!record) return;
    const result = window.Swal?.fire
      ? await window.Swal.fire({
        title: 'ລຶບພະນັກງານ?', text: record.fullName, icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ລຶບ', cancelButtonText: 'ຍົກເລີກ', confirmButtonColor: '#dc3545'
      })
      : { isConfirmed: window.confirm(`ລຶບ ${record.fullName}?`) };
    if (!result.isConfirmed) return;
    if (state.mode === 'supabase') {
      try {
        await backend.remove(record);
      } catch (error) {
        await notify('ລຶບບໍ່ສຳເລັດ', error?.message || 'Unknown error', 'error');
        return;
      }
    }
    const nextRecords = state.records.filter(item => item.id !== recordId);
    if (state.mode === 'local') persistStaffRecords(nextRecords);
    state.records = nextRecords;
    window.renderStaffDirectory();
  };

  window.resetStaffDemoData = async function () {
    const result = window.Swal?.fire
      ? await window.Swal.fire({
        title: 'ກັບໄປໃຊ້ຂໍ້ມູນຕົວຢ່າງ?',
        text: 'ຂໍ້ມູນພະນັກງານ Local ທີ່ເພີ່ມໄວ້ຈະຖືກແທນທີ່',
        icon: 'question', showCancelButton: true, confirmButtonText: 'Reset', cancelButtonText: 'ຍົກເລີກ'
      })
      : { isConfirmed: window.confirm('Reset ຂໍ້ມູນພະນັກງານ Local?') };
    if (!result.isConfirmed) return;
    state.records = cloneDemoRecords();
    persistStaffRecords(state.records);
    window.renderStaffDirectory();
  };

  document.addEventListener('input', event => {
    if (event.target?.id === 'staffFullName') window.renderStaffPhotoPreview();
  });
}

export { STAFF_STORAGE_KEY, STAFF_TYPE_META, STAFF_STATUS_META };
