/**
 * PRIVACY RULES AND VALIDATION
 *
 * This module defines strict privacy rules for handling personally identifiable
 * information (PII). These rules apply at all levels:
 *
 * 1. DISPLAY: PII should NEVER be shown in the UI, even locally
 * 2. STORAGE: PII should only exist temporarily in memory during processing
 * 3. EXPORT: PII must be stripped before any export (CSV, Excel, etc.)
 * 4. PUBLISH: PII must be stripped and validated before sending to server
 *
 * PRIVACY PRINCIPLE:
 * Users should never see PII in the dashboard, even in their own browser,
 * to prevent accidental screenshots, screen shares, or mistaken belief
 * that the data could be published.
 */

/**
 * PII fields that must NEVER be displayed, exported, or published
 *
 * These fields are organized by entity type for clarity.
 */
export const PII_FIELDS = {
  household: [
    "primaryName",
    "secondaryName",
    "email",
    "phone",
  ],
  person: [
    "firstName",
    "lastName",
    "email",
  ],
  address: [
    "street", // Street address is PII
    "city", // City can be quasi-identifier when combined with other data
  ],
  transaction: [
    "description", // May contain names or other PII
  ],
  lifecycleEvent: [
    "description", // May contain names
  ],
} as const;

/**
 * All PII fields flattened into a single array
 */
export const ALL_PII_FIELDS = Object.values(PII_FIELDS).flat();

/**
 * Safe fields that CAN be displayed and aggregated
 *
 * These are explicitly listed to make it clear what's allowed.
 */
export const SAFE_FIELDS = {
  household: [
    "id",
    "memberCount",
    "membershipType",
    "joinedYear",
    "source",
  ],
  person: [
    "id",
    "householdId",
    "age", // Age is OK, but DOB is not
    "gender",
    "role",
  ],
  address: [
    "id",
    "householdId",
    "state", // State-level is OK
    "zipCode", // ZIP is OK for geographic aggregation
    "country",
    "coords",
    "distanceFromSynagogue",
  ],
  transaction: [
    "id",
    "householdId",
    "date",
    "fiscalYear",
    "amount",
    "chargeType",
    "category",
    "paymentMethod",
  ],
} as const;

/**
 * Strip PII from an object
 *
 * @param obj - Object that may contain PII
 * @param entityType - Type of entity (household, person, address, transaction)
 * @returns Object with PII fields removed
 */
export function stripPII<T extends Record<string, any>>(
  obj: T,
  entityType?: keyof typeof PII_FIELDS
): Partial<T> {
  const cleaned = { ...obj };

  // If entity type specified, use specific PII list
  if (entityType && PII_FIELDS[entityType]) {
    PII_FIELDS[entityType].forEach((field) => {
      delete cleaned[field as keyof T];
    });
  } else {
    // Otherwise strip all known PII fields
    ALL_PII_FIELDS.forEach((field) => {
      delete cleaned[field as keyof T];
    });
  }

  return cleaned;
}

/**
 * Strip PII from an array of objects
 *
 * @param arr - Array of objects that may contain PII
 * @param entityType - Type of entity
 * @returns Array with PII removed from all objects
 */
export function stripPIIFromArray<T extends Record<string, any>>(
  arr: T[],
  entityType?: keyof typeof PII_FIELDS
): Partial<T>[] {
  return arr.map(obj => stripPII(obj, entityType));
}

/**
 * Validate that data contains no PII
 *
 * This is used before publishing or exporting data to ensure no PII leaks.
 *
 * @param data - Array of objects to validate
 * @param entityType - Optional entity type for more specific validation
 * @returns Validation result with list of violations
 */
export function validateNoPII(
  data: any[],
  entityType?: keyof typeof PII_FIELDS
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const fieldsToCheck = entityType ? PII_FIELDS[entityType] : ALL_PII_FIELDS;

  data.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      return;
    }

    fieldsToCheck.forEach((field) => {
      if (row[field] !== undefined && row[field] !== null) {
        violations.push(
          `Row ${index + 1}: contains PII field "${field}" with value`
        );
      }
    });
  });

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Anonymize aggregate statistics
 *
 * Even aggregate data can be PII if the group size is too small (k-anonymity).
 * This function ensures aggregates meet minimum thresholds.
 *
 * @param aggregates - Array of aggregate records with a count field
 * @param minGroupSize - Minimum group size to display (default: 5)
 * @returns Filtered aggregates that meet anonymity threshold
 */
export function anonymizeAggregates<T extends { count: number }>(
  aggregates: T[],
  minGroupSize: number = 5
): T[] {
  return aggregates.filter(agg => agg.count >= minGroupSize);
}

/**
 * Check if a field is safe to display
 *
 * @param fieldName - Name of the field
 * @param entityType - Type of entity (optional)
 * @returns true if the field is safe to display
 */
export function isSafeField(
  fieldName: string,
  entityType?: keyof typeof SAFE_FIELDS
): boolean {
  // Check if field is in the PII list
  if (ALL_PII_FIELDS.includes(fieldName as any)) {
    return false;
  }

  // If entity type specified, check if in safe list
  if (entityType && SAFE_FIELDS[entityType]) {
    return SAFE_FIELDS[entityType].includes(fieldName as any);
  }

  // Conservative: if not explicitly in safe list, consider unsafe
  return false;
}

/**
 * Create a privacy-safe summary for display
 *
 * Replaces PII fields with placeholder text.
 *
 * @param obj - Object with potential PII
 * @returns Object with PII replaced by "[PRIVATE]"
 */
export function createSafeSummary<T extends Record<string, any>>(
  obj: T
): Record<string, any> {
  const summary: Record<string, any> = { ...obj };

  ALL_PII_FIELDS.forEach((field) => {
    if (summary[field] !== undefined && summary[field] !== null) {
      summary[field] = "[PRIVATE]";
    }
  });

  return summary;
}

/**
 * Validation error for privacy violations
 */
export class PrivacyViolationError extends Error {
  constructor(
    public violations: string[],
    message: string = "Privacy violation detected"
  ) {
    super(message);
    this.name = "PrivacyViolationError";
  }
}

/**
 * Assert that data is safe to publish/export
 *
 * Throws PrivacyViolationError if PII is detected.
 *
 * @param data - Data to validate
 * @param context - Context description for error messages
 */
export function assertNoPII(data: any[], context: string = "data"): void {
  const validation = validateNoPII(data);
  if (!validation.valid) {
    throw new PrivacyViolationError(
      validation.violations,
      `Privacy violation in ${context}: PII fields detected`
    );
  }
}
