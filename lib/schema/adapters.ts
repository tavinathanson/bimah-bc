import type { PledgeRow } from "./types";
import type { Household, Person, Transaction, Address } from "./universal-types";
import { classifyStatus } from "../math/calculations";

/**
 * BACKWARD COMPATIBILITY ADAPTERS
 *
 * These functions convert between the legacy PledgeRow format (used by Hineini)
 * and the new normalized entity model. This allows existing Hineini CSVs to work
 * seamlessly while supporting new data sources.
 */

/**
 * Convert legacy PledgeRow (current format) to normalized entities
 *
 * This allows the old Hineini CSVs to work seamlessly with the new architecture.
 *
 * @param row - Legacy pledge row
 * @param fiscalYearCurrent - Current fiscal year (e.g., 2026)
 * @returns Normalized household, person, address (if ZIP exists), and transactions
 */
export function pledgeRowToEntities(
  row: PledgeRow,
  fiscalYearCurrent: number
): {
  household: Household;
  person: Person;
  address?: Address;
  transactions: Transaction[];
} {
  // Create household entity (no PII stored - just ID and metadata)
  const household: Household = {
    id: row.householdKey,
    memberCount: 1,
    membershipType: "unknown",
    source: "legacy_hineini",
  };

  // Create person entity (age only, no names)
  const person: Person = {
    id: `${row.householdKey}_primary`,
    householdId: row.householdKey,
    age: row.age,
    role: "primary",
  };

  // Create address entity if ZIP code exists
  let address: Address | undefined;
  if (row.zipCode) {
    address = {
      id: `${row.householdKey}_addr`,
      householdId: row.householdKey,
      zipCode: row.zipCode,
      country: "US",
    };
  }

  // Create transaction records for pledges
  const transactions: Transaction[] = [];

  // Current year pledge
  if (row.pledgeCurrent > 0) {
    transactions.push({
      id: `${row.householdKey}_pledge_${fiscalYearCurrent}`,
      householdId: row.householdKey,
      date: new Date(fiscalYearCurrent, 0, 1), // Jan 1 of fiscal year
      fiscalYear: fiscalYearCurrent,
      amount: row.pledgeCurrent,
      chargeType: "Pledge",
      category: "pledge",
      paymentMethod: "unknown",
    });
  }

  // Prior year pledge
  if (row.pledgePrior > 0) {
    transactions.push({
      id: `${row.householdKey}_pledge_${fiscalYearCurrent - 1}`,
      householdId: row.householdKey,
      date: new Date(fiscalYearCurrent - 1, 0, 1),
      fiscalYear: fiscalYearCurrent - 1,
      amount: row.pledgePrior,
      chargeType: "Pledge",
      category: "pledge",
      paymentMethod: "unknown",
    });
  }

  return { household, person, address, transactions };
}

/**
 * Convert normalized data back to PledgeRow format for backward compatibility
 *
 * Used when rendering the "Beth Chaim - Hineini" saved view or when the dashboard
 * is in Hineini mode.
 *
 * @param household - Household entity
 * @param person - Person entity (should be primary)
 * @param transactions - All transactions for this household
 * @param address - Address entity (optional)
 * @param currentFY - Current fiscal year
 * @param priorFY - Prior fiscal year
 * @returns Legacy PledgeRow format
 */
export function entitiesToPledgeRow(
  household: Household,
  person: Person,
  transactions: Transaction[],
  address: Address | undefined,
  currentFY: number,
  priorFY: number
): PledgeRow {
  // Find pledge transactions for the two years
  const currentPledge = transactions.find(
    t => t.fiscalYear === currentFY && t.category === "pledge"
  );
  const priorPledge = transactions.find(
    t => t.fiscalYear === priorFY && t.category === "pledge"
  );

  const pledgeCurrent = currentPledge?.amount ?? 0;
  const pledgePrior = priorPledge?.amount ?? 0;

  // Recompute status/change using existing logic
  const status = classifyStatus(pledgeCurrent, pledgePrior);
  const changeDollar = pledgeCurrent - pledgePrior;
  const changePercent = pledgePrior > 0 ? changeDollar / pledgePrior : null;

  return {
    householdKey: household.id,
    age: person.age ?? 0,
    pledgeCurrent,
    pledgePrior,
    zipCode: address?.zipCode,
    status,
    changeDollar,
    changePercent,
  };
}

/**
 * Batch convert an array of PledgeRows to normalized entities
 *
 * @param rows - Array of legacy pledge rows
 * @param fiscalYearCurrent - Current fiscal year
 * @returns Normalized entities grouped by type
 */
export function pledgeRowsToEntities(
  rows: PledgeRow[],
  fiscalYearCurrent: number
): {
  households: Household[];
  persons: Person[];
  addresses: Address[];
  transactions: Transaction[];
} {
  const households: Household[] = [];
  const persons: Person[] = [];
  const addresses: Address[] = [];
  const transactions: Transaction[] = [];

  for (const row of rows) {
    const entities = pledgeRowToEntities(row, fiscalYearCurrent);
    households.push(entities.household);
    persons.push(entities.person);
    if (entities.address) {
      addresses.push(entities.address);
    }
    transactions.push(...entities.transactions);
  }

  return { households, persons, addresses, transactions };
}

/**
 * Batch convert normalized entities back to PledgeRows
 *
 * @param households - Array of households
 * @param persons - Array of persons
 * @param transactions - Array of transactions
 * @param addresses - Array of addresses
 * @param currentFY - Current fiscal year
 * @param priorFY - Prior fiscal year
 * @returns Array of legacy PledgeRows
 */
export function entitiesToPledgeRows(
  households: Household[],
  persons: Person[],
  transactions: Transaction[],
  addresses: Address[],
  currentFY: number,
  priorFY: number
): PledgeRow[] {
  return households.map(household => {
    const person = persons.find(p => p.householdId === household.id && p.role === "primary");
    const householdTransactions = transactions.filter(t => t.householdId === household.id);
    const address = addresses.find(a => a.householdId === household.id);

    if (!person) {
      throw new Error(`No primary person found for household ${household.id}`);
    }

    return entitiesToPledgeRow(household, person, householdTransactions, address, currentFY, priorFY);
  });
}
