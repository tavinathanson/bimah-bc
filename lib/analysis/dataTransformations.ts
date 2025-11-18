import { differenceInYears } from "date-fns";
import type {
  Transaction,
  YearMetrics,
  HouseholdYearData,
  FilterState,
} from "@/lib/schema/types";
import { GIVING_LEVELS } from "@/lib/schema/types";
import { TENURE_COHORTS, AGE_COHORTS, PLEDGE_BINS } from "@/lib/schema/constants";

/**
 * Household with computed comparison fields for a specific year pair
 */
export interface HouseholdComparison {
  accountId: string;
  age?: number;
  zip?: string;
  tenureYears?: number;
  currentYearGiving: number;
  priorYearGiving: number;
  status: "renewed" | "new" | "lapsed" | "none";
  changeDirection?: "increased" | "decreased" | "no-change";
  changeDollar: number;
  changePercent: number | null;
  pledgeBin: string;
  ageCohort: string;
  givingLevel: string;
  tenureCohort: string;
  // By charge type for the current year
  byChargeType: Record<string, number>;
}

/**
 * Compute household comparisons for a specific year pair
 */
export function computeHouseholdComparisons(
  households: HouseholdYearData[],
  currentYear: number,
  priorYear: number,
  selectedChargeTypes?: string[]
): HouseholdComparison[] {
  const comparisons: HouseholdComparison[] = [];

  for (const h of households) {
    // Calculate totals for each year
    let currentTotal = 0;
    let priorTotal = 0;
    const byChargeType: Record<string, number> = {};

    const currentYearData = h.givingByYear[currentYear];
    const priorYearData = h.givingByYear[priorYear];

    if (currentYearData) {
      if (selectedChargeTypes && selectedChargeTypes.length > 0) {
        for (const type of selectedChargeTypes) {
          const amount = currentYearData.byChargeType[type] || 0;
          currentTotal += amount;
          if (amount > 0) byChargeType[type] = amount;
        }
      } else {
        currentTotal = currentYearData.total;
        Object.assign(byChargeType, currentYearData.byChargeType);
      }
    }

    if (priorYearData) {
      if (selectedChargeTypes && selectedChargeTypes.length > 0) {
        for (const type of selectedChargeTypes) {
          priorTotal += priorYearData.byChargeType[type] || 0;
        }
      } else {
        priorTotal = priorYearData.total;
      }
    }

    // Skip households with no activity in either year
    if (currentTotal === 0 && priorTotal === 0) continue;

    // Determine status
    let status: HouseholdComparison["status"];
    if (currentTotal > 0 && priorTotal > 0) {
      status = "renewed";
    } else if (currentTotal > 0 && priorTotal === 0) {
      status = "new";
    } else if (currentTotal === 0 && priorTotal > 0) {
      status = "lapsed";
    } else {
      status = "none";
    }

    // Determine change direction for renewed
    let changeDirection: HouseholdComparison["changeDirection"];
    if (status === "renewed") {
      if (currentTotal > priorTotal * 1.01) {
        changeDirection = "increased";
      } else if (currentTotal < priorTotal * 0.99) {
        changeDirection = "decreased";
      } else {
        changeDirection = "no-change";
      }
    }

    const changeDollar = currentTotal - priorTotal;
    const changePercent = priorTotal > 0 ? (changeDollar / priorTotal) * 100 : null;

    comparisons.push({
      accountId: h.accountId,
      age: h.age,
      zip: h.zip,
      tenureYears: h.tenureYears,
      currentYearGiving: currentTotal,
      priorYearGiving: priorTotal,
      status,
      changeDirection,
      changeDollar,
      changePercent,
      pledgeBin: getPledgeBinLabel(currentTotal),
      ageCohort: getAgeCohortLabel(h.age || 50),
      givingLevel: getGivingLevelLabel(currentTotal),
      tenureCohort: getTenureCohortLabel(h.tenureYears ?? 5),
      byChargeType,
    });
  }

  return comparisons;
}

/**
 * Get pledge bin label using original bins
 */
export function getPledgeBinLabel(amount: number): string {
  if (amount === 0) return "No Pledge";
  for (const bin of PLEDGE_BINS) {
    if (amount >= bin.min && amount < bin.max) {
      return bin.label;
    }
  }
  return "Unknown";
}

/**
 * Compute comparison summary metrics
 */
