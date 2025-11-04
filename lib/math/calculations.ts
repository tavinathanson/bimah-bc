import type {
  RawRow,
  PledgeRow,
  PledgeStatus,
  AgeCohort,
  PledgeBinLabel,
  ChangeDirection,
} from "../schema/types";
import { AGE_COHORTS, PLEDGE_BINS } from "../schema/constants";
/**
 * Simple hash function for generating household keys
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).padStart(8, "0");
}

/**
 * Generate a deterministic household key for a row
 */
export function generateHouseholdKey(
  fileName: string,
  rowIndex: number,
  row: RawRow
): string {
  const content = `${fileName}|${rowIndex}|${row.age}|${row.pledgeCurrent}|${row.pledgePrior}`;
  return `hh_${simpleHash(content)}`;
}

/**
 * Classify pledge status based on current and prior pledge values
 */
export function classifyStatus(pledgeCurrent: number, pledgePrior: number): PledgeStatus {
  const hasCurrent = pledgeCurrent > 0;
  const hasPrior = pledgePrior > 0;

  if (hasCurrent && hasPrior) return "renewed";
  if (hasCurrent && !hasPrior) return "current-only";
  if (!hasCurrent && hasPrior) return "prior-only";
  return "no-pledge-both";
}

/**
 * Calculate dollar change
 */
export function calculateChangeDollar(pledgeCurrent: number, pledgePrior: number): number {
  return pledgeCurrent - pledgePrior;
}

/**
 * Calculate percent change (null if prior is 0)
 */
export function calculateChangePercent(
  pledgeCurrent: number,
  pledgePrior: number
): number | null {
  if (pledgePrior === 0) return null;
  return (pledgeCurrent - pledgePrior) / pledgePrior;
}

/**
 * Classify change direction for renewed pledges
 */
export function classifyChangeDirection(
  changeDollar: number,
  status: PledgeStatus
): ChangeDirection | null {
  if (status !== "renewed") return null;

  if (changeDollar > 0) return "increased";
  if (changeDollar < 0) return "decreased";
  return "no-change";
}

/**
 * Determine age cohort
 */
export function getAgeCohort(age: number): AgeCohort {
  for (const cohort of AGE_COHORTS) {
    if (age < cohort.max) {
      return cohort.label as AgeCohort;
    }
  }
  return "65+";
}

/**
 * Determine pledge bin (for current pledge > 0)
 */
export function getPledgeBin(amount: number): PledgeBinLabel | null {
  if (amount <= 0) return null;

  for (const bin of PLEDGE_BINS) {
    if (amount >= bin.min && amount < bin.max) {
      return bin.label as PledgeBinLabel;
    }
  }

  return null;
}

/**
 * Transform raw rows into enriched pledge rows
 */
export function enrichRows(fileName: string, rawRows: RawRow[]): PledgeRow[] {
  return rawRows.map((row, index) => {
    const householdKey = generateHouseholdKey(fileName, index, row);
    const status = classifyStatus(row.pledgeCurrent, row.pledgePrior);
    const changeDollar = calculateChangeDollar(row.pledgeCurrent, row.pledgePrior);
    const changePercent = calculateChangePercent(row.pledgeCurrent, row.pledgePrior);

    return {
      ...row,
      householdKey,
      status,
      changeDollar,
      changePercent,
    };
  });
}

/**
 * Calculate totals summary
 */
export interface TotalsSummary {
  totalHouseholds: number;
  totalPledgedCurrent: number;
  totalPledgedPrior: number;
  deltaDollar: number;
  deltaPercent: number | null;
  renewed: number;
  currentOnly: number;
  priorOnly: number;
  noPledgeBoth: number;
}

export function calculateTotals(rows: PledgeRow[]): TotalsSummary {
  const totalHouseholds = rows.length;
  const totalPledgedCurrent = rows.reduce((sum, row) => sum + row.pledgeCurrent, 0);
  const totalPledgedPrior = rows.reduce((sum, row) => sum + row.pledgePrior, 0);
  const deltaDollar = totalPledgedCurrent - totalPledgedPrior;
  const deltaPercent =
    totalPledgedPrior > 0 ? (totalPledgedCurrent - totalPledgedPrior) / totalPledgedPrior : null;

  const renewed = rows.filter((r) => r.status === "renewed").length;
  const currentOnly = rows.filter((r) => r.status === "current-only").length;
  const priorOnly = rows.filter((r) => r.status === "prior-only").length;
  const noPledgeBoth = rows.filter((r) => r.status === "no-pledge-both").length;

  return {
    totalHouseholds,
    totalPledgedCurrent,
    totalPledgedPrior,
    deltaDollar,
    deltaPercent,
    renewed,
    currentOnly,
    priorOnly,
    noPledgeBoth,
  };
}

