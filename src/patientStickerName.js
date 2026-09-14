// Measure the shaped Lao text, including combining marks, instead of counting
// characters. Keep the full name; only reduce its font when space requires it.
export function fittingNameSize(baseSize, availableWidth, measure) {
  if (measure(baseSize) <= availableWidth) return baseSize;
  let low = 0;
  let high = baseSize;
  for (let i = 0; i < 24; i++) {
    const middle = (low + high) / 2;
    if (measure(middle) <= availableWidth) low = middle;
    else high = middle;
  }
  return Math.floor(low * 1000) / 1000;
}

export async function fitPatientStickerNames(container) {
  if (!container) return;
  const names = [...container.querySelectorAll('.pcard-name')];
  await Promise.all(names.map(name => {
    const family = getComputedStyle(name).fontFamily;
    return Promise.all([
      document.fonts.load(`800 14px ${family}`, name.textContent || 'ຊື່'),
      document.fonts.load(`500 11.9px ${family}`, 'ຊື່ ແລະ ນາມສະກຸນ:')
    ]);
  }));
  await document.fonts.ready;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:fixed;left:-10000px;top:0;display:inline-block;white-space:pre;visibility:hidden;padding:0;border:0;letter-spacing:normal;';
  document.body.appendChild(probe);
  try {
    for (const name of names) {
      const card = name.closest('.patient-card');
      const label = name.parentElement.querySelector('.pcard-label');
      const insured = card.classList.contains('has-payer');
      probe.style.fontFamily = getComputedStyle(name).fontFamily;
      probe.style.fontWeight = '500';
      probe.style.fontSize = `${insured ? 11.9 : 11.2}px`;
      probe.textContent = label?.textContent || '';
      const labelWidth = probe.getBoundingClientRect().width;
      // 66mm border-box card, 1.6mm padding each side, two 1.4px borders,
      // 1.4px flex gap and 1px safety allowance for print rounding.
      const available = (66 - 3.2) * 96 / 25.4 - 2.8 - 1.4 - labelWidth - 1;
      probe.style.fontWeight = '800';
      probe.textContent = name.textContent;
      const size = fittingNameSize(insured ? 13.3 : 14, Math.max(1, available), value => {
        probe.style.fontSize = `${value}px`;
        return probe.getBoundingClientRect().width;
      });
      name.style.setProperty('--sticker-name-size', `${size}px`);
    }
  } finally {
    probe.remove();
  }
}
