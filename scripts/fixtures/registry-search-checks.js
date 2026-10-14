// Real DataTables and Supabase client; synthetic local-only API fixture.
const panel = document.createElement('aside');
panel.style.cssText = 'position:fixed;right:8px;top:8px;z-index:200002;background:white;color:#111;padding:12px;border:2px solid #1683d8;width:470px;max-height:90vh;overflow:auto;font:13px system-ui';
panel.innerHTML = '<strong>Patient registry — SYNTHETIC LOCAL TEST</strong><p>No production reads or writes.</p><button id="registry-run">Run registry checks</button><pre id="registry-results">Ready</pre>';
document.body.append(panel);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const registryRequests = [];
async function until(check, message) {
  const start = Date.now();
  while (!check()) { if (Date.now() - start > 12000) throw new Error(message); await wait(100); }
}
panel.querySelector('button').onclick = async () => {
  const out = document.getElementById('registry-results');
  const lines = [];
  const check = (value, label) => { if (!value) throw new Error(label); lines.push(`PASS ${label}`); out.textContent = lines.join('\n'); };
  panel.querySelector('button').disabled = true;
  try {
    await until(() => window.doLogin && document.querySelector('#view-patients'), 'app did not initialize');
    document.getElementById('loginEmail').value = 'fixture@example.invalid';
    document.getElementById('loginPass').value = 'fixture-test-password';
    await window.doLogin();
    await until(() => document.getElementById('app-content').style.display !== 'none', 'synthetic login did not finish');
    const mock = window.hisWorkflowMock;
    mock.tables.HIS_One_Patients = Array.from({ length: 16 }, (_, i) => ({
      Patient_ID: `LXH2099-${String(i + 1).padStart(6, '0')}`, Old_Patient_ID: String(9000 + i),
      First_Name: 'ທົດສອບ', Last_Name: 'ຄົນເຈັບ', Gender: 'Male',
      Phone_Number: '02099990000', Registration_Date: '2099-01-01'
    }));
    window.loadView('patients');
    await until(() => $.fn.DataTable.isDataTable('#patientTable') && $('#patientTable').DataTable().rows().count() === 10, 'patient table did not load');
    const table = $('#patientTable').DataTable();
    const originalAjax = table.settings()[0].ajax;
    table.settings()[0].ajax = function (request, callback) {
      registryRequests.push(JSON.parse(JSON.stringify(request)));
      return originalAjax(request, callback);
    };
    const redraw = async action => {
      let done = false;
      $('#patientTable').one('draw.dt.registryFixture', () => { done = true; });
      action();
      await until(() => done, 'registry redraw did not complete');
    };
    const rows = () => table.rows().data().toArray();
    await redraw(() => table.search('LXH2099').draw());
    check(table.page.info().recordsDisplay === 16 && rows().length === 10, 'HN prefix preserves all 16 matches');
    await redraw(() => table.page('next').draw('page'));
    check(rows().length === 6, 'second page reaches remaining six patients');
    await redraw(() => table.search('lxh2099 - 000001').draw());
    check(rows().length === 1 && rows()[0].Patient_ID === 'LXH2099-000001', 'full HN accepts lowercase and copied spaces');
    const codeRequest = mock.requests.filter(r => r.path.endsWith('/HIS_One_Patients')).at(-1);
    check(new URLSearchParams(codeRequest.search).get('or').includes('.eq.'), 'real Supabase URL uses ID equality');
    await redraw(() => table.search('').column(3).search('9000').draw());
    check(rows().length === 1 && rows()[0].Old_Patient_ID === '9000', 'Old ID search returns correct patient');
    await redraw(() => table.column(3).search('').column(4).search('ທົດສອບ ຄົນເຈັບ').draw());
    check(table.page.info().recordsDisplay === 16, 'multiword Lao name remains searchable');
    await redraw(() => table.column(4).search('').column(7).search('0209999').draw());
    check(table.page.info().recordsDisplay === 16, 'phone search remains complete');
    await redraw(() => {
      table.column(7).search('');
      table.search('LXH2099-000001').draw();
    });
    mock.failTable = 'HIS_One_Patients';
    await redraw(() => table.ajax.reload());
    check(rows().length === 1 && $('#patientLoadAllNotice').is(':visible'), 'failed same-search refresh preserves page and shows error');
    await redraw(() => table.search('LXH2099-000002').draw());
    check(rows().length === 0 && $('#patientLoadAllNotice').is(':visible'), 'failed new HN does not display previous patient');
    mock.failTable = '';
    await redraw(() => table.ajax.reload());
    check(rows().length === 1 && rows()[0].Patient_ID === 'LXH2099-000002', 'recovery loads the intended patient');
    check(window.hisNetworkState === 'online', 'HTTP read failure does not mark network offline');
    check(!mock.requests.some(r => ['POST', 'PATCH', 'DELETE'].includes(r.method) && r.path.endsWith('/HIS_One_Patients')), 'registry workflow issues no patient writes');
    out.textContent += '\nALL 12 REGISTRY BROWSER CHECKS PASSED';
  } catch (error) {
    out.textContent += `\nFAIL ${error.message}\nSynthetic request diagnostics: ${JSON.stringify(registryRequests.slice(-2).map(r => ({ start: r.start, length: r.length, search: r.search, columns: r.columns.map(c => c.search), order: r.order })))}`;
    console.error(error);
  }
};
