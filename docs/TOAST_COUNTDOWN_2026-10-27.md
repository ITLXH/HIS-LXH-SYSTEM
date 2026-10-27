# Toast countdown — 2026-10-27

OPD arrival and LIS result toasts now display a full-width bottom progress bar that shrinks over five seconds. Existing timers dismiss both toast types after five seconds. OPD uses hospital blue, LIS green, critical LIS red. Manual dismissal, duplicate suppression, active-session guards and persistent result acknowledgments are unchanged. No data/schema changes.

Validation: synthetic Chromium checks verified full/half progress, removal at five seconds for both toast types, and anonymous suppression. test:auth, test:security and Vite build into tmp/toast-countdown-check passed. Existing large-chunk build warning remains.
