// Keep URL filters bounded and read every page before returning a complete set.
// A failed page rejects the entire read; callers must not render partial totals.
export async function readPatientScopedRows({ client, table, ids, select, orderBy }) {
  const rows = [];
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  for (let index = 0; index < uniqueIds.length; index += 100) {
    const batch = uniqueIds.slice(index, index + 100);
    for (let offset = 0; ; offset += 1000) {
      let query = client.from(table).select(select)
        .in('Patient_ID', batch).order('Patient_ID', { ascending: true });
      if (orderBy !== 'Patient_ID') query = query.order(orderBy, { ascending: true });
      const { data, error } = await query.range(offset, offset + 999);
      if (error) throw error;
      const page = data || [];
      rows.push(...page);
      if (page.length < 1000) break;
    }
  }
  return rows;
}

// Sharing exists only while the identical read is pending. The next refresh
// always reads fresh data; session changes cannot reuse an old session's read.
export function createConcurrentRead(task, getSession) {
  let session;
  const pending = new Map();
  return function (key, ...args) {
    const scope = getSession();
    if (scope !== session) { session = scope; pending.clear(); }
    if (!scope) return task(...args);
    if (pending.has(key)) return pending.get(key);
    const request = Promise.resolve().then(() => task(...args));
    pending.set(key, request);
    return request.finally(() => { if (pending.get(key) === request) pending.delete(key); });
  };
}
