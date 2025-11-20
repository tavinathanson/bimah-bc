"use client";

import { useState, useEffect } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, Star } from "lucide-react";
import { getAllViews } from "@/lib/dashboard/official-presets";
import type { SavedView } from "@/lib/dashboard/saved-views";

interface SavedViewSelectorProps {
  currentViewId?: string;
  onLoadView: (view: SavedView) => void;
  onSaveNew?: () => void;
}

/**
 * Saved view selector component
 *
 * Allows users to load official views (like "Beth Chaim - Hineini")
 * or their own custom saved views.
 */
export function SavedViewSelector({
  currentViewId,
  onLoadView,
  onSaveNew,
}: SavedViewSelectorProps) {
  const [selectedViewId, setSelectedViewId] = useState<string>(currentViewId || "");
  const [allViews, setAllViews] = useState<SavedView[]>([]);

  useEffect(() => {
    setAllViews(getAllViews());
  }, []);

  useEffect(() => {
    if (currentViewId) {
      setSelectedViewId(currentViewId);
    }
  }, [currentViewId]);

  const handleViewChange = (viewId: string) => {
    const view = allViews.find((v) => v.id === viewId);
    if (view) {
      setSelectedViewId(viewId);
      onLoadView(view);
    }
  };

  const officialViews = allViews.filter((v) => v.isOfficial);
  const userViews = allViews.filter((v) => !v.isOfficial);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-sm font-semibold text-slate-700 mb-2 block">
            Saved Views
          </label>
          <Select
            value={selectedViewId}
            onChange={(e) => handleViewChange(e.target.value)}
            className="w-full"
          >
            <option value="">Select a view...</option>

            {officialViews.length > 0 && (
              <optgroup label="Official Views">
                {officialViews.map((view) => (
                  <option key={view.id} value={view.id}>
                    ⭐ {view.name}
                  </option>
                ))}
              </optgroup>
            )}

            {userViews.length > 0 && (
              <optgroup label="My Saved Views">
                {userViews.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </div>

        {onSaveNew && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveNew}
            className="flex items-center gap-2 mt-6"
          >
            <Save className="h-4 w-4" />
            Save Current
          </Button>
        )}
      </div>

      {selectedViewId && (
        <div className="mt-3 text-xs text-slate-600">
          {allViews.find((v) => v.id === selectedViewId)?.description}
        </div>
      )}
    </div>
  );
}
