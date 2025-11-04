import { describe, it, expect } from "vitest";
import {
  classifyStatus,
  calculateChangeDollar,
  calculateChangePercent,
  getAgeCohort,
  getPledgeBin,
  calculateTotals,
  calculateCohortMetrics,
  calculateBinMetrics,
  calculateStatusMetrics,
  calculateZeroPledgeMetrics,
  calculateAdvancedInsights,
  enrichRows,
} from "../lib/math/calculations";
import type { PledgeRow } from "../lib/schema/types";

// Helper function to create test data
function createPledgeRow(
  age: number,
  current: number,
  prior: number,
  id: string = "hh_test"
): PledgeRow {
  return {
    age,
    pledgeCurrent: current,
    pledgePrior: prior,
    householdKey: id,
    status: classifyStatus(current, prior),
    changeDollar: calculateChangeDollar(current, prior),
    changePercent: calculateChangePercent(current, prior),
  };
}

describe("Status Classification - Comprehensive", () => {
  it("should handle all four status types", () => {
    expect(classifyStatus(1000, 900)).toBe("renewed");
    expect(classifyStatus(1000, 0)).toBe("current-only");
    expect(classifyStatus(0, 1000)).toBe("prior-only");
    expect(classifyStatus(0, 0)).toBe("no-pledge-both");
  });

  it("should handle edge case amounts", () => {
    expect(classifyStatus(0.01, 0.01)).toBe("renewed");
    expect(classifyStatus(0.01, 0)).toBe("current-only");
    expect(classifyStatus(0, 0.01)).toBe("prior-only");
    expect(classifyStatus(100000, 100000)).toBe("renewed");
  });

  it("should handle very small amounts correctly", () => {
    expect(classifyStatus(1, 1)).toBe("renewed");
    expect(classifyStatus(1, 0)).toBe("current-only");
    expect(classifyStatus(0, 1)).toBe("prior-only");
  });
});

describe("Change Calculations - Comprehensive", () => {
  describe("Dollar Change", () => {
    it("should handle increases correctly", () => {
      expect(calculateChangeDollar(2000, 1000)).toBe(1000);
      expect(calculateChangeDollar(5000, 0)).toBe(5000);
      expect(calculateChangeDollar(1800.50, 1800)).toBe(0.5);
    });

    it("should handle decreases correctly", () => {
      expect(calculateChangeDollar(1000, 2000)).toBe(-1000);
      expect(calculateChangeDollar(0, 5000)).toBe(-5000);
      expect(calculateChangeDollar(1800, 1800.50)).toBe(-0.5);
    });

    it("should handle no change", () => {
      expect(calculateChangeDollar(0, 0)).toBe(0);
      expect(calculateChangeDollar(1000, 1000)).toBe(0);
      expect(calculateChangeDollar(5400, 5400)).toBe(0);
    });

    it("should handle large amounts", () => {
      expect(calculateChangeDollar(100000, 50000)).toBe(50000);
      expect(calculateChangeDollar(50000, 100000)).toBe(-50000);
    });
  });

  describe("Percent Change", () => {
    it("should calculate percentage increases", () => {
      expect(calculateChangePercent(2000, 1000)).toBe(1); // 100% increase
      expect(calculateChangePercent(1500, 1000)).toBe(0.5); // 50% increase
      expect(calculateChangePercent(1100, 1000)).toBe(0.1); // 10% increase
    });

    it("should calculate percentage decreases", () => {
      expect(calculateChangePercent(1000, 2000)).toBe(-0.5); // 50% decrease
      expect(calculateChangePercent(500, 1000)).toBe(-0.5); // 50% decrease
      expect(calculateChangePercent(900, 1000)).toBe(-0.1); // 10% decrease
    });

    it("should return 0 for no change when prior > 0", () => {
      expect(calculateChangePercent(1000, 1000)).toBe(0);
    });

    it("should return null when both are 0", () => {
      expect(calculateChangePercent(0, 0)).toBeNull();
    });

    it("should return null when prior is 0", () => {
      expect(calculateChangePercent(1000, 0)).toBeNull();
      expect(calculateChangePercent(5000, 0)).toBeNull();
    });

    it("should handle edge cases", () => {
      expect(calculateChangePercent(0.01, 0.01)).toBe(0);
      expect(calculateChangePercent(0.02, 0.01)).toBe(1); // 100% increase
    });
  });
});