export function computeComparisonMetrics(comparisons: HouseholdComparison[]) {
  const totalHouseholds = comparisons.length;
  const currentTotal = comparisons.reduce((sum, c) => sum + c.currentYearGiving, 0);
  const priorTotal = comparisons.reduce((sum, c) => sum + c.priorYearGiving, 0);

  // Status counts
  const renewed = comparisons.filter(c => c.status === "renewed").length;
  const newHouseholds = comparisons.filter(c => c.status === "new").length;
  const lapsed = comparisons.filter(c => c.status === "lapsed").length;
  const none = comparisons.filter(c => c.status === "none").length;

  // Change direction counts (for renewed only)
  const renewedComparisons = comparisons.filter(c => c.status === "renewed");
  const increased = renewedComparisons.filter(c => c.changeDirection === "increased").length;
  const decreased = renewedComparisons.filter(c => c.changeDirection === "decreased").length;
  const noChange = renewedComparisons.filter(c => c.changeDirection === "no-change").length;

  // Calculate averages and medians
  const currentGifts = comparisons.filter(c => c.currentYearGiving > 0).map(c => c.currentYearGiving).sort((a, b) => a - b);
  const avgGift = currentGifts.length > 0 ? currentTotal / currentGifts.length : 0;
  const medianGift = currentGifts.length > 0 ? currentGifts[Math.floor(currentGifts.length / 2)] : 0;

  return {
    totalHouseholds,
    currentTotal,
    priorTotal,
    changeDollar: currentTotal - priorTotal,
    changePercent: priorTotal > 0 ? ((currentTotal - priorTotal) / priorTotal) * 100 : 0,
    avgGift,
    medianGift,
    status: { renewed, new: newHouseholds, lapsed, none },
    changeDirection: { increased, decreased, noChange },
  };
}

/**
 * Aggregate comparisons by a field
 */
