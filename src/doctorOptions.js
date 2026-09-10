function cleanDoctorName(value) {
  return String(value ?? '').trim();
}

const HIDDEN_DOCTOR_OPTIONS = new Set(['opd doctor']);

export function isHiddenDoctorOption(value) {
  return HIDDEN_DOCTOR_OPTIONS.has(cleanDoctorName(value).toLowerCase());
}

export function mergeDoctorOptions(masterDataDoctors = [], doctorUsers = []) {
  const masterNames = masterDataDoctors.map(entry =>
    cleanDoctorName(typeof entry === 'string' ? entry : entry?.value)
  );
  const userNames = doctorUsers.map(cleanDoctorName);

  return [...new Set([...masterNames, ...userNames].filter(name => name && !isHiddenDoctorOption(name)))];
}
