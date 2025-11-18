import type { Insight, YearMetrics, HouseholdYearData, FilterState } from "@/lib/schema/types";

/**
 * Generate contextual insights from year metrics
 */
export function generateInsights(
  yearMetrics: YearMetrics[],
  households: HouseholdYearData[],
  activeFilters: FilterState["activeFilters"]
): Insight[] {
  const insights: Insight[] = [];

  if (yearMetrics.length < 2) {
    return insights;
  }

  // Sort metrics by year
  const sortedMetrics = [...yearMetrics].sort((a, b) => a.year - b.year);
  const latestYear = sortedMetrics[sortedMetrics.length - 1];
  const previousYear = sortedMetrics[sortedMetrics.length - 2];

  if (!latestYear || !previousYear) {
    return insights;
  }

  // Overall trend insight
  const overallChange = previousYear.totalGiving > 0
    ? ((latestYear.totalGiving - previousYear.totalGiving) / previousYear.totalGiving) * 100
    : 0;

  if (Math.abs(overallChange) > 5) {
    insights.push({
      id: "overall-trend",
      type: "trend",
      severity: overallChange > 0 ? "positive" : "negative",
      title: `Giving ${overallChange > 0 ? "increased" : "decreased"} ${Math.abs(overallChange).toFixed(1)}%`,
      description: `Total giving went from $${formatNumber(previousYear.totalGiving)} in ${previousYear.year} to $${formatNumber(latestYear.totalGiving)} in ${latestYear.year}.`,
    });
  }

  // Household count change
  const householdChange = previousYear.householdCount > 0
    ? ((latestYear.householdCount - previousYear.householdCount) / previousYear.householdCount) * 100
    : 0;

  if (Math.abs(householdChange) > 5) {
    insights.push({
      id: "household-trend",
      type: "trend",
      severity: householdChange > 0 ? "positive" : householdChange < -10 ? "negative" : "warning",
      title: `${Math.abs(householdChange).toFixed(0)}% ${householdChange > 0 ? "more" : "fewer"} households`,
      description: `Active households changed from ${previousYear.householdCount} to ${latestYear.householdCount}.`,
    });
  }

  // Median gift change
  const medianChange = previousYear.medianGift > 0
    ? ((latestYear.medianGift - previousYear.medianGift) / previousYear.medianGift) * 100
    : 0;

  if (Math.abs(medianChange) > 10) {
    insights.push({
      id: "median-trend",
      type: "trend",
      severity: medianChange > 0 ? "positive" : "warning",
      title: `Median gift ${medianChange > 0 ? "up" : "down"} ${Math.abs(medianChange).toFixed(0)}%`,
      description: `The median household gift changed from $${formatNumber(previousYear.medianGift)} to $${formatNumber(latestYear.medianGift)}.`,
    });
  }

  // Age cohort insights
  const ageCohortInsights = generateAgeCohortInsights(latestYear, previousYear);
  insights.push(...ageCohortInsights);

  // Tenure insights
  const tenureInsights = generateTenureInsights(latestYear, previousYear);
  insights.push(...tenureInsights);

  // Top charge type insights
  if (!activeFilters.chargeTypes || activeFilters.chargeTypes.length > 1) {
    const chargeTypeInsights = generateChargeTypeInsights(latestYear, previousYear);
    insights.push(...chargeTypeInsights);
  }

  // Concentration insights
  const concentrationInsights = generateConcentrationInsights(households, latestYear.year);
  insights.push(...concentrationInsights);

  return insights;
}

/**
 * Generate insights about age cohort performance
 */
