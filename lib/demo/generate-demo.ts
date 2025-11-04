/**
 * Client-side demo data generator for Bimah BC
 * Generates realistic pledge data without needing to import a file
 * Uses a seeded random number generator for consistent results
 */

import type { RawRow } from "../schema/types";

const FIRST_NAMES = [
  "Aaron", "Abigail", "Adam", "Alex", "Benjamin", "Beth", "Daniel", "David",
  "Eli", "Hannah", "Isaac", "Jacob", "Jonathan", "Leah", "Michael", "Miriam",
  "Nathan", "Noah", "Rachel", "Rebecca", "Ruth", "Samuel", "Sarah", "Sophia",
  "Yael", "Ariel", "Shira", "Avi", "Tamar", "Moshe", "Emma", "Liam", "Olivia",
  "James", "Ava", "William", "Isabella", "Lucas", "Mia", "Henry", "Charlotte",
  "Ethan", "Amelia", "Alexander", "Harper", "Grace", "Jack", "Emily"
];

const LAST_NAMES = [
  "Cohen", "Levy", "Miller", "Schwartz", "Goldberg", "Friedman", "Shapiro",
  "Klein", "Rosenberg", "Green", "Silver", "Diamond", "Stein", "Wolf",
  "Mizrahi", "Azoulay", "Dahan", "Peretz", "Abboud", "Elias", "Smith", "Johnson",
  "Williams", "Brown", "Jones", "Garcia", "Martinez", "Davis", "Rodriguez", "Wilson",
  "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Lewis", "Robinson", "Walker", "Young"
];

/**
 * Seeded pseudo-random number generator (Mulberry32)
 * Returns a function that generates consistent random numbers
 */
function seededRandom(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let rng = seededRandom(12345); // Default seed

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function generateAge(): number {
  // Age distribution weighted toward common synagogue demographics
  const rand = rng();
  if (rand < 0.10) return randomInt(25, 39);  // 10% Under 40
  if (rand < 0.30) return randomInt(40, 49);  // 20% 40-49
  if (rand < 0.60) return randomInt(50, 64);  // 30% 50-64
  return randomInt(65, 85);                   // 40% 65+
}

function generatePledge(age: number): number {
  // Base pledge amount centered around $1,800
  const mean = 1800;
  const stdDev = 600;

  // Box-Muller transform for normal distribution
  const u1 = rng();
  const u2 = rng();
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

/**
 * Generate demo pledge data
 * @param numRows Number of household rows to generate (default: 500)
 * @returns Array of RawRow objects ready to use
 */
export function generateDemoData(numRows = 500): RawRow[] {
  // Reset RNG to seed for consistent results
  rng = seededRandom(12345);

  const rows: RawRow[] = [];

  for (let i = 0; i < numRows; i++) {
    const age = generateAge();

    // Determine status
    const rand = rng();
    let pledgePrior: number;
    let pledgeCurrent: number;

    if (rand < 0.65) {
      // 65% Renewed
      pledgePrior = generatePledge(age);

      // Most renewals have some change
      const changeRand = rng();
      if (changeRand < 0.45) {
        // 45% increase
        pledgeCurrent = pledgePrior + randomInt(100, 1000);
      } else if (changeRand < 0.85) {
        // 40% decrease
        pledgeCurrent = Math.max(100, pledgePrior - randomInt(100, 800));
      } else {
        // 20% no change
        pledgeCurrent = pledgePrior;
      }
    } else if (rand < 0.80) {
      // 15% Current Year Only (new)
      pledgePrior = 0;
      pledgeCurrent = generatePledge(age);
    } else if (rand < 0.93) {
      // 13% Prior Year Only (resigned)
      pledgePrior = generatePledge(age);
      pledgeCurrent = 0;
    } else {
      // 7% No pledge both years
      pledgePrior = 0;
      pledgeCurrent = 0;
    }

    rows.push({
      age,
      pledgeCurrent,
      pledgePrior,
    });
  }

  return rows;
}
