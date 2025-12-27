import * as XLSX from "xlsx";
import { parseDateOfBirth } from "./parser";
import type { ParseError, RawRow } from "../schema/types";
import { RawRowSchema } from "../schema/types";

/**
 * Required columns for ShulCloud format detection
 */
const SHULCLOUD_REQUIRED_COLUMNS = [
  "Type",
  "Charge",
  "Account ID",
  "Primary's Birthday",
];

/**
 * Optional columns that help confirm ShulCloud format
 */
const SHULCLOUD_OPTIONAL_COLUMNS = [
  "Date",
  "ID",
  "Member Since",
  "Join Date",
  "Zip",
  "Type External ID",
  "Date Entered",
];

export interface ShulCloudDetectionResult {
  isShulCloud: boolean;
  confidence: "high" | "partial" | "none";
  missingColumns: string[];
  presentColumns: string[];
}

export interface ShulCloudParseResult {
  rows: RawRow[];
  errors: ParseError[];
  yearsFound: number[];
  accountCount: number;
  hasNegativeValues: boolean;
  // Intermediate data for multi-file combining
  accountData: Map<string, { yearAmounts: Map<number, number>; age: number; zipCode?: string }>;
}

/**
 * Detect if headers match ShulCloud Transactions Export format
 */
export function detectShulCloudFormat(headers: string[]): ShulCloudDetectionResult {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

  const requiredPresent: string[] = [];
  const requiredMissing: string[] = [];

  for (const col of SHULCLOUD_REQUIRED_COLUMNS) {
    const normalizedCol = col.toLowerCase();
    if (normalizedHeaders.some((h) => h === normalizedCol)) {
      requiredPresent.push(col);
    } else {
      requiredMissing.push(col);
    }
  }

  // Check optional columns to boost confidence
  let optionalMatches = 0;
  for (const col of SHULCLOUD_OPTIONAL_COLUMNS) {
    const normalizedCol = col.toLowerCase();
    if (normalizedHeaders.some((h) => h === normalizedCol)) {
      optionalMatches++;
    }
  }

  // Determine confidence level
  if (requiredMissing.length === 0) {
    return {
      isShulCloud: true,
      confidence: "high",
      missingColumns: [],
      presentColumns: requiredPresent,
    };
  } else if (requiredPresent.length >= 2 || optionalMatches >= 3) {
    // Some required columns present, or many optional columns match
    return {
      isShulCloud: false,
      confidence: "partial",
      missingColumns: requiredMissing,
      presentColumns: requiredPresent,
    };
  }

  return {
    isShulCloud: false,
    confidence: "none",
    missingColumns: requiredMissing,
    presentColumns: requiredPresent,
  };
}

/**
 * Extract fiscal year from Type column (e.g., "Hineini 25" → 2025)
 */
function extractFiscalYear(type: string): number | null {
  // Look for 2-digit year pattern: "Hineini 25", "HINEINI 26", etc.
  const match = type.match(/\b(2[0-9])\b/);
  if (!match) return null;
  return 2000 + parseInt(match[1], 10);
}

/**
 * Parse a charge value, handling currency symbols, commas, and accounting notation (parentheses for negatives)
 */
function parseChargeValue(value: unknown): number | null {
  if (typeof value === "number" && !isNaN(value) && isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    let trimmed = value.trim();

    // Check for accounting notation: ($100.00) or (100) - these are negative
    const isParentheses = trimmed.startsWith("(") && trimmed.endsWith(")");
    if (isParentheses) {
      trimmed = trimmed.slice(1, -1); // Remove parentheses
    }

    // Remove currency symbols, commas, and whitespace
    const cleaned = trimmed.replace(/[$,\s]/g, "").trim();

    if (cleaned === "" || cleaned === "-") {
      return null;
    }

    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && isFinite(parsed)) {
      // Apply negative if it was in parentheses
      return isParentheses ? -parsed : parsed;
    }
  }

  return null;
}

/**
 * Detect CSV delimiter by checking the first row
 */
function detectCSVDelimiter(text: string): string {
  const firstLine = text.split("\n")[0] || "";
  const delimiters = [",", "\t", ";", "|"];

  for (const delimiter of delimiters) {
    if (firstLine.includes(delimiter)) {
      return delimiter;
    }
  }

  return ",";
}

/**
 * Parse a ShulCloud Transactions Export file
 */
