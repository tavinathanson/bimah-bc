import * as XLSX from "xlsx";
import type { ColumnMapping, ParsedFile, ParseError, RawRow } from "../schema/types";
import { RawRowSchema } from "../schema/types";

/**
 * Parse a numeric value from a cell, handling currency symbols, commas, etc.
 */
function parseNumericValue(value: unknown): number | null {
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
    const ageIndex = headerStrings.indexOf(mapping.age);
    const currentIndex = headerStrings.indexOf(mapping.pledgeCurrent);
    const priorIndex = headerStrings.indexOf(mapping.pledgePrior);

    if (ageIndex === -1) {
      errors.push({
        row: 0,
        column: mapping.age,
        message: `Column "${mapping.age}" not found in headers`,
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

      const ageValue = dataRow[ageIndex];
      const currentValue = dataRow[currentIndex];
      const priorValue = dataRow[priorIndex];

      const age = parseAge(ageValue);
      const pledgeCurrent = parseNumericValue(currentValue);
      const pledgePrior = parseNumericValue(priorValue);

      // Validate required fields
      if (age === null) {
        errors.push({
          row: rowNum,
          column: mapping.age,
          message: `Invalid or missing age value: "${ageValue}"`,
        });
        continue;
      }

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

      // Validate with Zod schema
      const parsed = RawRowSchema.safeParse({
        age,
        pledgeCurrent,
        pledgePrior,
      });

      if (!parsed.success) {
        errors.push({
          row: rowNum,
          message: `Validation error: ${parsed.error.message}`,
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