function generateAgeCohortInsights(latest: YearMetrics, previous: YearMetrics): Insight[] {
  const insights: Insight[] = [];

  for (const latestCohort of latest.byAgeCohort) {
    const prevCohort = previous.byAgeCohort.find(c => c.cohort === latestCohort.cohort);
    if (!prevCohort || prevCohort.total === 0) continue;

    const change = ((latestCohort.total - prevCohort.total) / prevCohort.total) * 100;

    // Only report significant changes
    if (Math.abs(change) > 15) {
      insights.push({
        id: `age-${latestCohort.cohort}`,
        type: "comparison",
        severity: change > 0 ? "positive" : "warning",
        title: `${latestCohort.cohort} ${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(0)}%`,
        description: `This age group's giving changed from $${formatNumber(prevCohort.total)} to $${formatNumber(latestCohort.total)}.`,
        relevantFilters: { ageCohorts: [latestCohort.cohort] },
      });
    }
  }

  // Find best and worst performing cohorts
  const cohortsWithChange = latest.byAgeCohort
    .map(c => {
      const prev = previous.byAgeCohort.find(p => p.cohort === c.cohort);
      const change = prev && prev.total > 0
        ? ((c.total - prev.total) / prev.total) * 100
        : 0;
      return { cohort: c.cohort, change };
    })
    .filter(c => c.change !== 0)
    .sort((a, b) => b.change - a.change);

  if (cohortsWithChange.length >= 2) {
    const best = cohortsWithChange[0];
    const worst = cohortsWithChange[cohortsWithChange.length - 1];

    if (best && worst && best.change > 10 && worst.change < -5) {
      insights.push({
        id: "age-comparison",
        type: "comparison",
        severity: "info",
        title: "Age cohort performance varies",
        description: `${best.cohort} leads growth at +${best.change.toFixed(0)}%, while ${worst.cohort} declined ${Math.abs(worst.change).toFixed(0)}%.`,
      });
    }
  }

  return insights;
}

/**
 * Generate insights about member tenure
 */
function generateTenureInsights(latest: YearMetrics, previous: YearMetrics): Insight[] {
  const insights: Insight[] = [];

  // Check new members (first cohort)
  const latestNew = latest.byTenure.find(t => t.cohort.toLowerCase().includes("new") || t.cohort.includes("0-2"));
  const prevNew = previous.byTenure.find(t => t.cohort.toLowerCase().includes("new") || t.cohort.includes("0-2"));

  if (latestNew && prevNew && prevNew.total > 0) {
    const change = ((latestNew.total - prevNew.total) / prevNew.total) * 100;
    if (Math.abs(change) > 20) {
      insights.push({
        id: "new-members-trend",
        type: "trend",
        severity: change > 0 ? "positive" : "warning",
        title: `New member giving ${change > 0 ? "surged" : "dropped"} ${Math.abs(change).toFixed(0)}%`,
        description: `Members with 0-2 years tenure gave $${formatNumber(latestNew.total)} vs $${formatNumber(prevNew.total)} last year.`,
        relevantFilters: { tenureCohorts: [latestNew.cohort] },
      });
    }
  }

  // Check legacy members
  const latestLegacy = latest.byTenure.find(t => t.cohort.toLowerCase().includes("legacy") || t.cohort.includes("11+"));
  const prevLegacy = previous.byTenure.find(t => t.cohort.toLowerCase().includes("legacy") || t.cohort.includes("11+"));

  if (latestLegacy && prevLegacy && prevLegacy.total > 0) {
    const legacyPct = (latestLegacy.total / latest.totalGiving) * 100;
    if (legacyPct > 40) {
      insights.push({
        id: "legacy-concentration",
        type: "highlight",
        severity: "info",
        title: `Legacy members provide ${legacyPct.toFixed(0)}% of giving`,
        description: `Members with 11+ years tenure gave $${formatNumber(latestLegacy.total)} of the $${formatNumber(latest.totalGiving)} total.`,
        relevantFilters: { tenureCohorts: [latestLegacy.cohort] },
      });
    }
  }

  return insights;
}

/**
 * Generate insights about charge types
 */
