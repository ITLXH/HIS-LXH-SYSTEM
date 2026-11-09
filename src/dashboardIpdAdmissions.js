export function countDashboardIpdAdmissions(admissions, startDate, endDate, shift = 'all') {
  return admissions.filter(admission => {
    const admitted = String(admission.Admission_Date || '').slice(0, 10);
    const discharged = String(admission.Discharge_Date || '').slice(0, 10);
    const status = String(admission.Status || '').trim().toLowerCase();
    if (!admission.Admission_ID || !admitted || ['cancelled', 'canceled'].includes(status)) return false;
    const lastDay = discharged || (['discharged', 'discharge', 'closed', 'transferred out'].includes(status) ? admitted : endDate);
    if (admitted > endDate || lastDay < startDate) return false;
    if (shift === 'all') return true;

    const admitAt = `${admitted}T${String(admission.Admission_Time || '00:00').slice(0, 5)}`;
    const dischargeAt = `${lastDay}T${String(admission.Discharge_Time || '23:59').slice(0, 5)}`;
    const day = new Date(`${startDate}T00:00:00Z`);
    const finalDay = new Date(`${endDate}T00:00:00Z`);
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
