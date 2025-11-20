"use client";

import numeral from "numeral";

export interface TooltipEntry {
  name: string;
  value: number | string;
  color?: string;
  format?: "number" | "currency" | "percent";
}

interface UniversalTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  entries?: TooltipEntry[]; // explicit entries (overrides payload)
  formatValue?: (value: number) => string;
}

/**
 * Consistent tooltip component for all charts
 *
 * Provides uniform styling and formatting across all chart types.
 * Supports automatic formatting based on value type.
 */
export function UniversalTooltip({
  active,
  payload,
  label,
  entries,
  formatValue,
}: UniversalTooltipProps) {
  if (!active) return null;

  const dataEntries: TooltipEntry[] =
    entries ||
    (payload || []).map((entry: any) => ({
      name: entry.name || entry.dataKey,
      value: entry.value,
      color: entry.color || entry.fill,
      format: "number",
    }));

  if (dataEntries.length === 0) return null;

  const defaultFormatValue = (value: number, format?: string) => {
    if (format === "currency") return numeral(value).format("$0,0");
    if (format === "percent") return numeral(value).format("0.0%");
    return numeral(value).format("0,0");
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[120px]">
      {label && <p className="font-semibold text-sm mb-2 text-slate-800">{label}</p>}
      {dataEntries.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-2">
            {entry.color && (
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            )}
            <span className="text-sm text-slate-700">{entry.name}</span>
          </div>
          <span className="text-sm font-semibold text-slate-900">
            {formatValue
              ? formatValue(Number(entry.value))
              : defaultFormatValue(Number(entry.value), entry.format)}
          </span>
        </div>
      ))}
    </div>
  );
}
