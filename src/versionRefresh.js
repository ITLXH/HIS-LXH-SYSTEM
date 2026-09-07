export const HIS_BUILD_ID = typeof __HIS_BUILD_ID__ !== 'undefined'
  ? String(__HIS_BUILD_ID__)
  : 'development';

const VERSION_POLL_MS = 60_000;
const SAFE_RELOAD_RETRY_MS = 5_000;

export function hasVisibleUnsavedWork(doc = document) {
  if (doc.querySelector('.modal.show, .swal2-container.swal2-shown')) return true;

  const active = doc.activeElement;
  if (active && active.matches?.('input, textarea, select, [contenteditable="true"]')) return true;

  return [...doc.querySelectorAll('form[data-his-dirty="true"]')]
    .some(form => form.offsetParent !== null);
}

export function startBuildVersionRefresh() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return () => {};
  if (window.__hisVersionRefreshStarted) return window.__hisStopVersionRefresh || (() => {});

  window.__hisVersionRefreshStarted = true;
  let pendingVersion = '';
  let reloadTimer = null;

  const markDirty = event => {
    const form = event.target?.closest?.('form');
    if (form) form.dataset.hisDirty = 'true';
  };
  const clearDirty = event => {
    const form = event.target?.closest?.('form');
    if (form) delete form.dataset.hisDirty;
  };

  document.addEventListener('input', markDirty, true);
  document.addEventListener('change', markDirty, true);
  document.addEventListener('submit', clearDirty, true);
  document.addEventListener('reset', clearDirty, true);

  const reloadWhenSafe = () => {
    if (!pendingVersion) return;
    if (hasVisibleUnsavedWork(document)) {
      reloadTimer = window.setTimeout(reloadWhenSafe, SAFE_RELOAD_RETRY_MS);
      return;
    }
    window.location.reload();
  };

  const checkVersion = async () => {
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) return;
      const payload = await response.json();
      const latestVersion = String(payload?.version || '').trim();
      if (!latestVersion || latestVersion === HIS_BUILD_ID || pendingVersion) return;
      pendingVersion = latestVersion;
      reloadWhenSafe();
    } catch (error) {
      console.debug('Build version check skipped:', error?.message || error);
    }
  };

  const pollTimer = window.setInterval(checkVersion, VERSION_POLL_MS);
  window.setTimeout(checkVersion, 10_000);

  window.__hisStopVersionRefresh = () => {
    window.clearInterval(pollTimer);
    if (reloadTimer) window.clearTimeout(reloadTimer);
    document.removeEventListener('input', markDirty, true);
    document.removeEventListener('change', markDirty, true);
    document.removeEventListener('submit', clearDirty, true);
    document.removeEventListener('reset', clearDirty, true);
    window.__hisVersionRefreshStarted = false;
  };
  return window.__hisStopVersionRefresh;
}
