/**
 * CHART UTILITIES
 *
 * Shared utilities for chart rendering, hiding logic, and formatting.
 */

/**
 * Chart types supported in the dashboard
 */
export type ChartType = "pie" | "bar" | "line" | "map" | "table" | "histogram";

/**
 * Determine if a chart should be hidden based on filtered data
 *
 * Rules:
 * - Pie/donut: hide if only 1 slice remains
 * - Bar chart: hide if only 1 bar remains
 * - Histogram: hide if only 1 bin remains
 * - Line chart: hide if only 1 data point remains
 * - Map: never hide (always useful for geographic context)
 * - Table: never hide (useful even with one row)
 *
 * @param chartType - Type of chart
 * @param dataPoints - Filtered data points for the chart
 * @returns true if chart should be hidden
 */
export function shouldHideChart(
  chartType: ChartType,
  dataPoints: any[]
): boolean {
  // Never hide maps or tables
  if (chartType === "map" || chartType === "table") {
    return false;
  }

  // Don't hide if there's no data (show empty state instead)
  if (dataPoints.length === 0) {
    return false;
  }

  // Hide pie, bar, and histogram charts when only one data point remains
  if (chartType === "pie" || chartType === "bar" || chartType === "histogram") {
    return dataPoints.length === 1;
  }

  // Hide line charts when only one point (can't show a trend)
  if (chartType === "line") {
    return dataPoints.length === 1;
  }

  return false;
}

/**
 * Generate a helpful message explaining why a chart is hidden
 *
 * @param chartType - Type of chart
 * @param filterCount - Number of active filters
 * @returns User-friendly explanation message
 */
export function getHiddenChartMessage(
  chartType: ChartType,
  filterCount: number
): string {
  if (filterCount === 0) {
    return "This chart has been hidden because there is insufficient data.";
  }

  const chartName = chartType === "pie" ? "pie chart" : "chart";

  return `This ${chartName} is hidden because only one category remains after filtering. Remove some filters to see the distribution.`;
}

/**
 * Theme colors for charts (Blue dominant with gold accents)
 *
 * Based on Jewish themes: Star of David blue + Menorah gold
 */
export const CHART_COLORS = [
  "#1886d9", // star-blue-500 (primary blue)
  "#36a5f1", // star-blue-400 (lighter blue)
  "#e6aa0f", // menorah-gold-500 (gold accent)
  "#0e69bb", // star-blue-600 (deeper blue)
  "#f2c41e", // menorah-gold-400 (lighter gold)
  "#0b5293", // star-blue-700 (darkest blue)
  "#d49b0c", // menorah-gold-600 (deeper gold)
  "#7cc5f7", // star-blue-300 (lightest blue)
];

/**
 * Get a color for a specific data index
 *
 * @param index - Data point index
 * @returns Hex color code
 */
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * Format a number for chart display
 *
 * @param value - Numeric value
 * @param format - Format type
 * @returns Formatted string
 */
export function formatChartValue(
  value: number,
  format: "number" | "currency" | "percent" = "number"
): string {
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (format === "percent") {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Generate a stable, unique ID for a filter based on field and value
 *
 * @param field - Field name
 * @param value - Filter value
 * @returns Unique filter ID
 */
export function generateFilterId(field: string, value: string | number): string {
  return `${field}_${String(value).replace(/\s+/g, "_").toLowerCase()}`;
}

/**
 * Check if data is empty or has no meaningful values
 *
 * @param data - Array of data points
 * @param valueKey - Key to check for non-zero values
 * @returns true if all values are zero or empty
 */
export function isDataEmpty(data: any[], valueKey: string = "count"): boolean {
  if (data.length === 0) return true;

  return data.every((item) => {
    const value = item[valueKey];
    return value === 0 || value === null || value === undefined;
  });
}

/**
 * Sort chart data by a specific key
 *
 * @param data - Array of data points
 * @param key - Key to sort by
 * @param direction - Sort direction
 * @returns Sorted array (new array, original unchanged)
 */
export function sortChartData<T>(
  data: T[],
  key: keyof T,
  direction: "asc" | "desc" = "desc"
): T[] {
  const sorted = [...data];
  sorted.sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (typeof aVal === "number" && typeof bVal === "number") {
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return direction === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return 0;
  });

  return sorted;
}
