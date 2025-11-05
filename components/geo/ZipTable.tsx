"use client";

import { useState, useMemo } from "react";
import type { ZipAggregate } from "@/lib/geo/aggregation";
import { sortZipAggregates, type ZipSortField, type ZipSortDirection } from "@/lib/geo/aggregation";
import numeral from "numeral";
import { ArrowUp, ArrowDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

interface ZipTableProps {
  aggregates: ZipAggregate[];
}

export function ZipTable({ aggregates }: ZipTableProps) {
  const [sortField, setSortField] = useState<ZipSortField>("zip");
  const [sortDirection, setSortDirection] = useState<ZipSortDirection>("asc");

  const sortedData = useMemo(() => {
    return sortZipAggregates(aggregates, sortField, sortDirection);
  }, [aggregates, sortField, sortDirection]);

  const handleSort = (field: ZipSortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleExport = () => {
    const exportData = sortedData.map((agg) => ({
      ZIP: agg.zip,
      Households: agg.households,
      "Total Current": agg.totalPledgeCurrent,
      "Total Prior": agg.totalPledgePrior,
      "Avg Pledge": agg.avgPledge,
      "Delta $": agg.deltaDollar,
      "Delta %": agg.deltaPercent === "n/a" ? "n/a" : agg.deltaPercent,
      "Distance (mi)": agg.distanceMiles ?? "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ZIP Codes");

    XLSX.writeFile(workbook, `geography-export-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const SortIcon = ({ field }: { field: ZipSortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp className="inline h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="inline h-3 w-3 ml-1" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={handleExport} size="sm" variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-auto max-h-[600px]">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th
                className="text-left p-3 font-medium cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("zip")}
              >
                ZIP <SortIcon field="zip" />
              </th>
              <th
                className="text-right p-3 font-medium cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("households")}
              >
                Households <SortIcon field="households" />
              </th>
              <th
                className="text-right p-3 font-medium cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("totalPledgeCurrent")}
              >
                Total $ <SortIcon field="totalPledgeCurrent" />
              </th>
              <th
                className="text-right p-3 font-medium cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("avgPledge")}
              >
                Avg $ <SortIcon field="avgPledge" />
              </th>
              <th
                className="text-right p-3 font-medium cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("deltaDollar")}
              >
                Delta $ <SortIcon field="deltaDollar" />
              </th>
              <th
                className="text-right p-3 font-medium cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("deltaPercent")}
              >
                Delta % <SortIcon field="deltaPercent" />
              </th>
              <th
                className="text-right p-3 font-medium cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("distanceMiles")}
              >
                Distance (mi) <SortIcon field="distanceMiles" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((agg, idx) => (
              <tr key={agg.zip} className={idx % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                <td className="p-3 font-mono">{agg.zip}</td>
                <td className="p-3 text-right">{agg.households}</td>
                <td className="p-3 text-right">{numeral(agg.totalPledgeCurrent).format("$0,0")}</td>
                <td className="p-3 text-right">{numeral(agg.avgPledge).format("$0,0")}</td>
                <td className="p-3 text-right">
                  <span className={agg.deltaDollar > 0 ? "text-green-600" : agg.deltaDollar < 0 ? "text-red-600" : ""}>
                    {numeral(agg.deltaDollar).format("+$0,0")}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {agg.deltaPercent === "n/a" ? (
                    <span className="text-muted-foreground">n/a</span>
                  ) : (
                    <span className={agg.deltaPercent > 0 ? "text-green-600" : agg.deltaPercent < 0 ? "text-red-600" : ""}>
                      {numeral(agg.deltaPercent).format("+0.0%")}
                    </span>
                  )}
                </td>
                <td className="p-3 text-right">
                  {agg.distanceMiles !== undefined ? agg.distanceMiles.toFixed(1) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Row Count */}
      <div className="text-xs text-muted-foreground">
        Showing {sortedData.length} ZIP code{sortedData.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
