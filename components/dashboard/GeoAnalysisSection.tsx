"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import type { PledgeRow } from "@/lib/schema/types";
import type { Coordinates } from "@/lib/geo/geocoding";
import { hasZipCodeData, aggregateByZipCode, type ZipAggregate } from "@/lib/geo/aggregation";
import { geocodeZipCode, calculateDistanceFromPoint } from "@/lib/geo/geocoding";
import { DistanceHistogram } from "@/components/geo/DistanceHistogram";
import { Input } from "@/components/ui/input";

const ZipMap = dynamic(() => import("@/components/geo/ZipMap").then(mod => ({ default: mod.ZipMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-muted rounded-lg flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

const STORAGE_KEY_ADDRESS = "bimah_bc_synagogue_address";
const STORAGE_KEY_COORDS = "bimah_bc_synagogue_coords";

interface GeoAnalysisSectionProps {
  filteredData: PledgeRow[];
  allData: PledgeRow[];
}

export function GeoAnalysisSection({ filteredData, allData }: GeoAnalysisSectionProps) {
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [aggregates, setAggregates] = useState<ZipAggregate[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const hasZips = hasZipCodeData(allData);

  // Load saved address on mount
  useEffect(() => {
    if (!hasZips) return;

    const savedAddress = localStorage.getItem(STORAGE_KEY_ADDRESS);
    const savedCoordsStr = localStorage.getItem(STORAGE_KEY_COORDS);

    if (savedAddress && savedCoordsStr) {
      try {
        const savedCoords = JSON.parse(savedCoordsStr) as Coordinates;
        setAddress(savedAddress);
        setCoords(savedCoords);
      } catch (e) {
        console.error("Failed to parse saved coordinates:", e);
      }
    }
  }, [hasZips]);

  // Geocode when filteredData OR coords changes
  useEffect(() => {
    if (!hasZips || !coords || filteredData.length === 0) {
      setAggregates([]);
      return;
    }

    let cancelled = false;

    const geocodeAllZips = async () => {
      setIsGeocoding(true);
      const zipAggregates = aggregateByZipCode(filteredData);
      const updatedAggregates: ZipAggregate[] = [];

      for (const agg of zipAggregates) {
        if (cancelled) break;

        try {
          const location = await geocodeZipCode(agg.zip);
          if (location) {
            const distance = calculateDistanceFromPoint(coords, location);
            updatedAggregates.push({
              ...agg,
              coords: { lat: location.lat, lon: location.lon },
              distanceMiles: distance,
            });
          } else {
            updatedAggregates.push(agg);
          }
        } catch (error) {
          console.error('Error geocoding ZIP', agg.zip, ':', error);
          updatedAggregates.push(agg);
        }
      }

      if (!cancelled) {
        setAggregates(updatedAggregates);
        setIsGeocoding(false);
      }
    };

    geocodeAllZips();

    return () => {
      cancelled = true;
    };
  }, [filteredData, coords, hasZips]);

  const handleSetLocation = async () => {
    // Simple geocoding using nominatim
    if (!address.trim()) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(address)}&` +
          `format=json&` +
          `limit=1&` +
          `countrycodes=us`
      );

      if (response.ok) {
        const data = await response.json();
        if (data[0]) {
          const newCoords: Coordinates = {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
          };
          setCoords(newCoords);
          localStorage.setItem(STORAGE_KEY_ADDRESS, address);
          localStorage.setItem(STORAGE_KEY_COORDS, JSON.stringify(newCoords));
        }
      }
    } catch (error) {
      console.error("Geocoding failed:", error);
    }
  };

  if (!hasZips) {
    return null;
  }

  const aggregatesWithCoords = aggregates.filter(a => a.coords);

  return (
    <>
      {/* Address Input Card */}
      {!coords && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-600" />
              Set Your Location for Geographic Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter your address or synagogue name..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetLocation()}
              />
              <Button onClick={handleSetLocation}>Set Location</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ZIP code data detected. Enter your location to see geographic distribution and distance analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Map Card */}
      {coords && aggregatesWithCoords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-600" />
              Geographic Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              {filteredData.length} Households • {address}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isGeocoding ? (
              <div className="h-[500px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ZipMap
                aggregates={aggregates}
                synagogueCoords={coords}
                synagogueAddress={address}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Histogram Card */}
      {coords && aggregatesWithCoords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-600" />
              Distance Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              {filteredData.length} Households
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isGeocoding ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <DistanceHistogram aggregates={aggregates} locationName={address} />
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