export function aggregateComparisonsByField<K extends keyof HouseholdComparison>(
  comparisons: HouseholdComparison[],
  field: K,
  valueField: "currentYearGiving" | "count" = "currentYearGiving"
): { name: string; value: number }[] {
  const grouped = new Map<string, number>();

  for (const c of comparisons) {
    const key = String(c[field] || "Unknown");
    const current = grouped.get(key) || 0;
    if (valueField === "count") {
      grouped.set(key, current + 1);
    } else {
      grouped.set(key, current + c.currentYearGiving);
    }
  }

  return Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Transform raw transactions into HouseholdYearData format
 */
export function transformToHouseholdData(
  transactions: Transaction[]
): HouseholdYearData[] {
  const byAccount = new Map<string, HouseholdYearData>();

  for (const t of transactions) {
    const year = t.date.getFullYear();
    const existing = byAccount.get(t.accountId) || {
      accountId: t.accountId,
      givingByYear: {},
    };

    // Update household metadata
    if (t.primaryBirthday) {
      existing.age = differenceInYears(new Date(), t.primaryBirthday);
    }
    if (t.zip) {
      existing.zip = t.zip;
    }
    if (t.memberSince) {
      existing.memberSince = t.memberSince;
      existing.tenureYears = differenceInYears(new Date(), t.memberSince);
    } else if (t.joinDate) {
      existing.memberSince = t.joinDate;
      existing.tenureYears = differenceInYears(new Date(), t.joinDate);
    }

    // Initialize year data if needed
    if (!existing.givingByYear[year]) {
      existing.givingByYear[year] = { total: 0, byChargeType: {} };
    }

    // Add to totals
    existing.givingByYear[year].total += t.amount;
    existing.givingByYear[year].byChargeType[t.chargeType] =
      (existing.givingByYear[year].byChargeType[t.chargeType] || 0) + t.amount;

    byAccount.set(t.accountId, existing);
  }

  return Array.from(byAccount.values());
}

/**
 * Compute YearMetrics for all years in the data
 */
export function computeYearMetrics(
  households: HouseholdYearData[],
  selectedChargeTypes?: string[]
): YearMetrics[] {
  // Get all years
  const years = new Set<number>();
  for (const h of households) {
    for (const year of Object.keys(h.givingByYear)) {
      years.add(Number(year));
    }
  }

  const metrics: YearMetrics[] = [];

  for (const year of years) {
    const yearData = computeMetricsForYear(households, year, selectedChargeTypes);
    if (yearData.householdCount > 0) {
      metrics.push(yearData);
    }
  }

  return metrics.sort((a, b) => a.year - b.year);
}

/**
 * Compute metrics for a single year
 */
function computeMetricsForYear(
  households: HouseholdYearData[],
  year: number,
  selectedChargeTypes?: string[]
): YearMetrics {
  const householdsWithData: { household: HouseholdYearData; total: number }[] = [];

  // Collect households with giving in this year
  for (const h of households) {
    const yearData = h.givingByYear[year];
    if (!yearData) continue;

    let total = 0;
    if (selectedChargeTypes && selectedChargeTypes.length > 0) {
      // Sum only selected charge types
      for (const type of selectedChargeTypes) {
        total += yearData.byChargeType[type] || 0;
      }
    } else {
      total = yearData.total;
    }

    if (total > 0) {
      householdsWithData.push({ household: h, total });
    }
  }

  // Sort by total for percentile calculations
  const sortedTotals = householdsWithData.map(h => h.total).sort((a, b) => a - b);
  const totalGiving = sortedTotals.reduce((sum, t) => sum + t, 0);
  const medianGift = sortedTotals.length > 0
    ? sortedTotals[Math.floor(sortedTotals.length / 2)] || 0
    : 0;
  const avgGift = sortedTotals.length > 0
    ? totalGiving / sortedTotals.length
    : 0;

  // Aggregate by age cohort
  const byAgeCohort = aggregateByAgeCohort(householdsWithData);

  // Aggregate by giving level
  const byGivingLevel = aggregateByGivingLevel(householdsWithData);

  // Aggregate by charge type
  const byChargeType = aggregateByChargeType(householdsWithData, year, selectedChargeTypes);

  // Aggregate by tenure
  const byTenure = aggregateByTenure(householdsWithData);

  // Aggregate by ZIP
  const byZip = aggregateByZip(householdsWithData);

  return {
    year,
    totalGiving,
    householdCount: householdsWithData.length,
    medianGift,
    avgGift,
    byAgeCohort,
    byGivingLevel,
    byChargeType,
    byTenure,
    byZip,
  };
}

function aggregateByAgeCohort(
  data: { household: HouseholdYearData; total: number }[]
): YearMetrics["byAgeCohort"] {
  const cohortMap = new Map<string, { total: number; count: number }>();

  for (const { household, total } of data) {
    const age = household.age || 50; // Default age
    const cohort = getAgeCohortLabel(age);
    const existing = cohortMap.get(cohort) || { total: 0, count: 0 };
    existing.total += total;
    existing.count += 1;
    cohortMap.set(cohort, existing);
  }

  return Array.from(cohortMap.entries()).map(([cohort, data]) => ({
    cohort,
    total: data.total,
    count: data.count,
    avg: data.count > 0 ? data.total / data.count : 0,
  }));
}

function aggregateByGivingLevel(
  data: { household: HouseholdYearData; total: number }[]
): YearMetrics["byGivingLevel"] {
  const levelMap = new Map<string, { count: number; total: number }>();

  for (const { total } of data) {
    const level = getGivingLevelLabel(total);
    const existing = levelMap.get(level) || { count: 0, total: 0 };
    existing.count += 1;
    existing.total += total;
    levelMap.set(level, existing);
  }

  return Array.from(levelMap.entries()).map(([level, data]) => ({
    level,
    count: data.count,
    total: data.total,
  }));
}

function aggregateByChargeType(
  data: { household: HouseholdYearData; total: number }[],
  year: number,
  selectedChargeTypes?: string[]
): YearMetrics["byChargeType"] {
  const typeMap = new Map<string, { total: number; count: number }>();

  for (const { household } of data) {
    const yearData = household.givingByYear[year];
    if (!yearData) continue;

    for (const [type, amount] of Object.entries(yearData.byChargeType)) {
      // Skip if not in selected types
      if (selectedChargeTypes && selectedChargeTypes.length > 0) {
        if (!selectedChargeTypes.includes(type)) continue;
      }

      const existing = typeMap.get(type) || { total: 0, count: 0 };
      existing.total += amount;
      existing.count += 1;
      typeMap.set(type, existing);
    }
  }

  return Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      total: data.total,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);
}

function aggregateByTenure(
  data: { household: HouseholdYearData; total: number }[]
): YearMetrics["byTenure"] {
  const cohortMap = new Map<string, { total: number; count: number }>();

  for (const { household, total } of data) {
    const tenure = household.tenureYears ?? 5; // Default tenure
    const cohort = getTenureCohortLabel(tenure);
    const existing = cohortMap.get(cohort) || { total: 0, count: 0 };
    existing.total += total;
    existing.count += 1;
    cohortMap.set(cohort, existing);
  }

  return Array.from(cohortMap.entries()).map(([cohort, data]) => ({
    cohort,
    total: data.total,
    count: data.count,
    avg: data.count > 0 ? data.total / data.count : 0,
  }));
}

