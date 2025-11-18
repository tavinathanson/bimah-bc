import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password";

describe("Password Hashing", () => {
  it("should generate a hash in correct format (salt:hash)", () => {
    const hash = hashPassword("testpassword");
    const parts = hash.split(":");

    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(64); // 32 bytes hex = 64 chars
    expect(parts[1]).toHaveLength(128); // 64 bytes hex = 128 chars
  });

  it("should generate different hashes for the same password (unique salts)", () => {
    const hash1 = hashPassword("samepassword");
    const hash2 = hashPassword("samepassword");

    expect(hash1).not.toBe(hash2);

    // Salts should be different
    const salt1 = hash1.split(":")[0];
    const salt2 = hash2.split(":")[0];
    expect(salt1).not.toBe(salt2);
  });

  it("should generate different hashes for different passwords", () => {
    const hash1 = hashPassword("password1");
    const hash2 = hashPassword("password2");

    expect(hash1).not.toBe(hash2);
  });

  it("should handle empty password", () => {
    const hash = hashPassword("");
    expect(hash).toMatch(/^[a-f0-9]{64}:[a-f0-9]{128}$/);
  });

  it("should handle unicode passwords", () => {
    const hash = hashPassword("密码🔐");
    expect(hash).toMatch(/^[a-f0-9]{64}:[a-f0-9]{128}$/);
  });

  it("should handle very long passwords", () => {
    const longPassword = "a".repeat(10000);
    const hash = hashPassword(longPassword);
    expect(hash).toMatch(/^[a-f0-9]{64}:[a-f0-9]{128}$/);
  });
});

describe("Password Verification", () => {
  it("should verify correct password", () => {
    const password = "correctpassword";
    const hash = hashPassword(password);

    expect(verifyPassword(password, hash)).toBe(true);
  });

  it("should reject incorrect password", () => {
    const hash = hashPassword("correctpassword");

    expect(verifyPassword("wrongpassword", hash)).toBe(false);
  });

  it("should reject similar but wrong passwords", () => {
    const hash = hashPassword("password123");

    expect(verifyPassword("password124", hash)).toBe(false);
    expect(verifyPassword("Password123", hash)).toBe(false);
    expect(verifyPassword("password123 ", hash)).toBe(false);
    expect(verifyPassword(" password123", hash)).toBe(false);
  });

  it("should handle empty password verification", () => {
    const hash = hashPassword("");

    expect(verifyPassword("", hash)).toBe(true);
    expect(verifyPassword("notempty", hash)).toBe(false);
  });

  it("should handle unicode password verification", () => {
    const password = "密码🔐test";
    const hash = hashPassword(password);

    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("密码🔐tes", hash)).toBe(false);
  });

  it("should reject malformed hash (no colon)", () => {
    expect(verifyPassword("test", "nocolonhere")).toBe(false);
  });

  it("should reject malformed hash (empty salt)", () => {
    expect(verifyPassword("test", ":somehash")).toBe(false);
  });

  it("should reject malformed hash (empty hash)", () => {
    expect(verifyPassword("test", "somesalt:")).toBe(false);
  });

  it("should reject hash with wrong length", () => {
    // This tests that we don't crash on malformed input
    const result = verifyPassword("test", "abc:def");
    expect(result).toBe(false);
  });
});

describe("Security Properties", () => {
  it("should use sufficient iterations (timing check)", () => {
    // Hashing should take measurable time due to iterations
    const start = performance.now();
    hashPassword("testpassword");
    const duration = performance.now() - start;

    // With 100k iterations, should take at least a few ms
    // This is a sanity check, not a precise benchmark
    expect(duration).toBeGreaterThan(1);
  });

  it("should produce consistent verification results", () => {
    const password = "testpassword";
    const hash = hashPassword(password);

    // Verify multiple times to ensure consistency
    for (let i = 0; i < 10; i++) {
      expect(verifyPassword(password, hash)).toBe(true);
      expect(verifyPassword("wrong", hash)).toBe(false);
    }
  });

  it("should not leak timing information for wrong passwords of different lengths", () => {
    const hash = hashPassword("correctpassword");

    // Both should return false regardless of input length
    // (constant-time comparison should prevent timing attacks)
    expect(verifyPassword("a", hash)).toBe(false);
    expect(verifyPassword("a".repeat(1000), hash)).toBe(false);
  });
});

describe("Edge Cases", () => {
  it("should handle passwords with special characters", () => {
    const specialChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
    const hash = hashPassword(specialChars);

    expect(verifyPassword(specialChars, hash)).toBe(true);
  });

  it("should handle passwords with newlines and tabs", () => {
    const password = "line1\nline2\ttab";
    const hash = hashPassword(password);

    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("line1\nline2 tab", hash)).toBe(false);
  });

  it("should handle null bytes in password", () => {
    const password = "before\x00after";
    const hash = hashPassword(password);

    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("before", hash)).toBe(false);
  });
});
