import { SHULCLOUD_TRANSACTION_COLUMNS } from "../schema/constants";

/**
 * Format signature for auto-detection
 */
export interface FormatSignature {
  id: string;
  name: string;
  description: string;
  requiredColumns: string[];
  optionalColumns: string[];
  // Minimum percentage of required columns that must match
  minMatchRatio: number;
}

/**
 * Result of format detection
 */
export interface FormatDetectionResult {
  format: FormatSignature | null;
  confidence: number;
  matchedColumns: string[];
  missingColumns: string[];
}

/**
 * Known file formats
 */
export const KNOWN_FORMATS: FormatSignature[] = [
  {
    id: "shulcloud-transactions",
    name: "ShulCloud Transactions",
    description: "Transaction export from ShulCloud with Date, Charge, Type, and Account ID",
    requiredColumns: ["Date", "Charge", "Type", "Account ID"],
    optionalColumns: ["Zip", "Primary's Birthday", "Member Since", "Join Date", "ID", "Type External ID", "Date Entered"],
    minMatchRatio: 1.0, // All required columns must match
  },
  {
    id: "bimah-legacy",
    name: "Bimah Pledge Comparison",
    description: "Year-over-year pledge comparison with age and two pledge columns",
    requiredColumns: [], // Will use pattern matching instead
    optionalColumns: [],
    minMatchRatio: 0,
  },
];

/**
 * Normalize a column header for comparison
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_\s-]+/g, " ");
}

/**
 * Check if two headers match (case-insensitive, whitespace-normalized)
 */
function headersMatch(header1: string, header2: string): boolean {
  return normalizeHeader(header1) === normalizeHeader(header2);
}

/**
 * Check if headers contain a pattern match for legacy format
 */
function detectLegacyFormat(headers: string[]): boolean {
  const normalized = headers.map(normalizeHeader);

  // Must have age or DOB
  const hasAge = normalized.some(h =>
    /^(age|years|yrs|member\s*age|donor\s*age)$/.test(h) ||
    /^(dob|date\s*of\s*birth|birth\s*date|birthday)$/.test(h)
  );

  // Must have two year columns (like 2025, 2026) or current/prior
  const yearPattern = /^(20\d{2}|fy\d{2}|fy20\d{2})$/;
  const yearColumns = normalized.filter(h => yearPattern.test(h));
  const hasTwoYears = yearColumns.length >= 2;

  const hasCurrentPrior = normalized.some(h =>
    /^(current|pledge\s*current|current\s*pledge)$/.test(h)
  ) && normalized.some(h =>
    /^(prior|previous|last|pledge\s*prior|prior\s*pledge|last\s*year)$/.test(h)
  );

  return hasAge && (hasTwoYears || hasCurrentPrior);
}

/**
 * Detect file format from column headers
 */
export function detectFormat(headers: string[]): FormatDetectionResult {
  // First check for ShulCloud format (specific column names)
  const shulcloudFormat = KNOWN_FORMATS.find(f => f.id === "shulcloud-transactions")!;

  const matchedColumns: string[] = [];
  const missingColumns: string[] = [];

  for (const required of shulcloudFormat.requiredColumns) {
    const found = headers.some(h => headersMatch(h, required));
    if (found) {
      matchedColumns.push(required);
    } else {
      missingColumns.push(required);
    }
  }

  // Count optional matches for confidence scoring
  let optionalMatches = 0;
  for (const optional of shulcloudFormat.optionalColumns) {
    if (headers.some(h => headersMatch(h, optional))) {
      optionalMatches++;
      matchedColumns.push(optional);
    }
  }

  const requiredMatchRatio = shulcloudFormat.requiredColumns.length > 0
    ? matchedColumns.filter(c => shulcloudFormat.requiredColumns.includes(c)).length / shulcloudFormat.requiredColumns.length
    : 0;

  // If all required columns match, it's ShulCloud format
  if (requiredMatchRatio >= shulcloudFormat.minMatchRatio) {
    // Confidence based on required + optional matches
    const totalPossible = shulcloudFormat.requiredColumns.length + shulcloudFormat.optionalColumns.length;
    const confidence = Math.min(0.95, 0.7 + (matchedColumns.length / totalPossible) * 0.25);

    return {
      format: shulcloudFormat,
      confidence,
      matchedColumns,
      missingColumns,
    };
  }

  // Check for legacy format
  if (detectLegacyFormat(headers)) {
    const legacyFormat = KNOWN_FORMATS.find(f => f.id === "bimah-legacy")!;
    return {
      format: legacyFormat,
      confidence: 0.85,
      matchedColumns: [], // Pattern-based, not column-based
      missingColumns: [],
    };
  }

  // No format detected - will need manual mapping
  return {
    format: null,
    confidence: 0,
    matchedColumns: [],
    missingColumns: [],
  };
}

/**
 * Get column mapping for detected ShulCloud format
 */
export function getShulCloudColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  const columnMap: Record<string, string[]> = {
    date: ["Date"],
    accountId: ["Account ID"],
    chargeType: ["Type"],
    amount: ["Charge"],
    zip: ["Zip"],
    primaryBirthday: ["Primary's Birthday"],
    memberSince: ["Member Since"],
    joinDate: ["Join Date"],
    typeExternalId: ["Type External ID"],
  };

  for (const [field, patterns] of Object.entries(columnMap)) {
    for (const pattern of patterns) {
      const found = headers.find(h => headersMatch(h, pattern));
      if (found) {
        mapping[field] = found;
        break;
      }
    }
  }

  return mapping;
}