/**
 * Calculate average and median
 */
export interface Stats {
  count: number;
  total: number;
  average: number;
  median: number;
}

export function calculateStats(amounts: number[]): Stats {
  const filtered = amounts.filter((a) => a > 0);
  const count = filtered.length;

  if (count === 0) {
    return { count: 0, total: 0, average: 0, median: 0 };
  }

  const total = filtered.reduce((sum, val) => sum + val, 0);
  const average = total / count;

  const sorted = [...filtered].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;

  return { count, total, average, median };
}

/**
 * Group rows by age cohort
 */
export interface CohortMetrics {
  cohort: AgeCohort;
  householdCount: number;
  totalCurrent: number;
  totalPrior: number;
  averageCurrent: number;
  medianCurrent: number;
  renewalRate: number;
  increased: number;
  decreased: number;
  noChange: number;
}

export function calculateCohortMetrics(rows: PledgeRow[]): CohortMetrics[] {
  const cohorts: AgeCohort[] = ["Under 40", "40-49", "50-64", "65+"];

  return cohorts.map((cohort) => {
    const cohortRows = rows.filter((r) => getAgeCohort(r.age) === cohort);
    const householdCount = cohortRows.length;

    const currentAmounts = cohortRows.map((r) => r.pledgeCurrent);
    const stats = calculateStats(currentAmounts);

    const totalCurrent = cohortRows.reduce((sum, r) => sum + r.pledgeCurrent, 0);
    const totalPrior = cohortRows.reduce((sum, r) => sum + r.pledgePrior, 0);

    const renewed = cohortRows.filter((r) => r.status === "renewed");
    const renewalRate = householdCount > 0 ? renewed.length / householdCount : 0;

    const increased = renewed.filter((r) => r.changeDollar > 0).length;
    const decreased = renewed.filter((r) => r.changeDollar < 0).length;
    const noChange = renewed.filter((r) => r.changeDollar === 0).length;

    return {
      cohort,
      householdCount,
      totalCurrent,
      totalPrior,
      averageCurrent: stats.average,
      medianCurrent: stats.median,
      renewalRate,
      increased,
      decreased,
      noChange,
    };
  });
}

/**
 * Group rows by pledge bin
 */
export interface BinMetrics {
  bin: PledgeBinLabel | "$0";
  householdCount: number;
  total: number;
  average: number;
  median: number;
}

export function calculateBinMetrics(rows: PledgeRow[]): BinMetrics[] {
  const bins: PledgeBinLabel[] = [
    "$1-$1,799",
    "$1,800-$2,499",
    "$2,500-$3,599",
    "$3,600-$5,399",
    "$5,400+",
  ];

  return bins.map((bin) => {
    const binRows = rows.filter((r) => getPledgeBin(r.pledgeCurrent) === bin);
    const amounts = binRows.map((r) => r.pledgeCurrent);
    const stats = calculateStats(amounts);

    return {
      bin,
      householdCount: binRows.length,
      total: stats.total,
      average: stats.average,
      median: stats.median,
    };
  });
}

/**
 * Calculate metrics for households with $0 current pledge
 */
export function calculateZeroPledgeMetrics(rows: PledgeRow[]): BinMetrics {
  const zeroRows = rows.filter((r) => r.pledgeCurrent === 0);
  return {
    bin: "$0",
    householdCount: zeroRows.length,
    total: 0,
    average: 0,
    median: 0,
  };
}

/**
 * Calculate renewal metrics by status
 */
export interface StatusMetrics {
  status: PledgeStatus;
  householdCount: number;
  totalCurrent: number;
  totalPrior: number;
}

export function calculateStatusMetrics(rows: PledgeRow[]): StatusMetrics[] {
  const statuses: PledgeStatus[] = ["renewed", "current-only", "prior-only", "no-pledge-both"];

  return statuses.map((status) => {
    const statusRows = rows.filter((r) => r.status === status);
    const householdCount = statusRows.length;
    const totalCurrent = statusRows.reduce((sum, r) => sum + r.pledgeCurrent, 0);
    const totalPrior = statusRows.reduce((sum, r) => sum + r.pledgePrior, 0);

    return {
      status,
      householdCount,
      totalCurrent,
      totalPrior,
    };
  });
}

