// Fetch only the current page of picker labels; patient details remain on their
// existing authenticated read paths. Search terms cannot add PostgREST filters.
export function patientLookupTokens(value) {
  return String(value || '').trim().replace(/[,%().:*_"\\]/g, ' ')
    .split(/\s+/).filter(Boolean).slice(0, 4).map(token => token.slice(0, 60));
}

export function createPatientLookupAjax({ client, table, getSession, normalizeOldId = String }) {
  let session;
  const pending = new Map();
  const pageSize = 20;
  const search = async (term, page, scope) => {
    if (session !== scope) { session = scope; pending.clear(); }
    const tokens = patientLookupTokens(term);
    const key = JSON.stringify([tokens, page]);
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      let query = client.from(table()).select('Patient_ID,Old_Patient_ID,First_Name,Last_Name')
        .order('Patient_ID', { ascending: false });
      for (const token of tokens) {
        query = query.or(['Patient_ID', 'Old_Patient_ID', 'First_Name', 'Last_Name', 'Phone_Number']
          .map(column => `${column}.ilike.%${token}%`).join(','));
      }
      const offset = (page - 1) * pageSize;
      const { data, error } = await query.range(offset, offset + pageSize);
      if (error) throw error;
      const rows = data || [];
      return {
        results: rows.slice(0, pageSize).map(patient => {
          const oldId = normalizeOldId(patient.Old_Patient_ID || '');
          const name = `${patient.First_Name || ''} ${patient.Last_Name || ''}`.trim();
          return { id: patient.Patient_ID, patientName: name,
            text: `${patient.Patient_ID}${oldId ? ` / Old: ${oldId}` : ''} - ${name}` };
        }),
        pagination: { more: rows.length > pageSize },
      };
    })();
    pending.set(key, request);
    try { return await request; }
    finally { if (pending.get(key) === request) pending.delete(key); }
  };
  return {
    delay: 300,
    data: params => ({ term: params.term || '', page: Math.max(1, Math.floor(Number(params.page) || 1)) }),
    transport(params, success, failure) {
      const scope = getSession();
      let cancelled = false;
      if (scope) {
        search(params.data.term, params.data.page, scope).then(
          result => { if (!cancelled && getSession() === scope) success(result); },
          error => { if (!cancelled && getSession() === scope) failure(error); },
        );
      }
      return { abort() { cancelled = true; } };
    },
    processResults: result => result,
  };
}
