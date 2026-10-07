// Actual HIS route loads against loopback-only synthetic backend data.
if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('Loopback only');
const panel = document.createElement('section');
panel.style.cssText = 'position:fixed;right:8px;top:8px;z-index:200002;background:white;color:#111;padding:12px;border:2px solid #1683d8;width:480px;max-height:90vh;overflow:auto;font:12px system-ui';
panel.innerHTML = '<strong>HIS — all page loads / LOCAL MOCKS</strong><p>Synthetic data only. No production traffic.</p><button id="page-audit-run">Run all page checks</button><pre id="page-audit-results" style="white-space:pre-wrap">Ready</pre><pre id="page-audit-json" hidden></pre>';
document.body.append(panel);
const errors = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason?.message || event.reason)));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (test, label) => {
  for (let elapsed = 0; !test(); elapsed += 100) { if (elapsed > 12000) throw new Error(label); await wait(100); }
};
panel.querySelector('button').onclick = async () => {
  panel.querySelector('button').disabled = true;
  const out = document.getElementById('page-audit-results');
  const results = [], extra = [];
  const assert = (condition, label) => { if (!condition) throw new Error(label); extra.push(label); };
  const mock = window.hisWorkflowMock;
  try {
    await until(() => window.doLogin && document.getElementById('view-ipd_chart'), 'app initialization');
    document.getElementById('loginEmail').value = 'fixture@example.invalid';
    document.getElementById('loginPass').value = 'fixture-test-password';
    await window.doLogin();
    await until(() => location.pathname === '/dashboard' && document.getElementById('app-content').style.display !== 'none', 'login');
    const routes = Object.keys(window.HIS_NAV_ROUTES);
    routes.push('ipd_chart');
    for (const route of routes) {
      const from = mock.requests.length, errorStart = errors.length;
      if (route === 'opd_consultation' || route === 'opd_test') {
        window.loadView('opd_queue', { force: true }); await window.loadQueue(); window.openOPDTest(0);
      } else if (route === 'ipd_chart') {
        await window.fetchIpdWardBedData(); window.prepareIpdUnfilteredState(); window.viewIpdChart('ATEST01');
      } else window.loadView(route, { force: true, skipOpdTestGuard: true });
      await wait(750);
      // Wait for the last async loader to settle, without confusing a visible shell with success.
      for (let retry = 0; retry < 12; retry++) {
        const count = mock.requests.length; await wait(150); if (count === mock.requests.length) break;
      }
      const view = window.HIS_NAV_ROUTES[route]?.view || route;
      const node = document.getElementById(`view-${view}`);
      assert(node && getComputedStyle(node).display !== 'none', `${route} visible`);
      assert(errors.length === errorStart, `${route}: ${errors.slice(errorStart).join('; ')}`);
      const calls = mock.requests.slice(from);
      results.push({ route, view, status: 'PASS', requestCount: calls.length, endpoints: [...new Set(calls.map(call => `${call.method} ${call.path}`))] });
      out.textContent = results.map(row => `PASS ${row.route} (${row.requestCount} calls)`).join('\n');
    }
    assert(new Set(results.map(row => row.view)).size === 30, 'all 30 configured views visited');
    assert(document.getElementById('ipdChartSubtitle').textContent.includes('PTEST01'), 'IPD correct patient HN');
    const state = window.ipdClinicalState;
    mock.failTable = 'HIS_One_Visits'; await window.loadIpdClinicalChart('ATEST01');
    assert(window.ipdClinicalState === state && document.getElementById('ipdChartSummaryPanel').textContent.includes('ຄັ້ງກ່ອນ'), 'IPD failure preserves complete same-patient state and warns');
    await window.loadIpdClinicalChart('MISSING_ADMISSION');
    assert(!document.getElementById('ipdPatientTimeline').textContent.includes('Synthetic') && !window.ipdClinicalState.admissionId, 'failed other admission clears old patient sections');
    mock.failTable = null;
    window.loadView('manpower', { force: true }); await wait(500);
    const manpower = [...mock.channels].find(channel => channel.name.includes('manpower'));
    assert(manpower, 'manpower channel subscribed');
    window.loadView('patients', { force: true }); await wait(500);
    assert(!mock.channels.has(manpower), 'route exit removes manpower channel');
    const count = mock.requests.length;
    for (const event of manpower.events) event.callback({});
    await wait(350);
    assert(mock.requests.length === count, 'obsolete manpower events cause no hidden-page reads');
    window.loadView('manpower'); await wait(500);
    assert([...mock.channels].some(channel => channel.name.includes('manpower')), 'normal cached-time reentry resubscribes manpower');
    window.loadView('patients'); await wait(350);
    await window.viewPatientDetail('PTEST01');
    assert(document.getElementById('view_p_id').textContent === 'PTEST01' && document.getElementById('view_p_phone').textContent === '02012345678', 'patient HN and phone preserved after all routes');
    // Deliberately leave the patient modal open: logout must remove it itself.
    await window.logout(); await wait(700);
    assert(mock.channels.size === 0, 'logout removes all subscriptions');
    assert(getComputedStyle(document.getElementById('patientProfileModal')).display === 'none' && document.getElementById('view_p_id').textContent === '—', 'logout hides patient modal and clears identity');
    document.getElementById('loginEmail').value = 'fixture@example.invalid';
    document.getElementById('loginPass').value = 'fixture-test-password';
    await window.doLogin(); await wait(700); await window.viewPatientDetail('PTEST01'); await wait(500);
    assert(getComputedStyle(document.getElementById('patientProfileModal')).display !== 'none' && document.getElementById('view_p_id').textContent === 'PTEST01', 'patient modal works after re-login despite logout during animation');
    await window.logout(); await wait(700);
    assert(errors.length === 0, 'no uncaught errors/rejections throughout audit');
    out.textContent += `\n${results.length} route loads / 30 views passed.\n${extra.length} assertions passed.\nMock integration only; production certification is not claimed.`;
    document.getElementById('page-audit-json').textContent = JSON.stringify({ results, assertions: extra, uncaughtErrors: errors, scope: 'Loopback Auth/API/Realtime mocks; no production CRUD or deployment' }, null, 2);
  } catch (error) {
    out.textContent += `\nFAIL ${error.message}`;
    document.getElementById('page-audit-json').textContent = JSON.stringify({ results, assertions: extra, uncaughtErrors: errors, failure: error.message }, null, 2);
  }
};
