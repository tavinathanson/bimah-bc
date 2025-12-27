import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, recordFailedAttempt, clearAttempts } from "../lib/rate-limit";

describe("Rate Limiter", () => {
  beforeEach(() => {
    // Clear state between tests
    clearAttempts("test-key");
    clearAttempts("other-key");
  });

  it("should allow first attempt", () => {
    const result = checkRateLimit("test-key");
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it("should allow attempts under the limit", () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt("test-key");
    }
    const result = checkRateLimit("test-key");
    expect(result.allowed).toBe(true);
  });

  it("should block after 5 failed attempts", () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt("test-key");
    }
    const result = checkRateLimit("test-key");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("should track keys independently", () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt("blocked-key");
    }
    expect(checkRateLimit("blocked-key").allowed).toBe(false);
    expect(checkRateLimit("other-key").allowed).toBe(true);
  });

  it("should clear attempts on success", () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt("test-key");
    }
    clearAttempts("test-key");

    // Should be able to fail 4 more times
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt("test-key");
    }
    expect(checkRateLimit("test-key").allowed).toBe(true);
  });

  it("should reset after lockout expires", () => {
    vi.useFakeTimers();

    for (let i = 0; i < 5; i++) {
      recordFailedAttempt("test-key");
    }
    expect(checkRateLimit("test-key").allowed).toBe(false);

    // Advance time past lockout (15 minutes)
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    expect(checkRateLimit("test-key").allowed).toBe(true);

    vi.useRealTimers();
  });

  it("should return correct retryAfter value", () => {
    vi.useFakeTimers();

    for (let i = 0; i < 5; i++) {
      recordFailedAttempt("test-key");
    }

    const result = checkRateLimit("test-key");
    expect(result.retryAfter).toBe(15 * 60); // 15 minutes in seconds

    // Advance 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000);

    const result2 = checkRateLimit("test-key");
    expect(result2.retryAfter).toBe(10 * 60); // 10 minutes remaining

    vi.useRealTimers();
  });
});
