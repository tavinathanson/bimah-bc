import type { FilterDefinition } from "./filter-types";

/**
 * SAVED VIEWS SYSTEM
 *
 * Saved views allow users to store dashboard configurations including:
 * - Category (Hineini, All Giving, etc.)
 * - Timeframe (This Year, Last Year, Compare, etc.)
 * - Active filters
 * - Visible sections
 *
 * Views are stored in localStorage and persist across sessions.
 */

/**
 * Dashboard category types
 */
export type DashboardCategory =
  | "hineini" // Two-year pledge comparison (existing)
  | "all_giving" // All transactions across time
  | "custom_charge_group" // User-defined charge type groupings
  | "membership" // Membership demographics and trends
  | "geography" // Geographic distribution and mapping
  | "attendance"; // Event and service attendance (future)

/**
 * Dashboard timeframe types
 */
export type DashboardTimeframe =
  | "this_year" // Current fiscal year snapshot
  | "last_year" // Prior fiscal year snapshot
  | "compare_two_years" // Side-by-side comparison (default for Hineini)
  | "multi_year_trend" // Trend over multiple years
  | "custom_range"; // User-defined date range

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  category: DashboardCategory;
  timeframe: DashboardTimeframe;
  fiscalYears?: number[]; // For compare mode or multi-year trends
  dateRange?: { start: Date; end: Date }; // For custom range
  chargeGroupId?: string; // For custom_charge_group category
}

/**
 * Saved view definition
 */
export interface SavedView {
  id: string;
  name: string;
  description?: string;
  category: DashboardCategory;
  timeframe: DashboardTimeframe;
  fiscalYears?: number[]; // Which fiscal years to analyze
  chargeGroupId?: string; // For custom charge group views
  filters: FilterDefinition[]; // Pre-applied filters
  visibleSections: string[]; // Section IDs to show
  createdAt: Date;
  updatedAt: Date;
  isOfficial?: boolean; // true for built-in views like "Beth Chaim - Hineini"
}

/**
 * Section visibility configuration
 */
export interface SectionVisibility {
  [sectionId: string]: boolean;
}

/**
 * Helper to get current fiscal year
 *
 * Assumes fiscal year starts July 1 and ends June 30.
 * For example: July 1, 2025 - June 30, 2026 is FY2026.
 */
export function getCurrentFiscalYear(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // If we're in July-December, it's the next calendar year's FY
  // If we're in January-June, it's the current calendar year's FY
  return month >= 6 ? year + 1 : year;
}

/**
 * Helper to get fiscal year from a date
 */
export function getFiscalYear(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= 6 ? year + 1 : year;
}

/**
 * Get fiscal year label for display
 */
export function getFiscalYearLabel(fiscalYear: number): string {
  return `FY${fiscalYear}`;
}

/**
 * Get fiscal year range for display
 */
export function getFiscalYearRange(fiscalYear: number): string {
  return `${fiscalYear - 1}-${fiscalYear}`;
}