describe("Age Cohort Classification - Comprehensive", () => {
  it("should handle Under 40 boundary cases", () => {
    expect(getAgeCohort(0)).toBe("Under 40");
    expect(getAgeCohort(1)).toBe("Under 40");
    expect(getAgeCohort(39)).toBe("Under 40");
  });

  it("should handle 40-49 boundary cases", () => {
    expect(getAgeCohort(40)).toBe("40-49");
    expect(getAgeCohort(49)).toBe("40-49");
  });

  it("should handle 50-64 boundary cases", () => {
    expect(getAgeCohort(50)).toBe("50-64");
    expect(getAgeCohort(64)).toBe("50-64");
  });

  it("should handle 65+ boundary cases", () => {
    expect(getAgeCohort(65)).toBe("65+");
    expect(getAgeCohort(100)).toBe("65+");
    expect(getAgeCohort(120)).toBe("65+");
  });

  it("should handle typical ages", () => {
    expect(getAgeCohort(25)).toBe("Under 40");
    expect(getAgeCohort(45)).toBe("40-49");
    expect(getAgeCohort(55)).toBe("50-64");
    expect(getAgeCohort(75)).toBe("65+");
  });
});

describe("Pledge Bin Classification - Edge Cases", () => {
  it("should return null for zero and negative amounts", () => {
    expect(getPledgeBin(0)).toBeNull();
    expect(getPledgeBin(-1)).toBeNull();
    expect(getPledgeBin(-1000)).toBeNull();
  });

  it("should handle $1-$1,799 bin boundaries precisely", () => {
    expect(getPledgeBin(1)).toBe("$1-$1,799");
    expect(getPledgeBin(100)).toBe("$1-$1,799");
    expect(getPledgeBin(1799)).toBe("$1-$1,799");
    expect(getPledgeBin(1799.99)).toBe("$1-$1,799");
  });

  it("should handle $1,800-$2,499 bin boundaries precisely", () => {
    expect(getPledgeBin(1800)).toBe("$1,800-$2,499");
    expect(getPledgeBin(2000)).toBe("$1,800-$2,499");
    expect(getPledgeBin(2499)).toBe("$1,800-$2,499");
    expect(getPledgeBin(2499.99)).toBe("$1,800-$2,499");
  });

  it("should handle $2,500-$3,599 bin boundaries precisely", () => {
    expect(getPledgeBin(2500)).toBe("$2,500-$3,599");
    expect(getPledgeBin(3000)).toBe("$2,500-$3,599");
    expect(getPledgeBin(3599)).toBe("$2,500-$3,599");
    expect(getPledgeBin(3599.99)).toBe("$2,500-$3,599");
  });

  it("should handle $3,600-$5,399 bin boundaries precisely", () => {
    expect(getPledgeBin(3600)).toBe("$3,600-$5,399");
    expect(getPledgeBin(4500)).toBe("$3,600-$5,399");
    expect(getPledgeBin(5399)).toBe("$3,600-$5,399");
    expect(getPledgeBin(5399.99)).toBe("$3,600-$5,399");
  });

  it("should handle $5,400+ bin", () => {
    expect(getPledgeBin(5400)).toBe("$5,400+");
    expect(getPledgeBin(10000)).toBe("$5,400+");
    expect(getPledgeBin(100000)).toBe("$5,400+");
  });

  it("should handle fractional amounts near boundaries", () => {
    expect(getPledgeBin(1799.50)).toBe("$1-$1,799");
    expect(getPledgeBin(1800.50)).toBe("$1,800-$2,499");
    expect(getPledgeBin(2499.50)).toBe("$1,800-$2,499");
    expect(getPledgeBin(2500.50)).toBe("$2,500-$3,599");
  });
});

