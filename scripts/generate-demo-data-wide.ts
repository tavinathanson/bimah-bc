#!/usr/bin/env node
/**
 * Generate demo CSV file with wide geographic spread
 * Usage: npm run generate-demo-wide
 */

import { generateDemoDataWide } from "../lib/demo/generate-demo-wide.js";

const rows = generateDemoDataWide(500);

// CSV header
console.log("Age,ZIP,Current,Prior");

// CSV rows
for (const row of rows) {
  console.log(`${row.age},${row.zipCode || ""},${row.pledgeCurrent},${row.pledgePrior}`);
}
