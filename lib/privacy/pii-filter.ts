/**
 * PII (Personally Identifiable Information) filtering utilities
 *
 * This module provides functions to strip sensitive data from imports:
 * - Name columns are completely removed (not shown in preview, not available for mapping)
 * - Birthday/DOB columns are converted to age immediately
 */

import { differenceInYears, parse, isValid } from "date-fns";

/**
 * Patterns that identify name-containing columns
 * These columns should be completely stripped from headers and data
 */
const NAME_COLUMN_PATTERNS = [
  /\bname\b/i, // "name", "Name", "NAME"
  /\bfirst\s*name\b/i, // "first name", "firstname", "First Name"
  /\blast\s*name\b/i, // "last name", "lastname", "Last Name"
  /\bfull\s*name\b/i, // "full name", "fullname"
  /\bmiddle\s*name\b/i, // "middle name"
  /\bprimary\s*name\b/i, // "primary name"
  /\bspouse\s*name\b/i, // "spouse name"
  /\bpartner\s*name\b/i, // "partner name"
  /\bmember\s*name\b/i, // "member name"
  /\bdonor\s*name\b/i, // "donor name"
  /\bhousehold\s*name\b/i, // "household name"
  /\bfamily\s*name\b/i, // "family name"
  /\bgiven\s*name\b/i, // "given name"
  /\bsurname\b/i, // "surname"
  /\bnickname\b/i, // "nickname"
  /\bpreferred\s*name\b/i, // "preferred name"
  /\bsalutation\b/i, // "salutation" (often contains names)
  /\bprimary's\s*name\b/i, // "Primary's Name" (ShulCloud)
  /\bspouse's\s*name\b/i, // "Spouse's Name" (ShulCloud)
];

/**
 * Patterns that identify birthday/DOB columns
 * These columns should be converted to age in previews
 */
const DOB_COLUMN_PATTERNS = [
  /\bdob\b/i, // "DOB", "dob"
  /\bdate\s*of\s*birth\b/i, // "date of birth"
  /\bbirth\s*date\b/i, // "birth date", "birthdate"
  /\bbirthday\b/i, // "birthday", "Birthday"
  /\bbirth\s*day\b/i, // "birth day"
  /\bbdate\b/i, // "bdate"
  /\bprimary's\s*birthday\b/i, // "Primary's Birthday" (ShulCloud)
  /\bspouse's\s*birthday\b/i, // "Spouse's Birthday" (ShulCloud)
];

/**
 * Check if a column header matches name patterns
 */
export function isNameColumn(header: string): boolean {
  const normalized = header.trim();
  return NAME_COLUMN_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Check if a column header matches DOB/birthday patterns
 */
export function isDobColumn(header: string): boolean {
  const normalized = header.trim();
  return DOB_COLUMN_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Check if a column is sensitive (either name or DOB)
 */
export function isSensitiveColumn(header: string): boolean {
  return isNameColumn(header) || isDobColumn(header);
}

/**
 * Filter headers to remove name columns
 * DOB columns are kept for mapping purposes but will be converted to age
 */
export function filterNameColumns(headers: string[]): string[] {
  return headers.filter((header) => !isNameColumn(header));
}

/**
 * Filter headers to remove all sensitive columns (name AND DOB)
 * Used for preview display where we don't want to show any PII
 */
export function filterSensitiveColumns(headers: string[]): string[] {
  return headers.filter((header) => !isSensitiveColumn(header));
}

/**
 * Convert a date value to age
 * Supports various formats: ISO, US dates, Excel serial dates
 */
export function convertToAge(value: unknown): number | null {
  if (!value) return null;

  let date: Date | null = null;

  // Handle Excel serial date numbers
  if (typeof value === "number") {
    // Excel dates are days since 1900-01-01 (with leap year bug correction)
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
  } else if (typeof value === "string") {
    const trimmed = value.trim();

    // Try common date formats with date-fns
    const formats = [
      "yyyy-MM-dd", // ISO: 2000-01-31
      "M/d/yyyy", // US: 1/31/2000 or 12/31/2000
      "MM/dd/yyyy", // US: 01/31/2000
      "d/M/yyyy", // International: 31/1/2000
      "dd/MM/yyyy", // International: 31/01/2000
      "yyyy/MM/dd", // Alternative ISO
      "M-d-yyyy", // US with dashes
      "d-M-yyyy", // International with dashes
    ];

    for (const format of formats) {
      try {
        const parsed = parse(trimmed, format, new Date());
        if (isValid(parsed)) {
          date = parsed;
          break;
        }
      } catch {
        // Continue to next format
      }
    }

    // If no format worked, try native Date parsing as fallback
    if (!date) {
      const nativeDate = new Date(trimmed);
      if (isValid(nativeDate)) {
        date = nativeDate;
      }
    }
  }

  if (!date || !isValid(date)) {
    return null;
  }

  // Calculate age
  const age = differenceInYears(new Date(), date);

  // Validate age is reasonable (0-120)
  if (age < 0 || age > 120) {
    return null;
  }

  return age;
}

/**
 * Sanitize a preview row by:
 * - Removing name columns entirely
 * - Converting DOB columns to age (labeled distinctly if Age column already exists)
 */
export function sanitizePreviewRow(
  row: Record<string, unknown>,
  headers: string[]
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  // Check if there's already an explicit Age column
  const hasExplicitAgeColumn = headers.some(
    (h) => /^age$/i.test(h.trim()) && !isDobColumn(h)
  );

  for (const header of headers) {
    const value = row[header];

    if (isNameColumn(header)) {
      // Skip name columns entirely - don't include in output
      continue;
    }

    if (isDobColumn(header)) {
      // Convert DOB to age
      const age = convertToAge(value);
      if (age !== null) {
        // If there's already an Age column, use a distinct label
        // Otherwise, show that this was converted from DOB
        const ageKey = hasExplicitAgeColumn ? "DOB → Age" : "DOB → Age";
        sanitized[ageKey] = age;
      }
      // Don't include the raw DOB value
      continue;
    }

    // Keep non-sensitive columns as-is
    sanitized[header] = value;
  }

  return sanitized;
}

/**
 * Sanitize multiple preview rows
 */
export function sanitizePreviewData(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  if (rows.length === 0) return [];

  // Get headers from first row
  const headers = Object.keys(rows[0] || {});

  return rows.map((row) => sanitizePreviewRow(row, headers));
}
