export function countDashboardIpdAdmissions(admissions, shift, getShift) {
  return admissions.filter(admission => {
    if (!admission.Admission_ID) return false;
    if (shift === 'all') return true;
    const time = String(admission.Admission_Time || '').trim();
    return time && getShift(`${admission.Admission_Date}T${time}`) === shift;
  }).length;
}
