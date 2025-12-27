"use client";

import { useState, useEffect } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, Star, Bookmark } from "lucide-react";
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
  const currentView = allViews.find((v) => v.id === selectedViewId);

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50/30 border border-blue-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Bookmark className="h-5 w-5 text-white" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <label className="text-sm font-bold text-slate-900 mb-2 block flex items-center gap-2">
              Saved Views
              {currentView?.isOfficial && (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              )}
            </label>
            <Select
              value={selectedViewId}
              onChange={(e) => handleViewChange(e.target.value)}
              className="w-full px-4 py-2.5 text-base font-medium bg-white border-2 border-blue-200 rounded-lg shadow-sm hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            >
              <option value="" className="text-slate-400">Select a view...</option>

              {officialViews.length > 0 && (
                <optgroup label="⭐ Official Views">
                  {officialViews.map((view) => (
                    <option key={view.id} value={view.id} className="font-medium">
                      {view.name}
                    </option>
                  ))}
                </optgroup>
              )}

              {userViews.length > 0 && (
                <optgroup label="📁 My Saved Views">
                  {userViews.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>

            {currentView && (
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {currentView.description}
              </p>
            )}
          </div>

          {onSaveNew && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveNew}
              className="flex items-center gap-2 mt-8 bg-white hover:bg-blue-50 border-blue-300 hover:border-blue-400 text-blue-700 font-semibold shadow-sm hover:shadow transition-all"
            >
              <Save className="h-4 w-4" />
              Save Current
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
