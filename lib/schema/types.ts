import { z } from "zod";

/**
 * Raw row data from parsed spreadsheet
 */
export const RawRowSchema = z.object({
  age: z.number().int().nonnegative(),
  pledgeCurrent: z.number().nonnegative(),
  pledgePrior: z.number().nonnegative(),
  zipCode: z.string().optional(),
});

export type RawRow = z.infer<typeof RawRowSchema>;

/**
 * Row with computed fields
 */
export const PledgeRowSchema = RawRowSchema.extend({
  householdKey: z.string(),
  status: z.enum(["renewed", "current-only", "prior-only", "no-pledge-both"]),
  changeDollar: z.number(),
  changePercent: z.number().nullable(),
});

export type PledgeRow = z.infer<typeof PledgeRowSchema>;

/**
 * Age cohorts
 */
export const AgeCohort = z.enum(["Under 40", "40-49", "50-64", "65+"]);
export type AgeCohort = z.infer<typeof AgeCohort>;

/**
 * Pledge status
 */
export const PledgeStatus = z.enum(["renewed", "current-only", "prior-only", "no-pledge-both"]);
export type PledgeStatus = z.infer<typeof PledgeStatus>;

/**
 * Change direction for renewed pledges
 */
export const ChangeDirection = z.enum(["increased", "decreased", "no-change"]);
export type ChangeDirection = z.infer<typeof ChangeDirection>;

/**
 * Pledge bin label
 */
export const PledgeBinLabel = z.enum([
  "$1-$1,799",
  "$1,800-$2,499",
  "$2,500-$3,599",
  "$3,600-$5,399",
  "$5,400+",
]);
export type PledgeBinLabel = z.infer<typeof PledgeBinLabel>;

/**
 * Column mapping from user
 */
export const ColumnMappingSchema = z.object({
  age: z.string().optional(),
  dob: z.string().optional(),
  pledgeCurrent: z.string(),
  pledgePrior: z.string(),
  zipCode: z.string().optional(),
}).refine(
  (data) => data.age || data.dob,
  {
    message: "Either age or date of birth (dob) must be provided",
  }
);

export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;

/**
 * Parse error
 */
export const ParseErrorSchema = z.object({
  row: z.number(),
  column: z.string().optional(),
  message: z.string(),
});

export type ParseError = z.infer<typeof ParseErrorSchema>;

/**
 * Parsed file result
 */
export const ParsedFileSchema = z.object({
  fileName: z.string(),
  rows: z.array(RawRowSchema),
  errors: z.array(ParseErrorSchema),
});

export type ParsedFile = z.infer<typeof ParsedFileSchema>;

/**
 * Transaction record from ShulCloud or similar exports
 */
export const TransactionSchema = z.object({
  date: z.date(),
  accountId: z.string(),
  chargeType: z.string(),
  amount: z.number(),
  zip: z.string().optional(),
  primaryBirthday: z.date().optional(),
  memberSince: z.date().optional(),
  joinDate: z.date().optional(),
  typeExternalId: z.string().optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

/**
 * Aggregated household summary computed from transactions
 */
export const HouseholdSummarySchema = z.object({
  accountId: z.string(),
  age: z.number().optional(),
  zip: z.string().optional(),
  memberSince: z.date().optional(),
  // Nested structure: chargeType -> year -> total amount
  byChargeType: z.record(z.string(), z.record(z.string(), z.number())),
  // For backward compatibility with existing dashboard
  totalsByYear: z.record(z.string(), z.number()),
});

export type HouseholdSummary = z.infer<typeof HouseholdSummarySchema>;

/**
 * Analysis mode for dashboard views
 */
export const AnalysisMode = z.enum(["overview", "comparison", "by-charge-type", "member-journey"]);
export type AnalysisMode = z.infer<typeof AnalysisMode>;

/**
 * Data source type - legacy pledge comparison or transaction-based
 */
export const DataSourceType = z.enum(["legacy-pledges", "transactions"]);
export type DataSourceType = z.infer<typeof DataSourceType>;
