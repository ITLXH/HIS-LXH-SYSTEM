export function countDashboardIpdAdmissions(admissions, startDate, endDate, shift = 'all') {
  return admissions.filter(admission => {
    const admitted = String(admission.Admission_Date || '').slice(0, 10);
    const discharged = String(admission.Discharge_Date || '').slice(0, 10);
    const status = String(admission.Status || '').trim().toLowerCase();
    if (!admission.Admission_ID || !admitted || ['cancelled', 'canceled'].includes(status)) return false;
    // shortcut: closed legacy rows without a discharge date or movement count only on admission day; backfill when a reliable discharge record exists.
    const lastDay = discharged || (['discharged', 'discharge', 'closed', 'transferred out'].includes(status) ? admitted : endDate);
    if (admitted > endDate || lastDay < startDate) return false;
    if (shift === 'all') return true;

    const admitAt = `${admitted}T${String(admission.Admission_Time || '00:00').slice(0, 5)}`;
    const dischargeAt = `${lastDay}T${String(admission.Discharge_Time || '23:59').slice(0, 5)}`;
    const day = new Date(`${admitted > startDate ? admitted : startDate}T00:00:00Z`);
    const finalDay = new Date(`${lastDay < endDate ? lastDay : endDate}T00:00:00Z`);
    for (; day <= finalDay; day.setUTCDate(day.getUTCDate() + 1)) {
      const key = day.toISOString().slice(0, 10);
      const slots = shift === 'morning' ? [['08:00', '16:00']]
        : shift === 'evening' ? [['16:00', '21:00']]
          : [['00:00', '08:00'], ['21:00', '23:59']];
      if (slots.some(([from, to]) => admitAt <= `${key}T${to}` && dischargeAt >= `${key}T${from}`)) return true;
    }
    return false;
  }).length;
}

export function applyDashboardDischargeMovements(admissions, movements, dateKey, timeKey) {
  const byId = new Map(admissions.filter(a => !a.Discharge_Date).map(a => [a.Admission_ID, a]));
  for (const movement of movements) {
    const admission = byId.get(movement.IPD_Admission_ID);
    if (!admission || !movement.Movement_Datetime) continue;
    const date = dateKey(movement.Movement_Datetime);
    if (!admission.Discharge_Date || date < admission.Discharge_Date) {
      admission.Discharge_Date = date;
      admission.Discharge_Time = timeKey(movement.Movement_Datetime);
    }
  }
  return admissions;
}
