import type { SavedView } from "./saved-views";
import { getCurrentFiscalYear } from "./saved-views";

/**
 * OFFICIAL SAVED VIEWS
 *
 * Pre-configured dashboard views maintained by the Bimah team.
 * These cannot be edited or deleted by users.
 */

/**
 * Beth Chaim - Hineini
 *
 * The original two-year pledge comparison dashboard.
 * This is the default view for existing users.
 */
export const BETH_CHAIM_HINEINI: SavedView = {
  id: "beth_chaim_hineini",
  name: "Beth Chaim – Hineini",
  description: "Two-year pledge comparison (current vs prior year)",
  category: "hineini",
  timeframe: "compare_two_years",
  fiscalYears: [getCurrentFiscalYear() - 1, getCurrentFiscalYear()],
  filters: [], // No default filters
  visibleSections: [
    "overview_metrics",
    "pledge_status",
    "age_analysis",
    "pledge_distribution",
    "change_analysis",
    "geography",
  ],
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  isOfficial: true,
};

/**
 * All official views
 */
export const OFFICIAL_VIEWS: SavedView[] = [BETH_CHAIM_HINEINI];

/**
 * Get all available views (official + user-created)
 */
export function getAllViews(): SavedView[] {
  const userViews = getUserSavedViews();
  return [...OFFICIAL_VIEWS, ...userViews];
}

/**
 * Get a view by ID
 */
export function getViewById(id: string): SavedView | null {
  const allViews = getAllViews();
  return allViews.find((v) => v.id === id) || null;
}

/**
 * Get user-created views from localStorage
 */
function getUserSavedViews(): SavedView[] {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem("bimah_saved_views");
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    // Parse dates
    return parsed.map((view) => ({
      ...view,
      createdAt: new Date(view.createdAt),
      updatedAt: new Date(view.updatedAt),
    }));
  } catch {
    return [];
  }
}

/**
 * Save a user view
 */
export function saveView(
  view: Omit<SavedView, "id" | "createdAt" | "updatedAt" | "isOfficial">
): SavedView {
  const newView: SavedView = {
    ...view,
    id: `view_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    isOfficial: false,
  };

  const existing = getUserSavedViews();
  const updated = [...existing, newView];

  localStorage.setItem("bimah_saved_views", JSON.stringify(updated));

  return newView;
}

/**
 * Update an existing user view
 *
 * Cannot update official views.
 */
export function updateView(
  id: string,
  updates: Partial<Omit<SavedView, "id" | "createdAt" | "isOfficial">>
): SavedView | null {
  const existing = getUserSavedViews();
  const index = existing.findIndex((v) => v.id === id);

  if (index === -1) return null; // View not found or is official

  const updated: SavedView = {
    ...existing[index],
    ...updates,
    updatedAt: new Date(),
  };

  existing[index] = updated;
  localStorage.setItem("bimah_saved_views", JSON.stringify(existing));

  return updated;
}

/**
 * Delete a user view
 *
 * Cannot delete official views.
 */
export function deleteView(id: string): boolean {
  // Prevent deletion of official views
  if (OFFICIAL_VIEWS.some((v) => v.id === id)) {
    return false;
  }

  const existing = getUserSavedViews();
  const filtered = existing.filter((v) => v.id !== id);

  if (filtered.length === existing.length) {
    return false; // Nothing was deleted
  }

  localStorage.setItem("bimah_saved_views", JSON.stringify(filtered));
  return true;
}

/**
 * Duplicate a view (creates a new user view based on an existing one)
 */
export function duplicateView(id: string, newName?: string): SavedView | null {
  const original = getViewById(id);
  if (!original) return null;

  const { id: _id, createdAt: _created, updatedAt: _updated, isOfficial: _official, ...viewData } = original;

  return saveView({
    ...viewData,
    name: newName || `${original.name} (Copy)`,
  });
}
