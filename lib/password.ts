import { randomBytes, pbkdf2Sync } from 'crypto';

const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

/**
 * Hash a password using PBKDF2 with a random salt
 * Returns a string in format: salt:hash
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    return false;
  }
  const verifyHash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');

  // Constant-time comparison to prevent timing attacks
  if (hash.length !== verifyHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ verifyHash.charCodeAt(i);
  }
  return result === 0;
}
