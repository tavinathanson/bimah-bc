import { nanoid } from 'nanoid';

/**
 * Generate a cryptographically secure, URL-safe report ID
 *
 * - 21 characters = 128 bits of entropy
 * - URL-safe alphabet (A-Za-z0-9_-)
 * - Collision probability: ~1 in 10^38
 * - Not guessable by brute force
 * - Not crawlable by search engines
 *
 * Example: "xK9mP2qR8tBvN5hZ7wLcJ"
 */
export function generateReportId(): string {
  return nanoid(21);
}
