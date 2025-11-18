"use client";

import { useState, useCallback, useMemo } from "react";
import type { Filter, FilterState, FilterType } from "@/lib/schema/types";

/**
 * Hook for managing filter stack with history navigation
 */
export function useFilterStack() {
  const [stack, setStack] = useState<Filter[]>([]);

  // Compute active filters from stack
  const activeFilters = useMemo(() => {
    const filters: FilterState["activeFilters"] = {};

    for (const filter of stack) {
      switch (filter.type) {
        case "ageCohort":
          if (!filters.ageCohorts) filters.ageCohorts = [];
          if (Array.isArray(filter.value)) {
            filters.ageCohorts.push(...filter.value.map(String));
          } else {
            filters.ageCohorts.push(String(filter.value));
          }
          break;
        case "givingLevel":
          if (!filters.givingLevels) filters.givingLevels = [];
          if (Array.isArray(filter.value)) {
            filters.givingLevels.push(...filter.value.map(String));
          } else {
            filters.givingLevels.push(String(filter.value));
          }
          break;
        case "chargeType":
          if (!filters.chargeTypes) filters.chargeTypes = [];
          if (Array.isArray(filter.value)) {
            filters.chargeTypes.push(...filter.value.map(String));
          } else {
            filters.chargeTypes.push(String(filter.value));
          }
          break;
        case "chargeTypeGroup":
          filters.chargeTypeGroup = String(filter.value);
          break;
        case "tenure":
          if (!filters.tenureCohorts) filters.tenureCohorts = [];
          if (Array.isArray(filter.value)) {
            filters.tenureCohorts.push(...filter.value.map(String));
          } else {
            filters.tenureCohorts.push(String(filter.value));
          }
          break;
        case "zip":
          if (!filters.zips) filters.zips = [];
          if (Array.isArray(filter.value)) {
            filters.zips.push(...filter.value.map(String));
          } else {
            filters.zips.push(String(filter.value));
          }
          break;
        case "year":
          if (!filters.years) filters.years = [];
          if (Array.isArray(filter.value)) {
            filters.years.push(...filter.value.map(Number));
          } else {
            filters.years.push(Number(filter.value));
          }
          break;
        case "status":
          if (!filters.statuses) filters.statuses = [];
          if (Array.isArray(filter.value)) {
            filters.statuses.push(...filter.value.map(String));
          } else {
            filters.statuses.push(String(filter.value));
          }
          break;
        case "changeDirection":
          if (!filters.changeDirections) filters.changeDirections = [];
          if (Array.isArray(filter.value)) {
            filters.changeDirections.push(...filter.value.map(String));
          } else {
            filters.changeDirections.push(String(filter.value));
          }
          break;
      }
    }

    return filters;
  }, [stack]);

  // Push a new filter onto the stack
  const pushFilter = useCallback((
    type: FilterType,
    value: string | string[] | number | number[],
    label: string
  ) => {
    const newFilter: Filter = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      label,
      value,
    };
    setStack(prev => [...prev, newFilter]);
  }, []);

  // Pop the most recent filter (go back)
  const popFilter = useCallback(() => {
    setStack(prev => prev.slice(0, -1));
  }, []);

  // Go back to a specific point in history
  const goToFilter = useCallback((filterId: string) => {
    setStack(prev => {
      const index = prev.findIndex(f => f.id === filterId);
      if (index === -1) return prev;
      return prev.slice(0, index + 1);
    });
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setStack([]);
  }, []);

  // Remove a specific filter type from the stack
  const removeFilterType = useCallback((type: FilterType) => {
    setStack(prev => prev.filter(f => f.type !== type));
  }, []);

  // Check if we can go back
  const canGoBack = stack.length > 0;

  // Get filter state for serialization/sharing
  const filterState: FilterState = useMemo(() => ({
    stack,
    activeFilters,
  }), [stack, activeFilters]);

  return {
    stack,
    activeFilters,
    filterState,
    pushFilter,
    popFilter,
    goToFilter,
    clearFilters,
    removeFilterType,
    canGoBack,
  };
}

/**
 * Get a human-readable label for a filter
 */
export function getFilterLabel(filter: Filter): string {
  return filter.label;
}

/**
 * Check if a data point matches the active filters
 */
export function matchesFilters(
  data: {
    ageCohort?: string;
    givingLevel?: string;
    chargeType?: string;
    tenure?: string;
    zip?: string;
    year?: number;
    status?: string;
    changeDirection?: string;
  },
  activeFilters: FilterState["activeFilters"]
): boolean {
  // Age cohort filter
  if (activeFilters.ageCohorts && activeFilters.ageCohorts.length > 0) {
    if (!data.ageCohort || !activeFilters.ageCohorts.includes(data.ageCohort)) {
      return false;
    }
  }

  // Giving level filter
  if (activeFilters.givingLevels && activeFilters.givingLevels.length > 0) {
    if (!data.givingLevel || !activeFilters.givingLevels.includes(data.givingLevel)) {
      return false;
    }
  }

  // Charge type filter
  if (activeFilters.chargeTypes && activeFilters.chargeTypes.length > 0) {
    if (!data.chargeType || !activeFilters.chargeTypes.includes(data.chargeType)) {
      return false;
    }
  }

  // Tenure filter
  if (activeFilters.tenureCohorts && activeFilters.tenureCohorts.length > 0) {
    if (!data.tenure || !activeFilters.tenureCohorts.includes(data.tenure)) {
      return false;
    }
  }

  // ZIP filter
  if (activeFilters.zips && activeFilters.zips.length > 0) {
    if (!data.zip || !activeFilters.zips.includes(data.zip)) {
      return false;
    }
  }

  // Year filter
  if (activeFilters.years && activeFilters.years.length > 0) {
    if (data.year === undefined || !activeFilters.years.includes(data.year)) {
      return false;
    }
  }

  // Status filter
  if (activeFilters.statuses && activeFilters.statuses.length > 0) {
    if (!data.status || !activeFilters.statuses.includes(data.status)) {
      return false;
    }
  }

  // Change direction filter
  if (activeFilters.changeDirections && activeFilters.changeDirections.length > 0) {
    if (!data.changeDirection || !activeFilters.changeDirections.includes(data.changeDirection)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a chart should be visible based on filters
 * Returns false if the chart would only show one category
 */
export function shouldShowChart(
  chartFilterType: FilterType,
  dataPointCount: number,
  activeFilters: FilterState["activeFilters"]
): boolean {
  // If this filter type is already active and has only one value, hide the chart
  switch (chartFilterType) {
    case "ageCohort":
      if (activeFilters.ageCohorts && activeFilters.ageCohorts.length === 1) {
        return false;
      }
      break;
    case "givingLevel":
      if (activeFilters.givingLevels && activeFilters.givingLevels.length === 1) {
        return false;
      }
      break;
    case "chargeType":
      if (activeFilters.chargeTypes && activeFilters.chargeTypes.length === 1) {
        return false;
      }
      break;
    case "tenure":
      if (activeFilters.tenureCohorts && activeFilters.tenureCohorts.length === 1) {
        return false;
      }
      break;
    case "zip":
      if (activeFilters.zips && activeFilters.zips.length === 1) {
        return false;
      }
      break;
    case "status":
      if (activeFilters.statuses && activeFilters.statuses.length === 1) {
        return false;
      }
      break;
  }

  // Also hide if the data only has one point
  return dataPointCount > 1;
}