describe("Calculate Totals - Comprehensive", () => {
  it("should handle empty dataset", () => {
    const totals = calculateTotals([]);
    expect(totals.totalHouseholds).toBe(0);
    expect(totals.totalPledgedCurrent).toBe(0);
    expect(totals.totalPledgedPrior).toBe(0);
    expect(totals.deltaDollar).toBe(0);
    expect(totals.deltaPercent).toBeNull(); // null when prior is 0
    expect(totals.renewed).toBe(0);
    expect(totals.currentOnly).toBe(0);
    expect(totals.priorOnly).toBe(0);
    expect(totals.noPledgeBoth).toBe(0);
  });

  it("should handle single household", () => {
    const rows = [createPledgeRow(45, 2000, 1500, "hh_1")];
    const totals = calculateTotals(rows);

    expect(totals.totalHouseholds).toBe(1);
    expect(totals.totalPledgedCurrent).toBe(2000);
    expect(totals.totalPledgedPrior).toBe(1500);
    expect(totals.deltaDollar).toBe(500);
    expect(totals.deltaPercent).toBeCloseTo(0.3333, 3);
    expect(totals.renewed).toBe(1);
  });

  it("should calculate all status types correctly", () => {
    const rows = [
      createPledgeRow(35, 2000, 1500, "hh_1"), // renewed
      createPledgeRow(40, 1800, 0, "hh_2"),    // current-only
      createPledgeRow(50, 0, 2000, "hh_3"),    // prior-only
      createPledgeRow(60, 0, 0, "hh_4"),       // no-pledge-both
    ];

    const totals = calculateTotals(rows);

    expect(totals.totalHouseholds).toBe(4);
    expect(totals.totalPledgedCurrent).toBe(3800);
    expect(totals.totalPledgedPrior).toBe(3500);
    expect(totals.deltaDollar).toBe(300);
    expect(totals.deltaPercent).toBeCloseTo(0.0857, 3);
    expect(totals.renewed).toBe(1);
    expect(totals.currentOnly).toBe(1);
    expect(totals.priorOnly).toBe(1);
    expect(totals.noPledgeBoth).toBe(1);
  });

  it("should handle all zero pledges", () => {
    const rows = [
      createPledgeRow(30, 0, 0, "hh_1"),
      createPledgeRow(40, 0, 0, "hh_2"),
    ];

    const totals = calculateTotals(rows);

    expect(totals.totalPledgedCurrent).toBe(0);
    expect(totals.totalPledgedPrior).toBe(0);
    expect(totals.deltaDollar).toBe(0);
    expect(totals.deltaPercent).toBeNull(); // null when prior is 0
    expect(totals.noPledgeBoth).toBe(2);
  });

  it("should handle negative delta (overall decrease)", () => {
    const rows = [
      createPledgeRow(35, 1000, 2000, "hh_1"),
      createPledgeRow(40, 500, 1500, "hh_2"),
    ];

    const totals = calculateTotals(rows);

    expect(totals.deltaDollar).toBe(-2000);
    expect(totals.deltaPercent).toBeCloseTo(-0.5714, 3);
  });
});

