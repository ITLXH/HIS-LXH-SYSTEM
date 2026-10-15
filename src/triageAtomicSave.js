// Keep one unconfirmed draft in memory so a lost response can be retried safely.
export function createAtomicTriageSaver() {
  let draft = null;
  let busy = false;
  return async function save({ client, table, actor, form, vital, visit }) {
    if (busy) return { error: { code: 'BUSY' } };
    busy = true;
    try {
      const signature = JSON.stringify([actor, form]);
      if (draft?.confirmed && draft.signature !== signature) draft = null;
      if (draft && draft.signature !== signature) {
        // A previous RPC may have committed despite a lost response. Reconcile
        // that exact request before allowing edited input to become another save.
        return { error: { code: 'UNCONFIRMED_DRAFT' } };
      }
      if (!draft) {
        const snapshot = await client.from(table).select('*')
          .eq('Visit_ID', form.visitId).eq('Patient_ID', form.patientId).maybeSingle();
        if (snapshot.error || !snapshot.data) return { error: { code: snapshot.error?.code || 'VISIT_NOT_FOUND' } };
        draft = { signature, args: {
          p_request_id: vital.Vital_ID,
          p_expected_visit: snapshot.data,
          p_vital: structuredClone(vital),
          p_visit: structuredClone(visit),
        } };
      }
      const result = await client.rpc('his_one_save_triage_atomic', draft.args);
      if (result.error) {
        // These PostgreSQL/schema rejections are confirmed rollbacks. Transport
        // and unknown gateway failures keep the same request ID and payload.
        if (['40001','22023','42501','42703','42P01','23502','23503','23514','PGRST202','PGRST204','PGRST205','42883'].includes(result.error.code)) draft = null;
        return { error: { code: result.error.code || 'UNCONFIRMED' } };
      }
      const data = result.data;
      if (!data?.success || data.request_id !== draft.args.p_request_id ||
          data.visit?.Visit_ID !== form.visitId || data.visit?.Patient_ID !== form.patientId) {
        return { error: { code: 'UNCONFIRMED' } };
      }
      draft.confirmed = true;
      return { data };
    } catch {
      return { error: { code: 'UNCONFIRMED' } };
    } finally { busy = false; }
  };
}
