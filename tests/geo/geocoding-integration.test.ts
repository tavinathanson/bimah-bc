import { describe, it, expect } from "vitest";
import { geocodeZipCode } from "@/lib/geo/geocoding";

describe("geocoding integration", () => {
  it("should geocode Central NJ ZIP codes from API", async () => {
    const testZips = ["08550", "08540", "08536", "08520", "08691"];

    for (const zip of testZips) {
      const result = await geocodeZipCode(zip);
      expect(result).toBeDefined();
      expect(result?.zip).toBe(zip);
      expect(result?.lat).toBeGreaterThan(39);
      expect(result?.lat).toBeLessThan(41);
      expect(result?.lon).toBeLessThan(-74);
      expect(result?.lon).toBeGreaterThan(-75);
      expect(result?.source).toMatch(/^(api|cache)$/); // From API or cache
    }
  }, 15000); // Increase timeout for API calls
});
