import { describe, it, expect } from "vitest";
import type { PledgeRow } from "@/lib/schema/types";
import type { DistanceBin } from "@/lib/geo/aggregation";
import {
  hasZipCodeData,
  aggregateByZipCode,
  calculateDistanceHistogram,
  sortZipAggregates,
} from "@/lib/geo/aggregation";

// Test distance bins
const TEST_DISTANCE_BINS: DistanceBin[] = [
  { label: "0-2 mi", min: 0, max: 2 },
  { label: "2-5 mi", min: 2, max: 5 },
  { label: "5-10 mi", min: 5, max: 10 },
  { label: "10-20 mi", min: 10, max: 20 },
  { label: "20+ mi", min: 20, max: Infinity },
];

const mockPledgeRows: PledgeRow[] = [
  {
    age: 45,
    pledgeCurrent: 3000,
    pledgePrior: 2500,
    zipCode: "94526",
    householdKey: "hh_001",
    status: "renewed",
    changeDollar: 500,
    changePercent: 0.2,
  },
  {
    age: 52,
    pledgeCurrent: 4000,
    pledgePrior: 4000,
    zipCode: "94526",
    householdKey: "hh_002",
    status: "renewed",
    changeDollar: 0,
    changePercent: 0,
  },
  {
    age: 38,
    pledgeCurrent: 2000,
    pledgePrior: 0,
    zipCode: "94582",
    householdKey: "hh_003",
    status: "current-only",
    changeDollar: 2000,
    changePercent: null,
  },
  {
    age: 65,
    pledgeCurrent: 5000,
    pledgePrior: 5500,
    zipCode: "94582",
    householdKey: "hh_004",
    status: "renewed",
    changeDollar: -500,
    changePercent: -0.091,
  },
  {
    age: 42,
    pledgeCurrent: 1500,
    pledgePrior: 1500,
    householdKey: "hh_005",
    status: "renewed",
    changeDollar: 0,
    changePercent: 0,
  },
];

