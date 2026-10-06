// Test fixture only: runs with the actual app and Supabase SDK on a loopback origin.
// Replaces network endpoints and realtime with in-memory data BEFORE main.js loads.
if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('Loopback test fixture only');
(() => {
  localStorage.removeItem('his_current_user_session');
  localStorage.removeItem('sb-pzyrowzghrcfpmhkreag-auth-token');
  const nativeFetch = window.fetch.bind(window);
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const authId = '11111111-1111-4111-8111-111111111111';
  const user = { id: authId, email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', created_at: today.toISOString(), app_metadata: {}, user_metadata: {} };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: authId, aud: 'authenticated', exp, role: 'authenticated' })}.fixture-signature`;
  const state = window.hisWorkflowMock = {
    dateKey, requests: [], channels: new Set(), archive: 'success',
    tables: {
      HIS_One_Users: [{ ID: 1, Auth_User_ID: authId, Email: user.email, Name: 'Workflow Test Admin', Role: 'admin', Status: 'active', Permissions: '["all"]', ButtonPermissions: '{}', Must_Change_Password: false }],
      HIS_One_Patients: [{ Patient_ID: 'PTEST01', First_Name: 'Synthetic', Last_Name: 'Patient', Registration_Date: dateKey, Date_of_Birth: '1990-01-01', Gender: 'Male', Title: 'Mr' }],
      HIS_One_Visits: [{ Visit_ID: 'VTEST01', Patient_ID: 'PTEST01', Patient_Name: 'Synthetic Patient', Date: today.toISOString(), Status: 'Waiting OPD', Department: 'OPD', Visit_Type: 'OPD', Symptoms: 'Fixture only', Lab_Orders_JSON: '[]', Prescription_JSON: '[]' }],
      HIS_One_Settings: [{ Key: 'HospitalName', Value: 'Local Workflow Test Hospital' }],
      HIS_One_Organizations: [{ Org_ID: 'ORGTEST01', Org_Code: 'FIXTURE', Org_Name: 'Synthetic Organization', Name: 'Synthetic Contact' }],
      HIS_One_MasterData: [{ ID: 1, Category: 'Department', Value: 'OPD' }],
      HIS_One_Result_Acknowledgments: [], lis_one_order_result_files: [],
      lis_one_test_orders: [{ order_id: 'OTEST01', patient_id: 'PTEST01', patient_name: 'Synthetic Patient', order_datetime: today.toISOString(), status: 'completed', test_name: 'Fixture Lab' }],
    },
    emit(row) {
      for (const channel of this.channels) for (const event of channel.events) {
        if (event.kind === 'postgres_changes' && event.filter.table === 'HIS_One_Visits') event.callback({ new: row, old: {}, eventType: 'UPDATE' });
      }
    },
    channelStatus(status) { for (const channel of this.channels) if (channel.name === 'opd-queue-notifications') channel.status?.(status); },
  };
  const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
  function select(table, params) {
    let rows = [...(state.tables[table] || [])];
    for (const [field, filter] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(field)) continue;
      const dot = filter.indexOf('.');
      const op = filter.slice(0, dot), value = filter.slice(dot + 1);
      if (op === 'eq') rows = rows.filter(row => String(row[field]) === value);
      if (op === 'gte') rows = rows.filter(row => String(row[field]) >= value);
      if (op === 'lte') rows = rows.filter(row => String(row[field]) <= value);
      if (op === 'in') rows = rows.filter(row => value.slice(1, -1).split(',').includes(String(row[field])));
      if (op === 'is' && value === 'null') rows = rows.filter(row => row[field] == null);
      if (op === 'not' && value === 'is.null') rows = rows.filter(row => row[field] != null);
    }
    return rows;
  }
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
    const method = options.method || 'GET';
    if (url.origin === location.origin && !url.pathname.startsWith('/api/')) return nativeFetch(input, options);
    state.requests.push({ path: url.pathname, method });
    if (url.pathname.includes('/auth/v1/token')) return json({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user });
    if (url.pathname.includes('/auth/v1/user')) return json(user);
    if (url.pathname.includes('/auth/v1/logout')) return new Response(null, { status: 204 });
    if (url.pathname.includes('/auth/v1/health')) return json({ name: 'fixture' });
    if (url.pathname === '/api/mock-error') return json({ error: 'Mock endpoint failure' }, 500);
    if (url.pathname === '/api/data') {
      const query = JSON.parse(options.body || '{}');
      const params = new URLSearchParams(query.filter || '');
      return json({ success: true, data: select(query.table, params).slice(0, query.limit || 1000) });
    }
    if (url.pathname === '/api/backup/lis-archive-run') { state.archive = 'in_progress'; return json({ success: true }); }
    if (url.pathname === '/api/backup/lis-archive-status') return json({ success: true, status: state.archive, percent: state.archive === 'success' ? 100 : 42, progress: { stage: 'copying_and_verifying' } });
    if (url.pathname.startsWith('/api/backup/')) return json({ success: true, status: 'success', conclusion: 'success', files: [], runs: [], backups: [], data: [] });
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json([]);
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = decodeURIComponent(url.pathname.slice('/rest/v1/'.length));
      if (table === 'HIS_One_Organizations' && (url.searchParams.get('select') || '').split(',').includes('Contact_Name')) {
        return json({ code: '42703', message: 'column HIS_One_Organizations.Contact_Name does not exist' }, 400);
      }
      if (state.failTable === table) return json({ code: '42501', message: 'Mock read failure' }, 403);
      const all = state.tables[table] ||= [];
      let rows = select(table, url.searchParams);
      if (['POST', 'PATCH', 'DELETE'].includes(method)) {
        const body = JSON.parse(options.body || '{}');
        if (method === 'POST') { rows = (Array.isArray(body) ? body : [body]).map(row => ({ ID: all.length + 1, ...row })); all.push(...rows); }
        if (method === 'PATCH') rows.forEach(row => Object.assign(row, body));
        if (method === 'DELETE') state.tables[table] = all.filter(row => !rows.includes(row));
      }
      const count = rows.length;
      const offset = Number(url.searchParams.get('offset') || 0);
      rows = rows.slice(offset, offset + Number(url.searchParams.get('limit') || 1000));
      const headers = new Headers(options.headers || {});
      const range = headers.get('range')?.split('-').map(Number);
      if (range) rows = rows.slice(range[0], range[1] + 1);
      return json(headers.get('accept')?.includes('vnd.pgrst.object') ? (rows[0] || null) : rows, 200, { 'Content-Range': `0-${Math.max(0, rows.length - 1)}/${count}` });
    }
    // Fail closed: unexpected external/API requests never fall through to production.
    throw new Error(`Unmocked workflow endpoint: ${url.origin}${url.pathname}`);
  };
  const sdk = window.supabase;
  window.supabase = { ...sdk, createClient(...args) {
    const client = sdk.createClient(...args);
    client.channel = name => {
      const channel = { name, events: [], on(kind, filter, callback) { this.events.push({ kind, filter, callback }); return this; },
        subscribe(callback) { this.status = callback; state.channels.add(this); queueMicrotask(() => { if (state.channels.has(this)) callback?.('SUBSCRIBED'); }); return this; },
        track: async () => 'ok', presenceState: () => ({}) };
      return channel;
    };
    client.removeChannel = async channel => { state.channels.delete(channel); return 'ok'; };
    return client;
  } };
  if (navigator.serviceWorker) navigator.serviceWorker.register = async () => ({});
})();
