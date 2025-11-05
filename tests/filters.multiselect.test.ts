import { describe, test, expect } from "vitest";
import type { PledgeRow } from "@/lib/schema/types";
import { getAgeCohort, getPledgeBin } from "@/lib/math/calculations";

/**
 * Tests for multi-select filter logic
 * These test the filter behavior implemented in app/dashboard/page.tsx
 */

// Sample test data
const sampleData: PledgeRow[] = [
  {
    householdKey: "1",
    age: 35,
    pledgeCurrent: 1500,
    pledgePrior: 1000,
    status: "renewed",
    changeDollar: 500,
    changePercent: 0.5,
  },
  {
    householdKey: "2",
    age: 45,
    pledgeCurrent: 2000,
    pledgePrior: 0,
    status: "current-only",
    changeDollar: 2000,
    changePercent: null,
  },
  {
    householdKey: "3",
    age: 55,
    pledgeCurrent: 0,
    pledgePrior: 3000,
    status: "prior-only",
    changeDollar: -3000,
    changePercent: -1,
  },
  {
    householdKey: "4",
    age: 70,
    pledgeCurrent: 5500,
    pledgePrior: 5000,
    status: "renewed",
    changeDollar: 500,
    changePercent: 0.1,
  },
  {
    householdKey: "5",
    age: 42,
    pledgeCurrent: 3000,
    pledgePrior: 3500,
    status: "renewed",
    changeDollar: -500,
    changePercent: -0.14,
  },
  {
    householdKey: "6",
    age: 60,
    pledgeCurrent: 2500,
    pledgePrior: 2500,
    status: "renewed",
    changeDollar: 0,
    changePercent: 0,
  },
];

// Helper function to simulate the filter logic
function applyFilters(
  data: PledgeRow[],
  filters: {
    filterCohort?: string[];
    filterStatus?: string[];
    filterChange?: string[];
    filterBin?: string[];
    ageCustomEnabled?: boolean;
    minAge?: string;
    maxAge?: string;
    pledgeMode?: "bins" | "custom";
    minPledge?: string;
    maxPledge?: string;
  }
): PledgeRow[] {
  const {
    filterCohort = [],
    filterStatus = [],
    filterChange = [],
    filterBin = [],
    ageCustomEnabled = false,
    minAge = "",
    maxAge = "",
    pledgeMode = "bins",
    minPledge = "",
    maxPledge = "",
  } = filters;

  const minAgeNum = minAge ? parseInt(minAge) : 0;
  const maxAgeNum = maxAge ? parseInt(maxAge) : Infinity;
  const minPledgeNum = minPledge ? parseFloat(minPledge) : 0;
  const maxPledgeNum = maxPledge ? parseFloat(maxPledge) : Infinity;

  return data.filter((row) => {
    // Age filter - can use cohorts OR custom range (OR both)
    if (filterCohort.length > 0 || (ageCustomEnabled && (minAge || maxAge))) {
      let ageMatches = false;

      // Check if matches any selected cohort
      if (filterCohort.length > 0 && filterCohort.includes(getAgeCohort(row.age))) {
        ageMatches = true;
      }

      // Check if matches custom range
      if (ageCustomEnabled && (minAge || maxAge) && row.age >= minAgeNum && row.age <= maxAgeNum) {
        ageMatches = true;
      }

      if (!ageMatches) return false;
    }

    // Status filter - must match one of selected statuses
    if (filterStatus.length > 0 && !filterStatus.includes(row.status)) {
      return false;
    }

    // Pledge amount filter - can use bins OR custom range (OR both)
    if (filterBin.length > 0 || (pledgeMode === "custom" && (minPledge || maxPledge))) {
      let pledgeMatches = false;

      // Check if matches any selected bin
      if (filterBin.length > 0) {
        const bin = getPledgeBin(row.pledgeCurrent);
        if (bin && filterBin.includes(bin)) {
          pledgeMatches = true;
        }
      }

      // Check if matches custom range (only if values are entered)
      if (pledgeMode === "custom" && (minPledge || maxPledge) && row.pledgeCurrent >= minPledgeNum && row.pledgeCurrent <= maxPledgeNum) {
        pledgeMatches = true;
      }

      if (!pledgeMatches) return false;
    }

    // Change direction filter (only applies to renewed)
    if (filterChange.length > 0) {
      // If not renewed, change filter doesn't apply - exclude these rows
      if (row.status !== "renewed") {
        return false;
      }
      // For renewed, must match one of selected change directions
      let changeMatches = false;
      if (filterChange.includes("increased") && row.changeDollar > 0) changeMatches = true;
      if (filterChange.includes("decreased") && row.changeDollar < 0) changeMatches = true;
      if (filterChange.includes("no-change") && row.changeDollar === 0) changeMatches = true;
      if (!changeMatches) return false;
    }

    return true;
  });
}

