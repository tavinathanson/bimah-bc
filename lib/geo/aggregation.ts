/**
 * ZIP code aggregation logic for geographic analysis
 */

import type { PledgeRow } from "../schema/types";
import type { Coordinates } from "./geocoding";
import { normalizeZipCode } from "./geocoding";

export interface ZipAggregate {
  zip: string;
  households: number;
  totalPledgeCurrent: number;
  totalPledgePrior: number;
  avgPledge: number;
  deltaDollar: number;
  deltaPercent: number | "n/a";
  coords?: Coordinates;
  distanceMiles?: number;
}

/**
 * Check if dataset has ZIP code data
 */
export function hasZipCodeData(rows: PledgeRow[]): boolean {
  return rows.some((row) => row.zipCode && row.zipCode.trim() !== "");
}

/**
 * Aggregate pledge data by ZIP code
 */
export function aggregateByZipCode(rows: PledgeRow[]): ZipAggregate[] {
  const zipMap = new Map<string, PledgeRow[]>();

  // Group rows by ZIP code
  for (const row of rows) {
    if (!row.zipCode || row.zipCode.trim() === "") {
      continue;
    }

    const normalizedZip = normalizeZipCode(row.zipCode);
    if (!zipMap.has(normalizedZip)) {
      zipMap.set(normalizedZip, []);
    }
    zipMap.get(normalizedZip)!.push(row);
  }

  // Calculate aggregates
  const aggregates: ZipAggregate[] = [];

  for (const [zip, zipRows] of zipMap.entries()) {
    const households = zipRows.length;
    const totalPledgeCurrent = zipRows.reduce(
      (sum, row) => sum + row.pledgeCurrent,
      0
    );
    const totalPledgePrior = zipRows.reduce(
      (sum, row) => sum + row.pledgePrior,
      0
    );
    const avgPledge = totalPledgeCurrent / households;
    const deltaDollar = totalPledgeCurrent - totalPledgePrior;
    const deltaPercent =
      totalPledgePrior === 0
        ? "n/a"
        : (totalPledgeCurrent - totalPledgePrior) / totalPledgePrior;

    aggregates.push({
      zip,
      households,
      totalPledgeCurrent,
      totalPledgePrior,
      avgPledge,
      deltaDollar,
      deltaPercent,
    });
  }

  return aggregates;
}

/**
 * Distance bin configuration
 */
export interface DistanceBin {
  label: string;
  min: number;
  max: number;
}

/**
 * Histogram data for distance analysis
 */
export interface DistanceHistogramBin {
  label: string;
  households: number;
  totalPledge: number;
}

/**
 * Calculate distance histogram using provided bins
 */
export function calculateDistanceHistogram(
  aggregates: ZipAggregate[],
  distanceBins: DistanceBin[],
  metric: "households" | "totalPledge" = "households"
): DistanceHistogramBin[] {
  const bins: DistanceHistogramBin[] = distanceBins.map((bin) => ({
    label: bin.label,
    households: 0,
    totalPledge: 0,
  }));

  for (const agg of aggregates) {
    if (agg.distanceMiles === undefined) continue;

    const binIndex = distanceBins.findIndex(
      (bin) => agg.distanceMiles! >= bin.min && agg.distanceMiles! < bin.max
    );

    if (binIndex !== -1) {
      bins[binIndex]!.households += agg.households;
      bins[binIndex]!.totalPledge += agg.totalPledgeCurrent;
    }
  }

  return bins;
}

/**
 * Sort options for ZIP table
 */
export type ZipSortField =
  | "zip"
  | "households"
  | "totalPledgeCurrent"
  | "avgPledge"
  | "deltaDollar"
  | "deltaPercent"
  | "distanceMiles";

export type ZipSortDirection = "asc" | "desc";

/**
 * Sort ZIP aggregates
 */
export function sortZipAggregates(
  aggregates: ZipAggregate[],
  field: ZipSortField,
  direction: ZipSortDirection
): ZipAggregate[] {
  const sorted = [...aggregates];

  sorted.sort((a, b) => {
    let aValue: number | string = 0;
    let bValue: number | string = 0;

    if (field === "deltaPercent") {
      // Handle "n/a" for delta percent
      aValue = a.deltaPercent === "n/a" ? -Infinity : a.deltaPercent;
      bValue = b.deltaPercent === "n/a" ? -Infinity : b.deltaPercent;
    } else if (field === "distanceMiles") {
      // Handle undefined distance
      aValue = a.distanceMiles ?? Infinity;
      bValue = b.distanceMiles ?? Infinity;
    } else {
      aValue = a[field] as number | string;
      bValue = b[field] as number | string;
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return direction === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === "number" && typeof bValue === "number") {
      return direction === "asc" ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  return sorted;
}
