"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ZipAggregate, DistanceBin } from "@/lib/geo/aggregation";
import { calculateDistanceHistogram } from "@/lib/geo/aggregation";
import { Button } from "@/components/ui/button";
import numeral from "numeral";

interface DistanceHistogramProps {
  aggregates: ZipAggregate[];
  distanceBins: DistanceBin[];
  locationName?: string;
}

export function DistanceHistogram({ aggregates, distanceBins, locationName }: DistanceHistogramProps) {
  const [metric, setMetric] = useState<"households" | "totalPledge">("households");

  const histogramData = calculateDistanceHistogram(aggregates, distanceBins, metric);

  const data = histogramData.map((bin) => ({
    name: bin.label,
    value: metric === "households" ? bin.households : bin.totalPledge,
  }));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-2">
        <Button
          variant={metric === "households" ? "default" : "outline"}
          onClick={() => setMetric("households")}
          size="sm"
        >
          Show Household Count
        </Button>
        <Button
          variant={metric === "totalPledge" ? "default" : "outline"}
          onClick={() => setMetric("totalPledge")}
          size="sm"
        >
          Show Total Pledge
        </Button>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis
            tickFormatter={(value) =>
              metric === "households" ? value.toString() : numeral(value).format("$0a")
            }
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;

              const value = payload[0].value as number;

              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                  <p className="font-semibold text-sm mb-1">{label}</p>
                  <p className="text-sm" style={{ color: payload[0].color }}>
                    {metric === "households"
                      ? `${value} Households`
                      : numeral(value).format("$0,0")}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary */}
      <div className="text-xs text-muted-foreground">
        Distance bins measured from {locationName || "your location"}
      </div>
    </div>
  );
}
