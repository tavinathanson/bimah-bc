"use client";

import { useState, useCallback, useEffect } from "react";
import type { ChargeTypeGroup } from "@/lib/schema/types";

const STORAGE_KEY = "bimah_charge_type_groups";

/**
 * Hook for managing charge type groups with localStorage persistence
 */
export function useChargeTypeGroups(availableChargeTypes: string[]) {
  const [groups, setGroups] = useState<ChargeTypeGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load groups from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ChargeTypeGroup[];
        setGroups(parsed);
      }
    } catch (e) {
      console.error("Failed to load charge type groups:", e);
    }
    setIsLoaded(true);
  }, []);

  // Save groups to localStorage when they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
      } catch (e) {
        console.error("Failed to save charge type groups:", e);
      }
    }
  }, [groups, isLoaded]);

  // Get all groups including the default "All Giving" group
  const allGroups: ChargeTypeGroup[] = [
    {
      id: "all",
      name: "All Giving",
      chargeTypes: [], // Empty means all
      isDefault: true,
    },
    ...groups,
  ];

  // Get the currently selected group
  const selectedGroup = allGroups.find((g) => g.id === selectedGroupId) || allGroups[0];

  // Get the charge types for the selected group
  const selectedChargeTypes = selectedGroup?.chargeTypes.length === 0
    ? availableChargeTypes // "All Giving" includes everything
    : selectedGroup?.chargeTypes || [];

  // Add a new group
  const addGroup = useCallback((name: string, chargeTypes: string[]) => {
    const newGroup: ChargeTypeGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      chargeTypes,
    };
    setGroups((prev) => [...prev, newGroup]);
    return newGroup.id;
  }, []);

  // Update an existing group
  const updateGroup = useCallback((id: string, updates: Partial<ChargeTypeGroup>) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
    );
  }, []);

  // Delete a group
  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (selectedGroupId === id) {
      setSelectedGroupId("all");
    }
  }, [selectedGroupId]);

  // Select a group
  const selectGroup = useCallback((id: string) => {
    setSelectedGroupId(id);
  }, []);

  return {
    groups: allGroups,
    customGroups: groups,
    selectedGroup,
    selectedGroupId,
    selectedChargeTypes,
    addGroup,
    updateGroup,
    deleteGroup,
    selectGroup,
    isLoaded,
  };
}

/**
 * Suggested charge type groups based on common patterns
 */
export function getSuggestedGroups(chargeTypes: string[]): ChargeTypeGroup[] {
  const suggestions: ChargeTypeGroup[] = [];

  // Check for membership-related types
  const membershipTypes = chargeTypes.filter((t) =>
    /member|dues|hineini/i.test(t)
  );
  if (membershipTypes.length > 0) {
    suggestions.push({
      id: "suggested-membership",
      name: "Membership",
      chargeTypes: membershipTypes,
    });
  }

  // Check for education-related types
  const educationTypes = chargeTypes.filter((t) =>
    /school|education|religious school|hebrew/i.test(t)
  );
  if (educationTypes.length > 0) {
    suggestions.push({
      id: "suggested-education",
      name: "Education",
      chargeTypes: educationTypes,
    });
  }

  // Check for holiday-related types
  const holidayTypes = chargeTypes.filter((t) =>
    /holiday|high holy|rosh|yom kippur|passover|purim/i.test(t)
  );
  if (holidayTypes.length > 0) {
    suggestions.push({
      id: "suggested-holidays",
      name: "Holidays",
      chargeTypes: holidayTypes,
    });
  }

  // Check for event-related types
  const eventTypes = chargeTypes.filter((t) =>
    /event|gala|dinner|auction|fundrais/i.test(t)
  );
  if (eventTypes.length > 0) {
    suggestions.push({
      id: "suggested-events",
      name: "Events",
      chargeTypes: eventTypes,
    });
  }

  return suggestions;
}
