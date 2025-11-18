/**
 * Generate demo ShulCloud transaction data for testing
 * Output format matches ShulCloud transaction export:
 * Date,ID,Member Since,Type,Charge,Join Date,Zip,Primary's Birthday,Account ID,Type External ID,Date Entered
 */

const CHARGE_TYPES = [
  "Hineini Pledges",
  "HH Pledges/Memorial Book",
  "Religious School Fees",
  "High Holiday Tickets",
  "Adult Education",
  "Building Fund",
];

const ZIP_CODES = [
  "10001", "10002", "10003", "10010", "10011", "10012", "10013", "10014",
  "10016", "10017", "10018", "10019", "10020", "10021", "10022", "10023",
  "10024", "10025", "10026", "10027", "10028", "10029", "10030", "10031",
  "10032", "10033", "10034", "10035", "10036", "10037", "10038", "10039",
  "10040", "10044", "10065", "10069", "10075", "10128", "10280", "10282",
  "11201", "11205", "11206", "11211", "11215", "11217", "11222", "11231",
];

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!;
}

function randomAmount(min: number, max: number): number {
  // Generate amounts that tend to cluster around common giving levels
  const levels = [180, 360, 500, 1000, 1800, 2500, 3600, 5000, 7200, 10000];
  if (Math.random() < 0.7) {
    // 70% chance to pick a nearby common level
    const baseLevel = randomChoice(levels);
    const variance = (Math.random() - 0.5) * baseLevel * 0.2;
    return Math.round(Math.max(min, Math.min(max, baseLevel + variance)));
  }
  // 30% chance for truly random amount
  return Math.round(min + Math.random() * (max - min));
}

interface Transaction {
  date: string;
  id: string;
  memberSince: string;
  type: string;
  charge: number;
  joinDate: string;
  zip: string;
  primaryBirthday: string;
  accountId: string;
  typeExternalId: string;
  dateEntered: string;
}

function generateTransactions(numAccounts: number): Transaction[] {
  const transactions: Transaction[] = [];

  // Generate dates for 2023-2025 range
  const year2023Start = new Date(2023, 0, 1);
  const year2023End = new Date(2023, 11, 31);
  const year2024Start = new Date(2024, 0, 1);
  const year2024End = new Date(2024, 11, 31);
  const year2025Start = new Date(2025, 0, 1);
  const year2025End = new Date(2025, 10, 15); // Up to mid-November 2025

  for (let i = 0; i < numAccounts; i++) {
    const accountId = `ACC${String(10000 + i).padStart(6, '0')}`;
    const zip = randomChoice(ZIP_CODES);

    // Generate member since date (1-30 years ago)
    const yearsAgo = Math.floor(Math.random() * 30) + 1;
    const memberSince = new Date();
    memberSince.setFullYear(memberSince.getFullYear() - yearsAgo);
    const memberSinceStr = formatDate(memberSince);

    // Generate birthday (25-85 years old)
    const age = Math.floor(Math.random() * 60) + 25;
    const birthday = new Date();
    birthday.setFullYear(birthday.getFullYear() - age);
    birthday.setMonth(Math.floor(Math.random() * 12));
    birthday.setDate(Math.floor(Math.random() * 28) + 1);
    const birthdayStr = formatDate(birthday);

    // Determine which charge types this account uses (1-4 types)
    const numTypes = Math.floor(Math.random() * 3) + 1;
    const accountChargeTypes = [...CHARGE_TYPES]
      .sort(() => Math.random() - 0.5)
      .slice(0, numTypes);

    // Generate transactions for each year and charge type
    const years = [
      { start: year2023Start, end: year2023End },
      { start: year2024Start, end: year2024End },
      { start: year2025Start, end: year2025End },
    ];

    for (const { start, end } of years) {
      // Some members might not give every year (10% skip rate)
      if (Math.random() < 0.1) continue;

      for (const chargeType of accountChargeTypes) {
        // Determine amount based on charge type
        let minAmount = 100;
        let maxAmount = 5000;

        if (chargeType === "Hineini Pledges") {
          minAmount = 1800;
          maxAmount = 15000;
        } else if (chargeType === "HH Pledges/Memorial Book") {
          minAmount = 180;
          maxAmount = 1000;
        } else if (chargeType === "Religious School Fees") {
          minAmount = 500;
          maxAmount = 3000;
        } else if (chargeType === "High Holiday Tickets") {
          minAmount = 100;
          maxAmount = 500;
        } else if (chargeType === "Adult Education") {
          minAmount = 50;
          maxAmount = 300;
        } else if (chargeType === "Building Fund") {
          minAmount = 100;
          maxAmount = 5000;
        }

        // Generate 1-3 transactions per year per charge type
        const numTransactions = chargeType === "Hineini Pledges" ? 1 : Math.floor(Math.random() * 2) + 1;

        for (let t = 0; t < numTransactions; t++) {
          const date = randomDate(start, end);
          const dateEntered = new Date(date);
          dateEntered.setDate(dateEntered.getDate() + Math.floor(Math.random() * 3)); // Entered 0-2 days later

          transactions.push({
            date: formatDate(date),
            id: `TXN${String(transactions.length + 1).padStart(8, '0')}`,
            memberSince: memberSinceStr,
            type: chargeType,
            charge: randomAmount(minAmount, maxAmount),
            joinDate: memberSinceStr,
            zip,
            primaryBirthday: birthdayStr,
            accountId,
            typeExternalId: `TYPE${CHARGE_TYPES.indexOf(chargeType) + 1}`,
            dateEntered: formatDate(dateEntered),
          });
        }
      }
    }
  }

  // Sort by date
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return transactions;
}

// Generate CSV output
const numAccounts = parseInt(process.argv[2] || "200");
const transactions = generateTransactions(numAccounts);

// Header
console.log("Date,ID,Member Since,Type,Charge,Join Date,Zip,Primary's Birthday,Account ID,Type External ID,Date Entered");

// Data rows
for (const txn of transactions) {
  console.log([
    txn.date,
    txn.id,
    txn.memberSince,
    txn.type,
    txn.charge,
    txn.joinDate,
    txn.zip,
    txn.primaryBirthday,
    txn.accountId,
    txn.typeExternalId,
    txn.dateEntered,
  ].join(","));
}
