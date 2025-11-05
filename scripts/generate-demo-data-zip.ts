#!/usr/bin/env node
/**
 * Generate demo CSV file with ZIP codes
 * Usage: npm run generate-demo-zip
 */

import { generateDemoData } from "../lib/demo/generate-demo.js";

const rows = generateDemoData(500);

// CSV header
console.log("Age,ZIP,Current,Prior");

// CSV rows
for (const row of rows) {
  console.log(`${row.age},${row.zipCode || ""},${row.pledgeCurrent},${row.pledgePrior}`);
}
