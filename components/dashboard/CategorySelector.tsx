"use client";

import { Select } from "@/components/ui/select";
import { LayoutDashboard, TrendingUp, Users, MapPin, FolderTree } from "lucide-react";
import type { DashboardCategory } from "@/lib/dashboard/saved-views";

interface CategorySelectorProps {
  value: DashboardCategory;
  onChange: (category: DashboardCategory) => void;
  disabled?: boolean;
}

const CATEGORY_INFO: Record<DashboardCategory, { icon: React.ElementType; label: string; description: string }> = {
  hineini: {
    icon: TrendingUp,
    label: "Hineini (Two-Year Pledge Comparison)",
    description: "Compare current vs prior year pledge data",
  },
  all_giving: {
    icon: LayoutDashboard,
    label: "All Giving",
    description: "Comprehensive giving analytics across all categories",
  },
  membership: {
    icon: Users,
    label: "Membership & Demographics",
    description: "Member profiles, demographics, and trends",
  },
  geography: {
    icon: MapPin,
    label: "Geographic Analysis",
    description: "Map-based geographic distribution and insights",
  },
  custom_charge_group: {
    icon: FolderTree,
    label: "Custom Charge Groups",
    description: "User-defined transaction groupings",
  },
  attendance: {
    icon: Users,
    label: "Attendance Tracking",
    description: "Event and service attendance analytics",
  },
};

/**
 * Dashboard category selector
 *
 * Allows users to switch between different analytics categories.
 * Future categories are shown as "Coming Soon" and disabled.
 */
export function CategorySelector({ value, onChange, disabled = false }: CategorySelectorProps) {
  const currentCategory = CATEGORY_INFO[value];
  const Icon = currentCategory.icon;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        <div className="flex-1">
          <label className="text-sm font-bold text-slate-900 block">Dashboard Type</label>
          <p className="text-xs text-slate-600 mt-0.5">{currentCategory.description}</p>
        </div>
      </div>

      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as DashboardCategory)}
        className="w-full px-4 py-2.5 text-base font-medium bg-white border-2 border-indigo-200 rounded-lg shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
        disabled={disabled}
      >
        <option value="hineini">✅ Hineini (Two-Year Pledge Comparison)</option>
        <option value="all_giving" disabled className="text-slate-400">
          ⏳ All Giving (Coming Soon)
        </option>
        <option value="membership" disabled className="text-slate-400">
          ⏳ Membership & Demographics (Coming Soon)
        </option>
        <option value="geography" disabled className="text-slate-400">
          ⏳ Geographic Analysis (Coming Soon)
        </option>
        <option value="custom_charge_group" disabled className="text-slate-400">
          ⏳ Custom Charge Groups (Coming Soon)
        </option>
      </Select>
    </div>
  );
}
