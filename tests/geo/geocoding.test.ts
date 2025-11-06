import { describe, it, expect } from "vitest";
import {
  isValidZipCode,
  normalizeZipCode,
  calculateDistance,
  calculateDistanceFromPoint,
} from "@/lib/geo/geocoding";

describe("geocoding utilities", () => {
  describe("isValidZipCode", () => {
    it("should validate 5-digit ZIP codes", () => {
      expect(isValidZipCode("94526")).toBe(true);
      expect(isValidZipCode("12345")).toBe(true);
    });

    it("should validate ZIP+4 format", () => {
      expect(isValidZipCode("94526-1234")).toBe(true);
    });

    it("should reject invalid formats", () => {
      expect(isValidZipCode("1234")).toBe(false); // Too short
      expect(isValidZipCode("123456")).toBe(false); // Too long
      expect(isValidZipCode("abcde")).toBe(false); // Not numeric
      expect(isValidZipCode("")).toBe(false); // Empty
      expect(isValidZipCode(123 as any)).toBe(false); // Not a string
    });
  });

  describe("normalizeZipCode", () => {
    it("should extract 5-digit ZIP from ZIP+4", () => {
      expect(normalizeZipCode("94526-1234")).toBe("94526");
    });

    it("should preserve 5-digit ZIP codes", () => {
      expect(normalizeZipCode("94526")).toBe("94526");
    });

    it("should trim whitespace", () => {
      expect(normalizeZipCode(" 94526 ")).toBe("94526");
    });
  });

  describe("calculateDistance", () => {
    it("should calculate distance between two coordinates", () => {
      // Danville, CA to San Francisco, CA (approximately 24 miles)
      const danville = { lat: 37.8111, lon: -121.9841 };
      const sanFrancisco = { lat: 37.7749, lon: -122.4194 };

      const distance = calculateDistance(danville, sanFrancisco);

      // Allow for some tolerance due to haversine approximation
      expect(distance).toBeGreaterThan(20);
      expect(distance).toBeLessThan(30);
    });

    it("should return 0 for identical coordinates", () => {
      const coord = { lat: 37.8111, lon: -121.9841 };
      const distance = calculateDistance(coord, coord);

      expect(distance).toBeCloseTo(0, 1);
    });

    it("should handle coordinates across the equator", () => {
      const north = { lat: 10, lon: 0 };
      const south = { lat: -10, lon: 0 };

      const distance = calculateDistance(north, south);

      // Approximately 20 degrees of latitude = ~1380 miles
      expect(distance).toBeGreaterThan(1300);
      expect(distance).toBeLessThan(1500);
    });
  });

  describe("calculateDistanceFromPoint", () => {
    it("should calculate distance from a given point", () => {
      // Reference point: Danville, CA
      const danville = { lat: 37.8111, lon: -121.9841 };
      // San Ramon, CA (neighboring city)
      const sanRamon = { lat: 37.7799, lon: -121.9780 };

      const distance = calculateDistanceFromPoint(danville, sanRamon);

      // Should be roughly 2-3 miles
      expect(distance).toBeGreaterThan(1);
      expect(distance).toBeLessThan(5);
    });

    it("should return 0 for identical coordinates", () => {
      const coord = { lat: 37.8111, lon: -121.9841 };
      const distance = calculateDistanceFromPoint(coord, coord);

      expect(distance).toBeCloseTo(0, 1);
    });
  });
});
