import { describe, it, expect } from "vitest";
import { detectShulCloudFormat, parseShulCloudFile, combineShulCloudResults } from "./shulcloud-parser";

// Helper to create a File with arrayBuffer support (jsdom doesn't fully implement it)
function createTestFile(content: string, name = "test.csv"): File {
  const blob = new Blob([content], { type: "text/csv" });
  const file = new File([blob], name, { type: "text/csv" });

  // Polyfill arrayBuffer if not available
  if (!file.arrayBuffer) {
    (file as File & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });
    };
  }

  return file;
}

describe("detectShulCloudFormat", () => {
  it("detects ShulCloud format with all required columns", () => {
    const headers = ["Type", "Charge", "Account ID", "Primary's Birthday", "Zip"];
    const result = detectShulCloudFormat(headers);
    expect(result.isShulCloud).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.missingColumns).toHaveLength(0);
  });

  it("detects partial ShulCloud format with some missing columns", () => {
    const headers = ["Type", "Charge", "Zip"];
    const result = detectShulCloudFormat(headers);
    expect(result.isShulCloud).toBe(false);
    expect(result.confidence).toBe("partial");
    expect(result.missingColumns).toContain("Account ID");
    expect(result.missingColumns).toContain("Primary's Birthday");
  });

  it("returns none for unrelated headers", () => {
    const headers = ["Name", "Email", "Phone"];
    const result = detectShulCloudFormat(headers);
    expect(result.confidence).toBe("none");
  });

  it("is case insensitive", () => {
    const headers = ["TYPE", "charge", "ACCOUNT ID", "primary's birthday"];
    const result = detectShulCloudFormat(headers);
    expect(result.isShulCloud).toBe(true);
    expect(result.confidence).toBe("high");
  });
});

describe("parseShulCloudFile - negative values and summing", () => {
  it("sums multiple positive transactions for the same account and year", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25,$500.00,ACC001,1980-01-15,07030
Hineini 25,$300.00,ACC001,1980-01-15,07030
Hineini 24,$400.00,ACC001,1980-01-15,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].pledgeCurrent).toBe(800); // $500 + $300
    expect(result.rows[0].pledgePrior).toBe(400);
    expect(result.hasNegativeValues).toBe(false);
  });

  it("handles negative values with minus sign", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25,$1000.00,ACC001,1980-01-15,07030
Hineini 25,-$200.00,ACC001,1980-01-15,07030
Hineini 24,$500.00,ACC001,1980-01-15,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].pledgeCurrent).toBe(800); // $1000 - $200
    expect(result.rows[0].pledgePrior).toBe(500);
    expect(result.hasNegativeValues).toBe(true);
  });

  it("handles negative values with accounting parentheses notation", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25,$1000.00,ACC001,1980-01-15,07030
Hineini 25,($150.00),ACC001,1980-01-15,07030
Hineini 24,$500.00,ACC001,1980-01-15,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].pledgeCurrent).toBe(850); // $1000 - $150
    expect(result.rows[0].pledgePrior).toBe(500);
    expect(result.hasNegativeValues).toBe(true);
  });

  it("handles parentheses without dollar sign", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25,1000,ACC001,1980-01-15,07030
Hineini 25,(100),ACC001,1980-01-15,07030
Hineini 24,500,ACC001,1980-01-15,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].pledgeCurrent).toBe(900); // 1000 - 100
    expect(result.rows[0].pledgePrior).toBe(500);
    expect(result.hasNegativeValues).toBe(true);
  });

  it("sums transactions across multiple accounts correctly", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25,$1000.00,ACC001,1980-01-15,07030
Hineini 25,($200.00),ACC001,1980-01-15,07030
Hineini 24,$500.00,ACC001,1980-01-15,07030
Hineini 25,$2000.00,ACC002,1975-06-20,07030
Hineini 24,$1800.00,ACC002,1975-06-20,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.accountCount).toBe(2);
    expect(result.hasNegativeValues).toBe(true);

    // Find rows by their values (order may vary)
    const acc001 = result.rows.find((r) => r.pledgeCurrent === 800);
    const acc002 = result.rows.find((r) => r.pledgeCurrent === 2000);

    expect(acc001).toBeDefined();
    expect(acc001?.pledgePrior).toBe(500);
    expect(acc002).toBeDefined();
    expect(acc002?.pledgePrior).toBe(1800);
  });

  it("handles completely negative net amount (caught at Zod validation)", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25,$100.00,ACC001,1980-01-15,07030
Hineini 25,($500.00),ACC001,1980-01-15,07030
Hineini 24,$200.00,ACC001,1980-01-15,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    // The row is built with pledgeCurrent = -400, which fails Zod nonnegative validation
    // So the row won't be included in the result
    expect(result.rows.length).toBe(0);
    expect(result.hasNegativeValues).toBe(true);
  });

  it("single file with 1 fiscal year - validation deferred to combine step", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25,$1000.00,ACC001,1980-01-15,07030
Hineini 25,$500.00,ACC002,1975-06-20,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    // Single file with 1 year should NOT error at parse time
    // (validation happens at combine step when multiple files are merged)
    expect(result.errors).toHaveLength(0);
    expect(result.yearsFound).toEqual([2025]);
    expect(result.accountData.size).toBe(2);
    // Rows are empty because we need 2 years to build pledgeCurrent/pledgePrior
    expect(result.rows).toHaveLength(0);
  });

  it("filters for hineini transactions only", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25,$1000.00,ACC001,1980-01-15,07030
Dues 25,$500.00,ACC001,1980-01-15,07030
Building Fund 25,$200.00,ACC001,1980-01-15,07030
Hineini 24,$800.00,ACC001,1980-01-15,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].pledgeCurrent).toBe(1000); // Only Hineini 25
    expect(result.rows[0].pledgePrior).toBe(800); // Only Hineini 24
  });

  it("extracts fiscal year from Type column", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini Pledge 26,$1000.00,ACC001,1980-01-15,07030
HINEINI 25,$800.00,ACC001,1980-01-15,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.yearsFound).toEqual([2026, 2025]);
    expect(result.rows[0].pledgeCurrent).toBe(1000); // 2026
    expect(result.rows[0].pledgePrior).toBe(800); // 2025
  });

  it("errors when Type lacks fiscal year", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini,$1000.00,ACC001,1980-01-15,07030
Hineini 24,$800.00,ACC001,1980-01-15,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("missing fiscal year");
  });
});