function generateChargeTypeInsights(latest: YearMetrics, previous: YearMetrics): Insight[] {
  const insights: Insight[] = [];

  // Find top charge type
  const sortedTypes = [...latest.byChargeType].sort((a, b) => b.total - a.total);
  const topType = sortedTypes[0];

  if (topType && latest.totalGiving > 0) {
    const pct = (topType.total / latest.totalGiving) * 100;
    if (pct > 30) {
      insights.push({
        id: "top-charge-type",
        type: "highlight",
        severity: "info",
        title: `${topType.type} is ${pct.toFixed(0)}% of giving`,
        description: `$${formatNumber(topType.total)} from ${topType.count} households.`,
        relevantFilters: { chargeTypes: [topType.type] },
      });
    }
  }

  // Find biggest growth charge type
  const typesWithChange = latest.byChargeType
    .map(t => {
      const prev = previous.byChargeType.find(p => p.type === t.type);
      const change = prev && prev.total > 0
        ? ((t.total - prev.total) / prev.total) * 100
        : 0;
      return { type: t.type, change, total: t.total };
    })
    .filter(t => t.total > latest.totalGiving * 0.05) // Only significant types
    .sort((a, b) => b.change - a.change);

  const fastest = typesWithChange[0];
  if (fastest && fastest.change > 20) {
    insights.push({
      id: "fastest-growing-type",
      type: "trend",
      severity: "positive",
      title: `${fastest.type} grew ${fastest.change.toFixed(0)}%`,
      description: `This charge type had the strongest year-over-year growth.`,
      relevantFilters: { chargeTypes: [fastest.type] },
    });
  }

  return insights;
}

/**
 * Generate insights about giving concentration
 */
function generateConcentrationInsights(
  households: HouseholdYearData[],
  year: number
): Insight[] {
  const insights: Insight[] = [];

  // Get giving amounts for the specified year
  const givingAmounts = households
    .map(h => h.givingByYear[year]?.total || 0)
    .filter(a => a > 0)
    .sort((a, b) => b - a);

  if (givingAmounts.length < 10) return insights;

  const totalGiving = givingAmounts.reduce((sum, a) => sum + a, 0);
  const top10Count = Math.ceil(givingAmounts.length * 0.1);
  const top10Total = givingAmounts.slice(0, top10Count).reduce((sum, a) => sum + a, 0);
  const top10Pct = (top10Total / totalGiving) * 100;

  if (top10Pct > 50) {
    insights.push({
      id: "top-10-concentration",
      type: "highlight",
      severity: top10Pct > 70 ? "warning" : "info",
      title: `Top 10% give ${top10Pct.toFixed(0)}% of total`,
      description: `${top10Count} households contribute $${formatNumber(top10Total)} of the $${formatNumber(totalGiving)} total.`,
    });
  }

  // Check for very high individual concentration
  const topHousehold = givingAmounts[0] || 0;
  const topHouseholdPct = (topHousehold / totalGiving) * 100;

  if (topHouseholdPct > 10) {
    insights.push({
      id: "top-household",
      type: "anomaly",
      severity: "warning",
      title: `Single household is ${topHouseholdPct.toFixed(0)}% of giving`,
      description: `The top household gave $${formatNumber(topHousehold)}. Consider diversification strategies.`,
    });
  }

  return insights;
}

/**
 * Format number for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K`;
  }
  return num.toLocaleString();
}

/**
 * Component to display insights inline
 */
export function InsightCard({
  insight,
  onFilterClick,
}: {
  insight: Insight;
  onFilterClick?: (filters: Partial<FilterState["activeFilters"]>) => void;
}) {
  const bgColors = {
    info: "bg-blue-50 border-blue-200",
    positive: "bg-green-50 border-green-200",
    warning: "bg-amber-50 border-amber-200",
    negative: "bg-red-50 border-red-200",
  };

  const iconColors = {
    info: "text-blue-600",
    positive: "text-green-600",
    warning: "text-amber-600",
    negative: "text-red-600",
  };

  const icons = {
    info: "💡",
    positive: "📈",
    warning: "⚠️",
    negative: "📉",
  };

  const isClickable = insight.relevantFilters && onFilterClick;

  return (
    <div
      className={`p-4 rounded-lg border ${bgColors[insight.severity]} ${
        isClickable ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
      onClick={() => {
        if (isClickable && insight.relevantFilters) {
          onFilterClick(insight.relevantFilters);
        }
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg" role="img" aria-label={insight.severity}>
          {icons[insight.severity]}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${iconColors[insight.severity]}`}>
            {insight.title}
          </h4>
          <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
          {isClickable && (
            <p className="text-xs text-gray-400 mt-2">Click to filter</p>
          )}
        </div>
      </div>
    </div>
  );
}
