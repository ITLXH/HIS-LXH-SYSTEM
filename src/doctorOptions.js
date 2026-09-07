function cleanDoctorName(value) {
  return String(value ?? '').trim();
}

export function mergeDoctorOptions(masterDataDoctors = [], doctorUsers = []) {
  const masterNames = masterDataDoctors.map(entry =>
    cleanDoctorName(typeof entry === 'string' ? entry : entry?.value)
  );
  const userNames = doctorUsers.map(cleanDoctorName);

  return [...new Set([...masterNames, ...userNames].filter(Boolean))];
}