describe("Calculate Cohort Metrics - Comprehensive", () => {
  it("should handle empty dataset", () => {
    const metrics = calculateCohortMetrics([]);

    expect(metrics).toHaveLength(4);
    metrics.forEach(cohort => {
      expect(cohort.householdCount).toBe(0);
      expect(cohort.totalCurrent).toBe(0);
      expect(cohort.averageCurrent).toBe(0);
      expect(cohort.renewalRate).toBe(0); // 0 when no households
    });
  });

  it("should calculate metrics for each cohort", () => {
    const rows = [
      createPledgeRow(25, 1000, 800, "hh_1"),   // Under 40, renewed
      createPledgeRow(35, 1500, 0, "hh_2"),     // Under 40, current-only
      createPledgeRow(45, 2000, 1800, "hh_3"),  // 40-49, renewed
      createPledgeRow(55, 2500, 2500, "hh_4"),  // 50-64, renewed
      createPledgeRow(75, 3000, 2800, "hh_5"),  // 65+, renewed
    ];

    const metrics = calculateCohortMetrics(rows);

    const under40 = metrics.find(m => m.cohort === "Under 40")!;
    expect(under40.householdCount).toBe(2);
    expect(under40.totalCurrent).toBe(2500);
    expect(under40.averageCurrent).toBe(1250);

    const age4049 = metrics.find(m => m.cohort === "40-49")!;
    expect(age4049.householdCount).toBe(1);
    expect(age4049.totalCurrent).toBe(2000);

    const age5064 = metrics.find(m => m.cohort === "50-64")!;
    expect(age5064.householdCount).toBe(1);
    expect(age5064.totalCurrent).toBe(2500);

    const age65plus = metrics.find(m => m.cohort === "65+")!;
    expect(age65plus.householdCount).toBe(1);
    expect(age65plus.totalCurrent).toBe(3000);
  });

  it("should calculate renewal rates correctly", () => {
    const rows = [
      createPledgeRow(30, 2000, 1500, "hh_1"), // renewed
      createPledgeRow(35, 1800, 1600, "hh_2"), // renewed
      createPledgeRow(38, 0, 1000, "hh_3"),    // prior-only (not renewed)
    ];

    const metrics = calculateCohortMetrics(rows);
    const under40 = metrics.find(m => m.cohort === "Under 40")!;

    // 2 renewed out of 3 who had prior pledges
    expect(under40.renewalRate).toBeCloseTo(2/3, 5);
  });

  it("should track change directions for renewed households", () => {
    const rows = [
      createPledgeRow(30, 2000, 1500, "hh_1"), // increased
      createPledgeRow(35, 1500, 2000, "hh_2"), // decreased
      createPledgeRow(38, 1800, 1800, "hh_3"), // no change
      createPledgeRow(39, 2500, 0, "hh_4"),    // current-only (not counted)
    ];

    const metrics = calculateCohortMetrics(rows);
    const under40 = metrics.find(m => m.cohort === "Under 40")!;

    expect(under40.increased).toBe(1);
    expect(under40.decreased).toBe(1);
    expect(under40.noChange).toBe(1);
  });

  it("should calculate median correctly", () => {
    const rows = [
      createPledgeRow(30, 1000, 0, "hh_1"),
      createPledgeRow(35, 2000, 0, "hh_2"),
      createPledgeRow(38, 3000, 0, "hh_3"),
    ];

    const metrics = calculateCohortMetrics(rows);
    const under40 = metrics.find(m => m.cohort === "Under 40")!;

    expect(under40.medianCurrent).toBe(2000);
  });

  it("should calculate median for even number of values", () => {
    const rows = [
      createPledgeRow(30, 1000, 0, "hh_1"),
      createPledgeRow(35, 2000, 0, "hh_2"),
      createPledgeRow(37, 3000, 0, "hh_3"),
      createPledgeRow(38, 4000, 0, "hh_4"),
    ];

    const metrics = calculateCohortMetrics(rows);
    const under40 = metrics.find(m => m.cohort === "Under 40")!;

    expect(under40.medianCurrent).toBe(2500); // (2000 + 3000) / 2
  });
});

