# Verified patient sticker printing

User confirmed successful physical printing on 2026-09-14 with Xprinter XP-420B.

- One physical sheet: **70 mm wide × 100 mm feed length**, portrait.
- Three cards on that sheet, each **66 × 31 mm**; gap **2 mm**; top inset **2 mm**.
- Driver custom stock: **2.756 × 3.937 inches** (70 × 100 mm).
- Browser: actual size / 100%, one page per sheet, no margins, no headers/footers.
- Phone remains visible. Full patient name stays on one line with measured font fitting.

Implementation: patientStickerPrint.js installs the fixed page rule last, only for
print-area, and removes it after printing. style.css scopes card geometry to
#print-area.print-active. patientStickerName.js measures the same card inner width.
Do not apply general printer profile scaling, A4/roster rules, or other document
font sizes to this print target. Do not alter these dimensions without a new
physical measurement and user approval. Browser preview alone is not proof of
physical output. Avoid repeated paper tests.

Run `node scripts/test-patient-sticker.mjs` and
`node scripts/test-sticker-name.mjs` before changing this layout.