describe("combineShulCloudResults - multi-file imports", () => {
  it("combines two files with different fiscal years", async () => {
    const csv25 = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25 FAKE,$1000.00,ACC001,1980-01-15,07030
Hineini 25 FAKE,$500.00,ACC002,1975-06-20,07030`;

    const csv26 = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 26 FAKE,$1200.00,ACC001,1980-01-15,07030
Hineini 26 FAKE,$600.00,ACC002,1975-06-20,07030`;

    const result25 = await parseShulCloudFile(createTestFile(csv25));
    const result26 = await parseShulCloudFile(createTestFile(csv26));

    const combined = combineShulCloudResults([result25, result26]);

    expect(combined.error).toBeUndefined();
    expect(combined.allYears).toEqual([2026, 2025]);
    expect(combined.totalAccounts).toBe(2);
    expect(combined.rows).toHaveLength(2);

    // Find ACC001's row
    const acc001 = combined.rows.find((r) => r.pledgeCurrent === 1200);
    expect(acc001).toBeDefined();
    expect(acc001?.pledgePrior).toBe(1000);

    // Find ACC002's row
    const acc002 = combined.rows.find((r) => r.pledgeCurrent === 600);
    expect(acc002).toBeDefined();
    expect(acc002?.pledgePrior).toBe(500);
  });

  it("errors when combined files have only 1 fiscal year", async () => {
    const csv25a = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25 FAKE,$1000.00,ACC001,1980-01-15,07030`;

    const csv25b = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25 FAKE,$500.00,ACC002,1975-06-20,07030`;

    const result25a = await parseShulCloudFile(createTestFile(csv25a));
    const result25b = await parseShulCloudFile(createTestFile(csv25b));

    const combined = combineShulCloudResults([result25a, result25b]);

    expect(combined.error).toBeDefined();
    expect(combined.error).toContain("Only 1 fiscal year found");
    expect(combined.rows).toHaveLength(0);
  });

  it("merges transactions for same account across files", async () => {
    // Same account appears in both files with same year - amounts should sum
    const csv1 = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25 FAKE,$500.00,ACC001,1980-01-15,07030
Hineini 26 FAKE,$600.00,ACC001,1980-01-15,07030`;

    const csv2 = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25 FAKE,$300.00,ACC001,1980-01-15,07030
Hineini 26 FAKE,$400.00,ACC001,1980-01-15,07030`;

    const result1 = await parseShulCloudFile(createTestFile(csv1));
    const result2 = await parseShulCloudFile(createTestFile(csv2));

    const combined = combineShulCloudResults([result1, result2]);

    expect(combined.error).toBeUndefined();
    expect(combined.totalAccounts).toBe(1);
    expect(combined.rows).toHaveLength(1);
    expect(combined.rows[0].pledgeCurrent).toBe(1000); // 600 + 400
    expect(combined.rows[0].pledgePrior).toBe(800); // 500 + 300
  });
});
