"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap } from "react-leaflet";
import type { ZipAggregate } from "@/lib/geo/aggregation";
import type { Coordinates } from "@/lib/geo/geocoding";
import numeral from "numeral";
import { Button } from "@/components/ui/button";
import "leaflet/dist/leaflet.css";

interface ZipMapProps {
  aggregates: ZipAggregate[];
  synagogueCoords: Coordinates;
  synagogueAddress?: string;
}

type ColorMetric = "totalPledge" | "deltaPercent";

/**
 * Calculate color for total pledge (blue scale)
 */
function getColorForTotalPledge(amount: number, max: number): string {
  const ratio = Math.min(amount / max, 1);
  const hue = 210; // Blue
  const saturation = 70 + ratio * 30; // 70-100%
  const lightness = 80 - ratio * 40; // 80-40%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Calculate color for delta percent (green-red diverging scale)
 */
function getColorForDeltaPercent(deltaPercent: number | "n/a"): string {
  if (deltaPercent === "n/a") {
    return "#9ca3af"; // Gray for n/a
  }

  // Clamp between -50% and +50%
  const clamped = Math.max(-0.5, Math.min(0.5, deltaPercent));
  const ratio = (clamped + 0.5) / 1; // 0 to 1

  if (ratio < 0.5) {
    // Red (decrease)
    const intensity = (0.5 - ratio) * 2; // 0 to 1
    const saturation = 70 + intensity * 20;
    const lightness = 70 - intensity * 30;
    return `hsl(0, ${saturation}%, ${lightness}%)`;
  } else {
    // Green (increase)
    const intensity = (ratio - 0.5) * 2; // 0 to 1
    const saturation = 70 + intensity * 20;
    const lightness = 70 - intensity * 30;
    return `hsl(120, ${saturation}%, ${lightness}%)`;
  }
}

/**
 * Map bounds component to fit all markers
 */
function MapBounds({ aggregates }: { aggregates: ZipAggregate[] }) {
  const map = useMap();

  useEffect(() => {
    const withCoords = aggregates.filter((agg) => agg.coords);
    if (withCoords.length === 0) return;

    const L = require("leaflet");
    const bounds = L.latLngBounds(
      withCoords.map((agg) => [agg.coords!.lat, agg.coords!.lon])
    );

    // Include synagogue in bounds (passed as prop from parent)
    // bounds.extend([synagogueCoords.lat, synagogueCoords.lon]);

    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }, [map, aggregates]);

  return null;
}

export function ZipMap({ aggregates, synagogueCoords, synagogueAddress }: ZipMapProps) {
  const [colorMetric, setColorMetric] = useState<ColorMetric>("totalPledge");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Fix Leaflet default marker icon issue in Next.js
    const L = require("leaflet");
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      iconUrl: "/leaflet/marker-icon.png",
      shadowUrl: "/leaflet/marker-shadow.png",
    });
  }, []);

  const withCoords = aggregates.filter((agg) => agg.coords);

  // Calculate max values for scaling
  const maxTotalPledge = Math.max(...withCoords.map((agg) => agg.totalPledgeCurrent), 1);
  const maxHouseholds = Math.max(...withCoords.map((agg) => agg.households), 1);

  if (!mounted) {
    return (
      <div className="w-full h-[600px] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  if (withCoords.length === 0) {
    return (
      <div className="w-full h-[600px] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">No ZIP codes with coordinates available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-2">
        <Button
          variant={colorMetric === "totalPledge" ? "default" : "outline"}
          onClick={() => setColorMetric("totalPledge")}
          size="sm"
        >
          Color by Total Pledge
        </Button>
        <Button
          variant={colorMetric === "deltaPercent" ? "default" : "outline"}
          onClick={() => setColorMetric("deltaPercent")}
          size="sm"
        >
          Color by % Change
        </Button>
      </div>

      {/* Map */}
      <div className="w-full h-[600px] rounded-lg overflow-hidden border">
        <MapContainer
          center={[synagogueCoords.lat, synagogueCoords.lon]}
          zoom={10}
          minZoom={7}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBounds aggregates={withCoords} />

          {/* Synagogue marker */}
          <Marker position={[synagogueCoords.lat, synagogueCoords.lon]}>
            <Popup>
              <div className="text-sm">
                <strong>Your Location</strong>
                {synagogueAddress && (
                  <>
                    <br />
                    {synagogueAddress}
                  </>
                )}
              </div>
            </Popup>
          </Marker>

          {/* ZIP code circles */}
          {withCoords.map((agg) => {
            const radius = 5 + (agg.households / maxHouseholds) * 15; // 5-20px radius
            const color =
              colorMetric === "totalPledge"
                ? getColorForTotalPledge(agg.totalPledgeCurrent, maxTotalPledge)
                : getColorForDeltaPercent(agg.deltaPercent);

            return (
              <CircleMarker
                key={agg.zip}
                center={[agg.coords!.lat, agg.coords!.lon]}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.7,
                  color: "#000",
                  weight: 1,
                }}
              >
                <Popup>
                  <div className="text-sm space-y-1">
                    <div className="font-semibold">ZIP {agg.zip}</div>
                    <div>Households: {agg.households}</div>
                    <div>Total Pledge: {numeral(agg.totalPledgeCurrent).format("$0,0")}</div>
                    <div>Avg Pledge: {numeral(agg.avgPledge).format("$0,0")}</div>
                    <div>
                      Change: {numeral(agg.deltaDollar).format("$0,0")} (
                      {agg.deltaPercent === "n/a"
                        ? "n/a"
                        : numeral(agg.deltaPercent).format("+0.0%")}
                      )
                    </div>
                    {agg.distanceMiles !== undefined && (
                      <div>Distance: {agg.distanceMiles.toFixed(1)} mi</div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="text-xs text-muted-foreground">
        <div>Circle size represents number of households</div>
        <div>
          {colorMetric === "totalPledge"
            ? "Color intensity represents total pledge amount (blue scale)"
            : "Color represents % change (red = decrease, green = increase)"}
        </div>
      </div>
    </div>
  );
}
