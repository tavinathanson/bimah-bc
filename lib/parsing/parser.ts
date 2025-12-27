import * as XLSX from "xlsx";
import { parse, differenceInYears, isValid } from "date-fns";
import type { ColumnMapping, ParsedFile, ParseError, RawRow } from "../schema/types";
import { RawRowSchema } from "../schema/types";

/**
 * Smart column mapping - guess column names based on common patterns
 */
export function guessColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};

  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  // Age patterns
  const agePatterns = /^(age|years|yrs|member\s*age|donor\s*age)$/i;
  const ageIndex = normalizedHeaders.findIndex(h => agePatterns.test(h));
  if (ageIndex !== -1) {
    mapping.age = headers[ageIndex];
  }

  // DOB patterns - look for date of birth, birthday, birthdate, etc.
  const dobPatterns = /^(dob|date\s*of\s*birth|birth\s*date|birthday|birth\s*day|bdate)$/i;
  const dobIndex = normalizedHeaders.findIndex(h => dobPatterns.test(h));
  if (dobIndex !== -1) {
    mapping.dob = headers[dobIndex];
  }

  // ZIP code patterns
  const zipPatterns = /^(zip|zip\s*code|postal|postal\s*code|zipcode)$/i;
  const zipIndex = normalizedHeaders.findIndex(h => zipPatterns.test(h));
  if (zipIndex !== -1) {
    mapping.zipCode = headers[zipIndex];
  }

  // Current year pledge patterns - look for current year, "2026", "current", etc.
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const currentPatterns = new RegExp(
    `^(${nextYear}|${currentYear}|current|pledge\\s*current|current\\s*pledge|fy${String(nextYear).slice(2)}|fy${nextYear})$`,
    'i'
  );
  const currentIndex = normalizedHeaders.findIndex(h => currentPatterns.test(h));
  if (currentIndex !== -1) {
    mapping.pledgeCurrent = headers[currentIndex];
  }

  // Prior year pledge patterns
  const priorYear = currentYear - 1;
  const priorPatterns = new RegExp(
    `^(${currentYear}|${priorYear}|prior|previous|last|pledge\\s*prior|prior\\s*pledge|last\\s*year|fy${String(currentYear).slice(2)}|fy${currentYear}|fy${String(priorYear).slice(2)}|fy${priorYear})$`,
    'i'
  );
  const priorIndex = normalizedHeaders.findIndex(h => priorPatterns.test(h));
  if (priorIndex !== -1) {
    mapping.pledgePrior = headers[priorIndex];
  }

  // If we found a "2026" column for current, look for "2025" for prior
  if (mapping.pledgeCurrent && !mapping.pledgePrior) {
    const match2026 = normalizedHeaders.findIndex(h => h === '2026');
    if (match2026 !== -1) {
      const match2025 = normalizedHeaders.findIndex(h => h === '2025');
      if (match2025 !== -1) {
        mapping.pledgePrior = headers[match2025];
      }
    }
  }

  return mapping;
}

/**
 * Parse a numeric value from a cell, handling currency symbols, commas, etc.
 */
export function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && !isNaN(value) && isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    // Remove currency symbols, commas, and whitespace
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
 * Parse age value, truncating floats toward zero
 */
function parseAge(value: unknown): number | null {
  const numeric = parseNumericValue(value);
  if (numeric === null || numeric < 0) {
    return null;
  }

  // Truncate toward zero (e.g., 39.7 → 39, -2.3 → -2)
  return Math.trunc(numeric);
}

/**
 * Parse date of birth and calculate age
 * Accepts various date formats: ISO (YYYY-MM-DD), US (MM/DD/YYYY), Excel serial dates
 */
