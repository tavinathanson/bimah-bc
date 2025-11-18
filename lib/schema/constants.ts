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

/**
 * Member tenure cohorts (years of membership)
 */
export const TENURE_COHORTS = [
  { label: "New (0-2 yrs)", min: 0, max: 3 },
  { label: "Established (3-5 yrs)", min: 3, max: 6 },
  { label: "Committed (6-10 yrs)", min: 6, max: 11 },
  { label: "Legacy (11+ yrs)", min: 11, max: Infinity },
] as const;

/**
 * Common charge type groupings for synagogue giving
 * Users can customize these, but these are sensible defaults
 */
export const CHARGE_TYPE_GROUPS = {
  "Dues & Pledges": [
    "Hineini Pledges",
    "HH Pledges/Memorial Book",
    "Membership Dues",
    "Annual Pledge",
  ],
  "Programs & Education": [
    "Religious School Fees",
    "Adult Education",
    "Youth Programs",
  ],
  "High Holidays": [
    "High Holiday Tickets",
    "Yizkor Book",
  ],
  "Other": [],
} as const;

/**
 * Known ShulCloud column names for format detection
 */
export const SHULCLOUD_TRANSACTION_COLUMNS = [
  "Date",
  "ID",
  "Member Since",
  "Type",
  "Charge",
  "Join Date",
  "Zip",
  "Primary's Birthday",
  "Account ID",
  "Type External ID",
  "Date Entered",
] as const;
