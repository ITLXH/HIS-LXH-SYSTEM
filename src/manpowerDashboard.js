const STAFF_STORAGE_KEY = 'his_local_staff_profiles_v1';
export const MANPOWER_STORAGE_KEY = 'his_local_manpower_assignments_v1';
export const MANPOWER_HISTORY_STORAGE_KEY = 'his_local_manpower_history_v1';

const TYPES = Object.freeze({
  doctor: { label: 'ແພດ', subtitle: 'Doctor', icon: 'fa-user-md', tone: 'blue', avatar: '/assets/manpower/avatar-doctor.png' },
  nurse: { label: 'ພະຍາບານ', subtitle: 'Nurse', icon: 'fa-user-nurse', tone: 'purple', avatar: '/assets/manpower/avatar-nurse.png' },
  pharmacy: { label: 'ການຢາ', subtitle: 'Pharmacy', icon: 'fa-pills', tone: 'green', avatar: '/assets/manpower/avatar-pharmacy.png' },
  lab: { label: 'ແລັບ', subtitle: 'Laboratory', icon: 'fa-flask', tone: 'teal', avatar: '/assets/manpower/avatar-laboratory.png' },
  radiology: { label: 'ເອໂກ້ + ລັງສີ', subtitle: 'Echo + Radiology', icon: 'fa-radiation', tone: 'orange', avatar: '/assets/manpower/avatar-imaging.png' }
});

const STATUSES = Object.freeze({
  working: { label: 'ເຂົ້າເວນ', icon: 'fa-check-circle' },
  leave: { label: 'ລາ', icon: 'fa-bed' },
  absent: { label: 'ຂາດ', icon: 'fa-times-circle' },
  swapped: { label: 'ປ່ຽນເວນ', icon: 'fa-exchange-alt' }
});

const SHIFTS = Object.freeze({
  morning: { label: 'ກະເຊົ້າ', time: '08:00–16:00' },
  evening: { label: 'ກະແລງ', time: '16:00–21:00' },
  night: { label: 'ກະກາງຄືນ', time: '21:00–08:00' }
});

const HISTORY_ACTIONS = Object.freeze({
  created: { label: 'ເພີ່ມເຂົ້າເວນ', icon: 'fa-user-plus', tone: 'created' },
  updated: { label: 'ປ່ຽນສະຖານະ', icon: 'fa-edit', tone: 'updated' },
  replaced: { label: 'ປ່ຽນຜູ້ຮັບເວນ', icon: 'fa-exchange-alt', tone: 'replaced' },
  deleted: { label: 'ເອົາອອກຈາກເວນ', icon: 'fa-user-minus', tone: 'deleted' }
});

const LOCAL_PHARMACY_DEMO = Object.freeze({
  id: 'staff-demo-006',
  employeeCode: 'PHA-001',
  fullName: 'ນ. ຈັນທະລາ ສີສຸກ',
  employeeType: 'pharmacy',
  department: 'ການຢາ',
  specialty: 'Pharmacy',
  phone: '020 5555 0501',
  email: '',
  status: 'active',
  photoData: ''
});

const TYPE_ALIASES = Object.freeze({
  doctor: ['doctor', 'doctors', 'ແພດ', 'ໝໍ'],
  nurse: ['nurse', 'nursing', 'ພະຍາບານ'],
  pharmacy: ['pharmacy', 'pharmacist', 'ການຢາ', 'ຫ້ອງຢາ'],
  lab: ['lab', 'laboratory', 'ແລັບ', 'ຫ້ອງແລັບ'],
  radiology: ['radiology', 'xray', 'x-ray', 'ultrasound', 'echo', 'ເອໂກ້', 'ລັງສີ', 'ເອໂກ້ + ລັງສີ', 'ອັນຕຣາຊາວ']
});

const clean = value => String(value ?? '').trim();
const localDate = date => {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
};
const today = () => localDate(new Date());

export function resolveManpowerStaffType(staff = {}) {
  const explicitType = clean(staff.employeeType).toLocaleLowerCase();
  if (Object.hasOwn(TYPES, explicitType)) return explicitType;
  const searchable = [staff.employeeType, staff.department, staff.specialty]
    .map(value => clean(value).toLocaleLowerCase())
    .filter(Boolean)
    .join(' ');
  return Object.entries(TYPE_ALIASES).find(([, aliases]) => aliases.some(alias => searchable.includes(alias)))?.[0] || '';
}

