const clean = value => String(value ?? '').trim();

const compactTimestamp = value => clean(value).replace(/[^0-9]/g, '').slice(0, 14) || 'now';

const normalizeTimestamp = value => {
  const text = clean(value);
  if (!text) return '';
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
};

export function resolveOpdTestInvestigationType(source = {}) {
  const item = source && typeof source === 'object' ? source : { name: clean(source) };
  const explicitType = clean(item.investigationType || item.orderType || item.serviceType).toLowerCase();
  if (['ultrasound', 'sonography', 'us'].includes(explicitType)) return 'ultrasound';
  if (['xray', 'x-ray', 'radiography', 'radiograph'].includes(explicitType)) return 'xray';
  if (['lab', 'laboratory', 'pathology'].includes(explicitType)) return 'lab';

  const categoryText = clean(item.categoryKey || item.category || item.formReference?.categoryKey || item.formReference?.category).toLowerCase();
  if (/ultra\s*-?\s*sound|sonograph/.test(categoryText)) return 'ultrasound';
  if (/\bx\s*-?\s*ray\b|radiograph/.test(categoryText)) return 'xray';

  const nameText = clean(item.name).toLowerCase();
  if (/ultra\s*-?\s*sound|sonograph/.test(nameText)) return 'ultrasound';
  if (/\bx\s*-?\s*ray\b|radiograph/.test(nameText)) return 'xray';
  return 'lab';
}

export function parseOpdQueueStoredList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

const OPD_QUEUE_ERROR_STATUSES = new Set([
  'cancelled', 'canceled', 'rejected', 'failed', 'error'
]);
const OPD_QUEUE_READY_STATUSES = new Set([
  'ready', 'dispensed', 'verified', 'released', 'final', 'reported'
]);
const OPD_QUEUE_PROGRESS_STATUSES = new Set([
  'sent', 'sent_to_pharmacy', 'accepted', 'collected', 'received', 'running',
  'processing', 'in_progress', 'scheduled', 'completed', 'preparing'
]);

const normalizeQueueStatus = value => clean(value).toLowerCase().replace(/[\s-]+/g, '_');

const hasQueueResult = item => Boolean(
  clean(item?.resultPdfUrl || item?.resultUrl || item?.fileUrl || item?.report || item?.findings || item?.impression)
);

const resolveQueueItemState = (item, kind) => {
  const status = normalizeQueueStatus(
    kind === 'medication'
      ? (item?.pharmacyStatus || item?.status)
      : kind === 'lab'
        ? (item?.resultStatus || item?.lisStatus || item?.status)
        : (item?.resultStatus || item?.risStatus || item?.status)
  );
  if (OPD_QUEUE_ERROR_STATUSES.has(status)) return 'error';
  if (hasQueueResult(item) || OPD_QUEUE_READY_STATUSES.has(status)) return 'ready';
  if (OPD_QUEUE_PROGRESS_STATUSES.has(status)) return 'progress';
  return 'pending';
};

const summarizeQueueItems = (items, kind) => {
  const states = items.map(item => resolveQueueItemState(item, kind));
  let state = 'none';
  if (states.length) {
    if (states.some(value => value === 'error')) state = 'error';
    else if (states.every(value => value === 'ready')) state = 'ready';
    else if (states.some(value => value === 'ready' || value === 'progress')) state = 'progress';
    else state = 'pending';
  }
  return { count: items.length, state };
};

export function buildOpdQueueOrderSummary(row = {}) {
  let investigations = parseOpdQueueStoredList(
    row.labOrdersStr ?? row.labOrders ?? row.Lab_Orders_JSON
  );
  let medications = parseOpdQueueStoredList(
    row.prescriptionStr ?? row.medications ?? row.Prescription_JSON
  );

  if ((!investigations.length || !medications.length) && row.clinicalNoteJson) {
    try {
      const note = typeof row.clinicalNoteJson === 'string'
        ? JSON.parse(row.clinicalNoteJson)
        : row.clinicalNoteJson;
      if (!investigations.length) investigations = parseOpdQueueStoredList(note?.orders);
      if (!medications.length) medications = parseOpdQueueStoredList(note?.medications);
    } catch (error) {
      // Legacy clinical notes are optional; malformed JSON must not break the queue.
    }
  }

  const grouped = { lab: [], ultrasound: [], xray: [] };
  investigations.forEach(item => {
    const normalized = item && typeof item === 'object' ? item : { name: clean(item) };
    grouped[resolveOpdTestInvestigationType(normalized)].push(normalized);
  });

  return {
    lab: summarizeQueueItems(grouped.lab, 'lab'),
    ultrasound: summarizeQueueItems(grouped.ultrasound, 'ultrasound'),
    xray: summarizeQueueItems(grouped.xray, 'xray'),
    medication: summarizeQueueItems(
      medications.map(item => item && typeof item === 'object' ? item : { name: clean(item) }),
      'medication'
    )
  };
}

