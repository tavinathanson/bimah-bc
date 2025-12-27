import { describe, it, expect } from "vitest";
import { getFileHeaders, previewFile, guessColumnMapping } from "./parser";

// Helper to create a File with arrayBuffer support
function createTestFile(content: string, name = "test.csv"): File {
  const blob = new Blob([content], { type: "text/csv" });
  const file = new File([blob], name, { type: "text/csv" });

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

describe("getFileHeaders - PII filtering", () => {
  it("filters out name columns from headers", async () => {
    const csv = `Name,Age,Pledge Current,Pledge Prior
John Doe,45,1000,900`;

    const file = createTestFile(csv);
    const { headers, dobHeaders } = await getFileHeaders(file);

    expect(headers).not.toContain("Name");
    expect(headers).toContain("Age");
    expect(headers).toContain("Pledge Current");
    expect(headers).toContain("Pledge Prior");
    expect(dobHeaders).toHaveLength(0);
  });

  it("filters out first name and last name columns", async () => {
    const csv = `First Name,Last Name,Age,Zip,2025,2024
John,Doe,45,07030,1000,900`;

    const file = createTestFile(csv);
    const { headers } = await getFileHeaders(file);

    expect(headers).not.toContain("First Name");
    expect(headers).not.toContain("Last Name");
    expect(headers).toContain("Age");
    expect(headers).toContain("Zip");
    expect(headers).toContain("2025");
    expect(headers).toContain("2024");
  });

  it("separates DOB columns into dobHeaders", async () => {
    const csv = `Birthday,Pledge Current,Pledge Prior
1980-01-15,1000,900`;

    const file = createTestFile(csv);
    const { headers, dobHeaders } = await getFileHeaders(file);

    // DOB columns are in dobHeaders, not in main headers
    expect(headers).not.toContain("Birthday");
    expect(dobHeaders).toContain("Birthday");
    expect(headers).toContain("Pledge Current");
  });

  it("handles ShulCloud-style headers", async () => {
    const csv = `Type,Charge,Account ID,Primary's Name,Primary's Birthday,Zip
Hineini 25,1000,ACC001,John Doe,1980-01-15,07030`;

    const file = createTestFile(csv);
    const { headers, dobHeaders } = await getFileHeaders(file);

    expect(headers).not.toContain("Primary's Name");
    expect(headers).not.toContain("Primary's Birthday");
    expect(headers).toContain("Type");
    expect(headers).toContain("Charge");
    expect(headers).toContain("Account ID");
    expect(headers).toContain("Zip");
    expect(dobHeaders).toContain("Primary's Birthday");
  });

  it("filters multiple name-related columns", async () => {
    const csv = `Member Name,Spouse Name,Donor Name,Age,Pledge
John Doe,Jane Doe,John Doe,45,1000`;

    const file = createTestFile(csv);
    const { headers } = await getFileHeaders(file);

    expect(headers).not.toContain("Member Name");
    expect(headers).not.toContain("Spouse Name");
    expect(headers).not.toContain("Donor Name");
    expect(headers).toContain("Age");
    expect(headers).toContain("Pledge");
  });
});

describe("previewFile - PII sanitization", () => {
  it("removes name columns from preview data", async () => {
    const csv = `Name,Age,Pledge
John Doe,45,1000
Jane Smith,35,2000`;

    const file = createTestFile(csv);
    const preview = await previewFile(file);

    expect(preview.length).toBe(2);
    expect(preview[0]).not.toHaveProperty("Name");
    expect(preview[0].Age).toBe(45);
    expect(preview[0].Pledge).toBe(1000);
  });

  it("converts birthday to age in preview with arrow label", async () => {
    const birthYear = new Date().getFullYear() - 45;
    const csv = `Birthday,Pledge
${birthYear}-01-15,1000`;

    const file = createTestFile(csv);
    const preview = await previewFile(file);

    expect(preview.length).toBe(1);
    expect(preview[0]).not.toHaveProperty("Birthday");
    expect(preview[0]["DOB → Age"]).toBe(45);
    expect(preview[0].Pledge).toBe(1000);
  });

  it("handles both name and birthday columns", async () => {
    const birthYear = new Date().getFullYear() - 50;
    const csv = `Name,Birthday,Zip,Pledge
John Doe,${birthYear}-06-20,07030,1500`;

    const file = createTestFile(csv);
    const preview = await previewFile(file);

    expect(preview.length).toBe(1);
    expect(preview[0]).not.toHaveProperty("Name");
    expect(preview[0]).not.toHaveProperty("Birthday");
    expect(preview[0]["DOB → Age"]).toBe(50);
    // Zip may be parsed as number by xlsx
    expect(String(preview[0].Zip)).toBe("7030");
    expect(preview[0].Pledge).toBe(1500);
  });

  it("preserves non-sensitive columns unchanged", async () => {
    const csv = `Account ID,Type,Charge,Zip
ACC001,Hineini 25,1500,07030`;

    const file = createTestFile(csv);
    const preview = await previewFile(file);

    expect(preview.length).toBe(1);
    expect(preview[0]["Account ID"]).toBe("ACC001");
    expect(preview[0].Type).toBe("Hineini 25");
    expect(preview[0].Charge).toBe(1500);
    // Zip may be parsed as number by xlsx
    expect(String(preview[0].Zip)).toBe("7030");
  });
});

describe("guessColumnMapping - PII filtering", () => {
  it("does not suggest name columns for any mapping", async () => {
    const headers = ["Name", "Age", "2025", "2024", "Zip"];
    const mapping = guessColumnMapping(headers);

    // Should find the non-name columns
    expect(mapping.age).toBe("Age");
    expect(mapping.zipCode).toBe("Zip");

    // Should not include name column anywhere in mapping
    expect(mapping.age).not.toBe("Name");
    expect(mapping.pledgeCurrent).not.toBe("Name");
    expect(mapping.pledgePrior).not.toBe("Name");
  });

  it("correctly maps columns when names are present", async () => {
    const headers = ["First Name", "Last Name", "Age", "Zip", "2025", "2024"];
    const mapping = guessColumnMapping(headers);

    // Should skip name columns and still find the right mappings
    expect(mapping.age).toBe("Age");
    expect(mapping.zipCode).toBe("Zip");
    expect(mapping.pledgeCurrent).toBe("2025");
    expect(mapping.pledgePrior).toBe("2024");
  });

  it("finds DOB columns even when name columns are present", async () => {
    const headers = ["Name", "Birthday", "2025", "2024"];
    const mapping = guessColumnMapping(headers);

    expect(mapping.dob).toBe("Birthday");
    expect(mapping.age).toBeUndefined(); // No age column present
  });

  it("handles all name columns filtered out", async () => {
    const headers = ["Member Name", "Spouse Name", "Age", "Pledge Current", "Pledge Prior"];
    const mapping = guessColumnMapping(headers);

    expect(mapping.age).toBe("Age");
    expect(mapping.pledgeCurrent).toBe("Pledge Current");
    expect(mapping.pledgePrior).toBe("Pledge Prior");
  });
});