export function parseDateOfBirth(value: unknown): number | null {
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
      'yyyy-MM-dd',     // ISO: 2000-01-31
      'M/d/yyyy',       // US: 1/31/2000 or 12/31/2000
      'MM/dd/yyyy',     // US: 01/31/2000
      'd/M/yyyy',       // International: 31/1/2000
      'dd/MM/yyyy',     // International: 31/01/2000
      'yyyy/MM/dd',     // Alternative ISO
      'M-d-yyyy',       // US with dashes
      'd-M-yyyy',       // International with dashes
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
 * Format Zod validation errors into user-friendly messages
 */
function formatZodError(error: { issues: Array<{ path: Array<string | number>; message: string }> }): string {
  const issue = error.issues[0];
  if (!issue) return "Validation failed";

  const field = issue.path[0];
  const message = issue.message;

  // Map field names to user-friendly terms
  const fieldMap: Record<string, string> = {
    age: "Age",
    pledgeCurrent: "Current year pledge",
    pledgePrior: "Prior year pledge",
  };

  const fieldName = fieldMap[field as string] || String(field);

  // Simplify common error messages
  if (message.includes("greater than or equal to 0")) {
    return `${fieldName} cannot be negative`;
  }

  if (message.includes("required")) {
    return `${fieldName} is required`;
  }

  // Default to showing the field name and message
  return `${fieldName}: ${message}`;
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

  return ","; // Default fallback
}

/**
 * Parse a file (XLSX or CSV) and return structured data
 */
export async function parseFile(
  file: File,
  mapping: ColumnMapping
): Promise<ParsedFile> {
  const errors: ParseError[] = [];
  const rows: RawRow[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    let workbook: XLSX.WorkBook;

    if (file.name.toLowerCase().endsWith(".csv")) {
      // Parse CSV with detected delimiter
      const text = new TextDecoder("utf-8").decode(arrayBuffer);
      const delimiter = detectCSVDelimiter(text);
      workbook = XLSX.read(text, {
        type: "string",
        raw: false,
        FS: delimiter,
      });
    } else {
      // Parse XLSX
      workbook = XLSX.read(arrayBuffer, {
        type: "array",
        raw: false,
      });
    }

    // Get first sheet
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      errors.push({
        row: 0,
        message: "No sheets found in workbook",
      });
      return { fileName: file.name, rows, errors };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      errors.push({
        row: 0,
        message: "Could not read worksheet",
      });
      return { fileName: file.name, rows, errors };
    }

    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    if (jsonData.length === 0) {
      errors.push({
        row: 0,
        message: "File is empty",
      });
      return { fileName: file.name, rows, errors };
    }

    // First row is headers
    const firstRow = jsonData[0];
    if (!firstRow) {
      errors.push({
        row: 0,
        message: "Invalid header row format",
      });
      return { fileName: file.name, rows, errors };
    }

    // When using header: 1, SheetJS returns arrays
    const headers = Array.isArray(firstRow) ? firstRow : Object.values(firstRow);
    const headerStrings = headers.map((h) => String(h || "").trim());

    // Find column indices
    const ageIndex = mapping.age ? headerStrings.indexOf(mapping.age) : -1;
    const dobIndex = mapping.dob ? headerStrings.indexOf(mapping.dob) : -1;
    const zipIndex = mapping.zipCode ? headerStrings.indexOf(mapping.zipCode) : -1;
    const currentIndex = headerStrings.indexOf(mapping.pledgeCurrent);
    const priorIndex = headerStrings.indexOf(mapping.pledgePrior);

    // Validate that either age or dob is mapped
    if (ageIndex === -1 && dobIndex === -1) {
      errors.push({
        row: 0,
        message: `Either age or date of birth column must be mapped`,
      });
    } else if (mapping.age && ageIndex === -1) {
      errors.push({
        row: 0,
        column: mapping.age,
        message: `Column "${mapping.age}" not found in headers`,
      });
    } else if (mapping.dob && dobIndex === -1) {
      errors.push({
        row: 0,
        column: mapping.dob,
        message: `Column "${mapping.dob}" not found in headers`,
      });
    }

    if (currentIndex === -1) {
      errors.push({
        row: 0,
        column: mapping.pledgeCurrent,
        message: `Column "${mapping.pledgeCurrent}" not found in headers`,
      });
    }

    if (priorIndex === -1) {
      errors.push({
        row: 0,
        column: mapping.pledgePrior,
        message: `Column "${mapping.pledgePrior}" not found in headers`,
      });
    }

    if (errors.length > 0) {
      return { fileName: file.name, rows, errors };
    }

    // Parse data rows (skip header)
    for (let i = 1; i < jsonData.length; i++) {
      const rowData = jsonData[i];
      if (!rowData) {
        continue; // Skip invalid rows
      }

      // When using header: 1, SheetJS returns arrays
      const dataRow = Array.isArray(rowData) ? rowData : Object.values(rowData);
      const rowNum = i + 1; // 1-indexed for user display

      const currentValue = dataRow[currentIndex];
      const priorValue = dataRow[priorIndex];

      // Parse age from either age column or DOB column
      let age: number | null = null;
      let ageSource: "age" | "dob" = "age";

      if (ageIndex !== -1) {
        const ageValue = dataRow[ageIndex];
        age = parseAge(ageValue);
        ageSource = "age";

        // If age parsing failed, provide specific error
        if (age === null) {
          errors.push({
            row: rowNum,
            column: mapping.age,
            message: `Invalid or missing age value: "${ageValue}"`,
          });
          continue;
        }
      } else if (dobIndex !== -1) {
        const dobValue = dataRow[dobIndex];
        age = parseDateOfBirth(dobValue);
        ageSource = "dob";

        // If DOB parsing failed, provide specific error
        if (age === null) {
          errors.push({
            row: rowNum,
            column: mapping.dob,
            message: `Invalid or missing date of birth value: "${dobValue}"`,
          });
          continue;
        }
      } else {
        errors.push({
          row: rowNum,
          message: `No age or date of birth data available`,
        });
        continue;
      }

      const pledgeCurrent = parseNumericValue(currentValue);
      const pledgePrior = parseNumericValue(priorValue);

      if (pledgeCurrent === null) {
        errors.push({
          row: rowNum,
          column: mapping.pledgeCurrent,
          message: `Invalid or missing current pledge value: "${currentValue}"`,
        });
        continue;
      }

      if (pledgePrior === null) {
        errors.push({
          row: rowNum,
          column: mapping.pledgePrior,
          message: `Invalid or missing prior pledge value: "${priorValue}"`,
        });
        continue;
      }

      // Parse ZIP code (optional)
      let zipCode: string | undefined;
      if (zipIndex !== -1) {
        const zipValue = dataRow[zipIndex];
        if (zipValue !== null && zipValue !== undefined && String(zipValue).trim() !== "") {
          zipCode = String(zipValue).trim();
        }
      }

      // Validate with Zod schema
      const parsed = RawRowSchema.safeParse({
        age,
        pledgeCurrent,
        pledgePrior,
        zipCode,
      });

      if (!parsed.success) {
        errors.push({
          row: rowNum,
          message: formatZodError(parsed.error),
        });
        continue;
      }

      rows.push(parsed.data);
    }

    return { fileName: file.name, rows, errors };
  } catch (error) {
    errors.push({
      row: 0,
      message: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
    });
    return { fileName: file.name, rows, errors };
  }
}

/**
 * Get column headers from a file for mapping UI
 */
export async function getFileHeaders(file: File): Promise<string[]> {
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

    // When using header: 1, SheetJS returns arrays
    const headers = Array.isArray(firstRow) ? firstRow : Object.values(firstRow);
    return headers.map((h) => String(h || "").trim()).filter((h) => h !== "");
  } catch {
    return [];
  }
}

/**
 * Preview first N rows from a file for validation UI
 */
export async function previewFile(
  file: File,
  limit = 25
): Promise<Record<string, unknown>[]> {
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
      defval: "",
      blankrows: false,
    });

    return jsonData.slice(0, limit);
  } catch {
    return [];
  }
}