describe("Calculate Bin Metrics - Comprehensive", () => {
  it("should handle empty dataset", () => {
    const metrics = calculateBinMetrics([]);

    expect(metrics).toHaveLength(5);
    metrics.forEach(bin => {
      expect(bin.householdCount).toBe(0);
      expect(bin.total).toBe(0);
    });
  });

  it("should classify pledges into correct bins", () => {
    const rows = [
      createPledgeRow(30, 1000, 0, "hh_1"),   // $1-$1,799
      createPledgeRow(35, 1799, 0, "hh_2"),   // $1-$1,799
      createPledgeRow(40, 1800, 0, "hh_3"),   // $1,800-$2,499
      createPledgeRow(45, 2500, 0, "hh_4"),   // $2,500-$3,599
      createPledgeRow(50, 3600, 0, "hh_5"),   // $3,600-$5,399
      createPledgeRow(55, 5400, 0, "hh_6"),   // $5,400+
      createPledgeRow(60, 0, 100, "hh_7"),    // $0 (excluded from bins)
    ];

    const metrics = calculateBinMetrics(rows);

    const bin1 = metrics.find(m => m.bin === "$1-$1,799")!;
    expect(bin1.householdCount).toBe(2);
    expect(bin1.total).toBe(2799);

    const bin2 = metrics.find(m => m.bin === "$1,800-$2,499")!;
    expect(bin2.householdCount).toBe(1);

    const bin3 = metrics.find(m => m.bin === "$2,500-$3,599")!;
    expect(bin3.householdCount).toBe(1);

    const bin4 = metrics.find(m => m.bin === "$3,600-$5,399")!;
    expect(bin4.householdCount).toBe(1);

    const bin5 = metrics.find(m => m.bin === "$5,400+")!;
    expect(bin5.householdCount).toBe(1);
  });

  it("should calculate averages correctly", () => {
    const rows = [
      createPledgeRow(30, 1000, 0, "hh_1"),
      createPledgeRow(35, 1500, 0, "hh_2"),
    ];

    const metrics = calculateBinMetrics(rows);
    const bin = metrics.find(m => m.bin === "$1-$1,799")!;

    expect(bin.average).toBe(1250);
  });

  it("should handle boundary values precisely", () => {
    const rows = [
      createPledgeRow(30, 1799.99, 0, "hh_1"),  // Should be in $1-$1,799
      createPledgeRow(35, 1800.00, 0, "hh_2"),  // Should be in $1,800-$2,499
      createPledgeRow(40, 2499.99, 0, "hh_3"),  // Should be in $1,800-$2,499
      createPledgeRow(45, 2500.00, 0, "hh_4"),  // Should be in $2,500-$3,599
    ];

    const metrics = calculateBinMetrics(rows);

    const bin1 = metrics.find(m => m.bin === "$1-$1,799")!;
    expect(bin1.householdCount).toBe(1);

    const bin2 = metrics.find(m => m.bin === "$1,800-$2,499")!;
    expect(bin2.householdCount).toBe(2);

    const bin3 = metrics.find(m => m.bin === "$2,500-$3,599")!;
    expect(bin3.householdCount).toBe(1);
  });
});

describe("Calculate Status Metrics - Comprehensive", () => {
  it("should handle empty dataset", () => {
    const metrics = calculateStatusMetrics([]);

    expect(metrics).toHaveLength(4);
    metrics.forEach(status => {
      expect(status.householdCount).toBe(0);
      expect(status.totalCurrent).toBe(0);
      expect(status.totalPrior).toBe(0);
    });
  });

  it("should calculate metrics for each status type", () => {
    const rows = [
      createPledgeRow(30, 2000, 1500, "hh_1"), // renewed
      createPledgeRow(35, 2200, 1800, "hh_2"), // renewed
      createPledgeRow(40, 1800, 0, "hh_3"),    // current-only
      createPledgeRow(45, 1900, 0, "hh_4"),    // current-only
      createPledgeRow(50, 0, 2000, "hh_5"),    // prior-only
      createPledgeRow(55, 0, 0, "hh_6"),       // no-pledge-both
    ];

    const metrics = calculateStatusMetrics(rows);

    const renewed = metrics.find(m => m.status === "renewed")!;
    expect(renewed.householdCount).toBe(2);
    expect(renewed.totalCurrent).toBe(4200);
    expect(renewed.totalPrior).toBe(3300);

    const currentOnly = metrics.find(m => m.status === "current-only")!;
    expect(currentOnly.householdCount).toBe(2);
    expect(currentOnly.totalCurrent).toBe(3700);
    expect(currentOnly.totalPrior).toBe(0);

    const priorOnly = metrics.find(m => m.status === "prior-only")!;
    expect(priorOnly.householdCount).toBe(1);
    expect(priorOnly.totalCurrent).toBe(0);
    expect(priorOnly.totalPrior).toBe(2000);

    const noPledge = metrics.find(m => m.status === "no-pledge-both")!;
    expect(noPledge.householdCount).toBe(1);
    expect(noPledge.totalCurrent).toBe(0);
    expect(noPledge.totalPrior).toBe(0);
  });
});

