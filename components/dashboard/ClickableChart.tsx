"use client";

import React, { ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FilterType, FilterState } from "@/lib/schema/types";
import { shouldShowChart } from "@/lib/hooks/useFilterStack";
import { MousePointer2 } from "lucide-react";

interface ClickableChartProps {
  title: string;
  subtitle?: string;
  filterType: FilterType;
  dataPointCount: number;
  activeFilters: FilterState["activeFilters"];
  onFilter: (type: FilterType, value: string | number, label: string) => void;
  children: ReactNode;
  className?: string;
  // Whether to show the "click to filter" hint
  showHint?: boolean;
}

/**
 * Wrapper component that makes any chart clickable and handles auto-hiding
 */
export function ClickableChart({
  title,
  subtitle,
  filterType,
  dataPointCount,
  activeFilters,
  onFilter,
  children,
  className = "",
  showHint = true,
}: ClickableChartProps) {
  // Check if this chart should be shown
  const isVisible = shouldShowChart(filterType, dataPointCount, activeFilters);

  if (!isVisible) {
    return null;
  }

  return (
    <Card className={`relative group ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {showHint && (
            <div className="flex items-center gap-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <MousePointer2 className="h-3 w-3" />
              <span>Click to filter</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Pass the onFilter function down via context or clone children */}
        <ClickableChartContext.Provider value={{ onFilter, filterType }}>
          {children}
        </ClickableChartContext.Provider>
      </CardContent>
    </Card>
  );
}

// Context to pass filter function to chart children
interface ClickableChartContextValue {
  onFilter: (type: FilterType, value: string | number, label: string) => void;
  filterType: FilterType;
}

const ClickableChartContext = React.createContext<ClickableChartContextValue | null>(null);

export function useClickableChart() {
  const context = React.useContext(ClickableChartContext);
  if (!context) {
    throw new Error("useClickableChart must be used within a ClickableChart");
  }
  return context;
}

/**
 * Hook to get click handler props for Recharts components
 */
export function useChartClick() {
  const context = React.useContext(ClickableChartContext);

  const handleClick = (data: { name?: string; value?: number; payload?: Record<string, unknown> }, label?: string) => {
    if (!context) return;

    const filterValue = data.name || label || "";
    const filterLabel = String(filterValue);

    if (filterValue) {
      context.onFilter(context.filterType, filterValue, filterLabel);
    }
  };

  return {
    onClick: handleClick,
    cursor: context ? "pointer" : "default",
  };
}

/**
 * Clickable bar for Recharts BarChart
 * Use as: <Bar ... onClick={(data) => handleBarClick(data)} />
 */
export function createBarClickHandler(
  onFilter: (type: FilterType, value: string | number, label: string) => void,
  filterType: FilterType
) {
  return (data: Record<string, unknown>) => {
    const name = data.name || data.label || data.category;
    if (name) {
      onFilter(filterType, String(name), String(name));
    }
  };
}

/**
 * Clickable cell for Recharts PieChart
 */
export function createPieClickHandler(
  onFilter: (type: FilterType, value: string | number, label: string) => void,
  filterType: FilterType
) {
  return (_: unknown, index: number, cells: Array<{ name?: string; label?: string }>) => {
    const cell = cells[index];
    const name = cell?.name || cell?.label;
    if (name) {
      onFilter(filterType, String(name), String(name));
    }
  };
}

/**
 * Simple bar chart with built-in click handling
 */
interface SimpleBarData {
  name: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: SimpleBarData[];
  filterType: FilterType;
  activeFilters: FilterState["activeFilters"];
  onFilter: (type: FilterType, value: string | number, label: string) => void;
  title: string;
  subtitle?: string;
  valueFormatter?: (value: number) => string;
  showValue?: boolean;
  horizontal?: boolean;
}

export function SimpleClickableBarChart({
  data,
  filterType,
  activeFilters,
  onFilter,
  title,
  subtitle,
  valueFormatter = (v) => v.toLocaleString(),
  showValue = true,
  horizontal = true,
}: SimpleBarChartProps) {
  const isVisible = shouldShowChart(filterType, data.length, activeFilters);

  if (!isVisible || data.length === 0) {
    return null;
  }

  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <Card className="group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <MousePointer2 className="h-3 w-3" />
            <span>Click to filter</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item) => (
            <button
              key={item.name}
              onClick={() => onFilter(filterType, item.name, item.name)}
              className="w-full text-left group/bar hover:bg-blue-50 rounded-lg p-3 -m-1 transition-colors border border-transparent hover:border-blue-200"
              aria-label={`Filter by ${item.name}: ${valueFormatter(item.value)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-medium text-gray-800 group-hover/bar:text-blue-900">
                  {item.name}
                </span>
                {showValue && (
                  <span className="text-base font-bold text-gray-900">
                    {valueFormatter(item.value)}
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`,
                    backgroundColor: item.color || "#3b82f6",
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Check if clicking on a category would result in useful drill-down
 * Returns false if already filtered to just that category
 */
export function canDrillDown(
  filterType: FilterType,
  value: string,
  activeFilters: FilterState["activeFilters"]
): boolean {
  switch (filterType) {
    case "ageCohort":
      return !activeFilters.ageCohorts?.includes(value);
    case "givingLevel":
      return !activeFilters.givingLevels?.includes(value);
    case "chargeType":
      return !activeFilters.chargeTypes?.includes(value);
    case "tenure":
      return !activeFilters.tenureCohorts?.includes(value);
    case "zip":
      return !activeFilters.zips?.includes(value);
    case "status":
      return !activeFilters.statuses?.includes(value);
    default:
      return true;
  }
}
