/**
 * Generate INVALID demo pledge data for testing validation in Bimah BC
 * This file intentionally contains errors to test the validation system
 * Run with: npm run generate-invalid-demo
 */

const FIRST_NAMES = [
  "Aaron", "Abigail", "Adam", "Alex", "Benjamin", "Beth", "Daniel", "David",
  "Eli", "Hannah", "Isaac", "Jacob", "Jonathan", "Leah", "Michael", "Miriam",
  "Nathan", "Noah", "Rachel", "Rebecca", "Ruth", "Samuel", "Sarah", "Sophia",
];

const LAST_NAMES = [
  "Cohen", "Levy", "Miller", "Schwartz", "Goldberg", "Friedman", "Shapiro",
  "Klein", "Rosenberg", "Green", "Silver", "Diamond", "Stein", "Wolf",
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate CSV header
console.log("Name,Age,2026,2025");

// Generate 50 rows with intentional errors
for (let i = 0; i < 50; i++) {
  const firstName = randomChoice(FIRST_NAMES);
  const lastName = randomChoice(LAST_NAMES);
  const name = `${firstName} ${lastName}`;

  let age: string | number;
  let pledge2026: string | number;
  let pledge2025: string | number;

  // Introduce various types of errors
  const errorType = Math.random();

  if (errorType < 0.15) {
    // 15% - Invalid age (negative)
    age = -randomInt(5, 50);
    pledge2026 = randomInt(1000, 3000);
    pledge2025 = randomInt(1000, 3000);
  } else if (errorType < 0.30) {
    // 15% - Invalid age (text)
    age = "N/A";
    pledge2026 = randomInt(1000, 3000);
    pledge2025 = randomInt(1000, 3000);
  } else if (errorType < 0.40) {
    // 10% - Empty age
    age = "";
    pledge2026 = randomInt(1000, 3000);
    pledge2025 = randomInt(1000, 3000);
  } else if (errorType < 0.50) {
    // 10% - Invalid pledge (negative)
    age = randomInt(30, 80);
    pledge2026 = -randomInt(1000, 3000);
    pledge2025 = randomInt(1000, 3000);
  } else if (errorType < 0.60) {
    // 10% - Invalid pledge (text)
    age = randomInt(30, 80);
    pledge2026 = "TBD";
    pledge2025 = randomInt(1000, 3000);
  } else if (errorType < 0.70) {
    // 10% - Empty pledge
    age = randomInt(30, 80);
    pledge2026 = "";
    pledge2025 = randomInt(1000, 3000);
  } else if (errorType < 0.75) {
    // 5% - Age as decimal (should be truncated, not an error)
    age = randomInt(30, 80) + 0.5;
    pledge2026 = randomInt(1000, 3000);
    pledge2025 = randomInt(1000, 3000);
  } else if (errorType < 0.80) {
    // 5% - Very large invalid age
    age = randomInt(150, 999);
    pledge2026 = randomInt(1000, 3000);
    pledge2025 = randomInt(1000, 3000);
  } else if (errorType < 0.85) {
    // 5% - Multiple errors (empty age and negative pledge)
    age = "";
    pledge2026 = -randomInt(1000, 3000);
    pledge2025 = "";
  } else {
    // 15% - Valid data (control group)
    age = randomInt(30, 80);
    pledge2026 = randomInt(1000, 3000);
    pledge2025 = randomInt(1000, 3000);
  }

  console.log(`"${name}",${age},${pledge2026},${pledge2025}`);
}
