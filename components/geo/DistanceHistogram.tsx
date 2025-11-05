"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ZipAggregate } from "@/lib/geo/aggregation";
import { calculateDistanceHistogram } from "@/lib/geo/aggregation";
import { Button } from "@/components/ui/button";
import numeral from "numeral";

interface DistanceHistogramProps {
  aggregates: ZipAggregate[];
  locationName?: string;
}

export function DistanceHistogram({ aggregates, locationName }: DistanceHistogramProps) {
  const [metric, setMetric] = useState<"households" | "totalPledge">("households");

  const histogramData = calculateDistanceHistogram(aggregates, metric);

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
            formatter={(value: number) =>
              metric === "households"
                ? `${value} Households`
                : numeral(value).format("$0,0")
            }
            labelStyle={{ color: "#000" }}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
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