describe("Multi-Select Filter Logic", () => {
  describe("Age/Cohort Filters", () => {
    test("single cohort filter", () => {
      const result = applyFilters(sampleData, {
        filterCohort: ["Under 40"],
      });
      expect(result.length).toBe(1);
      expect(result[0].age).toBe(35);
    });

    test("multiple cohort filters (OR logic)", () => {
      const result = applyFilters(sampleData, {
        filterCohort: ["Under 40", "40-49"],
      });
      expect(result.length).toBe(3); // ages 35, 45, 42
      expect(result.map(r => r.age).sort()).toEqual([35, 42, 45]);
    });

    test("custom age range only", () => {
      const result = applyFilters(sampleData, {
        ageCustomEnabled: true,
        minAge: "40",
        maxAge: "60",
      });
      expect(result.length).toBe(4); // ages 45, 55, 42, 60
      expect(result.map(r => r.age).sort()).toEqual([42, 45, 55, 60]);
    });

    test("cohort + custom range (OR logic)", () => {
      const result = applyFilters(sampleData, {
        filterCohort: ["65+"], // age 70
        ageCustomEnabled: true,
        minAge: "35",
        maxAge: "45",
      });
      expect(result.length).toBe(4); // ages 35, 42, 45, 70
      expect(result.map(r => r.age).sort()).toEqual([35, 42, 45, 70]);
    });

    test("custom range with only min", () => {
      const result = applyFilters(sampleData, {
        ageCustomEnabled: true,
        minAge: "60",
      });
      expect(result.length).toBe(2); // ages 60, 70
    });

    test("custom range with only max", () => {
      const result = applyFilters(sampleData, {
        ageCustomEnabled: true,
        maxAge: "40",
      });
      expect(result.length).toBe(1); // age 35
    });

    test("custom enabled but no values = no filter", () => {
      const result = applyFilters(sampleData, {
        ageCustomEnabled: true,
      });
      expect(result.length).toBe(6); // all records
    });
  });

  describe("Status Filters", () => {
    test("single status filter", () => {
      const result = applyFilters(sampleData, {
        filterStatus: ["renewed"],
      });
      expect(result.length).toBe(4);
      expect(result.every(r => r.status === "renewed")).toBe(true);
    });

    test("multiple status filters (OR logic)", () => {
      const result = applyFilters(sampleData, {
        filterStatus: ["renewed", "current-only"],
      });
      expect(result.length).toBe(5);
    });

    test("no status filter = show all", () => {
      const result = applyFilters(sampleData, {});
      expect(result.length).toBe(6);
    });
  });

  describe("Pledge Amount Filters", () => {
    test("single bin filter", () => {
      const result = applyFilters(sampleData, {
        filterBin: ["$1-$1,799"],
      });
      expect(result.length).toBe(1); // $1500
    });

    test("multiple bin filters (OR logic)", () => {
      const result = applyFilters(sampleData, {
        filterBin: ["$1-$1,799", "$1,800-$2,499"],
      });
      expect(result.length).toBe(2); // $1500, $2000
    });

    test("custom pledge range only", () => {
      const result = applyFilters(sampleData, {
        pledgeMode: "custom",
        minPledge: "2000",
        maxPledge: "3000",
      });
      expect(result.length).toBe(3); // $2000, $2500, $3000
    });

    test("bin + custom range (OR logic)", () => {
      const result = applyFilters(sampleData, {
        filterBin: ["$5,400+"], // $5500
        pledgeMode: "custom",
        minPledge: "1400",
        maxPledge: "1600",
      });
      expect(result.length).toBe(2); // $1500, $5500
    });

    test("custom mode enabled but no values = no filter", () => {
      const result = applyFilters(sampleData, {
        pledgeMode: "custom",
      });
      expect(result.length).toBe(6); // all records
    });
  });

  describe("Change Direction Filters", () => {
    test("increased only (filters to renewed with positive change)", () => {
      const result = applyFilters(sampleData, {
        filterChange: ["increased"],
      });
      expect(result.length).toBe(2); // $500 changes
      expect(result.every(r => r.status === "renewed" && r.changeDollar > 0)).toBe(true);
    });

    test("decreased only (filters to renewed with negative change)", () => {
      const result = applyFilters(sampleData, {
        filterChange: ["decreased"],
      });
      expect(result.length).toBe(1); // $-500 change
      expect(result[0].changeDollar).toBe(-500);
    });

    test("no-change only (filters to renewed with zero change)", () => {
      const result = applyFilters(sampleData, {
        filterChange: ["no-change"],
      });
      expect(result.length).toBe(1); // $0 change
      expect(result[0].changeDollar).toBe(0);
    });

    test("multiple change directions (OR logic)", () => {
      const result = applyFilters(sampleData, {
        filterChange: ["increased", "decreased"],
      });
      expect(result.length).toBe(3); // all changed pledges
      expect(result.every(r => r.changeDollar !== 0)).toBe(true);
    });

    test("change filter excludes non-renewed", () => {
      const result = applyFilters(sampleData, {
        filterChange: ["increased"],
      });
      // Should NOT include current-only or prior-only even though they have changes
      expect(result.every(r => r.status === "renewed")).toBe(true);
    });
  });

  describe("Combined Filters", () => {
    test("status + age filters (AND logic)", () => {
      const result = applyFilters(sampleData, {
        filterStatus: ["renewed"],
        filterCohort: ["40-49"],
      });
      expect(result.length).toBe(1); // age 42, renewed
      expect(result[0].age).toBe(42);
      expect(result[0].status).toBe("renewed");
    });

    test("status + pledge + age (all AND)", () => {
      const result = applyFilters(sampleData, {
        filterStatus: ["renewed"],
        filterBin: ["$2,500-$3,599"],
        filterCohort: ["40-49"],
      });
      expect(result.length).toBe(1); // age 42, $3000, renewed
      expect(result[0].householdKey).toBe("5");
    });

    test("status + change filters", () => {
      const result = applyFilters(sampleData, {
        filterStatus: ["renewed"],
        filterChange: ["increased"],
      });
      expect(result.length).toBe(2); // renewed with increases
    });

    test("empty filters = all data", () => {
      const result = applyFilters(sampleData, {});
      expect(result.length).toBe(6);
    });
  });

  describe("Edge Cases", () => {
    test("impossible combination returns empty", () => {
      const result = applyFilters(sampleData, {
        filterStatus: ["prior-only"], // no pledges
        filterBin: ["$5,400+"], // high pledges
      });
      expect(result.length).toBe(0);
    });

    test("change filter with non-renewed status = only renewed", () => {
      const result = applyFilters(sampleData, {
        filterChange: ["increased"],
        // This should ONLY show renewed records that increased
      });
      expect(result.every(r => r.status === "renewed")).toBe(true);
    });

    test("all cohorts selected = same as no filter", () => {
      const result = applyFilters(sampleData, {
        filterCohort: ["Under 40", "40-49", "50-64", "65+"],
      });
      expect(result.length).toBe(6);
    });

    test("custom age range 0-infinity = all ages", () => {
      const result = applyFilters(sampleData, {
        ageCustomEnabled: true,
        minAge: "0",
        maxAge: "999",
      });
      expect(result.length).toBe(6);
    });
  });
});

