"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  badge?: string;
}

export function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
  badge,
}: CollapsibleSectionProps) {
  return (
    <div className="space-y-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors group"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-600">{icon}</span>}
          <span className="font-semibold text-slate-800">{title}</span>
          {badge && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground group-hover:text-slate-600">
            {isExpanded ? "Collapse" : "Expand"}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          {children}
        </div>
      )}
    </div>
  );
}