/**
 * Advanced Insights Metrics
 */

export interface AdvancedInsights {
  retentionRate: number;
  averagePledgeByAge: { cohort: string; average: number }[];
  pledgeConcentration: {
    top10Percent: { households: number; amount: number; percentOfTotal: number };
    top25Percent: { households: number; amount: number; percentOfTotal: number };
    top50Percent: { households: number; amount: number; percentOfTotal: number };
  };
  newVsRenewedAverage: {
    currentOnly: number;
    renewed: number;
    difference: number;
  };
  upgradeDowngradeRates: {
    upgraded: number;
    downgraded: number;
    noChange: number;
    upgradeRate: number;
    downgradeRate: number;
  };
  pledgeChangeBehavior: {
    rangeMin: number;
    rangeMax: number;
    percentStable: number; // within ±10%
    percentSignificantChange: number; // changed by >$500
    q1: number; // 25th percentile of changes
    q3: number; // 75th percentile of changes
  };
  ageStats: {
    mean: number;
    median: number;
    mode: number;
  };
  generationalGiving: {
    generation: string;
    ageRange: string;
    count: number;
    totalPledge: number;
    averagePledge: number;
  }[];
}

export function calculateAdvancedInsights(rows: PledgeRow[]): AdvancedInsights {
  // Retention Rate
  const hadPriorPledge = rows.filter(r => r.pledgePrior > 0).length;
  const renewed = rows.filter(r => r.status === "renewed").length;
  const retentionRate = hadPriorPledge > 0 ? renewed / hadPriorPledge : 0;

  // Average Pledge by Age
  const cohortAverages = AGE_COHORTS.map(cohortDef => {
    const cohortRows = rows.filter(r => getAgeCohort(r.age) === cohortDef.label && r.pledgeCurrent > 0);
    const avg = cohortRows.length > 0
      ? cohortRows.reduce((sum, r) => sum + r.pledgeCurrent, 0) / cohortRows.length
      : 0;
    return { cohort: cohortDef.label, average: avg };
  });

  // Pledge Concentration
  const sortedByPledge = [...rows]
    .filter(r => r.pledgeCurrent > 0)
    .sort((a, b) => b.pledgeCurrent - a.pledgeCurrent);

  const totalPledge = sortedByPledge.reduce((sum, r) => sum + r.pledgeCurrent, 0);

  const top10Count = Math.ceil(sortedByPledge.length * 0.1);
  const top25Count = Math.ceil(sortedByPledge.length * 0.25);
  const top50Count = Math.ceil(sortedByPledge.length * 0.5);

  const top10Amount = sortedByPledge.slice(0, top10Count).reduce((sum, r) => sum + r.pledgeCurrent, 0);
  const top25Amount = sortedByPledge.slice(0, top25Count).reduce((sum, r) => sum + r.pledgeCurrent, 0);
  const top50Amount = sortedByPledge.slice(0, top50Count).reduce((sum, r) => sum + r.pledgeCurrent, 0);

  // New vs Renewed Average
  const currentOnlyRows = rows.filter(r => r.status === "current-only" && r.pledgeCurrent > 0);
  const renewedRows = rows.filter(r => r.status === "renewed" && r.pledgeCurrent > 0);

  const currentOnlyAvg = currentOnlyRows.length > 0
    ? currentOnlyRows.reduce((sum, r) => sum + r.pledgeCurrent, 0) / currentOnlyRows.length
    : 0;
  const renewedAvg = renewedRows.length > 0
    ? renewedRows.reduce((sum, r) => sum + r.pledgeCurrent, 0) / renewedRows.length
    : 0;

  // Upgrade/Downgrade Rates
  const renewedWithChanges = rows.filter(r => r.status === "renewed");
  const upgraded = renewedWithChanges.filter(r => r.changeDollar > 0).length;
  const downgraded = renewedWithChanges.filter(r => r.changeDollar < 0).length;
  const noChange = renewedWithChanges.filter(r => r.changeDollar === 0).length;

  const upgradeRate = renewedWithChanges.length > 0 ? upgraded / renewedWithChanges.length : 0;
  const downgradeRate = renewedWithChanges.length > 0 ? downgraded / renewedWithChanges.length : 0;

  // Pledge Change Behavior (more intuitive than variance/std dev)
  const changes = renewedWithChanges.map(r => r.changeDollar);
  const sortedChanges = [...changes].sort((a, b) => a - b);

  const rangeMin = sortedChanges[0] || 0;
  const rangeMax = sortedChanges[sortedChanges.length - 1] || 0;

  // Quartiles
  const q1Index = Math.floor(sortedChanges.length * 0.25);
  const q3Index = Math.floor(sortedChanges.length * 0.75);
  const q1 = sortedChanges[q1Index] || 0;
  const q3 = sortedChanges[q3Index] || 0;

  // Percent stable (within ±10% of prior pledge)
  const stable = renewedWithChanges.filter(r => {
    const percentChange = r.pledgePrior > 0 ? Math.abs(r.changeDollar / r.pledgePrior) : 0;
    return percentChange <= 0.10;
  }).length;
  const percentStable = renewedWithChanges.length > 0 ? stable / renewedWithChanges.length : 0;

  // Percent with significant change (>$500 absolute change)
  const significantChange = renewedWithChanges.filter(r => Math.abs(r.changeDollar) > 500).length;
  const percentSignificantChange = renewedWithChanges.length > 0 ? significantChange / renewedWithChanges.length : 0;

  // Age Stats
  const ages = rows.map(r => r.age).sort((a, b) => a - b);
  const meanAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
  const medianAge = ages.length % 2 === 0
    ? (ages[ages.length / 2 - 1]! + ages[ages.length / 2]!) / 2
    : ages[Math.floor(ages.length / 2)]!;

  // Mode (most common age)
  const ageFreq: Record<number, number> = {};
  ages.forEach(age => ageFreq[age] = (ageFreq[age] || 0) + 1);
  const modeAge = Number(Object.keys(ageFreq).reduce((a, b) => ageFreq[Number(a)]! > ageFreq[Number(b)]! ? a : b));

  // Generational Giving
  const generations = [
    { generation: "Silent Generation", ageRange: "79+", minAge: 79, maxAge: 150 },
    { generation: "Baby Boomers", ageRange: "60-78", minAge: 60, maxAge: 78 },
    { generation: "Gen X", ageRange: "44-59", minAge: 44, maxAge: 59 },
    { generation: "Millennials", ageRange: "28-43", minAge: 28, maxAge: 43 },
    { generation: "Gen Z", ageRange: "12-27", minAge: 12, maxAge: 27 },
  ];

  const generationalGiving = generations.map(gen => {
    const genRows = rows.filter(r => r.age >= gen.minAge && r.age <= gen.maxAge && r.pledgeCurrent > 0);
    const total = genRows.reduce((sum, r) => sum + r.pledgeCurrent, 0);
    const avg = genRows.length > 0 ? total / genRows.length : 0;

    return {
      generation: gen.generation,
      ageRange: gen.ageRange,
      count: genRows.length,
      totalPledge: total,
      averagePledge: avg,
    };
  });

  return {
    retentionRate,
    averagePledgeByAge: cohortAverages,
    pledgeConcentration: {
      top10Percent: {
        households: top10Count,
        amount: top10Amount,
        percentOfTotal: totalPledge > 0 ? (top10Amount / totalPledge) * 100 : 0,
      },
      top25Percent: {
        households: top25Count,
        amount: top25Amount,
        percentOfTotal: totalPledge > 0 ? (top25Amount / totalPledge) * 100 : 0,
      },
      top50Percent: {
        households: top50Count,
        amount: top50Amount,
        percentOfTotal: totalPledge > 0 ? (top50Amount / totalPledge) * 100 : 0,
      },
    },
    newVsRenewedAverage: {
      currentOnly: currentOnlyAvg,
      renewed: renewedAvg,
      difference: renewedAvg - currentOnlyAvg,
    },
    upgradeDowngradeRates: {
      upgraded,
      downgraded,
      noChange,
      upgradeRate,
      downgradeRate,
    },
    pledgeChangeBehavior: {
      rangeMin,
      rangeMax,
      percentStable,
      percentSignificantChange,
      q1,
      q3,
    },
    ageStats: {
      mean: meanAge,
      median: medianAge,
      mode: modeAge,
    },
    generationalGiving,
  };
}
