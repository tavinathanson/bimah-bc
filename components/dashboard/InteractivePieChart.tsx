"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { UniversalTooltip } from "./UniversalTooltip";
import type { FilterDefinition, ChartClickHandler } from "@/lib/dashboard/filter-types";
import { CHART_COLORS } from "@/lib/dashboard/chart-utils";

interface InteractivePieChartProps {
  data: any[];
  dataKey: string; // which field contains the values (e.g., "count", "amount")
  nameKey: string; // which field contains the labels
  colors?: string[];
  onChartClick?: (filter: FilterDefinition) => void;
  clickHandler?: ChartClickHandler;
  activeFilters?: FilterDefinition[];
  formatValue?: (value: number) => string;
  innerRadius?: number; // for donut charts
}

/**
 * Interactive pie/donut chart with click-to-filter support
 *
 * Clicking a slice adds/removes a filter for that category.
 * Active filters are highlighted with full opacity.
 */
export function InteractivePieChart({
  data,
  dataKey,
  nameKey,
  colors = CHART_COLORS,
  onChartClick,
  clickHandler,
  activeFilters = [],
  formatValue,
  innerRadius = 0,
}: InteractivePieChartProps) {
  const handleSliceClick = (entry: any) => {
    if (!onChartClick || !clickHandler) return;

    const filter: FilterDefinition = {
      id: `${clickHandler.field}_${entry[nameKey]}`,
      field: clickHandler.field,
      operator: "equals",
      value: entry[nameKey],
      label: clickHandler.getLabel(entry[nameKey]),
      category: clickHandler.category,
    };

    onChartClick(filter);
  };

  // Custom label with percentage
  const renderLabel = (entry: any) => {
    const total = data.reduce((sum, item) => sum + item[dataKey], 0);
    const percent = ((entry[dataKey] / total) * 100).toFixed(1);
    return `${percent}%`;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          outerRadius={120}
          innerRadius={innerRadius}
          label={renderLabel}
          labelLine={false}
          onClick={handleSliceClick}
          cursor={onChartClick ? "pointer" : "default"}
        >
          {data.map((entry, index) => {
            const isActive = activeFilters.some(
              (f) => f.field === clickHandler?.field && f.value === entry[nameKey]
            );
            return (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
                opacity={isActive ? 1 : 0.7}
              />
            );
          })}
        </Pie>
        <Tooltip content={<UniversalTooltip formatValue={formatValue} />} />
        <Legend
          verticalAlign="bottom"
          height={36}
          wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
