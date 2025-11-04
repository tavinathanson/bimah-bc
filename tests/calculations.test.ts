import { describe, it, expect } from "vitest";
import {
  classifyStatus,
  calculateChangeDollar,
  calculateChangePercent,
  getAgeCohort,
  getPledgeBin,
  calculateTotals,
  enrichRows,
} from "../lib/math/calculations";
import type { RawRow, PledgeRow } from "../lib/schema/types";

describe("Status Classification", () => {
  it("should classify as renewed when pledged both years", () => {
    expect(classifyStatus(1000, 900)).toBe("renewed");
  });

  it("should classify as new when pledged current only", () => {
    expect(classifyStatus(1000, 0)).toBe("new");
  });

  it("should classify as resigned when pledged prior only", () => {
    expect(classifyStatus(0, 1000)).toBe("resigned");
  });

  it("should classify as no-pledge-both when no pledge either year", () => {
    expect(classifyStatus(0, 0)).toBe("no-pledge-both");
  });
});

describe("Change Calculations", () => {
  it("should calculate dollar change correctly", () => {
    expect(calculateChangeDollar(1500, 1000)).toBe(500);
    expect(calculateChangeDollar(1000, 1500)).toBe(-500);
    expect(calculateChangeDollar(1000, 1000)).toBe(0);
  });

  it("should calculate percent change correctly", () => {
    expect(calculateChangePercent(1500, 1000)).toBe(0.5);
    expect(calculateChangePercent(1000, 2000)).toBe(-0.5);
    expect(calculateChangePercent(1000, 1000)).toBe(0);
  });

  it("should return null for percent change when prior is 0", () => {
    expect(calculateChangePercent(1000, 0)).toBeNull();
  });
});

describe("Age Cohort", () => {
  it("should classify Under 40 correctly", () => {
    expect(getAgeCohort(20)).toBe("Under 40");
    expect(getAgeCohort(39)).toBe("Under 40");
  });

  it("should classify 40-49 correctly", () => {
    expect(getAgeCohort(40)).toBe("40-49");
    expect(getAgeCohort(45)).toBe("40-49");
    expect(getAgeCohort(49)).toBe("40-49");
  });

  it("should classify 50-64 correctly", () => {
    expect(getAgeCohort(50)).toBe("50-64");
    expect(getAgeCohort(60)).toBe("50-64");
    expect(getAgeCohort(64)).toBe("50-64");
  });

  it("should classify 65+ correctly", () => {
    expect(getAgeCohort(65)).toBe("65+");
    expect(getAgeCohort(80)).toBe("65+");
  });
});

describe("Pledge Bin", () => {
  it("should return null for 0 or negative amounts", () => {
    expect(getPledgeBin(0)).toBeNull();
    expect(getPledgeBin(-100)).toBeNull();
  });

  it("should classify bins correctly with inclusive lower bound", () => {
    expect(getPledgeBin(1)).toBe("$1-$1,799");
    expect(getPledgeBin(1799)).toBe("$1-$1,799");
    expect(getPledgeBin(1800)).toBe("$1,800-$2,499");
    expect(getPledgeBin(2499)).toBe("$1,800-$2,499");
    expect(getPledgeBin(2500)).toBe("$2,500-$3,599");
    expect(getPledgeBin(3599)).toBe("$2,500-$3,599");
    expect(getPledgeBin(3600)).toBe("$3,600-$5,399");
    expect(getPledgeBin(5399)).toBe("$3,600-$5,399");
    expect(getPledgeBin(5400)).toBe("$5,400+");
    expect(getPledgeBin(10000)).toBe("$5,400+");
  });
});

describe("Enrich Rows", () => {
  it("should enrich raw rows with calculated fields", () => {
    const rawRows: RawRow[] = [
      { age: 35, pledgeCurrent: 2000, pledgePrior: 1500 },
      { age: 50, pledgeCurrent: 3000, pledgePrior: 0 },
    ];

    const enriched = enrichRows("test.xlsx", rawRows);

    expect(enriched).toHaveLength(2);
    expect(enriched[0]).toMatchObject({
      age: 35,
      pledgeCurrent: 2000,
      pledgePrior: 1500,
      status: "renewed",
      changeDollar: 500,
      changePercent: 0.3333333333333333,
    });
    expect(enriched[0]?.householdKey).toMatch(/^hh_/);

    expect(enriched[1]).toMatchObject({
      age: 50,
      pledgeCurrent: 3000,
      pledgePrior: 0,
      status: "new",
      changeDollar: 3000,
      changePercent: null,
    });
  });
});

describe("Calculate Totals", () => {
  it("should calculate totals correctly", () => {
    const rows: PledgeRow[] = [
      {
        age: 35,
        pledgeCurrent: 2000,
        pledgePrior: 1500,
        householdKey: "hh_1",
        status: "renewed",
        changeDollar: 500,
        changePercent: 0.33,
      },
      {
        age: 50,
        pledgeCurrent: 3000,
        pledgePrior: 0,
        householdKey: "hh_2",
        status: "current-only",
        changeDollar: 3000,
        changePercent: null,
      },
      {
        age: 60,
        pledgeCurrent: 0,
        pledgePrior: 1000,
        householdKey: "hh_3",
        status: "prior-only",
        changeDollar: -1000,
        changePercent: -1,
      },
    ];

    const totals = calculateTotals(rows);

    expect(totals.totalHouseholds).toBe(3);
    expect(totals.totalPledgedCurrent).toBe(5000);
    expect(totals.totalPledgedPrior).toBe(2500);
    expect(totals.deltaDollar).toBe(2500);
    expect(totals.deltaPercent).toBe(1);
    expect(totals.renewed).toBe(1);
    expect(totals.currentOnly).toBe(1);
    expect(totals.priorOnly).toBe(1);
    expect(totals.noPledgeBoth).toBe(0);
  });
});