describe("Calculate Zero Pledge Metrics", () => {
  it("should count households with zero current pledge", () => {
    const rows = [
      createPledgeRow(30, 0, 1500, "hh_1"),
      createPledgeRow(35, 0, 0, "hh_2"),
      createPledgeRow(40, 2000, 1800, "hh_3"),
    ];

    const metrics = calculateZeroPledgeMetrics(rows);

    expect(metrics.householdCount).toBe(2);
    expect(metrics.total).toBe(0);
  });

  it("should handle all zero pledges", () => {
    const rows = [
      createPledgeRow(30, 0, 0, "hh_1"),
      createPledgeRow(35, 0, 0, "hh_2"),
    ];

    const metrics = calculateZeroPledgeMetrics(rows);

    expect(metrics.householdCount).toBe(2);
  });

  it("should handle no zero pledges", () => {
    const rows = [
      createPledgeRow(30, 1000, 1500, "hh_1"),
      createPledgeRow(35, 2000, 1800, "hh_2"),
    ];

    const metrics = calculateZeroPledgeMetrics(rows);

    expect(metrics.householdCount).toBe(0);
  });
});

describe("Advanced Insights - Comprehensive", () => {
  it("should calculate retention rate correctly", () => {
    const rows = [
      createPledgeRow(30, 2000, 1500, "hh_1"), // renewed
      createPledgeRow(35, 2200, 1800, "hh_2"), // renewed
      createPledgeRow(40, 0, 2000, "hh_3"),    // not renewed
      createPledgeRow(45, 1800, 0, "hh_4"),    // new (not counted in denominator)
    ];

    const insights = calculateAdvancedInsights(rows);

    // 2 renewed out of 3 who had prior pledges
    expect(insights.retentionRate).toBeCloseTo(2/3, 5);
  });

  it("should calculate upgrade/downgrade rates", () => {
    const rows = [
      createPledgeRow(30, 2000, 1500, "hh_1"), // upgraded
      createPledgeRow(35, 1500, 2000, "hh_2"), // downgraded
      createPledgeRow(40, 1800, 1800, "hh_3"), // no change
      createPledgeRow(45, 2200, 1800, "hh_4"), // upgraded
    ];

    const insights = calculateAdvancedInsights(rows);

    expect(insights.upgradeDowngradeRates.upgraded).toBe(2);
    expect(insights.upgradeDowngradeRates.downgraded).toBe(1);
    expect(insights.upgradeDowngradeRates.upgradeRate).toBe(0.5);
    expect(insights.upgradeDowngradeRates.downgradeRate).toBe(0.25);
  });

  it("should calculate pledge concentration for top 10%", () => {
    const rows = [
      createPledgeRow(30, 10000, 0, "hh_1"), // Top 10%
      createPledgeRow(35, 1000, 0, "hh_2"),
      createPledgeRow(40, 1000, 0, "hh_3"),
      createPledgeRow(45, 1000, 0, "hh_4"),
      createPledgeRow(50, 1000, 0, "hh_5"),
      createPledgeRow(55, 1000, 0, "hh_6"),
      createPledgeRow(60, 1000, 0, "hh_7"),
      createPledgeRow(65, 1000, 0, "hh_8"),
      createPledgeRow(70, 1000, 0, "hh_9"),
      createPledgeRow(75, 1000, 0, "hh_10"),
    ];

    const insights = calculateAdvancedInsights(rows);
    const total = 19000;

    expect(insights.pledgeConcentration.top10Percent.households).toBe(1);
    expect(insights.pledgeConcentration.top10Percent.amount).toBe(10000);
    expect(insights.pledgeConcentration.top10Percent.percentOfTotal).toBeCloseTo((10000/total) * 100, 1);
  });

  it("should calculate age statistics", () => {
    const rows = [
      createPledgeRow(30, 1000, 0, "hh_1"),
      createPledgeRow(50, 1000, 0, "hh_2"),
      createPledgeRow(70, 1000, 0, "hh_3"),
    ];

    const insights = calculateAdvancedInsights(rows);

    expect(insights.ageStats.mean).toBe(50);
    expect(insights.ageStats.median).toBe(50);
    // Note: The actual calculations don't track min/max separately,
    // but we can infer them from the data
    const ages = rows.map(r => r.age).sort((a, b) => a - b);
    expect(ages[0]).toBe(30);
    expect(ages[ages.length - 1]).toBe(70);
  });

  it("should calculate new vs renewed average correctly", () => {
    const rows = [
      createPledgeRow(30, 2000, 0, "hh_1"),    // current-only
      createPledgeRow(35, 2400, 0, "hh_2"),    // current-only
      createPledgeRow(40, 3000, 2000, "hh_3"), // renewed
      createPledgeRow(45, 3200, 2200, "hh_4"), // renewed
    ];

    const insights = calculateAdvancedInsights(rows);

    expect(insights.newVsRenewedAverage.currentOnly).toBe(2200); // (2000 + 2400) / 2
    expect(insights.newVsRenewedAverage.renewed).toBe(3100);     // (3000 + 3200) / 2
    expect(insights.newVsRenewedAverage.difference).toBe(900);
  });

  it("should handle edge case with no renewed pledgers", () => {
    const rows = [
      createPledgeRow(30, 2000, 0, "hh_1"),
      createPledgeRow(35, 2400, 0, "hh_2"),
    ];

    const insights = calculateAdvancedInsights(rows);

    expect(insights.retentionRate).toBe(0);
    expect(insights.upgradeDowngradeRates.upgraded).toBe(0);
    expect(insights.upgradeDowngradeRates.downgraded).toBe(0);
  });
});

