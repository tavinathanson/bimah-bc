import { describe, it, expect } from "vitest";
import {
  isNameColumn,
  isDobColumn,
  isSensitiveColumn,
  filterNameColumns,
  filterSensitiveColumns,
  convertToAge,
  sanitizePreviewRow,
  sanitizePreviewData,
} from "./pii-filter";

describe("isNameColumn", () => {
  it("identifies basic name columns", () => {
    expect(isNameColumn("name")).toBe(true);
    expect(isNameColumn("Name")).toBe(true);
    expect(isNameColumn("NAME")).toBe(true);
  });

  it("identifies first/last name columns", () => {
    expect(isNameColumn("first name")).toBe(true);
    expect(isNameColumn("First Name")).toBe(true);
    expect(isNameColumn("firstname")).toBe(true);
    expect(isNameColumn("FirstName")).toBe(true);
    expect(isNameColumn("last name")).toBe(true);
    expect(isNameColumn("Last Name")).toBe(true);
    expect(isNameColumn("lastname")).toBe(true);
    expect(isNameColumn("LastName")).toBe(true);
  });

  it("identifies full name columns", () => {
    expect(isNameColumn("full name")).toBe(true);
    expect(isNameColumn("Full Name")).toBe(true);
    expect(isNameColumn("fullname")).toBe(true);
  });

  it("identifies member/donor name columns", () => {
    expect(isNameColumn("member name")).toBe(true);
    expect(isNameColumn("Member Name")).toBe(true);
    expect(isNameColumn("donor name")).toBe(true);
    expect(isNameColumn("Donor Name")).toBe(true);
  });

  it("identifies ShulCloud-specific name columns", () => {
    expect(isNameColumn("Primary's Name")).toBe(true);
    expect(isNameColumn("Spouse's Name")).toBe(true);
  });

  it("identifies other name-related columns", () => {
    expect(isNameColumn("surname")).toBe(true);
    expect(isNameColumn("nickname")).toBe(true);
    expect(isNameColumn("preferred name")).toBe(true);
    expect(isNameColumn("given name")).toBe(true);
    expect(isNameColumn("family name")).toBe(true);
    expect(isNameColumn("household name")).toBe(true);
  });

  it("does not match non-name columns", () => {
    expect(isNameColumn("age")).toBe(false);
    expect(isNameColumn("email")).toBe(false);
    expect(isNameColumn("zip")).toBe(false);
    expect(isNameColumn("pledge")).toBe(false);
    expect(isNameColumn("account id")).toBe(false);
    expect(isNameColumn("filename")).toBe(false); // Contains "name" but not a name column
  });
});

describe("isDobColumn", () => {
  it("identifies DOB columns", () => {
    expect(isDobColumn("DOB")).toBe(true);
    expect(isDobColumn("dob")).toBe(true);
    expect(isDobColumn("Dob")).toBe(true);
  });

  it("identifies date of birth columns", () => {
    expect(isDobColumn("date of birth")).toBe(true);
    expect(isDobColumn("Date of Birth")).toBe(true);
    expect(isDobColumn("Date Of Birth")).toBe(true);
  });

  it("identifies birthday columns", () => {
    expect(isDobColumn("birthday")).toBe(true);
    expect(isDobColumn("Birthday")).toBe(true);
    expect(isDobColumn("birth day")).toBe(true);
    expect(isDobColumn("birth date")).toBe(true);
    expect(isDobColumn("birthdate")).toBe(true);
  });

  it("identifies ShulCloud-specific birthday columns", () => {
    expect(isDobColumn("Primary's Birthday")).toBe(true);
    expect(isDobColumn("Spouse's Birthday")).toBe(true);
  });

  it("does not match non-DOB columns", () => {
    expect(isDobColumn("age")).toBe(false);
    expect(isDobColumn("name")).toBe(false);
    expect(isDobColumn("date")).toBe(false);
    expect(isDobColumn("date entered")).toBe(false);
  });
});

describe("isSensitiveColumn", () => {
  it("returns true for name columns", () => {
    expect(isSensitiveColumn("name")).toBe(true);
    expect(isSensitiveColumn("first name")).toBe(true);
  });

  it("returns true for DOB columns", () => {
    expect(isSensitiveColumn("birthday")).toBe(true);
    expect(isSensitiveColumn("DOB")).toBe(true);
  });

  it("returns false for non-sensitive columns", () => {
    expect(isSensitiveColumn("age")).toBe(false);
    expect(isSensitiveColumn("zip")).toBe(false);
    expect(isSensitiveColumn("pledge")).toBe(false);
  });
});

describe("filterNameColumns", () => {
  it("filters out name columns from headers", () => {
    const headers = ["Name", "Age", "Email", "First Name", "Pledge"];
    const filtered = filterNameColumns(headers);
    expect(filtered).toEqual(["Age", "Email", "Pledge"]);
  });

  it("handles ShulCloud headers", () => {
    const headers = ["Type", "Charge", "Account ID", "Primary's Name", "Primary's Birthday", "Zip"];
    const filtered = filterNameColumns(headers);
    expect(filtered).toEqual(["Type", "Charge", "Account ID", "Primary's Birthday", "Zip"]);
  });

  it("preserves order of remaining columns", () => {
    const headers = ["A", "Name", "B", "First Name", "C"];
    const filtered = filterNameColumns(headers);
    expect(filtered).toEqual(["A", "B", "C"]);
  });

  it("returns all headers if no name columns present", () => {
    const headers = ["Age", "Zip", "Pledge Current", "Pledge Prior"];
    const filtered = filterNameColumns(headers);
    expect(filtered).toEqual(headers);
  });
});

