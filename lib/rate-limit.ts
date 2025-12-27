// Simple in-memory rate limiter with lockout
const attempts = new Map<string, { count: number; lockedUntil: number }>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = attempts.get(key);

  if (record?.lockedUntil && record.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) };
  }

  return { allowed: true };
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const record = attempts.get(key) ?? { count: 0, lockedUntil: 0 };

  // Reset if lockout expired
  if (record.lockedUntil && record.lockedUntil < now) {
    record.count = 0;
    record.lockedUntil = 0;
  }

  record.count++;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
  }
  attempts.set(key, record);
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}