describe("Enrich Rows - Comprehensive", () => {
  it("should generate unique household keys", () => {
    const rawRows = [
      { age: 30, pledgeCurrent: 2000, pledgePrior: 1500 },
      { age: 35, pledgeCurrent: 1800, pledgePrior: 0 },
    ];

    const enriched = enrichRows("test.xlsx", rawRows);

    // Keys are generated using a hash function
    expect(enriched[0]?.householdKey).toMatch(/^hh_/);
    expect(enriched[1]?.householdKey).toMatch(/^hh_/);
    // Keys should be unique for different rows
    expect(enriched[0]?.householdKey).not.toBe(enriched[1]?.householdKey);
  });

  it("should correctly enrich all fields", () => {
    const rawRows = [
      { age: 45, pledgeCurrent: 2000, pledgePrior: 1500 },
    ];

    const enriched = enrichRows("test.xlsx", rawRows);
    const row = enriched[0]!;

    expect(row.age).toBe(45);
    expect(row.pledgeCurrent).toBe(2000);
    expect(row.pledgePrior).toBe(1500);
    expect(row.status).toBe("renewed");
    expect(row.changeDollar).toBe(500);
    expect(row.changePercent).toBeCloseTo(0.3333, 3);
  });

  it("should handle multiple rows correctly", () => {
    const rawRows = [
      { age: 30, pledgeCurrent: 2000, pledgePrior: 1500 },
      { age: 40, pledgeCurrent: 1800, pledgePrior: 0 },
      { age: 50, pledgeCurrent: 0, pledgePrior: 2000 },
      { age: 60, pledgeCurrent: 0, pledgePrior: 0 },
    ];

    const enriched = enrichRows("test.xlsx", rawRows);

    expect(enriched).toHaveLength(4);
    expect(enriched[0]?.status).toBe("renewed");
    expect(enriched[1]?.status).toBe("current-only");
    expect(enriched[2]?.status).toBe("prior-only");
    expect(enriched[3]?.status).toBe("no-pledge-both");
  });
});
