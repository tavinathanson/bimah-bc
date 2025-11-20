import { z } from "zod";

/**
 * UNIVERSAL DATA MODEL
 *
 * This module defines normalized data structures for a multi-category analytics engine.
 *
 * PRIVACY PRINCIPLES:
 * - PII fields are marked with comments and should NEVER be displayed in UI
 * - PII fields should NEVER be published to the server
 * - Use lib/privacy/rules.ts to validate data before display/publish
 */

/**
 * Household - normalized household record
 */
export const HouseholdSchema = z.object({
  id: z.string(), // "hh_abc123"

  // === PII FIELDS (NEVER DISPLAY OR PUBLISH) ===
  primaryName: z.string().optional(), // PRIVATE: Household name
  secondaryName: z.string().optional(), // PRIVATE: Secondary contact
  email: z.string().optional(), // PRIVATE: Email address
  phone: z.string().optional(), // PRIVATE: Phone number

  // === SAFE AGGREGATION FIELDS ===
  memberCount: z.number().int().nonnegative().default(1),
  membershipType: z.enum(["member", "non-member", "prospect", "unknown"]).default("unknown"),
  joinedYear: z.number().int().optional(),
  source: z.string(), // which CSV file this came from
});

export type Household = z.infer<typeof HouseholdSchema>;

/**
 * Person - individual within a household
 */
export const PersonSchema = z.object({
  id: z.string(), // "person_xyz789"
  householdId: z.string(),

  // === PII FIELDS (NEVER DISPLAY OR PUBLISH) ===
  firstName: z.string().optional(), // PRIVATE: First name
  lastName: z.string().optional(), // PRIVATE: Last name
  email: z.string().optional(), // PRIVATE: Personal email

  // === SAFE DEMOGRAPHIC FIELDS ===
  age: z.number().int().nonnegative().optional(),
  dateOfBirth: z.date().optional(), // Used only to calculate age
  gender: z.enum(["M", "F", "other", "unknown"]).optional(),
  role: z.enum(["primary", "spouse", "child", "other"]).default("other"),
});

export type Person = z.infer<typeof PersonSchema>;

/**
 * Address - geographic data for a household
 */
export const AddressSchema = z.object({
  id: z.string(),
  householdId: z.string(),

  // === PII FIELDS (NEVER DISPLAY OR PUBLISH) ===
  street: z.string().optional(), // PRIVATE: Street address
  city: z.string().optional(), // PRIVATE: Can be quasi-identifier

  // === SAFE GEOGRAPHIC AGGREGATION ===
  state: z.string().optional(), // OK: State-level aggregation
  zipCode: z.string().optional(), // OK: ZIP-level aggregation (5-digit only)
  country: z.string().default("US"),

  // === COMPUTED (SAFE) ===
  coords: z.object({
    lat: z.number(),
    lon: z.number(),
  }).optional(),
  distanceFromSynagogue: z.number().optional(), // miles
});

export type Address = z.infer<typeof AddressSchema>;

/**
 * Transaction - financial activity record
 */
export const TransactionSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  date: z.date(),
  fiscalYear: z.number().int(), // computed from date
  amount: z.number(),
  chargeType: z.string(), // "Pledge", "Building Fund", "Event", etc.
  category: z.enum([
    "pledge",
    "dues",
    "donation",
    "event",
    "school",
    "other"
  ]).default("other"),

  // === PII FIELDS (NEVER DISPLAY OR PUBLISH) ===
  description: z.string().optional(), // PRIVATE: May contain names or other PII

  // === SAFE FIELDS ===
  paymentMethod: z.enum(["check", "credit", "cash", "eft", "other", "unknown"]).default("unknown"),
});

export type Transaction = z.infer<typeof TransactionSchema>;

/**
 * Derived pledge summary (backward-compatible with current PledgeRow)
 */
export const PledgeSummarySchema = z.object({
  householdId: z.string(),
  fiscalYear: z.number().int(),
  totalPledged: z.number(),
  totalPaid: z.number().optional(),
  pledgeStatus: z.enum(["renewed", "new", "lapsed", "none"]),
});

export type PledgeSummary = z.infer<typeof PledgeSummarySchema>;

/**
 * Lifecycle events (optional, for future expansion)
 */
export const LifecycleEventSchema = z.object({
  id: z.string(),
  householdId: z.string().optional(),
  personId: z.string().optional(),
  eventType: z.enum([
    "bar_mitzvah",
    "bat_mitzvah",
    "wedding",
    "yahrzeit",
    "baby_naming",
    "conversion",
    "other"
  ]),
  eventDate: z.date(),

  // === PII FIELDS (NEVER DISPLAY OR PUBLISH) ===
  description: z.string().optional(), // PRIVATE: May contain names
});

export type LifecycleEvent = z.infer<typeof LifecycleEventSchema>;

/**
 * Charge group configuration (user-defined groupings of charge types)
 */
export const ChargeGroupSchema = z.object({
  id: z.string(),
  name: z.string(), // "Major Campaigns", "Operating Funds", etc.
  chargeTypes: z.array(z.string()), // ["Building Fund", "Capital Campaign"]
  color: z.string().optional(), // for chart rendering
});

export type ChargeGroup = z.infer<typeof ChargeGroupSchema>;
