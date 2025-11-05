"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { PledgeRow } from "@/lib/schema/types";
import { AppNav } from "@/components/ui/AppNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasZipCodeData, aggregateByZipCode, type ZipAggregate } from "@/lib/geo/aggregation";
import { geocodeZipCode, calculateDistanceFromPoint, type Coordinates } from "@/lib/geo/geocoding";
import { DistanceHistogram } from "@/components/geo/DistanceHistogram";
import { AddressInput } from "@/components/geo/AddressInput";
import { Loader2, MapPin } from "lucide-react";

// Dynamically import the map component with no SSR
const ZipMap = dynamic(() => import("@/components/geo/ZipMap").then(mod => ({ default: mod.ZipMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-muted rounded-lg flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

const STORAGE_KEY_ADDRESS = "bimah_bc_synagogue_address";
const STORAGE_KEY_COORDS = "bimah_bc_synagogue_coords";

export default function GeographyPage() {
  const router = useRouter();
  const [data, setData] = useState<PledgeRow[]>([]);
  const [aggregates, setAggregates] = useState<ZipAggregate[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0 });

  // Synagogue location state
  const [synagogueAddress, setSynagogueAddress] = useState<string>("");
  const [synagogueCoords, setSynagogueCoords] = useState<Coordinates | null>(null);

  // Load pledge data and synagogue location from storage
  useEffect(() => {
    const stored = sessionStorage.getItem("pledgeData");
    if (!stored) {
      router.push("/import");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as PledgeRow[];
      setData(parsed);

      // Check if we have ZIP code data
      if (!hasZipCodeData(parsed)) {
        return;
      }

      // Aggregate by ZIP code
      const zipAggregates = aggregateByZipCode(parsed);
      console.log('ZIP aggregates:', zipAggregates.length, 'unique ZIPs');

      // Set aggregates immediately (without coords/distances)
      setAggregates(zipAggregates);

      // Load saved synagogue location
      const savedAddress = localStorage.getItem(STORAGE_KEY_ADDRESS);
      const savedCoordsStr = localStorage.getItem(STORAGE_KEY_COORDS);

      if (savedAddress && savedCoordsStr) {
        try {
          const savedCoords = JSON.parse(savedCoordsStr) as Coordinates;
          setSynagogueAddress(savedAddress);
          setSynagogueCoords(savedCoords);

          // Automatically start geocoding with saved location
          if (zipAggregates.length > 0) {
            geocodeAllZips(zipAggregates, savedCoords);
          }
        } catch (e) {
          console.error("Failed to parse saved coordinates:", e);
        }
      }
    } catch (error) {
      console.error("Failed to load pledge data:", error);
      router.push("/import");
    }
  }, [router]);

  const geocodeAllZips = async (zipAggregates: ZipAggregate[], referenceCoords: Coordinates) => {
    setIsGeocoding(true);
    setGeocodingProgress({ current: 0, total: zipAggregates.length });

    const updatedAggregates: ZipAggregate[] = [];

    console.log('Starting geocoding for', zipAggregates.length, 'ZIP codes');

    for (let i = 0; i < zipAggregates.length; i++) {
      const agg = zipAggregates[i]!;
      setGeocodingProgress({ current: i + 1, total: zipAggregates.length });

      try {
        const location = await geocodeZipCode(agg.zip);
        console.log('Geocoded', agg.zip, ':', location ? 'success' : 'failed');

        if (location) {
          const distance = calculateDistanceFromPoint(referenceCoords, location);
          updatedAggregates.push({
            ...agg,
            coords: { lat: location.lat, lon: location.lon },
            distanceMiles: distance,
          });
        } else {
          console.warn('No location found for ZIP:', agg.zip);
          // Include without coordinates
          updatedAggregates.push(agg);
        }
      } catch (error) {
        console.error('Error geocoding ZIP', agg.zip, ':', error);
        // Include without coordinates on error
        updatedAggregates.push(agg);
      }
    }

    console.log('Geocoding complete. ZIPs with coords:', updatedAggregates.filter(a => a.coords).length);
    setAggregates(updatedAggregates);
    setIsGeocoding(false);
  };

  const handleAddressSelect = (address: string, coords: Coordinates) => {
    setSynagogueAddress(address);
    setSynagogueCoords(coords);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY_ADDRESS, address);
    localStorage.setItem(STORAGE_KEY_COORDS, JSON.stringify(coords));

    // Start geocoding if we have aggregates
    if (aggregates.length > 0) {
      geocodeAllZips(aggregates, coords);
    }
  };

  const hasGeoData = aggregates.length > 0 && synagogueCoords !== null;
  const aggregatesWithCoords = aggregates.filter(a => a.coords);

  // If no ZIP code data, show message
  if (data.length > 0 && !hasZipCodeData(data)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f8fbff] to-[#e0eefb] p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
          <AppNav />
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">No ZIP Code Data Available</h2>
                <p className="text-muted-foreground mb-4">
                  The current dataset does not include ZIP code information.
                </p>
                <p className="text-sm text-muted-foreground">
                  To use the Geography features, please re-import your data with a ZIP Code column.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fbff] to-[#e0eefb] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <AppNav />

        {/* Privacy Notice */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 md:h-5 md:w-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className="text-xs md:text-sm text-green-900">
              <strong>All computations are local to your browser.</strong> No data is uploaded. Geocoding uses public ZIP centroid data.
            </div>
          </div>
        </div>

        {/* Address Input Card */}
        <Card>
          <CardHeader>
            <CardTitle>Set Your Location</CardTitle>
          </CardHeader>
          <CardContent>
            <AddressInput
              onAddressSelect={handleAddressSelect}
              defaultAddress={synagogueAddress}
              defaultCoords={synagogueCoords || undefined}
            />
          </CardContent>
        </Card>

        {/* Loading State */}
        {isGeocoding && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">
                  Geocoding ZIP codes... {geocodingProgress.current} / {geocodingProgress.total}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Show placeholder if no location set */}
        {!synagogueCoords && !isGeocoding && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Set Your Location to Continue</h2>
                <p className="text-muted-foreground">
                  Enter your synagogue or organization address above to view geographic analysis.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Map */}
        {hasGeoData && !isGeocoding && aggregatesWithCoords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Geographic Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ZipMap
                aggregates={aggregates}
                synagogueCoords={synagogueCoords}
                synagogueAddress={synagogueAddress}
              />
            </CardContent>
          </Card>
        )}

        {/* Histogram */}
        {hasGeoData && !isGeocoding && aggregatesWithCoords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distance Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <DistanceHistogram
                aggregates={aggregates}
                locationName={synagogueAddress}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
