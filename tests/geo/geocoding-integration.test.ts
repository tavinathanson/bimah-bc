import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { geocodeZipCode } from "@/lib/geo/geocoding";

// Mock ZIP code data (realistic Central NJ coordinates)
const mockZipData: Record<string, { lat: string; lon: string }> = {
  "08550": { lat: "40.2968", lon: "-74.6549" }, // Princeton Junction
  "08540": { lat: "40.3487", lon: "-74.6593" }, // Princeton
  "08536": { lat: "40.3298", lon: "-74.5298" }, // Plainsboro
  "08520": { lat: "40.2298", lon: "-74.5298" }, // Hightstown
  "08691": { lat: "40.2198", lon: "-74.6098" }, // Robbinsville
};

// Create mock fetch response
function createMockResponse(zip: string) {
  const data = mockZipData[zip];
  if (!data) {
    return new Response(null, { status: 404 });
  }
  return new Response(JSON.stringify({
    "post code": zip,
    country: "United States",
    places: [{
      "place name": "Test City",
      state: "New Jersey",
      latitude: data.lat,
      longitude: data.lon,
    }],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("geocoding integration", () => {
  beforeEach(() => {
    // Mock fetch to return our test data
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const urlStr = url.toString();
      const zipMatch = urlStr.match(/\/us\/(\d{5})$/);
      const zip = zipMatch ? zipMatch[1] : "";
      return createMockResponse(zip);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      expect(result?.source).toBe("api");
    }
  });

  it("should return null for unknown ZIP codes", async () => {
    const result = await geocodeZipCode("99999");
    expect(result).toBeNull();
  });

  it("should handle API errors gracefully", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));
    // Use a ZIP that wasn't cached in previous tests
    const result = await geocodeZipCode("12345");
    expect(result).toBeNull();
  });
});
