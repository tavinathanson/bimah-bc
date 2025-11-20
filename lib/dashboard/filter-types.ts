/**
 * UNIVERSAL FILTER SYSTEM
 *
 * Type definitions for a flexible filtering system that works across
 * all dashboard categories (Hineini, All Giving, Membership, etc.)
 */

export type FilterOperator = "equals" | "in" | "between" | "gt" | "lt" | "gte" | "lte";

/**
 * A single filter definition
 */
export interface FilterDefinition {
  id: string; // Unique identifier (e.g., "ageCohort_40-49")
  field: string; // Field name in data model (e.g., "age", "amount", "status")
  operator: FilterOperator;
  value: string | number | string[] | [number, number];
  label: string; // Human-readable display (e.g., "Age: 40-49")
  category: string; // Filter category for grouping (e.g., "Age", "Amount", "Status")
}

/**
 * Filter category configuration
 */
export interface FilterCategory {
  id: string;
  label: string;
  type: "multi-select" | "range" | "single-select" | "custom";
  options?: FilterOption[]; // for select types
}

/**
 * A single filter option within a category
 */
export interface FilterOption {
  value: string;
  label: string;
  count?: number; // optional count for display
}

/**
 * Filter chip for display in UI
 */
export interface FilterChip {
  id: string;
  label: string;
  category: string;
  onRemove: () => void;
}

/**
 * Chart click-to-filter integration
 */
export interface ChartClickHandler {
  field: string; // Which field to filter on
  category: string; // Filter category name
  getLabel: (value: any) => string; // Function to generate human-readable label
}
