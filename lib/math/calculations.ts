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