describe("filterSensitiveColumns", () => {
  it("filters out both name and DOB columns", () => {
    const headers = ["Name", "Birthday", "Age", "Zip"];
    const filtered = filterSensitiveColumns(headers);
    expect(filtered).toEqual(["Age", "Zip"]);
  });

  it("handles complex ShulCloud headers", () => {
    const headers = ["Type", "Charge", "Account ID", "Primary's Name", "Primary's Birthday", "Zip"];
    const filtered = filterSensitiveColumns(headers);
    expect(filtered).toEqual(["Type", "Charge", "Account ID", "Zip"]);
  });
});

describe("convertToAge", () => {
  it("converts ISO date format to age", () => {
    // Test with a date that makes the person 44 years old
    const birthYear = new Date().getFullYear() - 44;
    const age = convertToAge(`${birthYear}-01-15`);
    expect(age).toBe(44);
  });

  it("converts US date format to age", () => {
    const birthYear = new Date().getFullYear() - 30;
    const age = convertToAge(`06/20/${birthYear}`);
    expect(age).toBe(30);
  });

  it("converts Excel serial date to age", () => {
    // Excel serial for 1980-01-15 is approximately 29236
    // This makes the person about 45 years old (depending on current date)
    const age = convertToAge(29236);
    expect(age).toBeGreaterThan(40);
    expect(age).toBeLessThan(50);
  });

  it("returns null for invalid dates", () => {
    expect(convertToAge("not a date")).toBe(null);
    expect(convertToAge("")).toBe(null);
    expect(convertToAge(null)).toBe(null);
    expect(convertToAge(undefined)).toBe(null);
  });

  it("returns null for unreasonable ages", () => {
    expect(convertToAge("1800-01-01")).toBe(null); // Too old
    expect(convertToAge("2100-01-01")).toBe(null); // Future date
  });
});

describe("sanitizePreviewRow", () => {
  it("removes name columns from row", () => {
    const headers = ["Name", "Age", "Pledge"];
    const row = { Name: "John Doe", Age: 45, Pledge: 1000 };
    const sanitized = sanitizePreviewRow(row, headers);

    expect(sanitized).not.toHaveProperty("Name");
    expect(sanitized.Age).toBe(45);
    expect(sanitized.Pledge).toBe(1000);
  });

  it("converts DOB to age with arrow label", () => {
    const headers = ["Birthday", "Pledge"];
    const birthYear = new Date().getFullYear() - 50;
    const row = { Birthday: `${birthYear}-03-15`, Pledge: 2000 };
    const sanitized = sanitizePreviewRow(row, headers);

    expect(sanitized).not.toHaveProperty("Birthday");
    expect(sanitized["DOB → Age"]).toBe(50);
    expect(sanitized.Pledge).toBe(2000);
  });

  it("handles both name and DOB columns", () => {
    const headers = ["Name", "Birthday", "Zip"];
    const birthYear = new Date().getFullYear() - 35;
    const row = { Name: "Jane Smith", Birthday: `${birthYear}-07-20`, Zip: "07030" };
    const sanitized = sanitizePreviewRow(row, headers);

    expect(sanitized).not.toHaveProperty("Name");
    expect(sanitized).not.toHaveProperty("Birthday");
    expect(sanitized["DOB → Age"]).toBe(35);
    expect(sanitized.Zip).toBe("07030");
  });

  it("preserves non-sensitive columns", () => {
    const headers = ["Account ID", "Type", "Charge"];
    const row = { "Account ID": "ACC001", Type: "Hineini 25", Charge: 1500 };
    const sanitized = sanitizePreviewRow(row, headers);

    expect(sanitized["Account ID"]).toBe("ACC001");
    expect(sanitized.Type).toBe("Hineini 25");
    expect(sanitized.Charge).toBe(1500);
  });
});

describe("sanitizePreviewData", () => {
  it("sanitizes multiple rows", () => {
    const rows = [
      { Name: "John", Birthday: "1980-01-15", Pledge: 1000 },
      { Name: "Jane", Birthday: "1990-06-20", Pledge: 2000 },
    ];
    const sanitized = sanitizePreviewData(rows);

    expect(sanitized).toHaveLength(2);
    expect(sanitized[0]).not.toHaveProperty("Name");
    expect(sanitized[0]).not.toHaveProperty("Birthday");
    expect(sanitized[0]["DOB → Age"]).toBeDefined();
    expect(sanitized[0].Pledge).toBe(1000);
    expect(sanitized[1]).not.toHaveProperty("Name");
    expect(sanitized[1]).not.toHaveProperty("Birthday");
    expect(sanitized[1]["DOB → Age"]).toBeDefined();
    expect(sanitized[1].Pledge).toBe(2000);
  });

  it("handles empty array", () => {
    expect(sanitizePreviewData([])).toEqual([]);
  });

  it("handles rows with multiple name columns", () => {
    const rows = [
      { "First Name": "John", "Last Name": "Doe", Age: 45, Zip: "12345" },
    ];
    const sanitized = sanitizePreviewData(rows);

    expect(sanitized[0]).not.toHaveProperty("First Name");
    expect(sanitized[0]).not.toHaveProperty("Last Name");
    expect(sanitized[0].Age).toBe(45);
    expect(sanitized[0].Zip).toBe("12345");
  });

  it("labels computed age distinctly when Age column already exists", () => {
    const birthYear = new Date().getFullYear() - 40;
    const rows = [
      { Age: 45, Birthday: `${birthYear}-05-10`, Pledge: 1000 },
    ];
    const sanitized = sanitizePreviewData(rows);

    expect(sanitized[0].Age).toBe(45); // Original Age preserved
    expect(sanitized[0]["DOB → Age"]).toBe(40); // Computed age with arrow label
    expect(sanitized[0]).not.toHaveProperty("Birthday");
  });
});