export async function parseShulCloudFile(file: File): Promise<ShulCloudParseResult> {
  const errors: ParseError[] = [];
  const rows: RawRow[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    let workbook: XLSX.WorkBook;

    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(arrayBuffer);
      const delimiter = detectCSVDelimiter(text);
      workbook = XLSX.read(text, {
        type: "string",
        raw: false,
        FS: delimiter,
      });
    } else {
      workbook = XLSX.read(arrayBuffer, {
        type: "array",
        raw: false,
      });
    }

    let hasNegativeValues = false;

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      errors.push({ row: 0, message: "No sheets found in workbook" });
      return { rows, errors, yearsFound: [], accountCount: 0, hasNegativeValues, accountData: new Map() };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      errors.push({ row: 0, message: "Could not read worksheet" });
      return { rows, errors, yearsFound: [], accountCount: 0, hasNegativeValues, accountData: new Map() };
    }

    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    if (jsonData.length === 0) {
      errors.push({ row: 0, message: "File is empty" });
      return { rows, errors, yearsFound: [], accountCount: 0, hasNegativeValues, accountData: new Map() };
    }

    // Get headers
    const firstRow = jsonData[0];
    if (!firstRow) {
      errors.push({ row: 0, message: "Invalid header row format" });
      return { rows, errors, yearsFound: [], accountCount: 0, hasNegativeValues, accountData: new Map() };
    }

    const headers = Array.isArray(firstRow) ? firstRow : Object.values(firstRow);
    const headerStrings = headers.map((h) => String(h || "").trim());
    const normalizedHeaders = headerStrings.map((h) => h.toLowerCase());

    // Find column indices
    const typeIndex = normalizedHeaders.indexOf("type");
    const chargeIndex = normalizedHeaders.indexOf("charge");
    const accountIdIndex = normalizedHeaders.indexOf("account id");
    const birthdayIndex = normalizedHeaders.indexOf("primary's birthday");
    const zipIndex = normalizedHeaders.indexOf("zip");

    // Validate required columns exist
    if (typeIndex === -1) {
      errors.push({ row: 0, message: 'Required column "Type" not found' });
    }
    if (chargeIndex === -1) {
      errors.push({ row: 0, message: 'Required column "Charge" not found' });
    }
    if (accountIdIndex === -1) {
      errors.push({ row: 0, message: 'Required column "Account ID" not found' });
    }
    if (birthdayIndex === -1) {
      errors.push({ row: 0, message: 'Required column "Primary\'s Birthday" not found' });
    }

    if (errors.length > 0) {
      return { rows, errors, yearsFound: [], accountCount: 0, hasNegativeValues, accountData: new Map() };
    }

    // Intermediate structure: accountId → { year → totalAmount, age, zip }
    const accountData = new Map<
      string,
      {
        yearAmounts: Map<number, number>;
        age: number | null;
        zipCode: string | undefined;
        birthdayRowNum: number; // For error reporting
      }
    >();

    const allYears = new Set<number>();

    // Process data rows (skip header)
    for (let i = 1; i < jsonData.length; i++) {
      const rowData = jsonData[i];
      if (!rowData) continue;

      const dataRow = Array.isArray(rowData) ? rowData : Object.values(rowData);
      const rowNum = i + 1; // 1-indexed for display

      const typeValue = String(dataRow[typeIndex] || "").trim();
      const chargeValue = dataRow[chargeIndex];
      const accountId = String(dataRow[accountIdIndex] || "").trim();
      const birthdayValue = dataRow[birthdayIndex];
      const zipValue = zipIndex !== -1 ? dataRow[zipIndex] : undefined;

      // Skip non-Hineini rows silently
      if (!typeValue.toLowerCase().includes("hineini")) {
        continue;
      }

      // Validate Account ID
      if (!accountId) {
        errors.push({
          row: rowNum,
          column: "Account ID",
          message: "Missing Account ID for Hineini transaction",
        });
        continue;
      }

      // Extract fiscal year from Type
      const year = extractFiscalYear(typeValue);
      if (year === null) {
        errors.push({
          row: rowNum,
          column: "Type",
          message: `Hineini transaction missing fiscal year (expected format like "Hineini 25"): "${typeValue}"`,
        });
        continue;
      }

      // Parse charge amount (supports negative values and accounting notation)
      const amount = parseChargeValue(chargeValue);
      if (amount === null) {
        errors.push({
          row: rowNum,
          column: "Charge",
          message: `Invalid charge value: "${chargeValue}"`,
        });
        continue;
      }

      // Track if we encounter negative values
      if (amount < 0) {
        hasNegativeValues = true;
      }

      // Track year
      allYears.add(year);

      // Get or create account entry
      let account = accountData.get(accountId);
      if (!account) {
        // Parse age from birthday (only once per account)
        const age = parseDateOfBirth(birthdayValue);

        // Parse ZIP code
        let zipCode: string | undefined;
        if (zipValue !== null && zipValue !== undefined && String(zipValue).trim() !== "") {
          zipCode = String(zipValue).trim();
        }

        account = {
          yearAmounts: new Map(),
          age,
          zipCode,
          birthdayRowNum: rowNum,
        };
        accountData.set(accountId, account);
      }

      // Sum amounts for the same account + year
      const existingAmount = account.yearAmounts.get(year) || 0;
      account.yearAmounts.set(year, existingAmount + amount);
    }

    // Validate we have at least 2 years of data
    const yearsFound = Array.from(allYears).sort((a, b) => b - a); // Descending

    if (yearsFound.length === 0) {
      errors.push({
        row: 0,
        message: "No valid Hineini transactions found in the file",
      });
      return { rows, errors, yearsFound: [], accountCount: 0, hasNegativeValues, accountData: new Map() };
    }

    // Note: We no longer error here if only 1 year is found.
    // The 2-year requirement is checked at the combined import level,
    // since users may import multiple files that together have 2+ years.

    // Build simplified accountData for combining (without birthdayRowNum)
    const simplifiedAccountData = new Map<string, { yearAmounts: Map<number, number>; age: number; zipCode?: string }>();

    for (const [accountId, account] of accountData) {
      if (account.age === null) {
        errors.push({
          row: account.birthdayRowNum,
          column: "Primary's Birthday",
          message: `Invalid or missing birthday for Account ID "${accountId}"`,
        });
        continue;
      }

      simplifiedAccountData.set(accountId, {
        yearAmounts: account.yearAmounts,
        age: account.age,
        zipCode: account.zipCode,
      });
    }

    // If we have 2+ years in this file, we can build rows directly
    if (yearsFound.length >= 2) {
      const currentYear = yearsFound[0];
      const priorYear = yearsFound[1];

      for (const [, account] of simplifiedAccountData) {
        const pledgeCurrent = account.yearAmounts.get(currentYear) ?? 0;
        const pledgePrior = account.yearAmounts.get(priorYear) ?? 0;

        const parsed = RawRowSchema.safeParse({
          age: account.age,
          pledgeCurrent,
          pledgePrior,
          zipCode: account.zipCode,
        });

        if (parsed.success) {
          rows.push(parsed.data);
        }
      }
    }

    return {
      rows,
      errors,
      yearsFound,
      accountCount: simplifiedAccountData.size,
      hasNegativeValues,
      accountData: simplifiedAccountData,
    };
  } catch (error) {
    errors.push({
      row: 0,
      message: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
    });
    return { rows, errors, yearsFound: [], accountCount: 0, hasNegativeValues: false, accountData: new Map() };
  }
}