export function normalizeOpdTestOrderSchedule(source = {}, fallbackTime = '') {
  const orderedAt = normalizeTimestamp(source.orderedAt) || normalizeTimestamp(fallbackTime) || new Date().toISOString();
  const scheduledAt = normalizeTimestamp(source.scheduledAt || source.scheduleAt || source.requestedAt) || orderedAt;
  const repeatSource = source.repeatScheduledAt || source.repeatTimes || source.additionalScheduledAt || [];
  const repeatScheduledAt = [...new Set((Array.isArray(repeatSource) ? repeatSource : [repeatSource])
    .map(normalizeTimestamp)
    .filter(value => value && value !== scheduledAt))]
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return { orderedAt, scheduledAt, repeatScheduledAt };
}

export function normalizeOpdTestDisposition(dispositionCode, dispositionNote = '') {
  const value = clean(dispositionCode);
  const canonicalCodes = new Set(['Home', 'Observe', 'Admit', 'Refer', 'LAMA']);
  const code = canonicalCodes.has(value) ? value : 'Other';
  return {
    code,
    note: clean(dispositionNote) || (code === 'Other' ? value : '')
  };
}

export function resolveOpdTestDisposition(dispositionCode, hasMedication = false, dispositionNote = '') {
  const normalized = normalizeOpdTestDisposition(dispositionCode, dispositionNote);
  const map = {
    Home: {
      mainStatus: hasMedication ? 'Pharmacy' : 'Completed',
      dischargeStatus: hasMedication ? 'ຮັບຢາກັບບ້ານ' : 'ກວດສຳເລັດ / ກັບບ້ານ'
    },
    Observe: { mainStatus: 'OPD Observation', dischargeStatus: 'ສົ່ງເຂົ້າຕິດຕາມ OPD' },
    Admit: { mainStatus: 'Admit IPD', dischargeStatus: 'ສົ່ງເຂົ້ານອນ IPD' },
    Refer: { mainStatus: 'Transfer', dischargeStatus: 'ສົ່ງຕໍ່ (Transfer)' },
    LAMA: { mainStatus: 'Completed', dischargeStatus: 'LAMA / ປະຕິເສດການຮັກສາ' }
  };
  const workflow = map[normalized.code] || {
    mainStatus: 'Completed',
    dischargeStatus: normalized.note || 'Other'
  };
  return { ...normalized, ...workflow };
}

export function normalizeOpdTestOrders(orders = [], context = {}) {
  const visitId = clean(context.visitId) || 'VISIT';
  const patientId = clean(context.patientId);
  const doctor = clean(context.doctor);
  const completedAt = clean(context.completedAt) || new Date().toISOString();
  const stamp = compactTimestamp(completedAt);

  return (Array.isArray(orders) ? orders : []).map((raw, index) => {
    const source = raw && typeof raw === 'object' ? raw : { name: clean(raw) };
    const investigationType = resolveOpdTestInvestigationType(source);
    const destinationSystem = clean(source.destinationSystem) || (investigationType === 'lab' ? 'LIS' : 'RIS');
    const schedule = normalizeOpdTestOrderSchedule(source, completedAt);
    const orderBatchId = clean(source.orderBatchId || source.batchId)
      || `OPD-${visitId}-${investigationType.toUpperCase()}-BATCH-${compactTimestamp(schedule.orderedAt)}`;
    const localOrderId = clean(source.localOrderId || source.orderNo)
      || `OPD-${visitId}-INV-${stamp}-${String(index + 1).padStart(3, '0')}`;
    const sourceOccurrences = Array.isArray(source.occurrences) ? source.occurrences : [];
    const occurrences = [schedule.scheduledAt, ...schedule.repeatScheduledAt].map((scheduledAt, occurrenceIndex) => {
      const previous = sourceOccurrences.find(item => normalizeTimestamp(item?.scheduledAt) === scheduledAt)
        || sourceOccurrences[occurrenceIndex]
        || {};
      return {
        ...previous,
        occurrenceId: clean(previous.occurrenceId) || `${localOrderId}-OCC-${String(occurrenceIndex + 1).padStart(3, '0')}`,
        sequence: occurrenceIndex + 1,
        scheduledAt,
        status: clean(previous.status) || 'planned'
      };
    });
    return {
      ...source,
      name: clean(source.name || raw),
      investigationType,
      orderType: investigationType,
      destinationSystem,
      localOrderId,
      orderNo: clean(source.orderNo) || localOrderId,
      orderBatchId,
      visitId,
      patientId,
      orderedBy: clean(source.orderedBy) || doctor,
      ...schedule,
      occurrences,
      status: clean(source.status) || 'ordered',
      lisStatus: investigationType === 'lab'
        ? (clean(source.lisStatus || source.status) || 'pending-lis')
        : (clean(source.lisStatus) || 'not-applicable'),
      risStatus: investigationType === 'lab'
        ? (clean(source.risStatus) || 'not-applicable')
        : (clean(source.risStatus || source.status) || 'pending-ris'),
      source: clean(source.source) || 'opd-test'
    };
  });
}

