export function dashboardServiceDepartmentsForVisit(visit, lookup) {
  if (String(visit.Visit_Type || visit.VisitType || '').trim().toUpperCase() === 'IPD') {
    const ipd = lookup.get('ipd');
    return ipd ? [ipd] : [];
  }
  const specialist = visit.Mapped_Specialist || visit.MappedSpecialist || visit.Specialist || '';
  return String(specialist).split(',').map(value => lookup.get(value.trim().toLowerCase())).filter(Boolean);
}
