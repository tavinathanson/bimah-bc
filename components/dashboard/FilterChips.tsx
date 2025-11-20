"use client";

import { X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FilterChip {
  id: string;
  label: string;
  category: string; // "Age", "Status", "Pledge Amount", etc.
  onRemove: () => void;
}

interface FilterChipsProps {
  filters: FilterChip[];
  onClearAll: () => void;
  className?: string;
}

/**
 * Display active filters as removable chips
 *
 * Shows all active filters with the ability to remove individual filters
 * or clear all at once. Automatically hidden when no filters are active.
 */
export function FilterChips({ filters, onClearAll, className = "" }: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm p-4 ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-700">Active Filters:</span>
          {filters.map((filter) => (
            <div
              key={filter.id}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1886d9] text-white text-sm rounded-full"
            >
              <span className="font-medium">{filter.category}:</span>
              <span>{filter.label}</span>
              <button
                onClick={filter.onRemove}
                className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${filter.label} filter`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-slate-600 hover:text-slate-800"
        >
          Clear All
        </Button>
      </div>
    </div>
  );
}
