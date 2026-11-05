export function medicationDirectionOptions(entries) {
  return [...new Set((Array.isArray(entries) ? entries : [])
    .map(entry => typeof entry?.value === 'string' ? entry.value.trim() : '')
    .filter(value => value && value.length <= 1000))];
}