function aggregateByZip(
  data: { household: HouseholdYearData; total: number }[]
): YearMetrics["byZip"] {
  const zipMap = new Map<string, { total: number; count: number }>();

  for (const { household, total } of data) {
    const zip = household.zip || "Unknown";
    const existing = zipMap.get(zip) || { total: 0, count: 0 };
    existing.total += total;
    existing.count += 1;
    zipMap.set(zip, existing);
  }

  return Array.from(zipMap.entries())
    .map(([zip, data]) => ({
      zip,
      total: data.total,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Get age cohort label for a given age
 */
export function getAgeCohortLabel(age: number): string {
  for (const cohort of AGE_COHORTS) {
    if (age >= cohort.min && age < cohort.max) {
      return cohort.label;
    }
  }
  return "Unknown";
}

/**
 * Get giving level label for a given amount
 */
export function getGivingLevelLabel(amount: number): string {
  for (const level of GIVING_LEVELS) {
    if (amount >= level.min && amount < level.max) {
      return level.label;
    }
  }
  return "Unknown";
}

/**
 * Get tenure cohort label for a given number of years
 */
export function getTenureCohortLabel(years: number): string {
  for (const cohort of TENURE_COHORTS) {
    if (years >= cohort.min && years < cohort.max) {
      return cohort.label;
    }
  }
  return "Unknown";
}

/**
 * Filter households based on active filters
 */
export function filterHouseholds(
  households: HouseholdYearData[],
  activeFilters: FilterState["activeFilters"],
  year: number
): HouseholdYearData[] {
  return households.filter(h => {
    // Check if household has data for the year
    const yearData = h.givingByYear[year];
    if (!yearData || yearData.total === 0) return false;

    // Age cohort filter
    if (activeFilters.ageCohorts && activeFilters.ageCohorts.length > 0) {
      const cohort = getAgeCohortLabel(h.age || 50);
      if (!activeFilters.ageCohorts.includes(cohort)) return false;
    }

    // Tenure filter
    if (activeFilters.tenureCohorts && activeFilters.tenureCohorts.length > 0) {
      const cohort = getTenureCohortLabel(h.tenureYears ?? 5);
      if (!activeFilters.tenureCohorts.includes(cohort)) return false;
    }

    // ZIP filter
    if (activeFilters.zips && activeFilters.zips.length > 0) {
      if (!h.zip || !activeFilters.zips.includes(h.zip)) return false;
    }

    // Giving level filter
    if (activeFilters.givingLevels && activeFilters.givingLevels.length > 0) {
      const level = getGivingLevelLabel(yearData.total);
      if (!activeFilters.givingLevels.includes(level)) return false;
    }

    // Charge type filter - check if household has any selected charge types
    if (activeFilters.chargeTypes && activeFilters.chargeTypes.length > 0) {
      const hasAny = activeFilters.chargeTypes.some(
        type => (yearData.byChargeType[type] || 0) > 0
      );
      if (!hasAny) return false;
    }

    return true;
  });
}

/**
 * Get all available years from household data
 */
export function getAvailableYears(households: HouseholdYearData[]): number[] {
  const years = new Set<number>();
  for (const h of households) {
    for (const year of Object.keys(h.givingByYear)) {
      years.add(Number(year));
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Get all available charge types from household data
 */
export function getAvailableChargeTypes(households: HouseholdYearData[]): string[] {
  const types = new Set<string>();
  for (const h of households) {
    for (const yearData of Object.values(h.givingByYear)) {
      for (const type of Object.keys(yearData.byChargeType)) {
        types.add(type);
      }
    }
  }
  return Array.from(types).sort();
}

/**
 * Prepare data for time-series charts
 */
export function prepareTimeSeriesData(
  metrics: YearMetrics[],
  valueKey: "totalGiving" | "householdCount" | "medianGift" | "avgGift"
): { year: number; value: number }[] {
  return metrics
    .map(m => ({ year: m.year, value: m[valueKey] }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Prepare multi-series data for comparing categories over time
 */
export function prepareMultiSeriesData(
  metrics: YearMetrics[],
  categories: string[],
  accessor: (m: YearMetrics) => { category: string; value: number }[]
): { year: number; [key: string]: number }[] {
  return metrics.map(m => {
    const point: { year: number; [key: string]: number } = { year: m.year };
    const values = accessor(m);
    for (const cat of categories) {
      const found = values.find(v => v.category === cat);
      point[cat] = found?.value || 0;
    }
    return point;
  });
}