describe("geo aggregation", () => {
  describe("hasZipCodeData", () => {
    it("should return true when rows have ZIP codes", () => {
      expect(hasZipCodeData(mockPledgeRows)).toBe(true);
    });

    it("should return false when no rows have ZIP codes", () => {
      const noZipRows = mockPledgeRows.map((row) => ({ ...row, zipCode: undefined }));
      expect(hasZipCodeData(noZipRows)).toBe(false);
    });

    it("should return true if at least one row has a ZIP code", () => {
      const mixedRows = [
        { ...mockPledgeRows[0]! },
        { ...mockPledgeRows[1]!, zipCode: undefined },
      ];
      expect(hasZipCodeData(mixedRows)).toBe(true);
    });
  });

  describe("aggregateByZipCode", () => {
    it("should aggregate by ZIP code", () => {
      const aggregates = aggregateByZipCode(mockPledgeRows);

      expect(aggregates).toHaveLength(2); // 94526 and 94582

      const zip94526 = aggregates.find((agg) => agg.zip === "94526");
      expect(zip94526).toBeDefined();
      expect(zip94526?.households).toBe(2);
      expect(zip94526?.totalPledgeCurrent).toBe(7000); // 3000 + 4000
      expect(zip94526?.totalPledgePrior).toBe(6500); // 2500 + 4000
      expect(zip94526?.avgPledge).toBe(3500); // 7000 / 2
      expect(zip94526?.deltaDollar).toBe(500); // 7000 - 6500
      expect(zip94526?.deltaPercent).toBeCloseTo(0.077, 2); // 500 / 6500

      const zip94582 = aggregates.find((agg) => agg.zip === "94582");
      expect(zip94582).toBeDefined();
      expect(zip94582?.households).toBe(2);
      expect(zip94582?.totalPledgeCurrent).toBe(7000); // 2000 + 5000
      expect(zip94582?.totalPledgePrior).toBe(5500); // 0 + 5500
      expect(zip94582?.avgPledge).toBe(3500);
    });

    it("should exclude rows without ZIP codes", () => {
      const aggregates = aggregateByZipCode(mockPledgeRows);

      // Row with householdKey "hh_005" has no zipCode, should be excluded
      const totalHouseholds = aggregates.reduce((sum, agg) => sum + agg.households, 0);
      expect(totalHouseholds).toBe(4); // Not 5
    });

    it("should handle deltaPercent as 'n/a' when prior is 0", () => {
      const rows: PledgeRow[] = [
        {
          age: 30,
          pledgeCurrent: 1000,
          pledgePrior: 0,
          zipCode: "12345",
          householdKey: "hh_test",
          status: "current-only",
          changeDollar: 1000,
          changePercent: null,
        },
      ];

      const aggregates = aggregateByZipCode(rows);
      expect(aggregates[0]?.deltaPercent).toBe("n/a");
    });
  });

  describe("calculateDistanceHistogram", () => {
    it("should create histogram bins by households", () => {
      const aggregates = [
        {
          zip: "94526",
          households: 10,
          totalPledgeCurrent: 10000,
          totalPledgePrior: 9000,
          avgPledge: 1000,
          deltaDollar: 1000,
          deltaPercent: 0.111,
          distanceMiles: 1.5,
        },
        {
          zip: "94582",
          households: 5,
          totalPledgeCurrent: 5000,
          totalPledgePrior: 4500,
          avgPledge: 1000,
          deltaDollar: 500,
          deltaPercent: 0.111,
          distanceMiles: 3.0,
        },
        {
          zip: "94550",
          households: 8,
          totalPledgeCurrent: 8000,
          totalPledgePrior: 7000,
          avgPledge: 1000,
          deltaDollar: 1000,
          deltaPercent: 0.143,
          distanceMiles: 15.0,
        },
      ];

      const histogram = calculateDistanceHistogram(aggregates, TEST_DISTANCE_BINS, "households");

      // Check that bins are created correctly
      expect(histogram).toHaveLength(TEST_DISTANCE_BINS.length);

      // 0-2 mi should have 10 households
      expect(histogram[0]?.households).toBe(10);

      // 2-5 mi should have 5 households
      expect(histogram[1]?.households).toBe(5);

      // 10-20 mi should have 8 households
      expect(histogram[3]?.households).toBe(8);
    });

    it("should create histogram bins by total pledge", () => {
      const aggregates = [
        {
          zip: "94526",
          households: 10,
          totalPledgeCurrent: 10000,
          totalPledgePrior: 9000,
          avgPledge: 1000,
          deltaDollar: 1000,
          deltaPercent: 0.111,
          distanceMiles: 1.5,
        },
      ];

      const histogram = calculateDistanceHistogram(aggregates, TEST_DISTANCE_BINS, "totalPledge");

      expect(histogram[0]?.totalPledge).toBe(10000);
    });
  });

  describe("sortZipAggregates", () => {
    it("should sort by ZIP code ascending", () => {
      const aggregates = aggregateByZipCode(mockPledgeRows);
      const sorted = sortZipAggregates(aggregates, "zip", "asc");

      expect(sorted[0]?.zip).toBe("94526");
      expect(sorted[1]?.zip).toBe("94582");
    });

    it("should sort by ZIP code descending", () => {
      const aggregates = aggregateByZipCode(mockPledgeRows);
      const sorted = sortZipAggregates(aggregates, "zip", "desc");

      expect(sorted[0]?.zip).toBe("94582");
      expect(sorted[1]?.zip).toBe("94526");
    });

    it("should sort by households descending", () => {
      const aggregates = aggregateByZipCode(mockPledgeRows);
      const sorted = sortZipAggregates(aggregates, "households", "desc");

      // Both have 2 households, so order depends on original order
      expect(sorted[0]?.households).toBe(2);
      expect(sorted[1]?.households).toBe(2);
    });

    it("should sort by total pledge current", () => {
      const aggregates = aggregateByZipCode(mockPledgeRows);
      const sorted = sortZipAggregates(aggregates, "totalPledgeCurrent", "desc");

      // Both have same total
      expect(sorted[0]?.totalPledgeCurrent).toBe(7000);
      expect(sorted[1]?.totalPledgeCurrent).toBe(7000);
    });
  });
});
