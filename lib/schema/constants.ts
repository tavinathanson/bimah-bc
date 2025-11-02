/**
 * Fiscal year definition
 */
export const FISCAL_YEAR = {
  label: "FY26",
  startDate: "2025-07-01",
  endDate: "2026-06-30",
} as const;

/**
 * Pledge bin definitions [inclusive lower, exclusive upper) except last bin
 */
export const PLEDGE_BINS = [
  { label: "$1-$1,799", min: 1, max: 1800 },
  { label: "$1,800-$2,499", min: 1800, max: 2500 },
  { label: "$2,500-$3,599", min: 2500, max: 3600 },
  { label: "$3,600-$5,399", min: 3600, max: 5400 },
  { label: "$5,400+", min: 5400, max: Infinity },
] as const;

/**
 * Age cohort definitions
 */
export const AGE_COHORTS = [
  { label: "Under 40", min: 0, max: 40 },
  { label: "40-49", min: 40, max: 50 },
  { label: "50-64", min: 50, max: 65 },
  { label: "65+", min: 65, max: Infinity },
] as const;
