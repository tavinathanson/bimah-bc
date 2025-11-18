import * as XLSX from "xlsx";
import { parse, differenceInYears, isValid } from "date-fns";
import type { Transaction, ParseError, PledgeRow } from "../schema/types";
import { getShulCloudColumnMapping } from "./formatDetection";

/**
 * Parse result for transaction files
 */
export interface ParsedTransactions {
  fileName: string;
  transactions: Transaction[];
  errors: ParseError[];
  chargeTypes: string[];
  dateRange: { min: Date; max: Date } | null;
}

/**
 * Parse a numeric value from a cell, handling currency symbols, commas, etc.
 */
function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && !isNaN(value) && isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "").trim();
    if (cleaned === "" || cleaned === "-") {
      return null;
    }
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Parse a date value from various formats
 */
function parseDate(value: unknown): Date | null {
  if (!value) return null;

  let date: Date | null = null;

  // Handle Excel serial date numbers
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
  } else if (typeof value === "string") {
    const trimmed = value.trim();

    const formats = [
      'yyyy-MM-dd',
      'M/d/yyyy',
      'MM/dd/yyyy',
      'd/M/yyyy',
      'dd/MM/yyyy',
      'yyyy/MM/dd',
      'M-d-yyyy',
      'd-M-yyyy',
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

    if (!date) {
      const nativeDate = new Date(trimmed);
      if (isValid(nativeDate)) {
        date = nativeDate;
      }
    }
  }

  return date && isValid(date) ? date : null;
}

/**
 * Detect CSV delimiter
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
 * Parse a ShulCloud transaction export file
 */
export async function parseTransactionFile(file: File): Promise<ParsedTransactions> {
  const errors: ParseError[] = [];
  const transactions: Transaction[] = [];
  const chargeTypesSet = new Set<string>();
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    let workbook: XLSX.WorkBook;

    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(arrayBuffer);
      const delimiter = detectCSVDelimiter(text);
      workbook = XLSX.read(text, { type: "string", raw: false, FS: delimiter });
    } else {
      workbook = XLSX.read(arrayBuffer, { type: "array", raw: false });
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      errors.push({ row: 0, message: "No sheets found in workbook" });
      return { fileName: file.name, transactions, errors, chargeTypes: [], dateRange: null };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      errors.push({ row: 0, message: "Could not read worksheet" });
      return { fileName: file.name, transactions, errors, chargeTypes: [], dateRange: null };
    }

    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    if (jsonData.length === 0) {
      errors.push({ row: 0, message: "File is empty" });
      return { fileName: file.name, transactions, errors, chargeTypes: [], dateRange: null };
    }

    // Get headers
    const firstRow = jsonData[0];
    if (!firstRow) {
      errors.push({ row: 0, message: "Invalid header row format" });
      return { fileName: file.name, transactions, errors, chargeTypes: [], dateRange: null };
    }

    const headers = Array.isArray(firstRow) ? firstRow : Object.values(firstRow);
    const headerStrings = headers.map((h) => String(h || "").trim());

    // Get column mapping
    const mapping = getShulCloudColumnMapping(headerStrings);

    // Validate required columns
    if (!mapping.date) {
      errors.push({ row: 0, message: 'Required column "Date" not found' });
    }
    if (!mapping.accountId) {
      errors.push({ row: 0, message: 'Required column "Account ID" not found' });
    }
    if (!mapping.chargeType) {
      errors.push({ row: 0, message: 'Required column "Type" not found' });
    }
    if (!mapping.amount) {
      errors.push({ row: 0, message: 'Required column "Charge" not found' });
    }

    if (errors.length > 0) {
      return { fileName: file.name, transactions, errors, chargeTypes: [], dateRange: null };
    }

    // Get column indices
    const dateIdx = headerStrings.indexOf(mapping.date!);
    const accountIdIdx = headerStrings.indexOf(mapping.accountId!);
    const chargeTypeIdx = headerStrings.indexOf(mapping.chargeType!);
    const amountIdx = headerStrings.indexOf(mapping.amount!);
    const zipIdx = mapping.zip ? headerStrings.indexOf(mapping.zip) : -1;
    const birthdayIdx = mapping.primaryBirthday ? headerStrings.indexOf(mapping.primaryBirthday) : -1;
    const memberSinceIdx = mapping.memberSince ? headerStrings.indexOf(mapping.memberSince) : -1;
    const joinDateIdx = mapping.joinDate ? headerStrings.indexOf(mapping.joinDate) : -1;
    const typeExternalIdIdx = mapping.typeExternalId ? headerStrings.indexOf(mapping.typeExternalId) : -1;

    // Parse data rows
    for (let i = 1; i < jsonData.length; i++) {
      const rowData = jsonData[i];
      if (!rowData) continue;

      const dataRow = Array.isArray(rowData) ? rowData : Object.values(rowData);
      const rowNum = i + 1;

      // Parse required fields
      const date = parseDate(dataRow[dateIdx]);
      if (!date) {
        errors.push({ row: rowNum, message: `Invalid date value: "${dataRow[dateIdx]}"` });
        continue;
      }

      const accountId = String(dataRow[accountIdIdx] || "").trim();
      if (!accountId) {
        errors.push({ row: rowNum, message: "Missing Account ID" });
        continue;
      }

      const chargeType = String(dataRow[chargeTypeIdx] || "").trim();
      if (!chargeType) {
        errors.push({ row: rowNum, message: "Missing charge type" });
        continue;
      }

      const amount = parseNumericValue(dataRow[amountIdx]);
      if (amount === null) {
        errors.push({ row: rowNum, message: `Invalid charge amount: "${dataRow[amountIdx]}"` });
        continue;
      }

      // Parse optional fields
      const zip = zipIdx !== -1 && dataRow[zipIdx] ? String(dataRow[zipIdx]).trim() : undefined;
      const primaryBirthday = birthdayIdx !== -1 ? parseDate(dataRow[birthdayIdx]) : undefined;
      const memberSince = memberSinceIdx !== -1 ? parseDate(dataRow[memberSinceIdx]) : undefined;
      const joinDate = joinDateIdx !== -1 ? parseDate(dataRow[joinDateIdx]) : undefined;
      const typeExternalId = typeExternalIdIdx !== -1 && dataRow[typeExternalIdIdx]
        ? String(dataRow[typeExternalIdIdx]).trim()
        : undefined;

      transactions.push({
        date,
        accountId,
        chargeType,
        amount,
        zip: zip || undefined,
        primaryBirthday: primaryBirthday || undefined,
        memberSince: memberSince || undefined,
        joinDate: joinDate || undefined,
        typeExternalId: typeExternalId || undefined,
      });

      chargeTypesSet.add(chargeType);

      // Track date range
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }

    return {
      fileName: file.name,
      transactions,
      errors,
      chargeTypes: Array.from(chargeTypesSet).sort(),
      dateRange: minDate && maxDate ? { min: minDate, max: maxDate } : null,
    };
  } catch (error) {
    errors.push({
      row: 0,
      message: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
    });
    return { fileName: file.name, transactions, errors, chargeTypes: [], dateRange: null };
  }
}

