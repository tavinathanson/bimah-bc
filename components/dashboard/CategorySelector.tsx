"use client";

import { Select } from "@/components/ui/select";
import type { DashboardCategory } from "@/lib/dashboard/saved-views";

interface CategorySelectorProps {
  value: DashboardCategory;
  onChange: (category: DashboardCategory) => void;
  disabled?: boolean;
}

/**
 * Dashboard category selector
 *
 * Allows users to switch between different analytics categories.
 * Future categories are shown as "Coming Soon" and disabled.
 */
export function CategorySelector({ value, onChange, disabled = false }: CategorySelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700">Dashboard Type</label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as DashboardCategory)}
        className="text-lg font-medium"
        disabled={disabled}
      >
        <option value="hineini">Hineini (Two-Year Pledge Comparison)</option>
        <option value="all_giving" disabled>
          All Giving (Coming Soon)
        </option>
        <option value="membership" disabled>
          Membership & Demographics (Coming Soon)
        </option>
        <option value="geography" disabled>
          Geographic Analysis (Coming Soon)
        </option>
        <option value="custom_charge_group" disabled>
          Custom Charge Groups (Coming Soon)
        </option>
      </Select>
      <p className="text-xs text-slate-500">
        Choose which type of analytics to display. Additional categories coming soon!
      </p>
    </div>
  );
}
