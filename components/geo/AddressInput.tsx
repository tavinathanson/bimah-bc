"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import type { Coordinates } from "@/lib/geo/geocoding";

interface AddressResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    amenity?: string;
    building?: string;
    name?: string;
  };
}

interface AddressInputProps {
  onAddressSelect: (address: string, coords: Coordinates) => void;
  defaultAddress?: string;
  defaultCoords?: Coordinates;
}

export function AddressInput({ onAddressSelect, defaultAddress, defaultCoords }: AddressInputProps) {
  const [query, setQuery] = useState(defaultAddress || "");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(defaultAddress || "");
  const [selectedCoords, setSelectedCoords] = useState<Coordinates | undefined>(defaultCoords);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset query when parent clears the address
  useEffect(() => {
    if (!defaultAddress) {
      setQuery("");
      setSelectedAddress("");
      setSelectedCoords(undefined);
      setResults([]);
      setShowResults(false);
    }
  }, [defaultAddress]);

  // Debounced search - only when user is actively typing (query differs from selected)
  useEffect(() => {
    // Don't search if query matches the selected address (user just selected it)
    if (query === selectedAddress) {
      setResults([]);
      setShowResults(false);
      return;
    }

    if (query.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      searchAddress(query);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, selectedAddress]);

  const searchAddress = async (searchQuery: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(searchQuery)}&` +
          `format=json&` +
          `addressdetails=1&` +
          `limit=5&` +
          `countrycodes=us`,
        {
          headers: {
            // Nominatim requires a User-Agent
            "User-Agent": "BimahBC/1.0",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setShowResults(data.length > 0);
      }
    } catch (error) {
      console.error("Address search failed:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const formatAddress = (result: AddressResult): string => {
    // Try to build a cleaner address from components
    if (result.address) {
      const parts: string[] = [];

      // Add place name if it exists (synagogue, building, etc.)
      if (result.address.name) {
        parts.push(result.address.name);
      }

      // Add street address
      if (result.address.house_number && result.address.road) {
        parts.push(`${result.address.house_number} ${result.address.road}`);
      } else if (result.address.road) {
        parts.push(result.address.road);
      }

      // Add city
      if (result.address.city) {
        parts.push(result.address.city);
      }

      // Add state
      if (result.address.state) {
        parts.push(result.address.state);
      }

      // Add postcode
      if (result.address.postcode) {
        parts.push(result.address.postcode);
      }

      if (parts.length > 0) {
        return parts.join(", ");
      }
    }

    // Fallback to display_name, but clean it up (take first 4 components)
    return result.display_name.split(",").slice(0, 4).join(",");
  };

  const handleSelectAddress = (result: AddressResult) => {
    const address = formatAddress(result);
    const coords: Coordinates = {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
    };

    setQuery(address);
    setSelectedAddress(address);
    setSelectedCoords(coords);
    setShowResults(false);
    setResults([]); // Clear results to prevent dropdown from reappearing

    // Immediately trigger the callback
    onAddressSelect(address, coords);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <div className="flex-1 relative" ref={wrapperRef}>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by address or synagogue name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (results.length > 0) setShowResults(true);
              }}
              className="pl-10"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              </div>
            )}
          </div>

          {/* Dropdown results */}
          {showResults && results.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
              {results.map((result, index) => {
                const addr = result.address;
                const placeName = addr?.name;

                // Always show the first part of display_name which includes full street address
                const displayParts = result.display_name.split(",").map(p => p.trim());
                const streetAddress = displayParts[0];
                const locationInfo = displayParts.slice(1, 3).join(", "); // City and state

                return (
                  <button
                    key={index}
                    className="w-full text-left px-4 py-2 hover:bg-muted text-sm border-b last:border-b-0 focus:outline-none focus:bg-muted"
                    onClick={() => handleSelectAddress(result)}
                  >
                    {placeName && (
                      <div className="font-semibold text-primary">{placeName}</div>
                    )}
                    <div className="font-medium">{streetAddress}</div>
                    {locationInfo && (
                      <div className="text-xs text-muted-foreground">
                        {locationInfo}
                        {addr?.postcode && ` ${addr.postcode}`}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Type at least 3 characters to search for an address
      </div>
    </div>
  );
}
