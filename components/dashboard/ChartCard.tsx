"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  children: ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  isHidden?: boolean;
  hiddenMessage?: string;
  actions?: ReactNode; // e.g., export button, info popover
  height?: number | string;
  className?: string;
}

/**
 * Universal chart wrapper component
 *
 * Provides consistent styling, empty states, and hiding logic for all charts.
 * Handles the "hide when only one category" rule automatically.
 */
export function ChartCard({
  title,
  subtitle,
  description,
  children,
  isEmpty = false,
  emptyMessage = "No data available",
  isHidden = false,
  hiddenMessage = "Chart hidden (only one category after filtering)",
  actions,
  height = 400,
  className = "",
}: ChartCardProps) {
  // Hidden state (when filtering leaves only one category)
  if (isHidden) {
    return (
      <Card className={`border-0 shadow-lg bg-slate-50 ${className}`}>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl font-semibold text-slate-700">
            {title}
          </CardTitle>
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Info className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm text-center max-w-md">{hiddenMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Normal state
  return (
    <Card className={`border-0 shadow-lg ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg md:text-xl font-semibold text-slate-800">
              {title}
            </CardTitle>
            {subtitle && <CardDescription className="mt-1">{subtitle}</CardDescription>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {description && (
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">{description}</p>
        )}
      </CardHeader>
      <CardContent className="pb-6">
        {isEmpty ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <div style={{ height: typeof height === "number" ? `${height}px` : height }}>
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
