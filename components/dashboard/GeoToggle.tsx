"use client";

import { useState, useEffect } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { AddressInput } from "@/components/geo/AddressInput";
import type { Coordinates } from "@/lib/geo/geocoding";

const STORAGE_KEY_ADDRESS = "bimah_bc_synagogue_address";
const STORAGE_KEY_COORDS = "bimah_bc_synagogue_coords";

interface GeoToggleProps {
  onAddressChange: (address: string | null, coords: Coordinates | null) => void;
}

export function GeoToggle({ onAddressChange }: GeoToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [synagogueAddress, setSynagogueAddress] = useState<string>("");
  const [synagogueCoords, setSynagogueCoords] = useState<Coordinates | null>(null);

  // Load saved address on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem(STORAGE_KEY_ADDRESS);
    const savedCoordsStr = localStorage.getItem(STORAGE_KEY_COORDS);

    if (savedAddress && savedCoordsStr) {
      try {
        const savedCoords = JSON.parse(savedCoordsStr) as Coordinates;
        setSynagogueAddress(savedAddress);
        setSynagogueCoords(savedCoords);
        onAddressChange(savedAddress, savedCoords);
      } catch (e) {
        console.error("Failed to parse saved coordinates:", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleAddressSelect = (address: string, coords: Coordinates) => {
    setSynagogueAddress(address);
    setSynagogueCoords(coords);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY_ADDRESS, address);
    localStorage.setItem(STORAGE_KEY_COORDS, JSON.stringify(coords));

    // Notify parent
    onAddressChange(address, coords);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSynagogueAddress("");
    setSynagogueCoords(null);
    localStorage.removeItem(STORAGE_KEY_ADDRESS);
    localStorage.removeItem(STORAGE_KEY_COORDS);
    onAddressChange(null, null);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 text-xs border rounded hover:bg-muted/50 ${synagogueCoords ? "border-purple-400 text-purple-700" : "text-muted-foreground"}`}
      >
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">
          {synagogueCoords ? synagogueAddress.split(",")[0] : "Set Location"}
        </span>
        <ChevronDown className="h-3 w-3 flex-shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 mt-1 w-full min-w-[300px] md:min-w-[400px] bg-white border rounded-md shadow-lg p-4">
            <div className="mb-3">
              <h4 className="text-sm font-medium mb-2">Set Your Location</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Enter your address to enable geographic analysis
              </p>
            </div>

            <AddressInput
              onAddressSelect={handleAddressSelect}
              defaultAddress={synagogueAddress}
              defaultCoords={synagogueCoords || undefined}
            />

            {synagogueCoords && (
              <button
                onClick={handleClear}
                className="mt-3 text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear location
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