/**
 * Combine multiple ShulCloud parse results into final rows.
 * This handles the case where different files contain different fiscal years.
 */
export function combineShulCloudResults(results: ShulCloudParseResult[]): {
  rows: RawRow[];
  allYears: number[];
  totalAccounts: number;
  hasNegativeValues: boolean;
  error?: string;
} {
  // Collect all years across all files
  const allYearsSet = new Set<number>();
  for (const result of results) {
    for (const year of result.yearsFound) {
      allYearsSet.add(year);
    }
  }
  const allYears = Array.from(allYearsSet).sort((a, b) => b - a); // Descending

  // Check 2-year requirement
  if (allYears.length < 2) {
    return {
      rows: [],
      allYears,
      totalAccounts: 0,
      hasNegativeValues: false,
      error: allYears.length === 0
        ? "No fiscal years found in the imported files."
        : `Only 1 fiscal year found (${allYears[0]}). Import files containing at least 2 fiscal years for year-to-year comparisons.`,
    };
  }

  const currentYear = allYears[0];
  const priorYear = allYears[1];

  // Merge account data across all files
  const mergedAccounts = new Map<string, { yearAmounts: Map<number, number>; age: number; zipCode?: string }>();

  for (const result of results) {
    for (const [accountId, account] of result.accountData) {
      const existing = mergedAccounts.get(accountId);
      if (existing) {
        // Merge year amounts
        for (const [year, amount] of account.yearAmounts) {
          const existingAmount = existing.yearAmounts.get(year) ?? 0;
          existing.yearAmounts.set(year, existingAmount + amount);
        }
      } else {
        // Clone the account data
        mergedAccounts.set(accountId, {
          yearAmounts: new Map(account.yearAmounts),
          age: account.age,
          zipCode: account.zipCode,
        });
      }
    }
  }

  // Build final rows
  const rows: RawRow[] = [];
  for (const [, account] of mergedAccounts) {
    const pledgeCurrent = account.yearAmounts.get(currentYear) ?? 0;
    const pledgePrior = account.yearAmounts.get(priorYear) ?? 0;

    const parsed = RawRowSchema.safeParse({
      age: account.age,
      pledgeCurrent,
      pledgePrior,
      zipCode: account.zipCode,
    });

    if (parsed.success) {
      rows.push(parsed.data);
    }
  }

  return {
    rows,
    allYears,
    totalAccounts: mergedAccounts.size,
    hasNegativeValues: results.some((r) => r.hasNegativeValues),
  };
}

/**
 * Get headers from a file (reused from main parser but needed here for detection)
 */
export async function getShulCloudFileHeaders(file: File): Promise<string[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    let workbook: XLSX.WorkBook;

    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(arrayBuffer);
      const delimiter = detectCSVDelimiter(text);
      workbook = XLSX.read(text, {
        type: "string",
        FS: delimiter,
      });
    } else {
      workbook = XLSX.read(arrayBuffer, { type: "array" });
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];

    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) return [];

    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    if (jsonData.length === 0) return [];

    const firstRow = jsonData[0];
    if (!firstRow) return [];

    const headers = Array.isArray(firstRow) ? firstRow : Object.values(firstRow);
    return headers.map((h) => String(h || "").trim()).filter((h) => h !== "");
  } catch {
    return [];
  }
}
