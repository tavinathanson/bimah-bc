"use client";

import { MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { AddressInput } from "@/components/geo/AddressInput";
import type { Coordinates } from "@/lib/geo/geocoding";

interface GeoToggleProps {
  synagogueAddress: string;
  synagogueCoords: Coordinates | null;
  onAddressSelect: (address: string, coords: Coordinates) => void;
  onClear: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  renderButton: boolean;
}

export function GeoToggle({
  synagogueAddress,
  synagogueCoords,
  onAddressSelect,
  onClear,
  isOpen,
  setIsOpen,
  renderButton
}: GeoToggleProps) {

  if (renderButton) {
    return (
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg hover:bg-slate-50/80 transition-all duration-200 ${
          synagogueCoords
            ? "ring-2 ring-purple-400/50 border-purple-400 bg-purple-50/50 shadow-sm"
            : "border-slate-200 bg-white shadow-sm hover:shadow"
        }`}
      >
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
        <span className={`flex-1 text-left truncate ${synagogueCoords ? "" : "text-muted-foreground"}`}>
          {synagogueCoords ? synagogueAddress.split(",")[0] : "Set Location"}
        </span>
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        )}
      </button>
    );
  }

  // Render drawer
  if (!isOpen) return null;

  return (
    <div className="p-4 bg-slate-50/50 border border-slate-200 rounded-lg max-w-2xl relative">
      {/* Close button */}
      <button
        onClick={() => setIsOpen(false)}
        className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground hover:bg-slate-200/50 rounded transition-colors"
        aria-label="Close"
      >
        <ChevronUp className="h-4 w-4" />
      </button>

      <div className="mb-3 pr-6">
        <h4 className="text-sm font-medium mb-1">Set Your Location</h4>
        <p className="text-xs text-muted-foreground">
          Enter your address to enable geographic analysis
        </p>
      </div>

      <AddressInput
        onAddressSelect={onAddressSelect}
        defaultAddress={synagogueAddress}
        defaultCoords={synagogueCoords || undefined}
      />

      {synagogueCoords && (
        <button
          onClick={onClear}
          className="mt-3 text-xs text-muted-foreground hover:text-foreground underline"
        >
          Clear location
        </button>
      )}
    </div>
  );
}
