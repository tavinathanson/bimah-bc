"use client";

import { useState, useCallback, useMemo } from "react";
import type { FilterDefinition, FilterChip } from "./filter-types";

/**
 * Universal filter management hook
 *
 * Provides centralized filter state and operations that work across
 * all dashboard categories.
 *
 * Usage:
 * ```tsx
 * const { filters, chips, addFilter, toggleFilter, applyFilters } = useFilters();
 * const filteredData = applyFilters(rawData);
 * ```
 */
export function useFilters() {
  const [filters, setFilters] = useState<FilterDefinition[]>([]);

  /**
   * Add a new filter or replace existing filter for the same field
   */
  const addFilter = useCallback((filter: FilterDefinition) => {
    setFilters((prev) => {
      // Check if filter with same ID already exists
      const existingIndex = prev.findIndex((f) => f.id === filter.id);

      if (existingIndex >= 0) {
        // Replace existing filter
        const updated = [...prev];
        updated[existingIndex] = filter;
        return updated;
      }

      // Add new filter
      return [...prev, filter];
    });
  }, []);

  /**
   * Remove a filter by ID
   */
  const removeFilter = useCallback((filterId: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== filterId));
  }, []);

  /**
   * Remove all filters
   */
  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  /**
   * Remove all filters for a specific field
   */
  const clearField = useCallback((field: string) => {
    setFilters((prev) => prev.filter((f) => f.field !== field));
  }, []);

  /**
   * Toggle a filter on/off (used for chart clicks)
   *
   * If the filter exists, remove it. Otherwise, add it.
   */
  const toggleFilter = useCallback((filter: FilterDefinition) => {
    setFilters((prev) => {
      const exists = prev.some((f) => f.id === filter.id);
      if (exists) {
        // Remove the filter
        return prev.filter((f) => f.id !== filter.id);
      }
      // Add the filter
      return [...prev, filter];
    });
  }, []);

  /**
   * Check if a specific filter is active
   */
  const isFilterActive = useCallback(
    (filterId: string) => {
      return filters.some((f) => f.id === filterId);
    },
    [filters]
  );

  /**
   * Convert filters to chip format for display
   */
  const chips: FilterChip[] = useMemo(
    () =>
      filters.map((f) => ({
        id: f.id,
        label: f.label,
        category: f.category,
        onRemove: () => removeFilter(f.id),
      })),
    [filters, removeFilter]
  );

  /**
   * Apply all active filters to a dataset
   *
   * Filters are combined with AND logic - all filters must match.
   *
   * @param data - Array of data to filter
   * @returns Filtered array
   */
  const applyFilters = useCallback(
    <T extends Record<string, any>>(data: T[]): T[] => {
      if (filters.length === 0) return data;

      return data.filter((row) => {
        // All filters must pass (AND logic)
        return filters.every((filter) => {
          const value = row[filter.field];

          switch (filter.operator) {
            case "equals":
              return value === filter.value;

            case "in":
              if (!Array.isArray(filter.value)) return false;
              return (filter.value as string[]).includes(String(value));

            case "between":
              if (!Array.isArray(filter.value) || filter.value.length !== 2) return false;
              const numValue = Number(value);
              const [min, max] = filter.value as [number, number];
              return numValue >= min && numValue <= max;

            case "gt":
              return Number(value) > Number(filter.value);

            case "lt":
              return Number(value) < Number(filter.value);

            case "gte":
              return Number(value) >= Number(filter.value);

            case "lte":
              return Number(value) <= Number(filter.value);

            default:
              return true;
          }
        });
      });
    },
    [filters]
  );

  /**
   * Get count of active filters
   */
  const filterCount = filters.length;

  /**
   * Get active filters for a specific field
   */
  const getFiltersForField = useCallback(
    (field: string) => {
      return filters.filter((f) => f.field === field);
    },
    [filters]
  );

  return {
    // State
    filters,
    chips,
    filterCount,

    // Actions
    addFilter,
    removeFilter,
    clearFilters,
    clearField,
    toggleFilter,

    // Queries
    isFilterActive,
    getFiltersForField,
    applyFilters,
  };
}
