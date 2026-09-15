const STAFF_STORAGE_KEY = 'his_local_staff_profiles_v1';
const STAFF_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const STAFF_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const STAFF_CROP_STAGE = Object.freeze({ width: 480, height: 360, padding: 20 });
const STAFF_CROP_PRESETS = Object.freeze({
  circle: { ratio: 1, outputWidth: 480, outputHeight: 480 },
  square: { ratio: 1, outputWidth: 480, outputHeight: 480 },
  portrait: { ratio: 3 / 4, outputWidth: 480, outputHeight: 640 }
});

const STAFF_TYPE_META = Object.freeze({
  doctor: { label: 'ແພດ', icon: 'fa-user-md', tone: 'doctor' },
  nurse: { label: 'ພະຍາບານ', icon: 'fa-user-nurse', tone: 'nurse' },
  lab: { label: 'ແລັບ', icon: 'fa-flask', tone: 'lab' },
  radiology: { label: 'ເອໂກ້ + ລັງສີ', icon: 'fa-radiation', tone: 'radiology' },
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
    employeeType: 'doctor', department: 'ແພດ', specialty: 'General Practice',
    phone: '020 5555 0101', email: '', status: 'active', photoData: ''
  },
  {
    id: 'staff-demo-002', employeeCode: 'DOC-002', fullName: 'ດຣ. ມາລີ ວິໄລວົງ',
    employeeType: 'doctor', department: 'ແພດ', specialty: 'Pediatrics',
    phone: '020 5555 0102', email: '', status: 'active', photoData: ''
  },
  {
    id: 'staff-demo-003', employeeCode: 'NUR-001', fullName: 'ນ. ຄຳແພງ ສີລາ',
    employeeType: 'nurse', department: 'ພະຍາບານ', specialty: '',
    phone: '020 5555 0201', email: '', status: 'active', photoData: ''
  },
  {
    id: 'staff-demo-004', employeeCode: 'LAB-001', fullName: 'ທ. ອານຸສອນ ພິມມະໄຊ',
    employeeType: 'lab', department: 'ແລັບ', specialty: 'Laboratory',
    phone: '020 5555 0301', email: '', status: 'active', photoData: ''
  },
  {
    id: 'staff-demo-005', employeeCode: 'RAD-001', fullName: 'ນ. ວິລະວັນ ແສງດາວ',
    employeeType: 'radiology', department: 'ເອໂກ້ + ລັງສີ', specialty: 'Echo + Radiology',
    phone: '020 5555 0401', email: '', status: 'on_leave', photoData: ''
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

export function getStaffCropBox(preset = 'circle', stage = STAFF_CROP_STAGE) {
  const config = STAFF_CROP_PRESETS[preset] || STAFF_CROP_PRESETS.circle;
  const availableWidth = stage.width - (stage.padding * 2);
  const availableHeight = stage.height - (stage.padding * 2);
  let width = Math.min(availableWidth, availableHeight * config.ratio);
  let height = width / config.ratio;
  if (height > availableHeight) {
    height = availableHeight;
    width = height * config.ratio;
  }
  return {
    x: (stage.width - width) / 2,
    y: (stage.height - height) / 2,
    width,
    height,
    centerX: stage.width / 2,
    centerY: stage.height / 2
  };
}

export function calculateStaffCropTransform({ imageWidth, imageHeight, preset = 'circle', zoom = 1, rotation = 0, offsetX = 0, offsetY = 0 }) {
  const crop = getStaffCropBox(preset);
  const sideways = Math.abs(rotation % 180) === 90;
  const rotatedWidth = sideways ? imageHeight : imageWidth;
  const rotatedHeight = sideways ? imageWidth : imageHeight;
  const baseScale = Math.max(crop.width / rotatedWidth, crop.height / rotatedHeight);
  const scale = baseScale * Math.max(1, Math.min(3, Number(zoom) || 1));
  const maxOffsetX = Math.max(0, ((rotatedWidth * scale) - crop.width) / 2);
  const maxOffsetY = Math.max(0, ((rotatedHeight * scale) - crop.height) / 2);
  return {
    crop,
    scale,
    offsetX: maxOffsetX ? Math.max(-maxOffsetX, Math.min(maxOffsetX, Number(offsetX) || 0)) : 0,
    offsetY: maxOffsetY ? Math.max(-maxOffsetY, Math.min(maxOffsetY, Number(offsetY) || 0)) : 0
  };
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

export function createStaffEmployeeCode(employeeType, recordId) {
  const prefixes = { doctor: 'DOC', nurse: 'NUR', lab: 'LAB', radiology: 'RAD', pharmacy: 'PHA', reception: 'REC', other: 'STF' };
  const suffix = clean(recordId).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || Date.now().toString(36).toUpperCase();
  return `${prefixes[employeeType] || prefixes.other}-${suffix}`;
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

function readStaffPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ບໍ່ສາມາດອ່ານຮູບໄດ້'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function loadStaffPhotoImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onerror = () => reject(new Error('ຮູບນີ້ບໍ່ສາມາດເປີດໄດ້'));
    image.onload = () => resolve(image);
    image.src = source;
  });
}

export function installStaffManagement({ escapeHtml = value => String(value ?? ''), backend = null } = {}) {
  const state = { records: [], initialized: false, mode: 'local' };
  const cropState = {
    image: null, source: '', preset: 'circle', zoom: 1, rotation: 0,
    offsetX: 0, offsetY: 0, dragging: false, pointerId: null,
    dragStartX: 0, dragStartY: 0, dragOffsetX: 0, dragOffsetY: 0
  };
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

    const rows = filtered.map((record, index) => {
      const typeMeta = STAFF_TYPE_META[record.employeeType] || STAFF_TYPE_META.other;
      const statusMeta = STAFF_STATUS_META[record.status] || STAFF_STATUS_META.active;
      const specialty = record.specialty || '—';
      const phone = record.phone || '—';
      const email = record.email || '';
      return `<tr class="staff-table-row staff-table-row--${typeMeta.tone}">
        <td class="staff-table-index">${index + 1}</td>
        <td>
          <div class="staff-table-person">
            <div class="staff-avatar">${photoMarkup(record)}</div>
          <div class="staff-profile-identity">
            <h4>${escapeHtml(record.fullName || '—')}</h4>
              <p>${escapeHtml(typeMeta.label)}</p>
          </div>
          </div>
        </td>
        <td><span class="staff-type-chip"><i class="fas ${typeMeta.icon}"></i>${typeMeta.label}</span></td>
        <td><span class="staff-table-secondary" title="${escapeHtml(specialty)}">${escapeHtml(specialty)}</span></td>
        <td><div class="staff-table-contact"><span><i class="fas fa-phone-alt"></i>${escapeHtml(phone)}</span>${email ? `<span title="${escapeHtml(email)}"><i class="fas fa-envelope"></i>${escapeHtml(email)}</span>` : ''}</div></td>
        <td><span class="staff-status-chip staff-status-chip--${record.status}"><i class="fas ${statusMeta.icon}"></i>${statusMeta.label}</span></td>
        <td><div class="staff-table-actions">
          <button class="staff-row-action staff-row-action--edit" type="button" onclick="window.openStaffModal('${escapeHtml(record.id)}')" aria-label="ແກ້ໄຂ ${escapeHtml(record.fullName)}"><i class="fas fa-edit"></i><span>ແກ້ໄຂ</span></button>
          <button class="staff-row-action staff-row-action--delete" type="button" onclick="window.deleteStaffProfile('${escapeHtml(record.id)}')" aria-label="ລຶບ ${escapeHtml(record.fullName)}"><i class="fas fa-trash-alt"></i></button>
        </div></td>
      </tr>`;
    }).join('');

    grid.innerHTML = `<div class="staff-table-scroll"><table class="staff-directory-table">
      <thead><tr>
        <th class="staff-table-index">#</th>
        <th>ຊື່ພະນັກງານ</th>
        <th>ພະແນກ</th>
        <th>ວິຊາສະເພາະ</th>
        <th>ຕິດຕໍ່</th>
        <th>ສະຖານະ</th>
        <th class="staff-table-action-heading">ຈັດການ</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  };

  window.openStaffModal = function (recordId = '') {
    const record = state.records.find(item => item.id === recordId) || normalizeStaffRecord({ status: 'active', employeeType: 'doctor' });
    const values = {
      staffRecordId: record.id,
      staffFullName: record.fullName,
      staffDepartmentType: record.employeeType,
      staffSpecialty: record.specialty,
      staffPhone: record.phone,
      staffEmail: record.email,
      staffStatus: record.status,
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
    const adjustButton = document.getElementById('staffAdjustPhotoButton');
    if (preview) preview.innerHTML = photoData
      ? `<img src="${escapeHtml(photoData)}" alt="ຮູບ ${escapeHtml(fullName)}">`
      : `<span>${escapeHtml(initials(fullName))}</span><i class="fas fa-camera"></i>`;
    if (removeButton) removeButton.disabled = !photoData;
    if (adjustButton) adjustButton.disabled = !photoData;
  };

  function currentStaffCropTransform() {
    if (!cropState.image) return null;
    const transform = calculateStaffCropTransform({
      imageWidth: cropState.image.naturalWidth,
      imageHeight: cropState.image.naturalHeight,
      preset: cropState.preset,
      zoom: cropState.zoom,
      rotation: cropState.rotation,
      offsetX: cropState.offsetX,
      offsetY: cropState.offsetY
    });
    cropState.offsetX = transform.offsetX;
    cropState.offsetY = transform.offsetY;
    return transform;
  }

  function drawStaffCropImage(context, transform) {
    context.save();
    context.translate(transform.crop.centerX + transform.offsetX, transform.crop.centerY + transform.offsetY);
    context.rotate(cropState.rotation * Math.PI / 180);
    context.scale(transform.scale, transform.scale);
    context.drawImage(cropState.image, -cropState.image.naturalWidth / 2, -cropState.image.naturalHeight / 2);
    context.restore();
  }

  window.renderStaffPhotoCrop = function () {
    const canvas = document.getElementById('staffPhotoCropCanvas');
    if (!canvas || !cropState.image) return;
    const context = canvas.getContext('2d');
    const transform = currentStaffCropTransform();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#24384b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawStaffCropImage(context, transform);

    const crop = transform.crop;
    context.save();
    context.fillStyle = 'rgba(5, 15, 24, .68)';
    context.beginPath();
    context.rect(0, 0, canvas.width, canvas.height);
    if (cropState.preset === 'circle') context.arc(crop.centerX, crop.centerY, crop.width / 2, 0, Math.PI * 2);
    else context.rect(crop.x, crop.y, crop.width, crop.height);
    context.fill('evenodd');
    context.strokeStyle = '#ffffff';
    context.lineWidth = 3;
    context.beginPath();
    if (cropState.preset === 'circle') context.arc(crop.centerX, crop.centerY, crop.width / 2, 0, Math.PI * 2);
    else context.rect(crop.x, crop.y, crop.width, crop.height);
    context.stroke();
    context.restore();

    const zoom = document.getElementById('staffPhotoZoom');
    const zoomValue = document.getElementById('staffPhotoZoomValue');
    if (zoom) zoom.value = String(Math.round(cropState.zoom * 100));
    if (zoomValue) zoomValue.textContent = `${Math.round(cropState.zoom * 100)}%`;
    document.querySelectorAll('[data-staff-crop-preset]').forEach(button => {
      const selected = button.dataset.staffCropPreset === cropState.preset;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };

  window.openStaffPhotoEditor = async function (source) {
    if (!source) return;
    try {
      cropState.image = await loadStaffPhotoImage(source);
      cropState.source = source;
      cropState.preset = 'circle';
      cropState.zoom = 1;
      cropState.rotation = 0;
      cropState.offsetX = 0;
      cropState.offsetY = 0;
      const overlay = document.getElementById('staffPhotoCropOverlay');
      if (!overlay) return;
      overlay.hidden = false;
      document.body.classList.add('staff-photo-crop-open');
      window.renderStaffPhotoCrop();
      document.getElementById('staffPhotoCropCanvas')?.focus();
    } catch (error) {
      const input = document.getElementById('staffPhotoInput');
      if (input) input.value = '';
      await notify('ເປີດຮູບບໍ່ສຳເລັດ', error.message, 'error');
    }
  };

  window.closeStaffPhotoEditor = function () {
    const overlay = document.getElementById('staffPhotoCropOverlay');
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('staff-photo-crop-open');
    cropState.dragging = false;
    cropState.pointerId = null;
    const input = document.getElementById('staffPhotoInput');
    if (input) input.value = '';
  };

  window.editCurrentStaffPhoto = function () {
    const source = clean(document.getElementById('staffPhotoData')?.value);
    if (source) void window.openStaffPhotoEditor(source);
  };

  window.setStaffCropPreset = function (preset) {
    if (!STAFF_CROP_PRESETS[preset]) return;
    cropState.preset = preset;
    cropState.offsetX = 0;
    cropState.offsetY = 0;
    window.renderStaffPhotoCrop();
  };

  window.setStaffCropZoom = function (percent) {
    cropState.zoom = Math.max(1, Math.min(3, Number(percent) / 100 || 1));
    window.renderStaffPhotoCrop();
  };

  window.changeStaffCropZoom = function (amount) {
    cropState.zoom = Math.max(1, Math.min(3, cropState.zoom + Number(amount || 0)));
    window.renderStaffPhotoCrop();
  };

  window.rotateStaffCrop = function (degrees) {
    cropState.rotation = ((cropState.rotation + Number(degrees || 0)) % 360 + 360) % 360;
    cropState.offsetX = 0;
    cropState.offsetY = 0;
    window.renderStaffPhotoCrop();
  };

  window.resetStaffPhotoCrop = function () {
    cropState.zoom = 1;
    cropState.rotation = 0;
    cropState.offsetX = 0;
    cropState.offsetY = 0;
    window.renderStaffPhotoCrop();
  };

  window.applyStaffPhotoCrop = async function () {
    try {
      const transform = currentStaffCropTransform();
      if (!transform || !cropState.image) return;
      const output = STAFF_CROP_PRESETS[cropState.preset] || STAFF_CROP_PRESETS.circle;
      const canvas = document.createElement('canvas');
      canvas.width = output.outputWidth;
      canvas.height = output.outputHeight;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const ratio = canvas.width / transform.crop.width;
      context.save();
      context.scale(ratio, ratio);
      context.translate(-transform.crop.x, -transform.crop.y);
      drawStaffCropImage(context, transform);
      context.restore();
      const input = document.getElementById('staffPhotoData');
      if (input) input.value = canvas.toDataURL('image/jpeg', 0.86);
      window.renderStaffPhotoPreview();
      window.closeStaffPhotoEditor();
    } catch (error) {
      await notify('ປັບຮູບບໍ່ສຳເລັດ', error?.message || 'Canvas export failed', 'error');
    }
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
      const photoData = await readStaffPhoto(file);
      await window.openStaffPhotoEditor(photoData);
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
    const recordId = existingId || createStaffRecordId();
    const employeeType = clean(document.getElementById('staffDepartmentType')?.value) || 'other';
    const typeMeta = STAFF_TYPE_META[employeeType] || STAFF_TYPE_META.other;
    const record = normalizeStaffRecord({
      id: recordId,
      employeeCode: existing?.employeeCode || createStaffEmployeeCode(employeeType, recordId),
      fullName: document.getElementById('staffFullName')?.value,
      employeeType,
      department: typeMeta.label,
      position: existing?.position,
      specialty: document.getElementById('staffSpecialty')?.value,
      phone: document.getElementById('staffPhone')?.value,
      email: document.getElementById('staffEmail')?.value,
      status: document.getElementById('staffStatus')?.value,
      linkedUserId: existing?.linkedUserId,
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

  document.addEventListener('keydown', event => {
    const overlay = document.getElementById('staffPhotoCropOverlay');
    if (!overlay || overlay.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      window.closeStaffPhotoEditor();
      return;
    }
    if (event.target?.id !== 'staffPhotoCropCanvas') return;
    const step = event.shiftKey ? 12 : 4;
    if (event.key === 'ArrowLeft') cropState.offsetX -= step;
    else if (event.key === 'ArrowRight') cropState.offsetX += step;
    else if (event.key === 'ArrowUp') cropState.offsetY -= step;
    else if (event.key === 'ArrowDown') cropState.offsetY += step;
    else return;
    event.preventDefault();
    window.renderStaffPhotoCrop();
  });

  document.addEventListener('pointerdown', event => {
    const canvas = event.target?.closest?.('#staffPhotoCropCanvas');
    if (!canvas || !cropState.image) return;
    const rect = canvas.getBoundingClientRect();
    cropState.dragging = true;
    cropState.pointerId = event.pointerId;
    cropState.dragStartX = (event.clientX - rect.left) * (canvas.width / rect.width);
    cropState.dragStartY = (event.clientY - rect.top) * (canvas.height / rect.height);
    cropState.dragOffsetX = cropState.offsetX;
    cropState.dragOffsetY = cropState.offsetY;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add('is-dragging');
  });

  document.addEventListener('pointermove', event => {
    if (!cropState.dragging || event.pointerId !== cropState.pointerId) return;
    const canvas = document.getElementById('staffPhotoCropCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    cropState.offsetX = cropState.dragOffsetX + x - cropState.dragStartX;
    cropState.offsetY = cropState.dragOffsetY + y - cropState.dragStartY;
    window.renderStaffPhotoCrop();
  });

  const finishCropDrag = event => {
    if (!cropState.dragging || (event.pointerId != null && event.pointerId !== cropState.pointerId)) return;
    cropState.dragging = false;
    cropState.pointerId = null;
    document.getElementById('staffPhotoCropCanvas')?.classList.remove('is-dragging');
  };
  document.addEventListener('pointerup', finishCropDrag);
  document.addEventListener('pointercancel', finishCropDrag);

  document.addEventListener('wheel', event => {
    if (event.target?.id !== 'staffPhotoCropCanvas') return;
    event.preventDefault();
    window.changeStaffCropZoom(event.deltaY < 0 ? 0.05 : -0.05);
  }, { passive: false });
}

export { STAFF_STORAGE_KEY, STAFF_TYPE_META, STAFF_STATUS_META };
