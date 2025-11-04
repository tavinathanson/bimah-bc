/**
 * Generate demo pledge data for testing Bimah BC
 * Run with: npx tsx scripts/generate-demo-data.ts
 */

const FIRST_NAMES = [
  "Aaron", "Abigail", "Adam", "Alex", "Alyssa", "Andrew", "Anna", "Ari",
  "Benjamin", "Beth", "Brian", "Chloe", "Daniel", "David", "Deborah", "Dina",
  "Eli", "Eliana", "Elizabeth", "Emma", "Ethan", "Eve", "Ezra", "Gabriel",
  "Hannah", "Isaac", "Isabel", "Jacob", "Jason", "Jennifer", "Jessica", "Jonathan",
  "Jordan", "Joseph", "Joshua", "Julia", "Leah", "Levi", "Maya", "Michael",
  "Miriam", "Nathan", "Noah", "Olivia", "Rachel", "Rebecca", "Ruth", "Samuel",
  "Sarah", "Sophia", "Tamar", "Zachary",
];

const LAST_NAMES = [
  "Cohen", "Levy", "Miller", "Schwartz", "Goldberg", "Friedman", "Katz",
  "Rosenberg", "Klein", "Shapiro", "Newman", "Green", "Silver", "Diamond",
  "Stein", "Rosen", "Wolf", "Fox", "Berg", "Bloom", "Rubin", "Weiss",
  "Kaplan", "Solomon", "Goldman", "Bernstein", "Adler", "Frank", "Harris",
  "Fisher", "Price", "Stone", "Becker", "Gordon", "Simon", "Davis", "Brown",
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateAge(): number {
  // Age distribution weighted toward common synagogue demographics
  const rand = Math.random();
  if (rand < 0.10) return randomInt(25, 39);  // 10% Under 40
  if (rand < 0.30) return randomInt(40, 49);  // 20% 40-49
  if (rand < 0.60) return randomInt(50, 64);  // 30% 50-64
  return randomInt(65, 85);                   // 40% 65+
}

function generatePledge(age: number, isRenewed: boolean): number {
  // Base pledge amount centered around $1,800
  // Using a normal distribution approach
  const mean = 1800;
  const stdDev = 600;

  // Box-Muller transform for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  let basePledge = mean + z * stdDev;

  // Age adjustment (subtle influence)
  if (age < 40) {
    basePledge *= 0.85; // Younger folks pledge slightly less
  } else if (age >= 65) {
    basePledge *= 1.15; // Older folks pledge slightly more
  }

  // Ensure positive values
  basePledge = Math.max(100, basePledge);

  // Round to nearest $50 for realism
  return Math.round(basePledge / 50) * 50;
}

function generateRow(index: number): {
  name: string;
  age: number;
  pledge2026: number;
  pledge2025: number;
  diff: number;
} {
  const firstName = randomChoice(FIRST_NAMES);
  const lastName = randomChoice(LAST_NAMES);
  const name = `${firstName} ${lastName}`;
  const age = generateAge();

  // Determine status
  const rand = Math.random();
  let pledge2025: number;
  let pledge2026: number;

  if (rand < 0.65) {
    // 65% Renewed
    pledge2025 = generatePledge(age, true);

    // Most renewals have some change
    const changeRand = Math.random();
    if (changeRand < 0.45) {
      // 45% increase
      pledge2026 = pledge2025 + randomInt(100, 1000);
    } else if (changeRand < 0.85) {
      // 40% decrease
      pledge2026 = Math.max(100, pledge2025 - randomInt(100, 800));
    } else {
      // 20% no change
      pledge2026 = pledge2025;
    }
  } else if (rand < 0.80) {
    // 15% New
    pledge2025 = 0;
    pledge2026 = generatePledge(age, false);
  } else if (rand < 0.93) {
    // 13% Resigned
    pledge2025 = generatePledge(age, true);
    pledge2026 = 0;
  } else {
    // 7% No pledge both years
    pledge2025 = 0;
    pledge2026 = 0;
  }

  const diff = pledge2026 - pledge2025;

  return {
    name,
    age,
    pledge2026,
    pledge2025,
    diff,
  };
}

function generateCSV(numRows: number): string {
  const headers = ["Name", "Age", "2026", "2025", "Diff"];
  const rows = [headers];

  for (let i = 0; i < numRows; i++) {
    const row = generateRow(i);
    rows.push([
      row.name,
      row.age.toString(),
      row.pledge2026.toString(),
      row.pledge2025.toString(),
      row.diff.toString(),
    ]);
  }

  return rows.map(row => row.join(",")).join("\n");
}

// Generate and output
const csv = generateCSV(500);
console.log(csv);

// Also print summary statistics
const lines = csv.split("\n").slice(1); // Skip header
let totalCurrent = 0;
let totalPrior = 0;
let renewed = 0;
let newCount = 0;
let resigned = 0;
let noPledge = 0;

lines.forEach(line => {
  const [, , current, prior] = line.split(",");
  const currentNum = parseInt(current || "0", 10);
  const priorNum = parseInt(prior || "0", 10);

  totalCurrent += currentNum;
  totalPrior += priorNum;

  if (currentNum > 0 && priorNum > 0) renewed++;
  else if (currentNum > 0 && priorNum === 0) newCount++;
  else if (currentNum === 0 && priorNum > 0) resigned++;
  else noPledge++;
});

console.error("\n=== Demo Data Statistics ===");
console.error(`Total Rows: ${lines.length}`);
console.error(`Total 2026 Pledges: $${totalCurrent.toLocaleString()}`);
console.error(`Total 2025 Pledges: $${totalPrior.toLocaleString()}`);
console.error(`Change: $${(totalCurrent - totalPrior).toLocaleString()} (${((totalCurrent / totalPrior - 1) * 100).toFixed(1)}%)`);
console.error(`Renewed: ${renewed} (${(renewed / lines.length * 100).toFixed(1)}%)`);
console.error(`New: ${newCount} (${(newCount / lines.length * 100).toFixed(1)}%)`);
console.error(`Resigned: ${resigned} (${(resigned / lines.length * 100).toFixed(1)}%)`);
console.error(`No Pledge: ${noPledge} (${(noPledge / lines.length * 100).toFixed(1)}%)`);
console.error("\nSave output to file: npx tsx scripts/generate-demo-data.ts > demo-pledges.csv");
