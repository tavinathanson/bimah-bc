"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronDown,
  Plus,
  X,
  Check,
  Trash2,
  FolderOpen,
  Pencil,
} from "lucide-react";
import type { ChargeTypeGroup } from "@/lib/schema/types";

interface ChargeTypeGroupSelectorProps {
  groups: ChargeTypeGroup[];
  selectedGroupId: string;
  availableChargeTypes: string[];
  onSelect: (groupId: string) => void;
  onAdd: (name: string, chargeTypes: string[]) => string;
  onUpdate: (id: string, updates: Partial<ChargeTypeGroup>) => void;
  onDelete: (id: string) => void;
}

export function ChargeTypeGroupSelector({
  groups,
  selectedGroupId,
  availableChargeTypes,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
}: ChargeTypeGroupSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const handleCreateGroup = () => {
    if (newGroupName.trim() && selectedTypes.length > 0) {
      const id = onAdd(newGroupName.trim(), selectedTypes);
      onSelect(id);
      setNewGroupName("");
      setSelectedTypes([]);
      setIsCreating(false);
      setIsOpen(false);
    }
  };

  const handleUpdateGroup = (id: string) => {
    if (newGroupName.trim() && selectedTypes.length > 0) {
      onUpdate(id, { name: newGroupName.trim(), chargeTypes: selectedTypes });
      setNewGroupName("");
      setSelectedTypes([]);
      setEditingId(null);
    }
  };

  const startEditing = (group: ChargeTypeGroup) => {
    setEditingId(group.id);
    setNewGroupName(group.name);
    setSelectedTypes(group.chargeTypes);
    setIsCreating(false);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewGroupName("");
    setSelectedTypes([]);
    setIsCreating(false);
  };

  const toggleChargeType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="relative">
      {/* Trigger button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between text-base h-11"
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          <span>{selectedGroup?.name || "All Giving"}</span>
          {selectedGroup && !selectedGroup.isDefault && (
            <span className="text-xs text-muted-foreground">
              ({selectedGroup.chargeTypes.length} types)
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </Button>

      {/* Dropdown panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              cancelEditing();
            }}
          />

          {/* Panel */}
          <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg max-h-[400px] overflow-y-auto">
            <CardContent className="p-2">
              {/* Existing groups */}
              <div className="space-y-1">
                {groups.map((group) => (
                  <div key={group.id}>
                    {editingId === group.id ? (
                      // Editing mode
                      <div className="p-3 bg-blue-50 rounded-lg space-y-3">
                        <Input
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="Group name"
                          className="text-base"
                        />
                        <div className="flex flex-wrap gap-1">
                          {availableChargeTypes.map((type) => (
                            <button
                              key={type}
                              onClick={() => toggleChargeType(type)}
                              className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                                selectedTypes.includes(type)
                                  ? "bg-blue-500 text-white border-blue-500"
                                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={cancelEditing}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateGroup(group.id)}
                            disabled={!newGroupName.trim() || selectedTypes.length === 0}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Display mode
                      <div
                        onClick={() => {
                          onSelect(group.id);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors cursor-pointer ${
                          selectedGroupId === group.id
                            ? "bg-blue-50 text-blue-900"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div>
                          <div className="font-medium text-base">{group.name}</div>
                          {group.chargeTypes.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {group.chargeTypes.slice(0, 3).join(", ")}
                              {group.chargeTypes.length > 3 && ` +${group.chargeTypes.length - 3} more`}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {selectedGroupId === group.id && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                          {!group.isDefault && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(group);
                                }}
                                className="p-1 hover:bg-gray-200 rounded"
                              >
                                <Pencil className="h-3.5 w-3.5 text-gray-500" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(group.id);
                                }}
                                className="p-1 hover:bg-red-100 rounded"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <hr className="my-2" />

              {/* Create new group */}
              {isCreating ? (
                <div className="p-3 bg-green-50 rounded-lg space-y-3">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="New group name (e.g., Membership)"
                    className="text-base"
                    autoFocus
                  />
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Select charge types:
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {availableChargeTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => toggleChargeType(type)}
                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                          selectedTypes.includes(type)
                            ? "bg-green-500 text-white border-green-500"
                            : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelEditing}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim() || selectedTypes.length === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Create Group
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsCreating(true);
                    setEditingId(null);
                    setNewGroupName("");
                    setSelectedTypes([]);
                  }}
                  className="w-full flex items-center gap-2 p-3 rounded-lg text-left text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span className="font-medium">Create custom group</span>
                </button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Compact inline display of selected charge types
 */
interface ChargeTypeChipsProps {
  chargeTypes: string[];
  onRemove?: (type: string) => void;
  maxVisible?: number;
}

export function ChargeTypeChips({
  chargeTypes,
  onRemove,
  maxVisible = 5,
}: ChargeTypeChipsProps) {
  const visible = chargeTypes.slice(0, maxVisible);
  const remaining = chargeTypes.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((type) => (
        <span
          key={type}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
        >
          {type}
          {onRemove && (
            <button
              onClick={() => onRemove(type)}
              className="hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {remaining > 0 && (
        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
          +{remaining} more
        </span>
      )}
    </div>
  );
}
