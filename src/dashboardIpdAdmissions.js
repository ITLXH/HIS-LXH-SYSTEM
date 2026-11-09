export function countDashboardIpdAdmissions(admissions, startDate, endDate, shift = 'all', getShift) {
  return admissions.filter(admission => {
    const admitted = String(admission.Admission_Date || '').slice(0, 10);
    const status = String(admission.Status || '').trim().toLowerCase();
    if (!admission.Admission_ID || admitted < startDate || admitted > endDate || ['cancelled', 'canceled'].includes(status)) return false;
    if (shift === 'all') return true;
    const time = String(admission.Admission_Time || '').trim();
    return time && getShift(`${admitted}T${time}`) === shift;
  }).length;
}