/**
 * Configuration for aggregating transactions to PledgeRow format
 */
export interface AggregationConfig {
  // Which charge types to include (empty = all)
  chargeTypes: string[];
  // Current fiscal year (e.g., 2026)
  currentYear: number;
  // Prior years to compare against (e.g., [2025] or [2023, 2024, 2025])
  priorYears: number[];
}

/**
 * Aggregate transactions into PledgeRow format for backward compatibility
 * Groups by account ID and compares current year vs prior years (can be a range)
 */
export function aggregateTransactionsToPledgeRows(
  transactions: Transaction[],
  config: AggregationConfig
): PledgeRow[] {
  // Filter by charge types if specified
  const filtered = config.chargeTypes.length > 0
    ? transactions.filter(t => config.chargeTypes.includes(t.chargeType))
    : transactions;

  // Group by account ID
  const byAccount = new Map<string, {
    transactions: Transaction[];
    currentTotal: number;
    priorTotal: number;
    latestBirthday?: Date;
    latestZip?: string;
    latestMemberSince?: Date;
  }>();

  for (const t of filtered) {
    const year = t.date.getFullYear();
    const existing = byAccount.get(t.accountId) || {
      transactions: [],
      currentTotal: 0,
      priorTotal: 0,
    };

    existing.transactions.push(t);

    if (year === config.currentYear) {
      existing.currentTotal += t.amount;
    } else if (config.priorYears.includes(year)) {
      existing.priorTotal += t.amount;
    }

    // Use the most recent birthday, zip, and memberSince
    if (t.primaryBirthday && (!existing.latestBirthday || t.date > new Date())) {
      existing.latestBirthday = t.primaryBirthday;
    }
    if (t.zip) {
      existing.latestZip = t.zip;
    }
    if (t.memberSince) {
      existing.latestMemberSince = t.memberSince;
    }

    byAccount.set(t.accountId, existing);
  }

  // Convert to PledgeRow format
  const pledgeRows: PledgeRow[] = [];

  for (const [accountId, data] of byAccount) {
    // Calculate age from birthday
    let age = 50; // Default age if no birthday
    if (data.latestBirthday) {
      age = differenceInYears(new Date(), data.latestBirthday);
    }

    // Determine status
    const hasCurrent = data.currentTotal > 0;
    const hasPrior = data.priorTotal > 0;

    let status: "renewed" | "current-only" | "prior-only" | "no-pledge-both";
    if (hasCurrent && hasPrior) {
      status = "renewed";
    } else if (hasCurrent && !hasPrior) {
      status = "current-only";
    } else if (!hasCurrent && hasPrior) {
      status = "prior-only";
    } else {
      status = "no-pledge-both";
    }

    // For multi-year prior periods, calculate average per year for fair comparison
    const priorYearCount = config.priorYears.length;
    const normalizedPriorTotal = priorYearCount > 1
      ? data.priorTotal / priorYearCount
      : data.priorTotal;

    const changeDollar = data.currentTotal - normalizedPriorTotal;
    const changePercent = normalizedPriorTotal > 0
      ? (data.currentTotal - normalizedPriorTotal) / normalizedPriorTotal
      : null;

    pledgeRows.push({
      householdKey: `txn_${accountId}`,
      age,
      pledgeCurrent: data.currentTotal,
      pledgePrior: normalizedPriorTotal,
      zipCode: data.latestZip,
      status,
      changeDollar,
      changePercent,
    });
  }

  return pledgeRows;
}

/**
 * Get available years from transactions
 */
export function getTransactionYears(transactions: Transaction[]): number[] {
  const years = new Set<number>();
  for (const t of transactions) {
    years.add(t.date.getFullYear());
  }
  return Array.from(years).sort((a, b) => b - a); // Descending
}
