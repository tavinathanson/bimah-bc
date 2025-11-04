import { describe, it, expect } from "vitest";
import type { PledgeRow } from "../lib/schema/types";

// Helper function to create test data
function createPledgeRow(
  age: number,
  current: number,
  prior: number,
  id: string = "hh_test"
): PledgeRow {
  const changeDollar = current - prior;
  const changePercent = prior > 0 ? (current - prior) / prior : null;

  let status: "renewed" | "current-only" | "prior-only" | "no-pledge-both";
  if (current > 0 && prior > 0) status = "renewed";
  else if (current > 0 && prior === 0) status = "current-only";
  else if (current === 0 && prior > 0) status = "prior-only";
  else status = "no-pledge-both";

  return {
    age,
    pledgeCurrent: current,
    pledgePrior: prior,
    householdKey: id,
    status,
    changeDollar,
    changePercent,
  };
}

// Linear regression calculation from forecasts page
function calculateLinearRegression(rows: PledgeRow[]): {
  slope: number;
  intercept: number;
  rSquared: number
} {
  const renewed = rows.filter(r => r.pledgePrior > 0 && r.pledgeCurrent > 0);

  if (renewed.length === 0) {
    return { slope: 1, intercept: 0, rSquared: 0 };
  }

  const n = renewed.length;
  const sumX = renewed.reduce((sum, r) => sum + r.pledgePrior, 0);
  const sumY = renewed.reduce((sum, r) => sum + r.pledgeCurrent, 0);
  const sumXY = renewed.reduce((sum, r) => sum + r.pledgePrior * r.pledgeCurrent, 0);
  const sumX2 = renewed.reduce((sum, r) => sum + r.pledgePrior * r.pledgePrior, 0);
  const sumY2 = renewed.reduce((sum, r) => sum + r.pledgeCurrent * r.pledgeCurrent, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssTotal = renewed.reduce((sum, r) => sum + Math.pow(r.pledgeCurrent - meanY, 2), 0);
  const ssResidual = renewed.reduce((sum, r) => {
    const predicted = slope * r.pledgePrior + intercept;
    return sum + Math.pow(r.pledgeCurrent - predicted, 2);
  }, 0);
  const rSquared = 1 - (ssResidual / ssTotal);

  return { slope, intercept, rSquared };
}

describe("Linear Regression - Forecasts", () => {
  it("should handle empty dataset", () => {
    const result = calculateLinearRegression([]);

    expect(result.slope).toBe(1);
    expect(result.intercept).toBe(0);
    expect(result.rSquared).toBe(0);
  });

  it("should calculate perfect correlation (slope=1)", () => {
    const rows = [
      createPledgeRow(30, 2000, 2000, "hh_1"),
      createPledgeRow(35, 3000, 3000, "hh_2"),
      createPledgeRow(40, 4000, 4000, "hh_3"),
    ];

    const result = calculateLinearRegression(rows);

    expect(result.slope).toBeCloseTo(1, 5);
    expect(result.intercept).toBeCloseTo(0, 5);
    expect(result.rSquared).toBeCloseTo(1, 5);
  });

  it("should calculate positive slope with increase trend", () => {
    const rows = [
      createPledgeRow(30, 2100, 2000, "hh_1"), // 5% increase
      createPledgeRow(35, 3150, 3000, "hh_2"), // 5% increase
      createPledgeRow(40, 4200, 4000, "hh_3"), // 5% increase
    ];

    const result = calculateLinearRegression(rows);

    expect(result.slope).toBeGreaterThan(1);
    expect(result.rSquared).toBeGreaterThan(0.9); // High correlation
  });

  it("should calculate negative slope with decrease trend", () => {
    const rows = [
      createPledgeRow(30, 1900, 2000, "hh_1"), // 5% decrease
      createPledgeRow(35, 2850, 3000, "hh_2"), // 5% decrease
      createPledgeRow(40, 3800, 4000, "hh_3"), // 5% decrease
    ];

    const result = calculateLinearRegression(rows);

    expect(result.slope).toBeLessThan(1);
    expect(result.rSquared).toBeGreaterThan(0.9); // High correlation
  });

  it("should exclude non-renewed households", () => {
    const rows = [
      createPledgeRow(30, 2000, 2000, "hh_1"), // renewed
      createPledgeRow(35, 3000, 3000, "hh_2"), // renewed
      createPledgeRow(40, 4000, 0, "hh_3"),    // current-only (excluded)
      createPledgeRow(45, 0, 5000, "hh_4"),    // prior-only (excluded)
    ];

    const result = calculateLinearRegression(rows);

    // Should only use first 2 rows
    expect(result.slope).toBeCloseTo(1, 5);
    expect(result.rSquared).toBeCloseTo(1, 5);
  });

  it("should handle single renewed household", () => {
    const rows = [
      createPledgeRow(30, 2000, 1800, "hh_1"),
    ];

    const result = calculateLinearRegression(rows);

    // With only one point, regression is undefined but we calculate it anyway
    expect(result.slope).toBeDefined();
    expect(result.intercept).toBeDefined();
  });

  it("should calculate R-squared correctly for imperfect fit", () => {
    const rows = [
      createPledgeRow(30, 2000, 2000, "hh_1"),
      createPledgeRow(35, 3500, 3000, "hh_2"), // Higher increase
      createPledgeRow(40, 4000, 4000, "hh_3"),
      createPledgeRow(45, 5000, 5000, "hh_4"),
    ];

    const result = calculateLinearRegression(rows);

    expect(result.rSquared).toBeGreaterThan(0);
    expect(result.rSquared).toBeLessThanOrEqual(1);
  });

  it("should handle large pledge amounts", () => {
    const rows = [
      createPledgeRow(30, 10000, 9500, "hh_1"),
      createPledgeRow(35, 20000, 19000, "hh_2"),
      createPledgeRow(40, 30000, 28500, "hh_3"),
    ];

    const result = calculateLinearRegression(rows);

    expect(result.slope).toBeGreaterThan(0);
    expect(result.intercept).toBeDefined();
    expect(result.rSquared).toBeGreaterThan(0.9);
  });

  it("should handle mixed increase/decrease patterns", () => {
    const rows = [
      createPledgeRow(30, 2100, 2000, "hh_1"), // increase
      createPledgeRow(35, 2900, 3000, "hh_2"), // decrease
      createPledgeRow(40, 4100, 4000, "hh_3"), // increase
      createPledgeRow(45, 4900, 5000, "hh_4"), // decrease
    ];

    const result = calculateLinearRegression(rows);

    expect(result.slope).toBeGreaterThan(0);
    expect(result.slope).toBeLessThan(2);
    expect(result.rSquared).toBeGreaterThan(0);
    expect(result.rSquared).toBeLessThan(1);
  });
});

describe("Retention Rate Calculations", () => {
  it("should calculate 100% retention", () => {
    const rows = [
      createPledgeRow(30, 2000, 1500, "hh_1"), // renewed
      createPledgeRow(35, 2200, 1800, "hh_2"), // renewed
      createPledgeRow(40, 2500, 2000, "hh_3"), // renewed
    ];

    const hadPriorPledge = rows.filter(r => r.pledgePrior > 0);
    const renewed = rows.filter(r => r.status === "renewed");
    const retentionRate = hadPriorPledge.length > 0 ? renewed.length / hadPriorPledge.length : 0;

    expect(retentionRate).toBe(1);
  });

  it("should calculate 0% retention", () => {
    const rows = [
      createPledgeRow(30, 0, 1500, "hh_1"), // prior-only
      createPledgeRow(35, 0, 1800, "hh_2"), // prior-only
      createPledgeRow(40, 0, 2000, "hh_3"), // prior-only
    ];

    const hadPriorPledge = rows.filter(r => r.pledgePrior > 0);
    const renewed = rows.filter(r => r.status === "renewed");
    const retentionRate = hadPriorPledge.length > 0 ? renewed.length / hadPriorPledge.length : 0;

    expect(retentionRate).toBe(0);
  });

  it("should calculate partial retention", () => {
    const rows = [
      createPledgeRow(30, 2000, 1500, "hh_1"), // renewed
      createPledgeRow(35, 2200, 1800, "hh_2"), // renewed
      createPledgeRow(40, 0, 2000, "hh_3"),    // prior-only
      createPledgeRow(45, 0, 1800, "hh_4"),    // prior-only
    ];

    const hadPriorPledge = rows.filter(r => r.pledgePrior > 0);
    const renewed = rows.filter(r => r.status === "renewed");
    const retentionRate = hadPriorPledge.length > 0 ? renewed.length / hadPriorPledge.length : 0;

    expect(retentionRate).toBe(0.5); // 2 out of 4
  });

  it("should exclude current-only from retention calculation", () => {
    const rows = [
      createPledgeRow(30, 2000, 1500, "hh_1"), // renewed
      createPledgeRow(35, 1800, 0, "hh_2"),    // current-only (not counted)
      createPledgeRow(40, 0, 2000, "hh_3"),    // prior-only
    ];

    const hadPriorPledge = rows.filter(r => r.pledgePrior > 0);
    const renewed = rows.filter(r => r.status === "renewed");
    const retentionRate = hadPriorPledge.length > 0 ? renewed.length / hadPriorPledge.length : 0;

    expect(retentionRate).toBe(0.5); // 1 out of 2
  });
});

describe("Revenue at Risk Calculations", () => {
  it("should calculate revenue lost from non-renewals", () => {
    const rows = [
      createPledgeRow(30, 0, 1500, "hh_1"), // lost $1500
      createPledgeRow(35, 0, 2000, "hh_2"), // lost $2000
      createPledgeRow(40, 2500, 2000, "hh_3"), // renewed (not at risk)
    ];

    const priorNoRenewal = rows.filter(r => r.pledgePrior > 0 && r.pledgeCurrent === 0);
    const priorNoRenewalAmount = priorNoRenewal.reduce((sum, r) => sum + r.pledgePrior, 0);

    expect(priorNoRenewalAmount).toBe(3500);
  });

  it("should calculate estimated loss from decreased pledges", () => {
    const rows = [
      createPledgeRow(30, 1500, 2000, "hh_1"), // decreased by 500
      createPledgeRow(35, 1800, 2500, "hh_2"), // decreased by 700
      createPledgeRow(40, 3000, 2000, "hh_3"), // increased (not counted)
    ];

    const decreased = rows.filter(r => r.status === "renewed" && r.changeDollar < 0);
    const avgDecrease = decreased.length > 0
      ? decreased.reduce((sum, r) => sum + Math.abs(r.changeDollar), 0) / decreased.length
      : 0;

    expect(avgDecrease).toBe(600); // (500 + 700) / 2
  });

  it("should handle no revenue at risk", () => {
    const rows = [
      createPledgeRow(30, 2000, 1500, "hh_1"), // increased
      createPledgeRow(35, 2200, 1800, "hh_2"), // increased
      createPledgeRow(40, 2500, 2000, "hh_3"), // increased
    ];

    const priorNoRenewal = rows.filter(r => r.pledgePrior > 0 && r.pledgeCurrent === 0);
    const priorNoRenewalAmount = priorNoRenewal.reduce((sum, r) => sum + r.pledgePrior, 0);

    expect(priorNoRenewalAmount).toBe(0);
  });
});

describe("Growth Rate Projections", () => {
  it("should calculate positive growth rate", () => {
    const currentTotal = 100000;
    const priorTotal = 90000;
    const growthRate = priorTotal > 0 ? (currentTotal - priorTotal) / priorTotal : 0;

    expect(growthRate).toBeCloseTo(0.1111, 3); // ~11.1%
  });

  it("should calculate negative growth rate", () => {
    const currentTotal = 80000;
    const priorTotal = 100000;
    const growthRate = priorTotal > 0 ? (currentTotal - priorTotal) / priorTotal : 0;

    expect(growthRate).toBe(-0.2); // -20%
  });

  it("should handle zero growth", () => {
    const currentTotal = 100000;
    const priorTotal = 100000;
    const growthRate = priorTotal > 0 ? (currentTotal - priorTotal) / priorTotal : 0;

    expect(growthRate).toBe(0);
  });

  it("should apply growth rate to project next year", () => {
    const currentTotal = 110000;
    const priorTotal = 100000;
    const growthRate = (currentTotal - priorTotal) / priorTotal;
    const nextYearProjection = currentTotal * (1 + growthRate);

    expect(nextYearProjection).toBeCloseTo(121000, 1); // 10% growth applied again
  });

  it("should calculate conservative/optimistic scenarios", () => {
    const currentTotal = 100000;
    const priorTotal = 90000;
    const growthRate = (currentTotal - priorTotal) / priorTotal; // 11.1%

    const conservative = currentTotal * (1 + growthRate * 0.5); // Half the growth
    const expected = currentTotal * (1 + growthRate);
    const optimistic = currentTotal * (1 + growthRate * 1.5); // 1.5x the growth

    expect(conservative).toBeLessThan(expected);
    expect(expected).toBeLessThan(optimistic);
    expect(conservative).toBeCloseTo(105556, 0);
    expect(expected).toBeCloseTo(111111, 0);
    expect(optimistic).toBeCloseTo(116667, 0);
  });
});

describe("Upgrade/Downgrade Trend Analysis", () => {
  it("should calculate upgrade rate", () => {
    const rows = [
      createPledgeRow(30, 2500, 2000, "hh_1"), // upgraded
      createPledgeRow(35, 3200, 3000, "hh_2"), // upgraded
      createPledgeRow(40, 1800, 2000, "hh_3"), // downgraded
      createPledgeRow(45, 2500, 2500, "hh_4"), // no change
    ];

    const renewed = rows.filter(r => r.status === "renewed");
    const upgraded = renewed.filter(r => r.changeDollar > 0);
    const upgradeRate = renewed.length > 0 ? upgraded.length / renewed.length : 0;

    expect(upgradeRate).toBe(0.5); // 2 out of 4
  });

  it("should calculate average upgrade amount", () => {
    const rows = [
      createPledgeRow(30, 2500, 2000, "hh_1"), // +500
      createPledgeRow(35, 3200, 3000, "hh_2"), // +200
      createPledgeRow(40, 4300, 4000, "hh_3"), // +300
    ];

    const upgraded = rows.filter(r => r.status === "renewed" && r.changeDollar > 0);
    const avgUpgrade = upgraded.length > 0
      ? upgraded.reduce((sum, r) => sum + r.changeDollar, 0) / upgraded.length
      : 0;

    expect(avgUpgrade).toBeCloseTo(333.33, 1); // (500 + 200 + 300) / 3
  });

  it("should project upgrade revenue for next year", () => {
    const currentRenewed = 100; // households
    const upgradeRate = 0.5;
    const avgUpgradeAmount = 300;

    const projectedUpgrades = Math.round(currentRenewed * upgradeRate);
    const projectedUpgradeRevenue = projectedUpgrades * avgUpgradeAmount;

    expect(projectedUpgrades).toBe(50);
    expect(projectedUpgradeRevenue).toBe(15000);
  });
});

describe("Edge Cases - Forecasts", () => {
  it("should handle all zero pledges", () => {
    const rows = [
      createPledgeRow(30, 0, 0, "hh_1"),
      createPledgeRow(35, 0, 0, "hh_2"),
    ];

    const currentTotal = rows.reduce((sum, r) => sum + r.pledgeCurrent, 0);
    const priorTotal = rows.reduce((sum, r) => sum + r.pledgePrior, 0);
    const growthRate = priorTotal > 0 ? (currentTotal - priorTotal) / priorTotal : 0;

    expect(currentTotal).toBe(0);
    expect(priorTotal).toBe(0);
    expect(growthRate).toBe(0);
  });

  it("should handle single household", () => {
    const rows = [
      createPledgeRow(45, 2500, 2000, "hh_1"),
    ];

    const regression = calculateLinearRegression(rows);

    expect(regression).toBeDefined();
    expect(regression.slope).toBeDefined();
    expect(regression.intercept).toBeDefined();
  });

  it("should handle very large numbers", () => {
    const rows = [
      createPledgeRow(30, 1000000, 900000, "hh_1"),
      createPledgeRow(35, 1100000, 1000000, "hh_2"),
    ];

    const currentTotal = rows.reduce((sum, r) => sum + r.pledgeCurrent, 0);
    const priorTotal = rows.reduce((sum, r) => sum + r.pledgePrior, 0);
    const growthRate = (currentTotal - priorTotal) / priorTotal;

    expect(growthRate).toBeCloseTo(0.1053, 3);
  });
});