export function normalizeOpdTestMedications(medications = [], context = {}) {
  const visitId = clean(context.visitId) || 'VISIT';
  const patientId = clean(context.patientId);
  const doctor = clean(context.doctor);
  const completedAt = clean(context.completedAt) || new Date().toISOString();
  const stamp = compactTimestamp(completedAt);

  return (Array.isArray(medications) ? medications : []).map((raw, index) => {
    const source = raw && typeof raw === 'object' ? raw : { name: clean(raw) };
    const localMedicationId = clean(source.localMedicationId || source.prescriptionItemId)
      || `OPD-${visitId}-RX-${stamp}-${String(index + 1).padStart(3, '0')}`;
    return {
      ...source,
      name: clean(source.name || raw),
      localMedicationId,
      prescriptionItemId: clean(source.prescriptionItemId) || localMedicationId,
      visitId,
      patientId,
      prescribedBy: clean(source.prescribedBy) || doctor,
      prescribedAt: clean(source.prescribedAt) || completedAt,
      status: clean(source.status) || 'prescribed',
      allergyChecked: source.allergyChecked !== false,
      duplicateChecked: source.duplicateChecked !== false,
      source: clean(source.source) || 'opd-test'
    };
  });
}

export function buildOpdTestVisitPersistence(input = {}) {
  const completedAt = clean(input.completedAt) || new Date().toISOString();
  const visitId = clean(input.visitId);
  const patientId = clean(input.patientId);
  const doctor = clean(input.doctor);
  const diagnoses = (Array.isArray(input.diagnoses) ? input.diagnoses : [])
    .map(clean)
    .filter(Boolean);
  const orders = normalizeOpdTestOrders(input.orders, { visitId, patientId, doctor, completedAt });
  const medications = normalizeOpdTestMedications(input.medications, { visitId, patientId, doctor, completedAt });
  const disposition = resolveOpdTestDisposition(
    input.dispositionCode || input.disposition,
    medications.length > 0,
    input.dispositionNote
  );
  const revision = Math.max(1, Number.parseInt(input.revision, 10) || 1);
  const followUp = clean(input.followUp);
  const clinicalNote = {
    schema: 'opd-test-clinical-v2',
    revision,
    visitId,
    patientId,
    chiefComplaint: clean(input.chiefComplaint),
    hpi: clean(input.hpi),
    pastHistory: clean(input.pastHistory),
    physicalExam: clean(input.physicalExam),
    diagnoses,
    departmentKey: clean(input.departmentKey),
    department: clean(input.department),
    treatment: clean(input.treatment),
    advice: clean(input.advice),
    followUp,
    // Keep the original field for readers that still expect v1, while storing
    // workflow routing separately from the doctor's free-text summary.
    disposition: disposition.code === 'Other' ? disposition.note : disposition.code,
    dispositionCode: disposition.code,
    dispositionNote: disposition.note,
    dispositionDetails: input.dispositionDetails || {},
    orders,
    medications,
    completedAt,
    completedBy: doctor
  };

  const coreUpdate = {
    Status: disposition.mainStatus,
    Chief_Complaint: clinicalNote.chiefComplaint,
    Symptoms: clinicalNote.chiefComplaint,
    Diagnosis: diagnoses.join(', '),
    Treatment: clinicalNote.treatment,
    Prescription_JSON: medications.length ? JSON.stringify(medications) : '',
    Doctor_Name: doctor,
    Doctor: doctor,
    Physical_Exam: clinicalNote.physicalExam,
    Advice: clinicalNote.advice,
    Follow_Up: followUp,
    Follow_Up_Date: followUp,
    Lab_Orders_JSON: orders.length ? JSON.stringify(orders) : '',
    Discharge_Status: disposition.dischargeStatus
  };

  const enhancedUpdate = {
    ...coreUpdate,
    HPI: clinicalNote.hpi,
    Past_History: clinicalNote.pastHistory,
    Clinical_Note_JSON: JSON.stringify(clinicalNote),
    EMR_Revision: revision,
    Completed_At: completedAt,
    Completed_By: doctor,
    Updated_At: completedAt
  };

  return { visitId, patientId, doctor, completedAt, revision, disposition, orders, medications, clinicalNote, coreUpdate, enhancedUpdate };
}
