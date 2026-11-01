const identity = /^[A-Za-z0-9_-]{1,120}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Read-only receipt view. It never changes a medication or the clinical form's dirty state.
export function createPmcOrderReceiptNotice({ rpc, render, notify }) {
  let patientId = '', visitId = '', generation = 0, seen = new Set(), initialized = false;
  async function refresh() {
    if (!patientId || !visitId) return;
    const current = generation;
    const result = await rpc('pmc_order_receipts_v1', { p_patient_id: patientId, p_visit_id: visitId }).catch(() => null);
    if (generation !== current || result?.error || !Array.isArray(result?.data) || result.data.length > 100
      || result.data.some(row => !row || !uuid.test(row.eventId) || !Number.isSafeInteger(row.revision) || row.revision < 1 || !Number.isFinite(Date.parse(row.receivedAt)))) return;
    const rows = result.data;
    if (initialized && rows.some(row => !seen.has(row.eventId))) notify(rows.filter(row => !seen.has(row.eventId)));
    seen = new Set(rows.map(row => row.eventId));
    initialized = true;
    render(rows);
  }
  async function open(nextPatientId, nextVisitId) {
    generation++;
    patientId = identity.test(nextPatientId || '') ? nextPatientId : '';
    visitId = identity.test(nextVisitId || '') ? nextVisitId : '';
    initialized = false;seen = new Set();render([]);
    await refresh();
  }
  function close() { generation++;patientId = '';visitId = '';initialized = false;seen = new Set();render([]); }
  return { open, refresh, close };
}
