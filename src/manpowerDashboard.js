const STAFF_STORAGE_KEY = 'his_local_staff_profiles_v1';
export const MANPOWER_STORAGE_KEY = 'his_local_manpower_assignments_v1';
export const MANPOWER_HISTORY_STORAGE_KEY = 'his_local_manpower_history_v1';
export const MANPOWER_OVERVIEW_STORAGE_KEY = 'his_local_manpower_overviews_v1';

const TYPES = Object.freeze({
  doctor: { label: 'ແພດ', subtitle: 'Doctor', icon: 'fa-user-md', tone: 'blue', avatar: '/assets/manpower/avatar-doctor.png' },
  nurse: { label: 'ພະຍາບານ', subtitle: 'Nurse', icon: 'fa-user-nurse', tone: 'purple', avatar: '/assets/manpower/avatar-nurse.png' },
  pharmacy: { label: 'ການຢາ', subtitle: 'Pharmacy', icon: 'fa-pills', tone: 'green', avatar: '/assets/manpower/avatar-pharmacy.png' },
  lab: { label: 'ແລັບ', subtitle: 'Laboratory', icon: 'fa-flask', tone: 'teal', avatar: '/assets/manpower/avatar-laboratory.png' },
  radiology: { label: 'ເອໂກ້ + ລັງສີ', subtitle: 'Echo + Radiology', icon: 'fa-radiation', tone: 'orange', avatar: '/assets/manpower/avatar-imaging.png' }
});

const STATUSES = Object.freeze({
  working: { label: 'ເຂົ້າປະຈຳການ', icon: 'fa-check-circle' },
  leave: { label: 'ລາ', icon: 'fa-bed' },
  absent: { label: 'ຂາດ', icon: 'fa-times-circle' },
  swapped: { label: 'ສັບປ່ຽນຜູ້ປະຈຳການ', icon: 'fa-exchange-alt' }
});

const LEAVE_TYPES = Object.freeze({
  vacation: { label: 'ລາພັກ', icon: 'fa-umbrella-beach' },
  sick: { label: 'ລາປ່ວຍ', icon: 'fa-notes-medical' },
  personal: { label: 'ລາກິດ', icon: 'fa-user-clock' }
});

const SHIFTS = Object.freeze({
  morning: { label: 'ກະເຊົ້າ', time: '08:00–16:00' },
  evening: { label: 'ກະແລງ', time: '16:00–21:00' },
  night: { label: 'ກະກາງຄືນ', time: '21:00–08:00' }
});

