import assert from 'node:assert/strict';
import {
  HIS_AUTH_SESSION_TTL_MS,
  HIS_AUTH_SESSION_VERSION,
  createHisAuthSessionRecord,
  validateHisAuthSessionRecord,
} from '../src/authSession.js';

const now = Date.UTC(2026, 8, 9, 0, 0, 0);
const user = { id: 7, name: 'Session Test' };
const record = createHisAuthSessionRecord(user, { now });

assert.equal(record.sessionVersion, HIS_AUTH_SESSION_VERSION);
assert.equal(record.expiresAt, now + HIS_AUTH_SESSION_TTL_MS);
assert.deepEqual(validateHisAuthSessionRecord(record, now + 1), {
  valid: true,
  expiresAt: record.expiresAt,
  user,
});
assert.deepEqual(validateHisAuthSessionRecord(record, record.expiresAt), {
  valid: false,
  reason: 'expired',
});
assert.equal(validateHisAuthSessionRecord({ ...record, sessionVersion: 'old-release' }, now).reason, 'version');
assert.equal(validateHisAuthSessionRecord({ user, expiresAt: record.expiresAt }, now).reason, 'version');

const preserved = createHisAuthSessionRecord(user, { now: now + 5_000, expiresAt: record.expiresAt });
assert.equal(preserved.expiresAt, record.expiresAt);

console.log('Auth session release and expiry policy checks passed.');
