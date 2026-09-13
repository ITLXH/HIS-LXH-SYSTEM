import './lisArchiveDashboard.css';

const ACTIVE_STATUSES = new Set(['queued', 'pending', 'waiting', 'in_progress', 'requested']);
const POLL_MS = 10000;
let initializedPanel = null;
let pollTimer = null;
let requestPending = false;

function el(id) {
  return document.getElementById(id);
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1073741824) return `${(value / 1048576).toFixed(1)} MB`;
  return `${(value / 1073741824).toFixed(2)} GB`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours} ຊມ ${minutes} ນາທີ`;
  if (minutes) return `${minutes} ນາທີ ${secs} ວິ`;
  return `${secs} ວິນາທີ`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '-';
  return date.toLocaleString('lo-LA', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function stageLabel(stage, status) {
  const labels = {
    starting: 'ກຳລັງເລີ່ມລະບົບ...',
    connecting: 'ກຳລັງເຊື່ອມຕໍ່ Supabase ແລະ Drive...',
    scanning: 'ກຳລັງກວດລາຍການໄຟລ໌...',
    copying_and_verifying: 'ກຳລັງ copy ແລະກວດ checksum...',
    verifying_gateway: 'ກຳລັງທົດສອບເປີດໄຟລ໌ຈາກ Drive...',
    finalizing: 'ກຳລັງສະຫຼຸບຜົນ...',
    completed: 'ອັບໂຫລດ ແລະກວດສອບສຳເລັດ',
    completed_with_errors: 'ສຳເລັດບາງສ່ວນ—ມີລາຍການຜິດພາດ',
    failed: 'ການອັບໂຫລດບໍ່ສຳເລັດ',
  };
  if (labels[stage]) return labels[stage];
  if (ACTIVE_STATUSES.has(status)) return status === 'queued' ? 'ກຳລັງລໍຖ້າຄິວ...' : 'ກຳລັງດຳເນີນການ...';
  if (status === 'success') return labels.completed;
  if (status === 'failure') return labels.failed;
  return 'ພ້ອມສຳລັບການອັບໂຫລດ';
}

function setSundayHint() {
  const target = el('lisArchiveSundayHint');
  if (!target) return;
  const now = new Date();
  const days = (7 - now.getDay()) % 7;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + days);
  const isSunday = now.getDay() === 0;
  target.textContent = isSunday
    ? 'ມື້ນີ້ແມ່ນວັນອາທິດ—ສາມາດກົດອັບໂຫລດໄດ້'
    : `ວັນອາທິດຖັດໄປ: ${sunday.toLocaleDateString('lo-LA')}`;
}

function render(data) {
  const progress = data.progress || {};
  const status = data.status || 'none';
  const active = ACTIVE_STATUSES.has(status);
  const percent = Math.min(100, Math.max(0, Number(data.percent || progress.percent || 0)));
  const processed = Number(progress.processed_object_count || 0);
  const eligible = Number(progress.eligible_object_count || 0);
  const processedBytes = Number(progress.processed_bytes || 0);
  const eligibleBytes = Number(progress.eligible_bytes || 0);
  const failures = Number(progress.failure_count || 0);

  const badge = el('lisArchiveStatusBadge');
  badge.className = `badge ${status === 'success' ? 'bg-success' : status === 'failure' ? 'bg-danger' : active ? 'bg-warning text-dark' : 'bg-secondary'}`;
  badge.textContent = status === 'success' ? 'ສຳເລັດ' : status === 'failure' ? 'ຜິດພາດ' : active ? 'ກຳລັງເຮັດ' : 'ພ້ອມ';
  el('lisArchiveStage').textContent = stageLabel(progress.stage, status);
  el('lisArchivePercent').textContent = `${Math.round(percent)}%`;

  const bar = el('lisArchiveProgressBar');
  bar.style.width = `${percent}%`;
  bar.classList.toggle('is-active', active);
  bar.classList.toggle('bg-danger', status === 'failure');
  bar.parentElement.setAttribute('aria-valuenow', String(Math.round(percent)));

  el('lisArchiveProcessed').textContent = `${processed.toLocaleString()} / ${eligible.toLocaleString()} ໄຟລ໌`;
  el('lisArchiveVerified').textContent = `${Number(progress.verified_copy_count || 0).toLocaleString()} ໄຟລ໌`;
  el('lisArchiveBytes').textContent = `${formatBytes(processedBytes)} / ${formatBytes(eligibleBytes)}`;
  el('lisArchiveStarted').textContent = formatDate(data.started_at || progress.started_at);
  el('lisArchiveElapsed').textContent = data.elapsed_seconds === null || data.elapsed_seconds === undefined ? '-' : formatDuration(data.elapsed_seconds);
  el('lisArchiveFailures').textContent = failures.toLocaleString();
  el('lisArchiveFailures').classList.toggle('text-danger', failures > 0);
  el('lisArchiveUpdated').textContent = `ອັບເດດ: ${formatDate(progress.updated_at || data.updated_at)}`;

  const button = el('btnLisArchiveNow');
  button.disabled = active || requestPending;
  button.innerHTML = active
    ? '<i class="fas fa-spinner fa-spin me-1"></i>ກຳລັງອັບໂຫລດ'
    : '<i class="fas fa-cloud-upload-alt me-1"></i>ເລີ່ມອັບໂຫລດ';
}

async function apiFetch(url, options) {
  if (typeof window.authenticatedFetch !== 'function') throw new Error('Authentication is not ready');
  const response = await window.authenticatedFetch(url, options);
  let data = {};
  try { data = await response.json(); } catch (_) { /* handled below */ }
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function refresh() {
  if (!el('lisArchivePanel')) return;
  try {
    render(await apiFetch('/api/backup/lis-archive-status'));
  } catch (error) {
    if (error.status === 404) {
      el('lisArchiveStage').textContent = 'API ຈະໃຊ້ໄດ້ຫຼັງ deploy ໄປ Cloudflare Pages';
    } else {
      el('lisArchiveStage').textContent = `ກວດສະຖານະບໍ່ສຳເລັດ: ${error.message}`;
    }
  }
}

async function startArchive() {
  if (requestPending) return;
  const confirmation = await window.Swal.fire({
    icon: 'question',
    title: 'ເລີ່ມອັບໂຫລດ PDF?',
    html: '<div class="text-start small"><p>ລະບົບຈະ copy ໄຟລ໌ຜົນກວດທີ່ເກີນ <strong>14 ມື້</strong> ໄປ Google Drive ແລະກວດ checksum.</p><p class="mb-0 text-success"><i class="fas fa-shield-alt me-1"></i>ຄັ້ງນີ້ຈະບໍ່ລຶບໄຟລ໌ຈາກ Supabase.</p></div>',
    showCancelButton: true,
    confirmButtonText: 'ເລີ່ມອັບໂຫລດ',
    cancelButtonText: 'ຍົກເລີກ',
    confirmButtonColor: '#1683d8',
  });
  if (!confirmation.isConfirmed) return;

  requestPending = true;
  el('btnLisArchiveNow').disabled = true;
  el('lisArchiveStage').textContent = 'ກຳລັງສົ່ງຄຳສັ່ງ...';
  try {
    await apiFetch('/api/backup/lis-archive-run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    render({ status: 'requested', percent: 0, elapsed_seconds: 0, progress: { stage: 'starting' } });
    window.Swal.fire({
      icon: 'success',
      title: 'ເລີ່ມແລ້ວ',
      text: 'ສາມາດປິດໜ້ານີ້ໄດ້; server ຈະເຮັດຕໍ່ ແລະສະຖານະຈະກັບຄືນມາເມື່ອເປີດໃໝ່.',
      confirmButtonText: 'ຕົກລົງ',
    });
    setTimeout(refresh, 3000);
  } catch (error) {
    if (error.status === 409 && error.data) {
      await refresh();
      window.Swal.fire('ກຳລັງດຳເນີນຢູ່', `ມີ Archive Run #${error.data.run_number || '?'} ກຳລັງເຮັດວຽກ`, 'info');
    } else {
      window.Swal.fire('ເລີ່ມບໍ່ສຳເລັດ', error.message, 'error');
    }
  } finally {
    requestPending = false;
    await refresh();
  }
}

function initialize() {
  const panel = el('lisArchivePanel');
  if (!panel || panel === initializedPanel) return;
  initializedPanel = panel;
  el('btnLisArchiveNow')?.addEventListener('click', startArchive);
  setSundayHint();
  refresh();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refresh, POLL_MS);
}

new MutationObserver(initialize).observe(document.documentElement, { childList: true, subtree: true });
initialize();

window.refreshLisArchiveStatus = refresh;
