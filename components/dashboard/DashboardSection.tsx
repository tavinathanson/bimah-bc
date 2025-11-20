"use client";

import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  badge?: {
    text: string;
    variant: "primary" | "secondary" | "success" | "warning";
  };
  className?: string;
}

/**
 * Dashboard section wrapper for logical grouping
 *
 * Provides consistent section headers with optional collapse functionality.
 * Used to organize related charts and metrics together.
 */
export function DashboardSection({
  title,
  subtitle,
  children,
  defaultCollapsed = false,
  collapsible = false,
  badge,
  className = "",
}: DashboardSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`space-y-4 ${className}`}>
      <div
        className={`flex items-center justify-between ${collapsible ? "cursor-pointer" : ""}`}
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
      >
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            {title}
            {badge && (
              <span
                className={`text-xs md:text-sm px-3 py-1 rounded-full font-semibold ${
                  badge.variant === "primary"
                    ? "bg-blue-100 text-blue-700"
                    : badge.variant === "secondary"
                    ? "bg-slate-100 text-slate-700"
                    : badge.variant === "success"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {badge.text}
              </span>
            )}
          </h2>
          {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
        </div>
        {collapsible && (
          <button
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label={isCollapsed ? "Expand section" : "Collapse section"}
          >
            {isCollapsed ? (
              <ChevronDown className="h-5 w-5 text-slate-600" />
            ) : (
              <ChevronUp className="h-5 w-5 text-slate-600" />
            )}
          </button>
        )}
      </div>

      {!isCollapsed && <div className="space-y-4 md:space-y-5">{children}</div>}
    </div>
  );
}