const HISTORY_ACTIONS = Object.freeze({
  created: { label: 'ເພີ່ມຜູ້ເຂົ້າປະຈຳການ', icon: 'fa-user-plus', tone: 'created' },
  updated: { label: 'ປ່ຽນສະຖານະ', icon: 'fa-edit', tone: 'updated' },
  replaced: { label: 'ສັບປ່ຽນຜູ້ປະຈຳການ', icon: 'fa-exchange-alt', tone: 'replaced' },
  deleted: { label: 'ນຳອອກຈາກລາຍຊື່ປະຈຳການ', icon: 'fa-user-minus', tone: 'deleted' }
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
    return [item.staffName, item.replacementBeforeName, item.replacementAfterName, item.noteBefore, item.noteAfter, item.changedBy]
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

function readOverviewStore() {
  try {
    const records = JSON.parse(window.localStorage.getItem(MANPOWER_OVERVIEW_STORAGE_KEY) || '{}');
    return records && typeof records === 'object' && !Array.isArray(records) ? records : {};
  } catch {
    return {};
  }
}

function overviewsForDate(date, records = readOverviewStore()) {
  const values = records?.[date] || {};
  return {
    morning: clean(values.morning),
    evening: clean(values.evening),
    night: clean(values.night)
  };
}

function writeLocalOverview(date, shift, overview) {
  const records = readOverviewStore();
  records[date] = { ...overviewsForDate(date, records), [shift]: String(overview ?? '').slice(0, 4000) };
  window.localStorage.setItem(MANPOWER_OVERVIEW_STORAGE_KEY, JSON.stringify(records));
}

function createId() {
  return window.crypto?.randomUUID?.() || `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function installManpowerDashboard({ escapeHtml = value => String(value ?? ''), staffBackend = null, backend = null, getCurrentUser = null, canManage = null } = {}) {
  const state = { date: today(), shift: 'morning', staff: [], assignments: [], history: [], overviews: overviewsForDate(today()), mode: 'local', initialized: false, unsubscribe: null, refreshTimer: null, overviewSaveTimers: new Map(), overviewSaveVersions: new Map(), pendingOverviewValues: new Map() };
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
  const normalizedLeaveType = assignment => assignment?.status === 'leave' ? (clean(assignment.leaveType) || 'vacation') : '';
  const statusMeta = assignment => {
    if (assignment?.status === 'leave') return LEAVE_TYPES[normalizedLeaveType(assignment)] || LEAVE_TYPES.vacation;
    return STATUSES[assignment?.status] || STATUSES.working;
  };
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
      leaveTypeBefore: clean(before.leaveType),
      leaveTypeAfter: clean(after.leaveType),
      noteBefore: clean(before.note),
      noteAfter: clean(after.note),
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

  const loadProductionOverviews = async () => {
    if (isLocalMode() || !backend?.loadOverviews) return;
    const loadedDate = state.date;
    const records = await backend.loadOverviews(loadedDate);
    if (state.date !== loadedDate) return;
    const loadedOverviews = { morning: '', evening: '', night: '' };
    records.forEach(item => {
      if (Object.hasOwn(loadedOverviews, item.shift)) loadedOverviews[item.shift] = item.overview;
    });
    Object.keys(loadedOverviews).forEach(shift => {
      const pendingKey = `${loadedDate}|${shift}`;
      if (state.pendingOverviewValues.has(pendingKey)) loadedOverviews[shift] = state.pendingOverviewValues.get(pendingKey);
    });
    state.overviews = loadedOverviews;
  };

  const loadProductionAssignments = async ({ includeOverviews = false } = {}) => {
    if (isLocalMode() || !backend?.loadAssignments) return;
    if (includeOverviews) {
      const [assignments] = await Promise.all([backend.loadAssignments(state.date), loadProductionOverviews()]);
      state.assignments = assignments;
    } else state.assignments = await backend.loadAssignments(state.date);
    window.renderManpowerDashboard();
  };

  const scheduleRealtimeRefresh = scope => {
    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(async () => {
      try {
        if (scope === 'overviews') await loadProductionOverviews();
        else await loadProductionAssignments();
        window.renderManpowerDashboard();
        if (scope === 'history' && document.getElementById('manpowerHistoryModal')?.classList.contains('show')) {
          await window.loadManpowerHistory?.();
        }
      } catch (error) {
        console.warn('Manpower realtime refresh failed:', error);
      }
    }, 180);
  };

  const assignmentsForShift = shift => state.assignments.filter(item => item.date === state.date && item.shift === shift);
  const selectedAssignments = () => assignmentsForShift(state.shift);

  function seedAssignments() {
    if (!window.isLocalManpowerPreview?.() || state.assignments.length || !state.staff.length) return;
    state.assignments = state.staff.map(staff => ({ id: createId(), date: state.date, shift: 'morning', staffId: staff.id, status: 'working' }));
    writeAssignments(state.assignments);
  }

  function photo(staff, meta) {
    const source = staff.photoData || meta.avatar;
    const avatarClass = staff.photoData ? '' : ' class="is-department-avatar"';
    return `<img${avatarClass} src="${escapeHtml(source)}" data-manpower-fallback="${escapeHtml(meta.avatar)}" alt="${escapeHtml(staff.photoData ? staff.fullName : `Avatar ${meta.subtitle}`)}">`;
  }

  function visibleAssignmentsForShift(shift, staffRecords = state.staff) {
    return assignmentsForShift(shift).filter(assignment => {
      const staff = staffRecords.find(person => person.id === assignment.staffId);
      return staff && Boolean(resolveManpowerStaffType(staff));
    });
  }

  function departmentMarkup(visibleAssignments, interactive = true, staffRecords = state.staff) {
    const assignedStaff = visibleAssignments.map(assignment => ({ assignment, staff: staffRecords.find(person => person.id === assignment.staffId) }))
      .filter(item => item.staff);
    const manageAllowed = interactive && mayManage();
    const personCard = ({ assignment, staff }, meta) => {
      const status = statusMeta(assignment);
      const note = clean(assignment.note);
      return `<article class="manpower-person">
        <div class="manpower-person-photo">${photo(staff, meta)}</div>
        <div class="manpower-person-info"><strong title="${escapeHtml(staff.fullName)}">${escapeHtml(staff.fullName)}</strong><small>${escapeHtml(staff.specialty || meta.subtitle)}</small><span class="manpower-person-role">${escapeHtml(meta.label)}</span>${note ? `<span class="manpower-note" title="${escapeHtml(note)}"><i class="fas fa-sticky-note"></i>${escapeHtml(note)}</span>` : ''}</div>
        <div class="manpower-person-footer"><span class="manpower-status manpower-status--${assignment.status}"><i class="fas ${status.icon}"></i>${status.label}</span>${manageAllowed ? `<button type="button" class="manpower-manage" onclick="window.openManpowerManagement('${escapeHtml(assignment.id)}')"><i class="fas fa-sliders-h"></i> ຈັດການ</button>` : ''}</div>
        ${manageAllowed ? `<button type="button" class="manpower-remove" onclick="window.removeManpowerAssignment('${escapeHtml(assignment.id)}')" aria-label="ນຳ ${escapeHtml(staff.fullName)} ອອກຈາກລາຍຊື່ປະຈຳການ"><i class="fas fa-times"></i></button>` : ''}
      </article>`;
    };
    return Object.entries(TYPES).map(([type, meta]) => {
      const departmentStaff = assignedStaff.filter(item => resolveManpowerStaffType(item.staff) === type);
      const people = departmentStaff.length
        ? departmentStaff.map(item => personCard(item, meta)).join('')
        : '<div class="manpower-empty">ຍັງບໍ່ມີຜູ້ເຂົ້າປະຈຳການໃນພະແນກນີ້</div>';
      return `<section class="manpower-department manpower-department--${meta.tone}">
        <header><div class="manpower-department-title"><h4><i class="fas ${meta.icon}"></i>${meta.label}</h4><small>${meta.subtitle}</small></div><div class="manpower-department-actions"><strong>${departmentStaff.length} ຄົນ</strong>${manageAllowed ? `<button type="button" onclick="window.openManpowerAssignment('${type}')" aria-label="ເພີ່ມ ${meta.label} ເຂົ້າປະຈຳການ"><i class="fas fa-plus"></i><span>ເພີ່ມ</span></button>` : ''}</div></header>
        <div class="manpower-people">${people}</div>
      </section>`;
    }).join('');
  }

  function summaryMarkup(summary) {
    return `<article><span class="is-green"><i class="fas fa-user-check"></i></span><small>ເຂົ້າປະຈຳການ</small><strong>${summary.working}</strong></article>
      <article><span class="is-red"><i class="fas fa-user-times"></i></span><small>ຂາດ</small><strong>${summary.absent}</strong></article>
      <article><span class="is-orange"><i class="fas fa-bed"></i></span><small>ລາ</small><strong>${summary.leave}</strong></article>
      <article><span class="is-purple"><i class="fas fa-exchange-alt"></i></span><small>ສັບປ່ຽນຜູ້ປະຈຳການ</small><strong>${summary.swapped}</strong></article>`;
  }

  function overviewPrintMarkup(overview) {
    return `<section class="manpower-overview"><div class="manpower-overview-heading"><label><i class="fas fa-clipboard-list"></i> ສະພາບລວມ:</label></div><div class="manpower-overview-print">${escapeHtml(clean(overview) || '—')}</div></section>`;
  }

  function renderAllShiftsPrint(staffRecords = state.staff) {
    const container = document.getElementById('manpowerAllShiftsPrint');
    if (!container) return;
    const [year, month, day] = state.date.split('-');
    container.innerHTML = Object.entries(SHIFTS).map(([shift, shiftMeta]) => {
      const assignments = visibleAssignmentsForShift(shift, staffRecords);
      const summary = calculateManpowerSummary(assignments);
      return `<section class="manpower-print-sheet${assignments.length > 24 ? ' manpower-print-dense' : ''}" data-print-shift="${shift}">
        <header class="manpower-header"><div><span class="manpower-eyebrow"><i class="fas fa-calendar-check"></i> DAILY MANPOWER</span><h3>ຕາຕະລາງການປະຈຳການ</h3><p>ຈັດພະນັກງານເຂົ້າປະຈຳການຕາມວັນທີ, ຮອບເວລາ ແລະພະແນກ</p></div></header>
        <div class="manpower-print-context"><strong>ວັນທີ ${escapeHtml(`${day}/${month}/${year}`)}</strong><span>${shiftMeta.label} ${shiftMeta.time}</span></div>
        <section class="manpower-summary">${summaryMarkup(summary)}</section>
        <nav class="manpower-shifts" aria-label="${escapeHtml(shiftMeta.label)}"><button type="button" class="active"><i class="fas ${shift === 'morning' ? 'fa-sun' : shift === 'evening' ? 'fa-cloud-sun' : 'fa-moon'}"></i><span>${shiftMeta.label}</span><small>${shiftMeta.time}</small></button></nav>
        <main class="manpower-departments">${departmentMarkup(assignments, false, staffRecords)}</main>
        ${overviewPrintMarkup(state.overviews[shift])}
      </section>`;
    }).join('');
  }

  window.initManpowerDashboard = async function () {
    const container = document.getElementById('manpowerDepartmentList');
    const badge = document.getElementById('manpowerDataBadge');
    state.initialized = false;
    if (badge) badge.hidden = true;
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
        state.overviews = overviewsForDate(state.date);
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
        const [assignments] = await Promise.all([backend.loadAssignments(state.date), loadProductionOverviews()]);
        state.assignments = assignments;
        state.history = [];
        if (!state.unsubscribe && backend?.subscribe) state.unsubscribe = backend.subscribe(scope => scheduleRealtimeRefresh(scope));
      }
      state.initialized = true;
      if (badge && isLocal) {
        badge.hidden = false;
        badge.innerHTML = '<i class="fas fa-laptop-code"></i> Local test data';
      }
      const historyStorageLabel = document.getElementById('manpowerHistoryStorageLabel');
      if (historyStorageLabel) historyStorageLabel.innerHTML = isLocalMode()
        ? '<i class="fas fa-laptop-code"></i> ປະຫວັດ Local ຢູ່ໃນ browser ນີ້'
        : '<i class="fas fa-shield-alt"></i> Audit Supabase ຖືກບັນທຶກອັດຕະໂນມັດ ແລະແກ້ໄຂບໍ່ໄດ້';
      window.renderManpowerDashboard();
    } catch (error) {
      state.staff = [];
      state.initialized = true;
      if (badge) {
        badge.hidden = false;
        badge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ໂຫຼດບໍ່ສຳເລັດ';
      }
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

    const visibleAssignments = visibleAssignmentsForShift(state.shift);
    const summary = calculateManpowerSummary(visibleAssignments);
    const counts = { manpowerWorkingCount: summary.working, manpowerAbsentCount: summary.absent, manpowerLeaveCount: summary.leave, manpowerSwappedCount: summary.swapped };
    Object.entries(counts).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value; });

    const container = document.getElementById('manpowerDepartmentList');
    if (!container) return;
    container.innerHTML = departmentMarkup(visibleAssignments);
    const overview = state.overviews[state.shift] || '';
    const overviewInput = document.getElementById('manpowerOverview');
    if (overviewInput && overviewInput.value !== overview) overviewInput.value = overview;
    if (overviewInput) overviewInput.disabled = !mayManage();
    const overviewPrint = document.getElementById('manpowerOverviewPrint');
    if (overviewPrint) overviewPrint.textContent = clean(overview) || '—';
    const overviewState = document.getElementById('manpowerOverviewSaveState');
    if (overviewState) {
      const scopeKey = `${state.date}|${state.shift}`;
      if (!mayManage()) overviewState.textContent = 'ສະເພາະ Admin ແກ້ໄຂໄດ້';
      else if (overviewState.dataset.scope !== scopeKey) {
        overviewState.textContent = '';
        overviewState.className = '';
      }
      overviewState.dataset.scope = scopeKey;
    }
  };

  const showOverviewSaveState = (message, tone = '') => {
    const element = document.getElementById('manpowerOverviewSaveState');
    if (!element) return;
    element.textContent = message;
    element.className = tone ? `is-${tone}` : '';
    element.dataset.scope = `${state.date}|${state.shift}`;
  };

  window.updateManpowerOverview = function (value) {
    if (!mayManage()) return;
    const overview = String(value ?? '').slice(0, 4000);
    const scope = { date: state.date, shift: state.shift };
    state.overviews[scope.shift] = overview;
    const overviewPrint = document.getElementById('manpowerOverviewPrint');
    if (overviewPrint) overviewPrint.textContent = clean(overview) || '—';
    if (isLocalMode()) {
      writeLocalOverview(scope.date, scope.shift, overview);
      showOverviewSaveState('ບັນທຶກແລ້ວ', 'saved');
      return;
    }
    if (!backend?.saveOverview) return showOverviewSaveState('ບັນທຶກບໍ່ໄດ້', 'error');
    const scopeKey = `${scope.date}|${scope.shift}`;
    state.pendingOverviewValues.set(scopeKey, overview);
    window.clearTimeout(state.overviewSaveTimers.get(scopeKey));
    const version = (state.overviewSaveVersions.get(scopeKey) || 0) + 1;
    state.overviewSaveVersions.set(scopeKey, version);
    showOverviewSaveState('ກຳລັງບັນທຶກ...', 'saving');
    const timer = window.setTimeout(async () => {
      try {
        await backend.saveOverview({ ...scope, overview });
        if (version === state.overviewSaveVersions.get(scopeKey)) {
          state.pendingOverviewValues.delete(scopeKey);
          state.overviewSaveTimers.delete(scopeKey);
        }
        if (version === state.overviewSaveVersions.get(scopeKey) && state.date === scope.date && state.shift === scope.shift) {
          showOverviewSaveState('ບັນທຶກແລ້ວ', 'saved');
        }
      } catch (error) {
        console.error('Save manpower overview failed:', error);
        state.overviewSaveTimers.delete(scopeKey);
        if (version === state.overviewSaveVersions.get(scopeKey) && state.date === scope.date && state.shift === scope.shift) {
          showOverviewSaveState('ບັນທຶກບໍ່ສຳເລັດ', 'error');
        }
      }
    }, 600);
    state.overviewSaveTimers.set(scopeKey, timer);
  };

  window.selectManpowerShift = function (shift) {
    if (!['morning', 'evening', 'night'].includes(shift)) return;
    state.shift = shift;
    window.renderManpowerDashboard();
  };

  window.setManpowerDate = async function (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(date))) return;
    state.date = date;
    if (isLocalMode()) {
      state.overviews = overviewsForDate(state.date);
      window.renderManpowerDashboard();
    }
    else {
      try { await loadProductionAssignments({ includeOverviews: true }); } catch (error) { await notify('ໂຫຼດຕາຕະລາງປະຈຳການບໍ່ສຳເລັດ', error.message); }
    }
  };

  window.changeManpowerDate = async function (days) {
    const date = new Date(`${state.date}T12:00:00`);
    date.setDate(date.getDate() + Number(days || 0));
    state.date = localDate(date);
    if (isLocalMode()) {
      state.overviews = overviewsForDate(state.date);
      window.renderManpowerDashboard();
    }
    else {
      try { await loadProductionAssignments({ includeOverviews: true }); } catch (error) { await notify('ໂຫຼດຕາຕະລາງປະຈຳການບໍ່ສຳເລັດ', error.message); }
    }
  };

  window.goToManpowerToday = async function () {
    state.date = today();
    if (isLocalMode()) {
      state.overviews = overviewsForDate(state.date);
      window.renderManpowerDashboard();
    }
    else {
      try { await loadProductionAssignments({ includeOverviews: true }); } catch (error) { await notify('ໂຫຼດຕາຕະລາງປະຈຳການບໍ່ສຳເລັດ', error.message); }
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
      body.innerHTML = '<tr><td colspan="7" class="manpower-history-empty"><i class="fas fa-history"></i><strong>ຍັງບໍ່ມີປະຫວັດຕາມເງື່ອນໄຂນີ້</strong><small>ລອງປ່ຽນຕົວກອງ ຫຼືເພີ່ມ/ຈັດການການປະຈຳການ</small></td></tr>';
      return;
    }
    body.innerHTML = records.map(item => {
      const action = HISTORY_ACTIONS[item.action] || HISTORY_ACTIONS.updated;
      const type = TYPES[item.staffType] || { label: item.staffType || '-', tone: 'blue' };
      const shift = SHIFTS[item.shift] || { label: item.shift || '-' };
      const beforeStatus = item.statusBefore ? statusMeta({ status: item.statusBefore, leaveType: item.leaveTypeBefore }).label : '-';
      const afterStatus = item.statusAfter ? statusMeta({ status: item.statusAfter, leaveType: item.leaveTypeAfter }).label : '-';
      const changedAt = new Date(item.changedAt);
      const time = Number.isNaN(changedAt.getTime()) ? '-' : changedAt.toLocaleString('lo-LA', { hour12: false });
      let detail = `${beforeStatus} → ${afterStatus}`;
      if (item.action === 'created') detail = `ສະຖານະ: ${afterStatus}`;
      if (item.action === 'deleted') detail = `ສະຖານະກ່ອນລຶບ: ${beforeStatus}`;
      if (item.replacementAfterName) detail += `<small>ເຂົ້າປະຈຳການແທນ: ${escapeHtml(item.replacementAfterName)}</small>`;
      if (item.noteAfter) detail += `<small>ໝາຍເຫດ: ${escapeHtml(item.noteAfter)}</small>`;
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

  function printManpower({ allShifts = false } = {}) {
    const view = document.getElementById('view-manpower');
    if (!view) return;
    const printWindow = window.open('', '_blank', 'popup,width=1280,height=900');
    if (!printWindow) {
      document.getElementById('manpowerAllShiftsPrint')?.replaceChildren();
      void notify('ບໍ່ສາມາດເປີດໜ້າພິມ', 'ກະລຸນາອະນຸຍາດ Pop-up ສຳລັບເວັບນີ້ ແລ້ວກົດພິມອີກຄັ້ງ', 'warning');
      return;
    }

    printWindow.document.open();
    printWindow.document.write('<!doctype html><html lang="lo"><head><meta charset="utf-8"><title>Manpower Print</title></head><body>ກຳລັງກະກຽມໜ້າພິມ ແລະໂຫຼດຮູບ...</body></html>');
    printWindow.document.close();

    const buildPrintDocument = async () => {
      let printStaff = state.staff;
      if (allShifts && !isLocalMode() && staffBackend?.load) {
        try {
          const freshRecords = await Promise.race([
            staffBackend.load(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out refreshing staff photos')), 10000))
          ]);
          if (Array.isArray(freshRecords)) {
            printStaff = freshRecords.filter(item => item?.id && item?.fullName && item?.status !== 'inactive');
          }
        } catch (error) {
          console.warn('Unable to refresh staff photos for printing:', error);
        }
      }

      if (printWindow.closed) {
        document.getElementById('manpowerAllShiftsPrint')?.replaceChildren();
        window.finishPrinterPrint?.();
        return;
      }

      if (allShifts) renderAllShiftsPrint(printStaff);
      const printView = view.cloneNode(true);
      const isDense = !allShifts
        && view.querySelectorAll('#manpowerDepartmentList .manpower-person').length > 24;
      printView.classList.toggle('manpower-print-all', allShifts);
      printView.classList.toggle('manpower-print-dense', isDense);
      printView.classList.add('print-active');

      const profilePrepared = window.preparePrinterPrint?.('view-manpower', 'manpower') === true;
      const printerStyle = profilePrepared
        ? document.getElementById('hisPrinterRuntimeStyle')?.outerHTML || ''
        : '';
      const styleLinks = Array.from(document.querySelectorAll('link[rel~="stylesheet"]'))
        .map(link => `<link rel="stylesheet" href="${escapeHtml(link.href)}">`)
        .join('');
      const inlineStyles = Array.from(document.querySelectorAll('style'))
        .filter(style => style.id !== 'hisPrinterRuntimeStyle')
        .map(style => style.outerHTML)
        .join('');

      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
      <html lang="lo"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <base href="${escapeHtml(document.baseURI)}"><title>Manpower Print</title>${styleLinks}${inlineStyles}${printerStyle}
      <style id="manpower-print-page-rule">
        @media print {
          @page { size: 297mm 210mm; margin: 4mm; }
          html, body { width: 289mm !important; min-width: 0 !important; max-width: 289mm !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          html body > #view-manpower.print-active { display: block !important; page: auto !important; position: absolute !important; inset: 0 auto auto 0 !important; left: 0 !important; top: 0 !important; width: 289mm !important; min-width: 0 !important; max-width: 289mm !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; zoom: 1 !important; }
        }
        @media screen {
          body { margin: 0; padding: 12px; background: #e9eef3; }
          body > #view-manpower { display: block !important; width: 289mm; max-width: 100%; margin: 0 auto; background: #fff; }
        }
      </style></head><body>${printView.outerHTML}
      <script>
        (() => {
          let printStarted = false;
          const waitForImage = image => new Promise(resolve => {
            image.loading = 'eager';
            if (image.complete) return resolve();
            const done = () => resolve();
            image.addEventListener('load', done, { once: true });
            image.addEventListener('error', done, { once: true });
            setTimeout(done, 10000);
          });
          const prepareImages = async () => {
            const images = Array.from(document.querySelectorAll('#view-manpower img'));
            await Promise.all(images.map(async image => {
              await waitForImage(image);
              if (image.naturalWidth > 0) {
                try { await image.decode(); } catch {}
                return;
              }
              const fallback = image.dataset.manpowerFallback;
              if (!fallback || image.getAttribute('src') === fallback) return;
              image.src = fallback;
              await waitForImage(image);
              if (image.naturalWidth > 0) {
                try { await image.decode(); } catch {}
              }
            }));
          };
          const printAfterReady = async () => {
            if (printStarted) return;
            printStarted = true;
            await prepareImages();
            await Promise.race([
              Promise.resolve(document.fonts?.ready).catch(() => {}),
              new Promise(resolve => setTimeout(resolve, 4000))
            ]);
            requestAnimationFrame(() => requestAnimationFrame(() => {
              window.focus();
              const closeAfterPrint = () => setTimeout(() => window.close(), 250);
              window.addEventListener('afterprint', closeAfterPrint, { once: true });
              window.print();
              setTimeout(closeAfterPrint, 1200);
            }));
          };
          window.addEventListener('load', printAfterReady, { once: true });
          setTimeout(() => { if (document.readyState === 'complete') void printAfterReady(); }, 5000);
        })();
      <\/script></body></html>`);
      printWindow.document.close();
      document.getElementById('manpowerAllShiftsPrint')?.replaceChildren();
      window.finishPrinterPrint?.();
    };

    void buildPrintDocument();
  }

  window.printManpowerDashboard = function () {
    printManpower();
  };

  window.printAllManpowerShifts = function () {
    printManpower({ allShifts: true });
  };

  const enableStaffSearch = select => {
    if (!select || !window.jQuery || !window.jQuery.fn?.select2) return;
    const $select = window.jQuery(select);
    if ($select.hasClass('select2-hidden-accessible')) $select.select2('destroy');
    $select.select2({
      dropdownParent: window.jQuery('#manpowerAssignmentModal'),
      placeholder: 'ພິມຊື່ພະນັກງານເພື່ອຄົ້ນຫາ',
      minimumResultsForSearch: 0,
      width: '100%'
    }).off('change.manpower').on('change.manpower', window.toggleNewManpowerFields);
  };

  window.openManpowerAssignment = function (type = 'doctor') {
    if (!mayManage()) return notify('ບໍ່ມີສິດ', 'ສະເພາະ Admin ເທົ່ານັ້ນທີ່ສາມາດຈັດການການປະຈຳການໄດ້', 'warning');
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
        ? `<option value=""></option><optgroup label="${escapeHtml(meta.label)} — ສາມາດເພີ່ມໄດ້">${choices.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.fullName)}${item.specialty ? ` — ${escapeHtml(item.specialty)}` : ''}</option>`).join('')}</optgroup>`
        : '<option value="">ບໍ່ມີພະນັກງານວ່າງໃນພະແນກນີ້</option>';
      const assignedOptions = alreadyAssigned.length
        ? `<optgroup label="ເຂົ້າປະຈຳການແລ້ວ">${alreadyAssigned.map(item => `<option value="" disabled>${escapeHtml(item.fullName)} — ເຂົ້າປະຈຳການແລ້ວ</option>`).join('')}</optgroup>`
        : '';
      select.innerHTML = `${availableOptions}${assignedOptions}`;
      select.disabled = !departmentStaff.length;
      enableStaffSearch(select);
    }
    if (saveButton) saveButton.disabled = !choices.length;
    if (availabilityNote) {
      availabilityNote.innerHTML = departmentStaff.length
        ? `<i class="fas fa-users"></i> ${escapeHtml(meta.label)}: ພົບ ${departmentStaff.length} ຄົນ · ວ່າງເພີ່ມ ${choices.length} ຄົນ · ເຂົ້າປະຈຳການແລ້ວ ${alreadyAssigned.length} ຄົນ`
        : '<i class="fas fa-user-plus"></i> ຍັງບໍ່ມີພະນັກງານໃນພະແນກນີ້; ກະລຸນາເພີ່ມໃນໜ້າຈັດການພະນັກງານ';
    }
    const statusSelect = document.getElementById('manpowerStatusSelect');
    const leaveTypeSelect = document.getElementById('manpowerNewLeaveType');
    const noteInput = document.getElementById('manpowerNewNote');
    if (statusSelect) statusSelect.value = 'working';
    if (leaveTypeSelect) leaveTypeSelect.value = 'vacation';
    if (noteInput) noteInput.value = '';
    window.toggleNewManpowerFields();
    const modal = document.getElementById('manpowerAssignmentModal');
    if (modal && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modal).show();
  };

  window.toggleNewManpowerFields = function () {
    const status = clean(document.getElementById('manpowerStatusSelect')?.value) || 'working';
    const group = document.getElementById('manpowerNewLeaveTypeGroup');
    const leaveTypeSelect = document.getElementById('manpowerNewLeaveType');
    const isLeave = status === 'leave';
    if (group) group.hidden = !isLeave;
    if (leaveTypeSelect) leaveTypeSelect.required = isLeave;
  };

  window.saveManpowerAssignment = async function (event) {
    event?.preventDefault();
    if (!mayManage()) return notify('ບໍ່ມີສິດ', 'ສະເພາະ Admin ເທົ່ານັ້ນທີ່ສາມາດຈັດການການປະຈຳການໄດ້', 'warning');
    const staffId = clean(document.getElementById('manpowerStaffSelect')?.value);
    if (!staffId) return;
    const status = clean(document.getElementById('manpowerStatusSelect')?.value) || 'working';
    const leaveType = status === 'leave' ? (clean(document.getElementById('manpowerNewLeaveType')?.value) || 'vacation') : '';
    const note = clean(document.getElementById('manpowerNewNote')?.value);
    const assignment = { id: createId(), date: state.date, shift: state.shift, staffId, status, leaveType, note, replacementStaffId: '', createdAt: new Date().toISOString() };
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
      await notify('ບັນທຶກການຈັດການປະຈຳການບໍ່ສຳເລັດ', error.message);
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  };

  window.removeManpowerAssignment = async function (assignmentId) {
    if (!mayManage()) return notify('ບໍ່ມີສິດ', 'ສະເພາະ Admin ເທົ່ານັ້ນທີ່ສາມາດຈັດການການປະຈຳການໄດ້', 'warning');
    const assignment = state.assignments.find(item => item.id === assignmentId);
    if (!assignment) return;
    const staff = staffById(assignment.staffId);
    let confirmed = true;
    if (window.Swal?.fire) {
      const result = await window.Swal.fire({
        title: 'ນຳອອກຈາກລາຍຊື່ປະຈຳການ?',
        text: staff?.fullName || '',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ເອົາອອກ',
        cancelButtonText: 'ຍົກເລີກ',
        confirmButtonColor: '#d9233f'
      });
      confirmed = result.isConfirmed;
    } else confirmed = window.confirm?.(`ນຳ ${staff?.fullName || ''} ອອກຈາກລາຍຊື່ປະຈຳການ?`) !== false;
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
    if (!mayManage()) return notify('ບໍ່ມີສິດ', 'ສະເພາະ Admin ເທົ່ານັ້ນທີ່ສາມາດຈັດການການປະຈຳການໄດ້', 'warning');
    const assignment = state.assignments.find(item => item.id === assignmentId);
    const currentStaff = assignment ? state.staff.find(item => item.id === assignment.staffId) : null;
    if (!assignment || !currentStaff) return;

    const assignmentInput = document.getElementById('manpowerManageAssignmentId');
    const currentInput = document.getElementById('manpowerManageCurrentStaff');
    const statusSelect = document.getElementById('manpowerManageStatus');
    const leaveTypeSelect = document.getElementById('manpowerLeaveType');
    const noteInput = document.getElementById('manpowerNote');
    if (assignmentInput) assignmentInput.value = assignment.id;
    if (currentInput) currentInput.value = currentStaff.fullName;
    if (statusSelect) statusSelect.value = assignment.status || 'working';
    if (leaveTypeSelect) leaveTypeSelect.value = normalizedLeaveType(assignment) || 'vacation';
    if (noteInput) noteInput.value = assignment.note || '';
    window.toggleManpowerFields();
    const modal = document.getElementById('manpowerManagementModal');
    if (modal && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modal).show();
  };

  window.toggleManpowerFields = function () {
    const status = clean(document.getElementById('manpowerManageStatus')?.value) || 'working';
    const group = document.getElementById('manpowerLeaveTypeGroup');
    const leaveTypeSelect = document.getElementById('manpowerLeaveType');
    const isLeave = status === 'leave';
    if (group) group.hidden = !isLeave;
    if (leaveTypeSelect) leaveTypeSelect.required = isLeave;
  };

  window.saveManpowerManagement = async function (event) {
    event?.preventDefault();
    if (!mayManage()) return notify('ບໍ່ມີສິດ', 'ສະເພາະ Admin ເທົ່ານັ້ນທີ່ສາມາດຈັດການການປະຈຳການໄດ້', 'warning');
    const assignmentId = clean(document.getElementById('manpowerManageAssignmentId')?.value);
    const status = clean(document.getElementById('manpowerManageStatus')?.value) || 'working';
    const leaveType = status === 'leave' ? (clean(document.getElementById('manpowerLeaveType')?.value) || 'vacation') : '';
    const note = clean(document.getElementById('manpowerNote')?.value);
    const assignment = state.assignments.find(item => item.id === assignmentId);
    if (!assignment) return;
    const before = { status: assignment.status, leaveType: normalizedLeaveType(assignment), note: assignment.note || '', replacementStaffId: assignment.replacementStaffId || '' };
    const after = { status, leaveType, note, replacementStaffId: '' };
    if (before.status === after.status && before.leaveType === after.leaveType && before.note === after.note && !before.replacementStaffId) {
      window.bootstrap?.Modal?.getInstance(document.getElementById('manpowerManagementModal'))?.hide();
      return;
    }
    try {
      if (isLocalMode()) {
        assignment.status = status;
        assignment.leaveType = leaveType;
        assignment.note = note;
        assignment.replacementStaffId = '';
        assignment.updatedAt = new Date().toISOString();
        writeAssignments(state.assignments);
        appendHistory({
          action: 'updated',
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
      await notify('ຈັດການການປະຈຳການບໍ່ສຳເລັດ', error.message);
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
      if (event.key === MANPOWER_OVERVIEW_STORAGE_KEY) {
        state.overviews = overviewsForDate(state.date);
        window.renderManpowerDashboard?.();
      }
    });
  }
}
