import './onlinePresence.css';

export function mergeOnlineUsers(state) {
  const users = new Map();
  Object.values(state).flat().forEach(row => {
    if (!row.user_id) return;
    const old = users.get(row.user_id);
    if (!old || (old.idle && !row.idle)) users.set(row.user_id, row);
  });
  return [...users.values()].sort((a, b) => Number(a.idle) - Number(b.idle) || String(a.name).localeCompare(String(b.name)));
}

export function createOnlinePresence(client, escapeHtml) {
  let channel = null;
  let timer = null;
  let cleanup = () => {};
  let status = 'connecting';
  let users = [];
  const en = () => window.getAppLanguage?.() === 'en';
  function render() {
    const count = document.getElementById('his-online-count');
    const list = document.getElementById('his-online-list');
    const button = document.getElementById('his-online-button');
    if (!count || !list || !button) return;
    const connected = status === 'connected';
    count.textContent = connected ? String(users.length) : '—';
    button.dataset.status = status;
    const title = connected ? (en() ? `Online: ${users.length}` : `ອອນລາຍ ${users.length} ຄົນ`) : (en() ? 'Connecting…' : 'ກຳລັງເຊື່ອມຕໍ່…');
    button.title = title;
    button.setAttribute('aria-label', title);
    document.getElementById('his-online-heading').textContent = title;
    list.innerHTML = connected ? users.map(user => `<div class="his-online-row"><span class="his-online-dot ${user.idle ? 'is-idle' : ''}"></span><div><strong>${escapeHtml(user.name || 'User')}</strong><small>${escapeHtml(user.role || '')} · ${user.idle ? (en() ? 'Idle' : 'ພັກການໃຊ້ງານ') : (en() ? 'Active' : 'ກຳລັງໃຊ້ງານ')}</small></div></div>`).join('') : `<div class="his-online-empty">${en() ? 'Online status is temporarily unavailable.' : 'ຍັງບໍ່ສາມາດກວດສອບຜູ້ອອນລາຍໄດ້'}</div>`;
  }
  function stop() {
    const previous = channel;
    channel = null;
    clearInterval(timer);
    cleanup();
    users = [];
    status = 'connecting';
    render();
    if (previous) void client.removeChannel(previous);
  }
  function start(user) {
    stop();
    if (!user?.authUserId) return;
    let lastActivity = Date.now();
    let publishedIdle = null;
    let ready = false;
    const active = () => { lastActivity = Date.now(); };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, active, { passive: true }));
    cleanup = () => events.forEach(event => document.removeEventListener(event, active));
    const current = client.channel('his:staff:presence', { config: { private: true } });
    channel = current;
    async function publish() {
      if (channel !== current || !ready) return;
      const idle = Date.now() - lastActivity >= 300000;
      if (idle === publishedIdle) return;
      const result = await current.track({ user_id: user.authUserId, name: user.name, role: user.role, idle });
      if (channel !== current) return;
      if (result === 'ok') publishedIdle = idle;
    }
    current.on('presence', { event: 'sync' }, () => {
      if (channel !== current) return;
      users = mergeOnlineUsers(current.presenceState());
      status = 'connected';
      render();
    }).subscribe(state => {
      if (channel !== current) return;
      ready = state === 'SUBSCRIBED';
      if (ready) { publishedIdle = null; void publish(); }
      else { status = 'connecting'; users = []; render(); }
    });
    timer = setInterval(() => { void publish(); }, 15000);
    render();
  }
  client.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') stop(); });
  return { start, stop, render };
}
