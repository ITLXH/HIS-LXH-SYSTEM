// Physical print verified by the user on XP-420B, 2026-09-14.
// Keep independent of general printer settings and other documents' @page rules.
export const PATIENT_STICKER_PAPER = Object.freeze({ width: 70, height: 100 });
export const PATIENT_STICKER_PRINT_CSS = `@media print {
  @page { size: 70mm 100mm; margin: 0; }
  html, body, #partial-prints { width: 70mm !important; min-width: 70mm !important; max-width: 70mm !important; height: 100mm !important; min-height: 100mm !important; max-height: 100mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
  #partial-prints { position: relative !important; }
}`;

export function preparePatientStickerPrint(containerId) {
  finishPatientStickerPrint();
  if (containerId !== 'print-area') return;
  const style = document.createElement('style');
  style.id = 'patient-sticker-page-rule';
  style.textContent = PATIENT_STICKER_PRINT_CSS;
  document.head.appendChild(style);
}

export function finishPatientStickerPrint() {
  document.getElementById('patient-sticker-page-rule')?.remove();
}
