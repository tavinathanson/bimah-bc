"use client";

import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { UniversalTooltip } from "./UniversalTooltip";
import type { FilterDefinition, ChartClickHandler } from "@/lib/dashboard/filter-types";
import { CHART_COLORS } from "@/lib/dashboard/chart-utils";

interface InteractiveBarChartProps {
  data: any[];
  dataKey: string; // which field to use for bar height (e.g., "count", "amount")
  xKey: string; // which field to use for x-axis labels
  colors?: string[];
  onChartClick?: (filter: FilterDefinition) => void;
  clickHandler?: ChartClickHandler;
  activeFilters?: FilterDefinition[]; // to highlight selected bars
  formatValue?: (value: number) => string;
  xAxisAngle?: number;
}

/**
 * Interactive bar chart with click-to-filter support
 *
 * Clicking a bar adds/removes a filter for that category.
 * Active filters are highlighted with full opacity.
 */
export function InteractiveBarChart({
  data,
  dataKey,
  xKey,
  colors = CHART_COLORS,
  onChartClick,
  clickHandler,
  activeFilters = [],
  formatValue,
  xAxisAngle = -45,
}: InteractiveBarChartProps) {
  const handleBarClick = (entry: any) => {
    if (!onChartClick || !clickHandler) return;

    const filter: FilterDefinition = {
      id: `${clickHandler.field}_${entry[xKey]}`,
      field: clickHandler.field,
      operator: "equals",
      value: entry[xKey],
      label: clickHandler.getLabel(entry[xKey]),
      category: clickHandler.category,
    };

    onChartClick(filter);
  };

  // Determine if each bar is "active" (matching a filter)
  const enrichedData = data.map((item) => {
    const isActive = activeFilters.some(
      (f) => f.field === clickHandler?.field && f.value === item[xKey]
    );
    return { ...item, _isActive: isActive };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={enrichedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey={xKey}
          angle={xAxisAngle}
          textAnchor="end"
          height={80}
          tick={{ fontSize: 12, fill: "#64748b" }}
        />
        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
        <Tooltip content={<UniversalTooltip formatValue={formatValue} />} />
        <Bar
          dataKey={dataKey}
          fill={colors[0]}
          onClick={handleBarClick}
          cursor={onChartClick ? "pointer" : "default"}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
