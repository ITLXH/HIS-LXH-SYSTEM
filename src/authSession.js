import { HIS_BUILD_ID } from './versionRefresh.js';

export const HIS_AUTH_SESSION_KEY = 'his_current_user_session';
export const HIS_AUTH_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

// Every production build uses its commit SHA, so a newly deployed commit
// invalidates all application sessions created by the previous release.
export const HIS_AUTH_SESSION_VERSION = HIS_BUILD_ID;

export function createHisAuthSessionRecord(user, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const requestedExpiry = Number(options.expiresAt);
  const expiresAt = Number.isFinite(requestedExpiry) && requestedExpiry > now
    ? requestedExpiry
    : now + HIS_AUTH_SESSION_TTL_MS;

  return {
    user,
    savedAt: now,
    expiresAt,
    sessionVersion: HIS_AUTH_SESSION_VERSION,
  };
}

export function validateHisAuthSessionRecord(record, now = Date.now()) {
  if (!record || typeof record !== 'object') return { valid: false, reason: 'missing' };
  if (record.sessionVersion !== HIS_AUTH_SESSION_VERSION) return { valid: false, reason: 'version' };

  const expiresAt = Number(record.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return { valid: false, reason: 'expired' };
  if (!record.user || typeof record.user !== 'object') return { valid: false, reason: 'user' };

  return { valid: true, expiresAt, user: record.user };
}
