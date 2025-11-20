"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import numeral from "numeral";

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  description?: string;
  icon?: LucideIcon;
  format?: "number" | "currency" | "percent" | "custom";
  formatString?: string; // numeral.js format (e.g., "$0,0.00", "0.0%")
  trend?: {
    direction: "up" | "down" | "neutral";
    value: number | string;
    label: string;
  };
  badge?: {
    text: string;
    variant: "success" | "warning" | "error" | "info";
  };
  onClick?: () => void;
  className?: string;
}

/**
 * Large metric display card for KPIs
 *
 * Shows a single key metric with optional icon, trend, and badge.
 * Designed for high readability with large text.
 */
export function MetricCard({
  title,
  value,
  subtitle,
  description,
  icon: Icon,
  format = "number",
  formatString,
  trend,
  badge,
  onClick,
  className = "",
}: MetricCardProps) {
  // Format value based on type
  const formattedValue =
    typeof value === "string"
      ? value
      : format === "currency"
      ? numeral(value).format(formatString || "$0,0")
      : format === "percent"
      ? numeral(value).format(formatString || "0.0%")
      : numeral(value).format(formatString || "0,0");

  return (
    <Card
      className={`border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      onClick={onClick}
    >
      <CardHeader className="py-5 md:py-6">
        <CardDescription className="text-xs md:text-sm flex items-center justify-between gap-2 mb-2 font-medium text-slate-600">
          <span className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4" />}
            {title}
          </span>
          {badge && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                badge.variant === "success"
                  ? "bg-green-100 text-green-700"
                  : badge.variant === "warning"
                  ? "bg-yellow-100 text-yellow-700"
                  : badge.variant === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {badge.text}
            </span>
          )}
        </CardDescription>
        <CardTitle className="text-3xl md:text-4xl font-bold text-[#0e69bb] tracking-tight">
          {formattedValue}
        </CardTitle>
        {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
      </CardHeader>
      {(trend || description) && (
        <CardContent className="py-4 pt-0">
          {trend && (
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-semibold ${
                  trend.direction === "up"
                    ? "text-green-600"
                    : trend.direction === "down"
                    ? "text-red-600"
                    : "text-slate-600"
                }`}
              >
                {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}{" "}
                {trend.value}
              </span>
              <span className="text-xs text-slate-500">{trend.label}</span>
            </div>
          )}
          {description && <p className="text-xs text-slate-500 mt-2">{description}</p>}
        </CardContent>
      )}
    </Card>
  );
}
