/**
 * Generates fake ShulCloud Transactions test data for development/testing.
 *
 * ALL DATA IS COMPLETELY SYNTHETIC - no real donor, member, or financial data is used.
 * This script uses seeded random number generation for reproducibility.
 *
 * Usage: npx tsx scripts/generate-shulcloud-test-data.ts
 */

import * as fs from "fs";
import * as path from "path";

// Seeded random number generator (Mulberry32) for reproducibility
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(12345); // Fixed seed for reproducibility

// Helper functions
function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

function randomDate(startYear: number, endYear: number): string {
  const year = randomInt(startYear, endYear);
  const month = randomInt(1, 12);
  const day = randomInt(1, 28); // Keep it simple, avoid month-end issues
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Configuration
const NUM_ACCOUNTS = 50;
const FISCAL_YEARS = [25, 26]; // FY25 and FY26
const FAKE_ZIP_CODES = ["00001", "00002", "00003", "00004", "00005"]; // Obviously fake

// Generate fake accounts
interface FakeAccount {
  accountId: string;
  birthday: string;
  zip: string;
  memberSince: string;
  baseAmount: number;
}

function generateAccounts(): FakeAccount[] {
  const accounts: FakeAccount[] = [];

  for (let i = 1; i <= NUM_ACCOUNTS; i++) {
    accounts.push({
      accountId: `FAKE-ACC-${String(i).padStart(4, "0")}`,
      birthday: randomDate(1950, 2000),
      zip: randomChoice(FAKE_ZIP_CODES),
      memberSince: randomDate(2005, 2023),
      baseAmount: randomInt(5, 100) * 100, // $500 to $10,000 in $100 increments
    });
  }

  return accounts;
}

// Generate transactions for a fiscal year
interface FakeTransaction {
  date: string;
  id: string;
  memberSince: string;
  type: string;
  charge: string;
  joinDate: string;
  zip: string;
  birthday: string;
  accountId: string;
  typeExternalId: string;
  dateEntered: string;
}

function generateTransactionsForYear(
  accounts: FakeAccount[],
  fiscalYear: number,
  baseYear: number
): FakeTransaction[] {
  const transactions: FakeTransaction[] = [];
  let txnCounter = 1;

  for (const account of accounts) {
    // 80% chance of having a transaction in this year
    if (random() > 0.8) continue;

    // Vary the amount by -20% to +30% from base
    const variation = 0.8 + random() * 0.5;
    const amount = Math.round(account.baseAmount * variation);

    const txnDate = randomDate(baseYear, baseYear);

    transactions.push({
      date: txnDate,
      id: `FAKE-TXN-${String(txnCounter++).padStart(6, "0")}`,
      memberSince: account.memberSince,
      type: `Hineini ${fiscalYear} FAKE`,
      charge: `$${amount}.00`,
      joinDate: account.memberSince,
      zip: account.zip,
      birthday: account.birthday,
      accountId: account.accountId,
      typeExternalId: `FAKE-HIN${fiscalYear}`,
      dateEntered: txnDate,
    });

    // 15% chance of a second transaction (additional payment)
    if (random() < 0.15) {
      const additionalAmount = randomInt(1, 5) * 100;
      const additionalDate = randomDate(baseYear, baseYear);

      transactions.push({
        date: additionalDate,
        id: `FAKE-TXN-${String(txnCounter++).padStart(6, "0")}`,
        memberSince: account.memberSince,
        type: `Hineini ${fiscalYear} FAKE`,
        charge: `$${additionalAmount}.00`,
        joinDate: account.memberSince,
        zip: account.zip,
        birthday: account.birthday,
        accountId: account.accountId,
        typeExternalId: `FAKE-HIN${fiscalYear}`,
        dateEntered: additionalDate,
      });
    }

    // 5% chance of a refund/credit (negative amount)
    if (random() < 0.05) {
      const refundAmount = randomInt(1, 3) * 100;
      const refundDate = randomDate(baseYear, baseYear);

      transactions.push({
        date: refundDate,
        id: `FAKE-TXN-${String(txnCounter++).padStart(6, "0")}`,
        memberSince: account.memberSince,
        type: `Hineini ${fiscalYear} FAKE`,
        charge: `($${refundAmount}.00)`, // Accounting notation
        joinDate: account.memberSince,
        zip: account.zip,
        birthday: account.birthday,
        accountId: account.accountId,
        typeExternalId: `FAKE-HIN${fiscalYear}`,
        dateEntered: refundDate,
      });
    }

    // Add some non-Hineini transactions (should be filtered out)
    if (random() < 0.3) {
      transactions.push({
        date: randomDate(baseYear, baseYear),
        id: `FAKE-TXN-${String(txnCounter++).padStart(6, "0")}`,
        memberSince: account.memberSince,
        type: `Dues ${fiscalYear} FAKE`,
        charge: `$${randomInt(3, 8) * 100}.00`,
        joinDate: account.memberSince,
        zip: account.zip,
        birthday: account.birthday,
        accountId: account.accountId,
        typeExternalId: `FAKE-DUES${fiscalYear}`,
        dateEntered: randomDate(baseYear, baseYear),
      });
    }
  }

  return transactions;
}

function toCSV(transactions: FakeTransaction[]): string {
  const headers = [
    "Date",
    "ID",
    "Member Since",
    "Type",
    "Charge",
    "Join Date",
    "Zip",
    "Primary's Birthday",
    "Account ID",
    "Type External ID",
    "Date Entered",
  ];

  const rows = transactions.map((t) => [
    t.date,
    t.id,
    t.memberSince,
    t.type,
    t.charge,
    t.joinDate,
    t.zip,
    t.birthday,
    t.accountId,
    t.typeExternalId,
    t.dateEntered,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

// Main
function main() {
  console.log("Generating FAKE ShulCloud test data...");
  console.log("NOTE: All data is completely synthetic - no real data is used.\n");

  const accounts = generateAccounts();
  console.log(`Generated ${accounts.length} fake accounts`);

  // Generate FY25 transactions (calendar year 2024)
  const fy25Transactions = generateTransactionsForYear(accounts, 25, 2024);
  console.log(`Generated ${fy25Transactions.length} fake FY25 transactions`);

  // Generate FY26 transactions (calendar year 2025)
  const fy26Transactions = generateTransactionsForYear(accounts, 26, 2025);
  console.log(`Generated ${fy26Transactions.length} fake FY26 transactions`);

  // Combined file with both years
  const combinedTransactions = [...fy25Transactions, ...fy26Transactions];
  console.log(`Combined: ${combinedTransactions.length} total fake transactions`);

  // Write files
  const outputDir = path.join(process.cwd(), "test-data");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outputDir, "shulcloud-fy25-FAKE.csv"), toCSV(fy25Transactions));
  fs.writeFileSync(path.join(outputDir, "shulcloud-fy26-FAKE.csv"), toCSV(fy26Transactions));
  fs.writeFileSync(path.join(outputDir, "shulcloud-combined-FAKE.csv"), toCSV(combinedTransactions));

  console.log("\nFiles written to test-data/:");
  console.log("  - shulcloud-fy25-FAKE.csv");
  console.log("  - shulcloud-fy26-FAKE.csv");
  console.log("  - shulcloud-combined-FAKE.csv");
  console.log("\n⚠️  These files contain FAKE data only - safe for testing.");
}

main();