describe("Chart Visibility Logic", () => {
  test("cohort chart - show when no filters", () => {
    const ageFilterCount = 0;
    const showCohortChart = ageFilterCount === 0 || ageFilterCount >= 2;
    expect(showCohortChart).toBe(true);
  });

  test("cohort chart - hide when 1 filter", () => {
    const ageFilterCount: number = 1;
    const showCohortChart = ageFilterCount === 0 || ageFilterCount >= 2;
    expect(showCohortChart).toBe(false);
  });

  test("cohort chart - show when 2+ filters", () => {
    const ageFilterCount: number = 2;
    const showCohortChart = ageFilterCount === 0 || ageFilterCount >= 2;
    expect(showCohortChart).toBe(true);
  });

  test("cohort chart - custom counts as 1", () => {
    const filterCohort = [];
    const ageCustomEnabled = true;
    const ageFilterCount = filterCohort.length + (ageCustomEnabled ? 1 : 0);
    expect(ageFilterCount).toBe(1);
  });

  test("cohort chart - standard + custom = 2", () => {
    const filterCohort = ["40-49"];
    const ageCustomEnabled = true;
    const ageFilterCount = filterCohort.length + (ageCustomEnabled ? 1 : 0);
    expect(ageFilterCount).toBe(2);
  });
});