export function calculateManpowerSummary(assignments = []) {
  return assignments.reduce((summary, item) => {
    if (Object.hasOwn(summary, item.status)) summary[item.status] += 1;
    return summary;
  }, { working: 0, absent: 0, leave: 0, swapped: 0 });
}

export function filterManpowerHistory(records = [], filters = {}) {
  const query = clean(filters.query).toLocaleLowerCase();
  return records.filter(item => {
    if (filters.date && item.date !== filters.date) return false;
    if (filters.shift && item.shift !== filters.shift) return false;
    if (filters.type && item.staffType !== filters.type) return false;
    if (filters.action && item.action !== filters.action) return false;
    if (!query) return true;
    return [item.staffName, item.replacementBeforeName, item.replacementAfterName, item.changedBy]
      .some(value => clean(value).toLocaleLowerCase().includes(query));
  });
}

function readJson(key) {
  try { return JSON.parse(window.localStorage.getItem(key) || '[]'); } catch { return []; }
}

function writeAssignments(assignments) {
  window.localStorage.setItem(MANPOWER_STORAGE_KEY, JSON.stringify(assignments));
}

function writeHistory(history) {
  window.localStorage.setItem(MANPOWER_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function createId() {
  return window.crypto?.randomUUID?.() || `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function installManpowerDashboard({ escapeHtml = value => String(value ?? ''), staffBackend = null, backend = null, getCurrentUser = null, canManage = null } = {}) {
  const state = { date: today(), shift: 'morning', staff: [], assignments: [], history: [], mode: 'local', initialized: false, unsubscribe: null, refreshTimer: null };
  window.manpowerDashboardState = state;

  const isLocalMode = () => state.mode === 'local';
  const mayManage = () => isLocalMode() || (typeof canManage === 'function' && canManage());
  const notify = async (title, text, icon = 'error') => {
    if (window.Swal?.fire) return window.Swal.fire({ title, text, icon, confirmButtonText: 'ຕົກລົງ' });
    window.alert?.(`${title}\n${text}`);
    return null;
  };

  const readLocalStaff = () => {
    const records = readJson(STAFF_STORAGE_KEY);
    const staff = Array.isArray(records) ? records.filter(item => item?.id && item?.fullName && item?.status !== 'inactive') : [];
    if (window.isLocalManpowerPreview?.() && !staff.some(item => item.employeeType === 'pharmacy')) {
      staff.push({ ...LOCAL_PHARMACY_DEMO, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      window.localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staff));
    }
    return staff;
  };

  const loadStaff = async () => {
    if (window.isLocalManpowerPreview?.()) return readLocalStaff();
    const sharedState = window.staffManagementState;
    if (sharedState?.initialized && sharedState.mode === 'supabase' && Array.isArray(sharedState.records)) {
      return sharedState.records.filter(item => item?.id && item?.fullName && item?.status !== 'inactive');
    }
    if (staffBackend?.load) {
      const records = await staffBackend.load();
      return Array.isArray(records) ? records.filter(item => item?.id && item?.fullName && item?.status !== 'inactive') : [];
    }
    return readLocalStaff();
  };

  const staffById = staffId => state.staff.find(item => item.id === staffId);
  const currentOperator = () => {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    return clean(user?.name || user?.username || user?.id) || 'Manpower Local Test';
  };
  const appendHistory = ({ action, assignment, before = {}, after = {} }) => {
    if (!isLocalMode()) return;
    const staff = staffById(assignment.staffId);
    const beforeReplacement = staffById(before.replacementStaffId);
    const afterReplacement = staffById(after.replacementStaffId);
    state.history.unshift({
      id: createId(),
      assignmentId: assignment.id,
      action,
      date: assignment.date,
      shift: assignment.shift,
      staffId: assignment.staffId,
      staffName: staff?.fullName || assignment.staffName || '-',
      staffType: resolveManpowerStaffType(staff || assignment),
      statusBefore: clean(before.status),
      statusAfter: clean(after.status),
      replacementBeforeId: clean(before.replacementStaffId),
      replacementBeforeName: beforeReplacement?.fullName || '',
      replacementAfterId: clean(after.replacementStaffId),
      replacementAfterName: afterReplacement?.fullName || '',
      changedAt: new Date().toISOString(),
      changedBy: currentOperator()
    });
    writeHistory(state.history);
    window.renderManpowerHistory?.();
  };

  const loadProductionAssignments = async () => {
    if (isLocalMode() || !backend?.loadAssignments) return;
    state.assignments = await backend.loadAssignments(state.date);
    window.renderManpowerDashboard();
  };

  const scheduleRealtimeRefresh = scope => {
    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(async () => {
      try {
        await loadProductionAssignments();
        if (scope === 'history' && document.getElementById('manpowerHistoryModal')?.classList.contains('show')) {
          await window.loadManpowerHistory?.();
        }
      } catch (error) {
        console.warn('Manpower realtime refresh failed:', error);
      }
    }, 180);
  };

  const selectedAssignments = () => state.assignments.filter(item => item.date === state.date && item.shift === state.shift);

  function seedAssignments() {
    if (!window.isLocalManpowerPreview?.() || state.assignments.length || !state.staff.length) return;
    state.assignments = state.staff.map(staff => ({ id: createId(), date: state.date, shift: 'morning', staffId: staff.id, status: 'working' }));
    writeAssignments(state.assignments);
  }

  function photo(staff, meta) {
    return staff.photoData
      ? `<img src="${escapeHtml(staff.photoData)}" alt="${escapeHtml(staff.fullName)}">`
      : `<img class="is-department-avatar" src="${escapeHtml(meta.avatar)}" alt="Avatar ${escapeHtml(meta.subtitle)}">`;
  }

  window.initManpowerDashboard = async function () {
    const container = document.getElementById('manpowerDepartmentList');
    const badge = document.getElementById('manpowerDataBadge');
    state.initialized = false;
    if (container) container.innerHTML = '<div class="manpower-loading"><span class="spinner-border spinner-border-sm" role="status"></span><strong>ກຳລັງໂຫຼດພະນັກງານ...</strong></div>';
    try {
      const isLocal = Boolean(window.isLocalManpowerPreview?.());
      state.mode = isLocal || !backend ? 'local' : 'supabase';
      state.staff = await loadStaff();
      if (isLocalMode()) {
        state.assignments = readJson(MANPOWER_STORAGE_KEY);
        if (!Array.isArray(state.assignments)) state.assignments = [];
        state.history = readJson(MANPOWER_HISTORY_STORAGE_KEY);
        if (!Array.isArray(state.history)) state.history = [];
        seedAssignments();
      } else {
        const legacy = readJson(MANPOWER_STORAGE_KEY);
        const migrationKey = 'his_manpower_supabase_migrated_v1';
        if (!window.localStorage.getItem(migrationKey) && mayManage() && backend?.importLocal) {
          const validStaffIds = new Set(state.staff.map(item => item.id));
          const eligible = Array.isArray(legacy) ? legacy.filter(item => validStaffIds.has(item.staffId)) : [];
          try {
            await backend.importLocal(eligible);
            window.localStorage.setItem(migrationKey, new Date().toISOString());
          } catch (migrationError) {
            console.warn('Local manpower migration deferred:', migrationError);
          }
        }
        state.assignments = await backend.loadAssignments(state.date);
        state.history = [];
        if (!state.unsubscribe && backend?.subscribe) state.unsubscribe = backend.subscribe(scope => scheduleRealtimeRefresh(scope));
      }
      state.initialized = true;
      if (badge) badge.innerHTML = isLocal
        ? '<i class="fas fa-laptop-code"></i> Local test data'
        : `<i class="fas fa-broadcast-tower"></i> Supabase realtime · ${state.staff.length} ຄົນ${mayManage() ? '' : ' · ເບິ່ງເທົ່ານັ້ນ'}`;
      badge?.classList.toggle('is-live', !isLocal);
      const historyStorageLabel = document.getElementById('manpowerHistoryStorageLabel');
      if (historyStorageLabel) historyStorageLabel.innerHTML = isLocalMode()
        ? '<i class="fas fa-laptop-code"></i> ປະຫວັດ Local ຢູ່ໃນ browser ນີ້'
        : '<i class="fas fa-shield-alt"></i> Audit Supabase ຖືກບັນທຶກອັດຕະໂນມັດ ແລະແກ້ໄຂບໍ່ໄດ້';
      window.renderManpowerDashboard();
    } catch (error) {
      state.staff = [];
      state.initialized = true;
      if (badge) badge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ໂຫຼດບໍ່ສຳເລັດ';
      if (container) container.innerHTML = `<div class="manpower-loading manpower-loading--error"><i class="fas fa-exclamation-triangle"></i><strong>ໂຫຼດພະນັກງານຈາກ Supabase ບໍ່ສຳເລັດ</strong><small>${escapeHtml(error?.message || 'Unknown error')}</small></div>`;
    }
  };

  window.renderManpowerDashboard = function () {
    if (!state.initialized) return;
    const dateInput = document.getElementById('manpowerDate');
    if (dateInput) dateInput.value = state.date;
    const printContext = document.getElementById('manpowerPrintContext');
    const shiftMeta = SHIFTS[state.shift] || SHIFTS.morning;
    const [year, month, day] = state.date.split('-');
    if (printContext) printContext.innerHTML = `<strong>ວັນທີ ${escapeHtml(`${day}/${month}/${year}`)}</strong><span>${shiftMeta.label} ${shiftMeta.time}</span>`;
    document.querySelectorAll('.manpower-shifts button').forEach(button => button.classList.toggle('active', button.dataset.shift === state.shift));

    const assignments = selectedAssignments();
    const visibleAssignments = assignments.filter(assignment => {
      const staff = state.staff.find(person => person.id === assignment.staffId);
      return staff && Boolean(resolveManpowerStaffType(staff));
    });
    const summary = calculateManpowerSummary(visibleAssignments);
    const counts = { manpowerWorkingCount: summary.working, manpowerAbsentCount: summary.absent, manpowerLeaveCount: summary.leave, manpowerSwappedCount: summary.swapped };
    Object.entries(counts).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value; });

    const container = document.getElementById('manpowerDepartmentList');
    if (!container) return;
    const assignedStaff = visibleAssignments.map(assignment => ({ assignment, staff: state.staff.find(person => person.id === assignment.staffId) }))
      .filter(item => item.staff);
    const manageAllowed = mayManage();
    const personCard = ({ assignment, staff }, meta) => {
      const status = STATUSES[assignment.status] || STATUSES.working;
      const replacement = assignment.replacementStaffId
        ? state.staff.find(person => person.id === assignment.replacementStaffId)
        : null;
      return `<article class="manpower-person">
        <div class="manpower-person-photo">${photo(staff, meta)}</div>
        <div class="manpower-person-info"><strong title="${escapeHtml(staff.fullName)}">${escapeHtml(staff.fullName)}</strong><small>${escapeHtml(staff.specialty || meta.subtitle)}</small><span class="manpower-person-role">${escapeHtml(meta.label)}</span><span class="manpower-status manpower-status--${assignment.status}"><i class="fas ${status.icon}"></i>${status.label}</span>${replacement ? `<span class="manpower-replacement" title="${escapeHtml(staff.fullName)} → ${escapeHtml(replacement.fullName)}"><i class="fas fa-long-arrow-alt-right"></i>${escapeHtml(replacement.fullName)}</span>` : ''}</div>
        ${manageAllowed ? `<button type="button" class="manpower-remove" onclick="window.removeManpowerAssignment('${escapeHtml(assignment.id)}')" aria-label="ເອົາ ${escapeHtml(staff.fullName)} ອອກຈາກເວນ"><i class="fas fa-times"></i></button>
        <button type="button" class="manpower-manage" onclick="window.openManpowerManagement('${escapeHtml(assignment.id)}')"><i class="fas fa-sliders-h"></i> ຈັດການ</button>` : ''}
      </article>`;
    };
    container.innerHTML = Object.entries(TYPES).map(([type, meta]) => {
      const departmentStaff = assignedStaff.filter(item => resolveManpowerStaffType(item.staff) === type);
      const people = departmentStaff.length
        ? departmentStaff.map(item => personCard(item, meta)).join('')
        : '<div class="manpower-empty">ຍັງບໍ່ມີຜູ້ເຂົ້າເວນໃນພະແນກນີ້</div>';
      return `<section class="manpower-department manpower-department--${meta.tone}">
        <header><div class="manpower-department-title"><h4><i class="fas ${meta.icon}"></i>${meta.label}</h4><small>${meta.subtitle}</small></div><div class="manpower-department-actions"><strong>${departmentStaff.length} ຄົນ</strong>${manageAllowed ? `<button type="button" onclick="window.openManpowerAssignment('${type}')" aria-label="ເພີ່ມ ${meta.label} ເຂົ້າເວນ"><i class="fas fa-plus"></i><span>ເພີ່ມ</span></button>` : ''}</div></header>
        <div class="manpower-people">${people}</div>
      </section>`;
    }).join('');
  };

  window.selectManpowerShift = function (shift) {
    if (!['morning', 'evening', 'night'].includes(shift)) return;
    state.shift = shift;
    window.renderManpowerDashboard();
  };

  window.setManpowerDate = async function (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(date))) return;
    state.date = date;
    if (isLocalMode()) window.renderManpowerDashboard();
    else {
      try { await loadProductionAssignments(); } catch (error) { await notify('ໂຫຼດເວນບໍ່ສຳເລັດ', error.message); }
    }
  };

  window.changeManpowerDate = async function (days) {
    const date = new Date(`${state.date}T12:00:00`);
    date.setDate(date.getDate() + Number(days || 0));
    state.date = localDate(date);
    if (isLocalMode()) window.renderManpowerDashboard();
    else {
      try { await loadProductionAssignments(); } catch (error) { await notify('ໂຫຼດເວນບໍ່ສຳເລັດ', error.message); }
    }
  };

  window.goToManpowerToday = async function () {
    state.date = today();
    if (isLocalMode()) window.renderManpowerDashboard();
    else {
      try { await loadProductionAssignments(); } catch (error) { await notify('ໂຫຼດເວນບໍ່ສຳເລັດ', error.message); }
    }
  };

  window.openManpowerHistory = async function () {
    const dateFilter = document.getElementById('manpowerHistoryDate');
    if (dateFilter && !dateFilter.value) dateFilter.value = state.date;
    await window.loadManpowerHistory();
    const modal = document.getElementById('manpowerHistoryModal');
    if (modal && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modal).show();
  };

  window.resetManpowerHistoryFilters = async function () {
    const values = {
      manpowerHistorySearch: '',
      manpowerHistoryDate: '',
      manpowerHistoryShift: '',
      manpowerHistoryType: '',
      manpowerHistoryAction: ''
    };
    Object.entries(values).forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (field) field.value = value;
    });
    await window.loadManpowerHistory();
  };

  window.loadManpowerHistory = async function () {
    if (!isLocalMode() && backend?.loadHistory) {
      const body = document.getElementById('manpowerHistoryRows');
      if (body) body.innerHTML = '<tr><td colspan="7" class="manpower-history-empty"><span class="spinner-border spinner-border-sm" role="status"></span><strong>ກຳລັງໂຫຼດປະຫວັດ...</strong></td></tr>';
      try {
        state.history = await backend.loadHistory({
          date: document.getElementById('manpowerHistoryDate')?.value,
          shift: document.getElementById('manpowerHistoryShift')?.value,
          type: document.getElementById('manpowerHistoryType')?.value,
          action: document.getElementById('manpowerHistoryAction')?.value
        });
      } catch (error) {
        if (body) body.innerHTML = `<tr><td colspan="7" class="manpower-history-empty text-danger"><i class="fas fa-exclamation-triangle"></i><strong>ໂຫຼດປະຫວັດບໍ່ສຳເລັດ</strong><small>${escapeHtml(error.message)}</small></td></tr>`;
        return;
      }
    }
    window.renderManpowerHistory();
  };

  window.renderManpowerHistory = function () {
    const body = document.getElementById('manpowerHistoryRows');
    const count = document.getElementById('manpowerHistoryCount');
    if (!body) return;
    const filters = {
      query: document.getElementById('manpowerHistorySearch')?.value,
      date: document.getElementById('manpowerHistoryDate')?.value,
      shift: document.getElementById('manpowerHistoryShift')?.value,
      type: document.getElementById('manpowerHistoryType')?.value,
      action: document.getElementById('manpowerHistoryAction')?.value
    };
    const records = filterManpowerHistory(state.history, filters)
      .sort((a, b) => clean(b.changedAt).localeCompare(clean(a.changedAt)));
    if (count) count.textContent = `${records.length} ລາຍການ`;
    if (!records.length) {
      body.innerHTML = '<tr><td colspan="7" class="manpower-history-empty"><i class="fas fa-history"></i><strong>ຍັງບໍ່ມີປະຫວັດຕາມເງື່ອນໄຂນີ້</strong><small>ລອງປ່ຽນຕົວກອງ ຫຼືເພີ່ມ/ຈັດການເວນ</small></td></tr>';
      return;
    }
    body.innerHTML = records.map(item => {
      const action = HISTORY_ACTIONS[item.action] || HISTORY_ACTIONS.updated;
      const type = TYPES[item.staffType] || { label: item.staffType || '-', tone: 'blue' };
      const shift = SHIFTS[item.shift] || { label: item.shift || '-' };
      const beforeStatus = STATUSES[item.statusBefore]?.label || '-';
      const afterStatus = STATUSES[item.statusAfter]?.label || '-';
      const changedAt = new Date(item.changedAt);
      const time = Number.isNaN(changedAt.getTime()) ? '-' : changedAt.toLocaleString('lo-LA', { hour12: false });
      let detail = `${beforeStatus} → ${afterStatus}`;
      if (item.action === 'created') detail = `ສະຖານະ: ${afterStatus}`;
      if (item.action === 'deleted') detail = `ສະຖານະກ່ອນລຶບ: ${beforeStatus}`;
      if (item.replacementAfterName) detail += `<small>ຮັບເວນແທນ: ${escapeHtml(item.replacementAfterName)}</small>`;
      return `<tr>
        <td><span class="manpower-history-action manpower-history-action--${action.tone}"><i class="fas ${action.icon}"></i>${action.label}</span></td>
        <td><strong>${escapeHtml(item.staffName)}</strong><small>${escapeHtml(type.label)}</small></td>
        <td>${escapeHtml(item.date || '-')}</td>
        <td>${escapeHtml(shift.label)}</td>
        <td>${detail}</td>
        <td>${escapeHtml(item.changedBy || '-')}</td>
        <td>${escapeHtml(time)}</td>
      </tr>`;
    }).join('');
  };

  window.printManpowerDashboard = function () {
    const view = document.getElementById('view-manpower');
    const app = document.getElementById('app-content');
    view?.classList.toggle('manpower-print-dense', document.querySelectorAll('#manpowerDepartmentList .manpower-person').length > 24);
    app?.classList.add('print-active');
    const cleanup = () => app?.classList.remove('print-active');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  };

  window.openManpowerAssignment = function (type = 'doctor') {
    if (!mayManage()) return notify('ບໍ່ມີສິດ', 'ສະເພາະ Admin ເທົ່ານັ້ນທີ່ສາມາດຈັດເວນໄດ້', 'warning');
    const meta = TYPES[type] || TYPES.doctor;
    const assignedIds = new Set(selectedAssignments().map(item => item.staffId));
    const departmentStaff = state.staff.filter(item => resolveManpowerStaffType(item) === type);
    const choices = departmentStaff.filter(item => !assignedIds.has(item.id));
    const alreadyAssigned = departmentStaff.filter(item => assignedIds.has(item.id));
    const select = document.getElementById('manpowerStaffSelect');
    const availabilityNote = document.getElementById('manpowerStaffAvailabilityNote');
    const departmentScope = document.getElementById('manpowerAssignmentDepartment');
    const saveButton = document.getElementById('manpowerAssignmentSaveButton');
    const typeInput = document.getElementById('manpowerAssignmentType');
    if (typeInput) typeInput.value = type;
    if (departmentScope) departmentScope.innerHTML = `<i class="fas ${meta.icon}"></i><span>ກຳລັງເລືອກສະເພາະ</span><strong>${escapeHtml(meta.label)} · ${escapeHtml(meta.subtitle)}</strong>`;
    if (select) {
      const availableOptions = choices.length
        ? `<optgroup label="${escapeHtml(meta.label)} — ສາມາດເພີ່ມໄດ້">${choices.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.fullName)}${item.specialty ? ` — ${escapeHtml(item.specialty)}` : ''}</option>`).join('')}</optgroup>`
        : '<option value="">ບໍ່ມີພະນັກງານວ່າງໃນພະແນກນີ້</option>';
      const assignedOptions = alreadyAssigned.length
        ? `<optgroup label="ຈັດເຂົ້າເວນແລ້ວ">${alreadyAssigned.map(item => `<option value="" disabled>${escapeHtml(item.fullName)} — ຢູ່ໃນເວນແລ້ວ</option>`).join('')}</optgroup>`
        : '';
      select.innerHTML = `${availableOptions}${assignedOptions}`;
      select.disabled = !departmentStaff.length;
    }
    if (saveButton) saveButton.disabled = !choices.length;
    if (availabilityNote) {
      availabilityNote.innerHTML = departmentStaff.length
        ? `<i class="fas fa-users"></i> ${escapeHtml(meta.label)}: ພົບ ${departmentStaff.length} ຄົນ · ວ່າງເພີ່ມ ${choices.length} ຄົນ · ຢູ່ໃນເວນແລ້ວ ${alreadyAssigned.length} ຄົນ`
        : '<i class="fas fa-user-plus"></i> ຍັງບໍ່ມີພະນັກງານໃນພະແນກນີ້; ກະລຸນາເພີ່ມໃນໜ້າຈັດການພະນັກງານ';
    }
    window.toggleNewManpowerReplacement();
    const modal = document.getElementById('manpowerAssignmentModal');
    if (modal && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modal).show();
  };

  window.toggleNewManpowerReplacement = function () {
    const status = clean(document.getElementById('manpowerStatusSelect')?.value) || 'working';
    const staffId = clean(document.getElementById('manpowerStaffSelect')?.value);
    const group = document.getElementById('manpowerNewReplacementGroup');
    const replacementSelect = document.getElementById('manpowerNewReplacementStaff');
    const needsReplacement = status !== 'working';
    if (group) group.hidden = !needsReplacement;
    if (!replacementSelect) return;
    replacementSelect.required = needsReplacement;
    if (!needsReplacement) {
      replacementSelect.value = '';
      return;
    }
    const selectedStaff = staffById(staffId);
    const selectedType = resolveManpowerStaffType(selectedStaff);
    const assignedIds = new Set(selectedAssignments().flatMap(item => [item.staffId, item.replacementStaffId].filter(Boolean)));
    const choices = state.staff.filter(item => item.id !== staffId && resolveManpowerStaffType(item) === selectedType && !assignedIds.has(item.id));
    replacementSelect.innerHTML = `<option value="">ເລືອກຜູ້ຮັບເວນແທນ</option>${choices.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.fullName)}</option>`).join('')}`;
  };

  window.saveManpowerAssignment = async function (event) {
    event?.preventDefault();
    if (!mayManage()) return notify('ບໍ່ມີສິດ', 'ສະເພາະ Admin ເທົ່ານັ້ນທີ່ສາມາດຈັດເວນໄດ້', 'warning');
    const staffId = clean(document.getElementById('manpowerStaffSelect')?.value);
    if (!staffId) return;
    const status = clean(document.getElementById('manpowerStatusSelect')?.value) || 'working';
    const replacementStaffId = clean(document.getElementById('manpowerNewReplacementStaff')?.value);
    if (status !== 'working' && !replacementStaffId) return notify('ຂໍ້ມູນບໍ່ຄົບ', 'ກະລຸນາເລືອກຜູ້ຮັບເວນແທນ', 'warning');
    const assignment = { id: createId(), date: state.date, shift: state.shift, staffId, status, replacementStaffId: status === 'working' ? '' : replacementStaffId, createdAt: new Date().toISOString() };
    const saveButton = document.getElementById('manpowerAssignmentSaveButton');
    if (saveButton) saveButton.disabled = true;
    try {
      if (isLocalMode()) {
        state.assignments.push(assignment);
        writeAssignments(state.assignments);
        appendHistory({ action: 'created', assignment, after: assignment });
      } else {
        await backend.create(assignment);
        await loadProductionAssignments();
      }
      window.bootstrap?.Modal?.getInstance(document.getElementById('manpowerAssignmentModal'))?.hide();
      window.renderManpowerDashboard();
    } catch (error) {
      await notify('ບັນທຶກເວນບໍ່ສຳເລັດ', error.message);
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  };

  window.removeManpowerAssignment = async function (assignmentId) {
    if (!mayManage()) return notify('ບໍ່ມີສິດ', 'ສະເພາະ Admin ເທົ່ານັ້ນທີ່ສາມາດຈັດເວນໄດ້', 'warning');
    const assignment = state.assignments.find(item => item.id === assignmentId);
    if (!assignment) return;
    const staff = staffById(assignment.staffId);
    let confirmed = true;
    if (window.Swal?.fire) {
      const result = await window.Swal.fire({
        title: 'ເອົາອອກຈາກເວນ?',
        text: staff?.fullName || '',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ເອົາອອກ',
        cancelButtonText: 'ຍົກເລີກ',
        confirmButtonColor: '#d9233f'
      });
      confirmed = result.isConfirmed;
    } else confirmed = window.confirm?.(`ເອົາ ${staff?.fullName || ''} ອອກຈາກເວນ?`) !== false;
    if (!confirmed) return;
    try {
      if (isLocalMode()) {
        state.assignments = state.assignments.filter(item => item.id !== assignmentId);
        writeAssignments(state.assignments);
        appendHistory({ action: 'deleted', assignment, before: assignment });
      } else {
        await backend.remove(assignmentId);
        await loadProductionAssignments();
      }
      window.renderManpowerDashboard();
    } catch (error) {
      await notify('ເອົາອອກບໍ່ສຳເລັດ', error.message);
    }
  };

  window.openManpowerManagement = function (assignmentId) {
    if (!mayManage()) return notify('ບໍ່ມີສິດ', 'ສະເພາະ Admin ເທົ່ານັ້ນທີ່ສາມາດຈັດເວນໄດ້', 'warning');
    const assignment = state.assignments.find(item => item.id === assignmentId);
    const currentStaff = assignment ? state.staff.find(item => item.id === assignment.staffId) : null;
    if (!assignment || !currentStaff) return;

    const assignmentInput = document.getElementById('manpowerManageAssignmentId');
    const currentInput = document.getElementById('manpowerManageCurrentStaff');
    const statusSelect = document.getElementById('manpowerManageStatus');
    const replacementSelect = document.getElementById('manpowerReplacementStaff');
    if (assignmentInput) assignmentInput.value = assignment.id;
    if (currentInput) currentInput.value = currentStaff.fullName;
    if (statusSelect) statusSelect.value = assignment.status || 'working';

    const currentType = resolveManpowerStaffType(currentStaff);
    const blockedIds = new Set(selectedAssignments()
      .filter(item => item.id !== assignment.id)
      .flatMap(item => [item.staffId, item.replacementStaffId].filter(Boolean)));
    const choices = state.staff.filter(item => item.id !== currentStaff.id && resolveManpowerStaffType(item) === currentType && !blockedIds.has(item.id));
    if (replacementSelect) {
      replacementSelect.innerHTML = `<option value="">ເລືອກຜູ້ຮັບເວນແທນ</option>${choices.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.fullName)}</option>`).join('')}`;
      replacementSelect.value = assignment.replacementStaffId || '';
    }
    window.toggleManpowerReplacement();
    const modal = document.getElementById('manpowerManagementModal');
    if (modal && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modal).show();
  };

  window.toggleManpowerReplacement = function () {
    const status = clean(document.getElementById('manpowerManageStatus')?.value) || 'working';
    const group = document.getElementById('manpowerReplacementGroup');
    const replacementSelect = document.getElementById('manpowerReplacementStaff');
    const needsReplacement = status !== 'working';
    if (group) group.hidden = !needsReplacement;
    if (replacementSelect) replacementSelect.required = needsReplacement;
  };

  window.saveManpowerManagement = async function (event) {
    event?.preventDefault();
    if (!mayManage()) return notify('ບໍ່ມີສິດ', 'ສະເພາະ Admin ເທົ່ານັ້ນທີ່ສາມາດຈັດເວນໄດ້', 'warning');
    const assignmentId = clean(document.getElementById('manpowerManageAssignmentId')?.value);
    const status = clean(document.getElementById('manpowerManageStatus')?.value) || 'working';
    const replacementStaffId = clean(document.getElementById('manpowerReplacementStaff')?.value);
    if (status !== 'working' && !replacementStaffId) return;
    const assignment = state.assignments.find(item => item.id === assignmentId);
    if (!assignment) return;
    const before = { status: assignment.status, replacementStaffId: assignment.replacementStaffId || '' };
    const after = { status, replacementStaffId: status === 'working' ? '' : replacementStaffId };
    if (before.status === after.status && before.replacementStaffId === after.replacementStaffId) {
      window.bootstrap?.Modal?.getInstance(document.getElementById('manpowerManagementModal'))?.hide();
      return;
    }
    try {
      if (isLocalMode()) {
        assignment.status = status;
        assignment.replacementStaffId = after.replacementStaffId;
        assignment.updatedAt = new Date().toISOString();
        writeAssignments(state.assignments);
        appendHistory({
          action: before.replacementStaffId !== after.replacementStaffId && after.replacementStaffId ? 'replaced' : 'updated',
          assignment,
          before,
          after
        });
      } else {
        await backend.update(assignmentId, after);
        await loadProductionAssignments();
      }
      window.bootstrap?.Modal?.getInstance(document.getElementById('manpowerManagementModal'))?.hide();
      window.renderManpowerDashboard();
    } catch (error) {
      await notify('ຈັດການເວນບໍ່ສຳເລັດ', error.message);
    }
  };

  if (!window.__manpowerLocalRealtimeInstalled) {
    window.__manpowerLocalRealtimeInstalled = true;
    window.addEventListener('storage', event => {
      if (!isLocalMode()) return;
      if (event.key === MANPOWER_STORAGE_KEY) {
        state.assignments = readJson(MANPOWER_STORAGE_KEY);
        window.renderManpowerDashboard?.();
      }
      if (event.key === MANPOWER_HISTORY_STORAGE_KEY) {
        state.history = readJson(MANPOWER_HISTORY_STORAGE_KEY);
        window.renderManpowerHistory?.();
      }
    });
  }
}
