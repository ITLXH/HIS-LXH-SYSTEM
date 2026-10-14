# Safe repair, phase 2 — Release reload — 2026-10-14

Phase 1 commit b56b63a fixed Organizations and passed all 21 registered checks/build. Objective: retain clinical editing and pending HTTP writes when a new release is detected; require fresh app login only when it is safe. Current production source 7f0cddc invalidates auth before unsaved-work checks and forces reload.

Plan: port the previously synthetic-tested watcher without overwriting current production feature code; remove forceReload, await beforeReload, track mutating Supabase HTTP requests, defer hidden/offline/editing/pending writes, cancel late responses and bypass service-worker manifest caching. Track actual HIS view containers as well as forms/modals. Keep failed writes/drafts and all database permissions untouched.

Test plan: actual network-wrapper mutation counter with synthetic fetch, existing watcher tests, real-DOM local synthetic fixture, all current regressions/build. No clinical live CRUD. Source-only review branch; no main merge or deploy. Rollback is reverting this phase commit and retaining phase 1; preserve clinical data and local drafts.

Additional edge cases: hidden dialogs do not block safe refresh indefinitely; visible dialogs and inline HIS view edits do. Two concurrent mutation requests retain busy state until both settle. Counters track HTTP request lifetime and do not replace clinical transactional persistence guarantees. No clinical payload logged.

Validation complete: all 22 registered HIS test commands passed; final watcher/write-counter edge tests and npm run build passed after review. Real-DOM synthetic browser: active draft deferred reload with 0 auth invalidations; after confirm save/close, exactly 1 invalidation/reload and draft retained. Existing bundle-size warning only. No live staff UAT, clinical writes, deletion, schema/policy changes or deployment.

## Verified commit/push and next gates
Phase 1 implementation: b56b63a55d2c5f8914efce7a133404541c7efee0. Phase 2 implementation: c649edeb8c4580f3acb248508a69c63869ef2474. Both pushed to origin/codex/his-safe-incremental-20261014; remote branch SHA matched c649ede. Remote main remained 7f0cddcae9e880b545bb74d514f0cc07c509efa9 at the push check. No main merge or production deployment.

Rollback source phase 2 independently if needed while retaining phase 1; preserve all clinical records/drafts. Clinical rollback never means restoring an old database over newer records. Remaining stages: patient search profiling under JWT/RLS; staged vitals additive table; OutLab currency and transactional edit preservation; authenticated HIS/LIS/UXI integration before anonymous-policy cutover. Existing prior SQL candidates and LIS review fixes are not live repairs. No isolated staging has been verified, so clinical CRUD/security cutover and production promotion remain blocked by that concrete environment gate.
