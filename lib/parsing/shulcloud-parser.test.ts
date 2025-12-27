import { describe, it, expect } from "vitest";
import { detectShulCloudFormat, parseShulCloudFile } from "./shulcloud-parser";

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

  it("handles completely negative net amount", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25,$100.00,ACC001,1980-01-15,07030
Hineini 25,($500.00),ACC001,1980-01-15,07030
Hineini 24,$200.00,ACC001,1980-01-15,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    // Should error because pledgeCurrent would be negative (-400)
    // which fails the nonnegative() validation
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("requires at least 2 fiscal years", async () => {
    const csv = `Type,Charge,Account ID,Primary's Birthday,Zip
Hineini 25,$1000.00,ACC001,1980-01-15,07030
Hineini 25,$500.00,ACC002,1975-06-20,07030`;

    const file = createTestFile(csv);
    const result = await parseShulCloudFile(file);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("At least 2 years");
    expect(result.yearsFound).toEqual([2025]);
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
