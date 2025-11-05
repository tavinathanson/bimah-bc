"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PledgeRow } from "@/lib/schema/types";
import {
  calculateTotals,
  calculateCohortMetrics,
  calculateBinMetrics,
  calculateZeroPledgeMetrics,
  calculateStatusMetrics,
  getAgeCohort,
  getPledgeBin,
} from "@/lib/math/calculations";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AlertCircle, Filter, X, ChevronDown, ChevronUp, Info, Check } from "lucide-react";
import { generateExcelWorkbook } from "@/lib/export/excelExporter";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import numeral from "numeral";
import { AppNav } from "@/components/ui/AppNav";

// Theme colors - Blue dominant with gold accents (Jewish theme)
const COLORS = [
  "#1886d9", // star-blue-500 (primary blue)
  "#36a5f1", // star-blue-400 (lighter blue)
  "#e6aa0f", // menorah-gold-500 (gold accent)
  "#0e69bb", // star-blue-600 (deeper blue)
  "#f2c41e", // menorah-gold-400 (lighter gold)
];

// Custom tooltip component for consistent formatting
function CustomChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="font-semibold text-sm mb-1">{label || payload[0].name}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.value} Households
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<PledgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Filters - now support multiple selections
  const [filterCohort, setFilterCohort] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterChange, setFilterChange] = useState<string[]>([]);
  const [filterBin, setFilterBin] = useState<string[]>([]);

  // Dropdown open states
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [ageDropdownOpen, setAgeDropdownOpen] = useState(false);
  const [changeDropdownOpen, setChangeDropdownOpen] = useState(false);
  const [pledgeDropdownOpen, setPledgeDropdownOpen] = useState(false);

  // Pledge mode
  const [pledgeMode, setPledgeMode] = useState<"bins" | "custom">("bins");
  const [ageCustomEnabled, setAgeCustomEnabled] = useState(false);
  const [minPledge, setMinPledge] = useState<string>("");
  const [maxPledge, setMaxPledge] = useState<string>("");
  const [minAge, setMinAge] = useState<string>("");
  const [maxAge, setMaxAge] = useState<string>("");
  const [showDefinitions, setShowDefinitions] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("pledgeData");
    if (!stored) {
      router.push("/import");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as PledgeRow[];
      setData(parsed);

      // Restore filter state
      const savedFilters = sessionStorage.getItem("dashboardFilters");
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        setFilterCohort(filters.filterCohort || []);
        setFilterStatus(filters.filterStatus || []);
        setFilterChange(filters.filterChange || []);
        setFilterBin(filters.filterBin || []);
        setPledgeMode(filters.pledgeMode || "bins");
        setMinPledge(filters.minPledge || "");
        setMaxPledge(filters.maxPledge || "");
        setMinAge(filters.minAge || "");
        setMaxAge(filters.maxAge || "");
        setShowDefinitions(filters.showDefinitions || false);
      }
    } catch {
      router.push("/import");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Save filter state whenever it changes
  useEffect(() => {
    if (data.length > 0) {
      const filters = {
        filterCohort,
        filterStatus,
        filterChange,
        filterBin,
        pledgeMode,
        minPledge,
        maxPledge,
        minAge,
        maxAge,
        showDefinitions,
      };
      sessionStorage.setItem("dashboardFilters", JSON.stringify(filters));
    }
  }, [data.length, filterCohort, filterStatus, filterChange, filterBin, pledgeMode, minPledge, maxPledge, minAge, maxAge, showDefinitions]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Data Found</h2>
              <p className="text-muted-foreground mb-4">
                Please import and validate files first.
              </p>
              <Button onClick={() => router.push("/import")}>
                Go to Import
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Apply filters
  const minPledgeNum = minPledge ? parseFloat(minPledge) : 0;
  const maxPledgeNum = maxPledge ? parseFloat(maxPledge) : Infinity;
  const minAgeNum = minAge ? parseInt(minAge) : 0;
  const maxAgeNum = maxAge ? parseInt(maxAge) : Infinity;

  const filteredData = data.filter((row) => {
    // Age filter - can use cohorts OR custom range (OR both)
    if (filterCohort.length > 0 || (ageCustomEnabled && (minAge || maxAge))) {
      let ageMatches = false;

      // Check if matches any selected cohort
      if (filterCohort.length > 0 && filterCohort.includes(getAgeCohort(row.age))) {
        ageMatches = true;
      }

      // Check if matches custom range
      if (ageCustomEnabled && (minAge || maxAge) && row.age >= minAgeNum && row.age <= maxAgeNum) {
        ageMatches = true;
      }

      if (!ageMatches) return false;
    }

    // Status filter - must match one of selected statuses
    if (filterStatus.length > 0 && !filterStatus.includes(row.status)) {
      return false;
    }

    // Pledge amount filter - can use bins OR custom range (OR both)
    if (filterBin.length > 0 || (pledgeMode === "custom" && (minPledge || maxPledge))) {
      let pledgeMatches = false;

      // Check if matches any selected bin
      if (filterBin.length > 0) {
        const bin = getPledgeBin(row.pledgeCurrent);
        if (bin && filterBin.includes(bin)) {
          pledgeMatches = true;
        }
      }

      // Check if matches custom range (only if values are entered)
      if (pledgeMode === "custom" && (minPledge || maxPledge) && row.pledgeCurrent >= minPledgeNum && row.pledgeCurrent <= maxPledgeNum) {
        pledgeMatches = true;
      }

      if (!pledgeMatches) return false;
    }

    // Change direction filter (only applies to renewed)
    if (filterChange.length > 0) {
      // If not renewed, change filter doesn't apply - exclude these rows
      if (row.status !== "renewed") {
        return false;
      }
      // For renewed, must match one of selected change directions
      let changeMatches = false;
      if (filterChange.includes("increased") && row.changeDollar > 0) changeMatches = true;
      if (filterChange.includes("decreased") && row.changeDollar < 0) changeMatches = true;
      if (filterChange.includes("no-change") && row.changeDollar === 0) changeMatches = true;
      if (!changeMatches) return false;
    }

    return true;
  });

  const hasActiveFilters = filterCohort.length > 0 || filterStatus.length > 0 ||
    filterChange.length > 0 || filterBin.length > 0 || pledgeMode === "custom" ||
    ageCustomEnabled;

  const clearFilters = () => {
    setFilterCohort([]);
    setFilterStatus([]);
    setFilterChange([]);
    setFilterBin([]);
    setMinPledge("");
    setMaxPledge("");
    setMinAge("");
    setMaxAge("");
    setPledgeMode("bins");
    setAgeCustomEnabled(false);
  };

  // Smart chart visibility - show when no filters OR multiple filters (comparison is useful)
  const ageFilterCount = filterCohort.length + (ageCustomEnabled ? 1 : 0);
  const showCohortChart = ageFilterCount === 0 || ageFilterCount >= 2;

  const showStatusChart = filterStatus.length === 0 || filterStatus.length >= 2;

  const pledgeFilterCount = filterBin.length + (pledgeMode === "custom" ? 1 : 0);
  const showBinChart = pledgeFilterCount === 0 || pledgeFilterCount >= 2;

  const showChangeChart = (filterChange.length === 0 || filterChange.length >= 2) &&
    (filterStatus.length === 0 || filterStatus.includes("renewed") || filterStatus.length >= 2);

  const totals = calculateTotals(filteredData);
  const cohortMetrics = calculateCohortMetrics(filteredData);
  const binMetrics = calculateBinMetrics(filteredData);
  const zeroPledgeMetrics = calculateZeroPledgeMetrics(filteredData);
  const statusMetrics = calculateStatusMetrics(filteredData);

  // Calculate custom bin metrics when in custom mode
  const customBinMetrics = pledgeMode === "custom" ? (() => {
    // Check if we should include zeros (min is empty or 0)
    const includeZeros = !minPledge || minPledgeNum === 0;

    const pledges = filteredData
      .map(r => r.pledgeCurrent)
      .filter(p => includeZeros ? p >= 0 : p > 0)
      .sort((a, b) => a - b);

    if (pledges.length === 0) {
      return { householdCount: 0, total: 0, average: 0, median: 0 };
    }

    const total = pledges.reduce((sum, p) => sum + p, 0);
    const median = pledges.length % 2 === 0
      ? (pledges[pledges.length / 2 - 1]! + pledges[pledges.length / 2]!) / 2
      : pledges[Math.floor(pledges.length / 2)]!;

    return {
      householdCount: pledges.length,
      total,
      average: total / pledges.length,
      median,
    };
  })() : null;

  // For custom mode, also get zero metrics separately if min > 0
  const customZeroMetrics = pledgeMode === "custom" && minPledgeNum > 0
    ? calculateZeroPledgeMetrics(filteredData)
    : null;


  const handleExportExcel = async () => {
    const blob = await generateExcelWorkbook(filteredData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = hasActiveFilters ? "-filtered" : "";
    a.download = `pledge-report${suffix}-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Map status values to user-friendly display names
  const statusDisplayNames: Record<string, string> = {
    "renewed": "Renewed",
    "current-only": "New: Current Year Only",
    "prior-only": "Prior Year Only",
    "no-pledge-both": "No Pledge"
  };

  // Filter chart data to only show selected options when filters are active
  const statusChartData = statusMetrics
    .filter((s) => filterStatus.length === 0 || filterStatus.includes(s.status))
    .map((s) => ({
      name: statusDisplayNames[s.status] || s.status,
      value: s.householdCount,
    }));

  const cohortChartData = cohortMetrics
    .filter((c) => filterCohort.length === 0 || filterCohort.includes(c.cohort))
    .map((c) => ({
      name: c.cohort,
      Households: c.householdCount,
    }));

  const binChartData = binMetrics
    .filter((b) => b.householdCount > 0)
    .filter((b) => filterBin.length === 0 || filterBin.includes(b.bin))
    .map((b) => ({
      name: b.bin,
      Households: b.householdCount,
    }));

  const changeData = [
    { name: "Increased", value: cohortMetrics.reduce((sum, c) => sum + c.increased, 0) },
    { name: "Decreased", value: cohortMetrics.reduce((sum, c) => sum + c.decreased, 0) },
    { name: "No Change", value: cohortMetrics.reduce((sum, c) => sum + c.noChange, 0) },
  ].filter((d) => filterChange.length === 0 || filterChange.includes(d.name.toLowerCase().replace(" ", "-")));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return "n/a";
    return (value * 100).toFixed(1) + "%";
  };

  // Format for chart labels - abbreviate when helpful
  const formatChartLabel = (value: number) => {
    if (value >= 1000) {
      return numeral(value).format("$0.[0]a").toUpperCase(); // $1.5K
    }
    return numeral(value).format("$0,0"); // $500
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fbff] to-[#e0eefb] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <AppNav onExport={handleExportExcel} showExport={true} />

        <Card>
          <CardContent className="p-3 md:p-4 space-y-3">
            {/* Main Filter Bar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 mb-3 min-h-[28px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters:</span>
                  <button
                    onClick={() => setShowDefinitions(!showDefinitions)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Show definitions"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
                {hasActiveFilters && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Showing <strong className="text-foreground">{filteredData.length}</strong> of {data.length} Households
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="gap-1 h-7 py-0"
                    >
                      <X className="h-3 w-3" />
                      Clear All Filters
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Status Filter */}
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1.5 h-7">
                    <label className={`text-xs font-medium ${filterStatus.length > 0 ? "text-blue-700 font-semibold" : "text-muted-foreground"}`}>
                      Status
                    </label>
                    {filterStatus.length > 0 && <span className="text-blue-600 text-sm">●</span>}
                  </div>
                  <button
                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md hover:bg-muted/50 ${filterStatus.length > 0 ? "ring-2 ring-blue-400 border-blue-400" : ""}`}
                  >
                    <span className={filterStatus.length === 0 ? "text-muted-foreground" : ""}>
                      {filterStatus.length === 0 ? "All Status" : `${filterStatus.length} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {statusDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownOpen(false)} />
                      <div className="absolute z-20 w-full mt-1 bg-white border rounded-md shadow-lg">
                        {filterStatus.length > 0 && (
                          <button
                            onClick={() => setFilterStatus([])}
                            className="w-full px-3 py-2 text-sm text-left text-blue-600 hover:bg-blue-50 border-b font-medium"
                          >
                            Clear (show all)
                          </button>
                        )}
                        {[
                          { value: "renewed", label: "Renewed" },
                          { value: "current-only", label: "New: Current Year Only" },
                          { value: "prior-only", label: "Prior Year Only" },
                          { value: "no-pledge-both", label: "No Pledge" }
                        ].map(option => (
                          <label key={option.value} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterStatus.includes(option.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterStatus([...filterStatus, option.value]);
                                } else {
                                  setFilterStatus(filterStatus.filter(s => s !== option.value));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{option.label}</span>
                            {filterStatus.includes(option.value) && <Check className="h-4 w-4 ml-auto text-blue-600" />}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Pledge Amount Filter */}
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1.5 h-7">
                    <label className={`text-xs font-medium ${(filterBin.length > 0 || pledgeMode === "custom") ? "text-blue-700 font-semibold" : "text-muted-foreground"}`}>
                      Pledge Amount
                    </label>
                    {(filterBin.length > 0 || pledgeMode === "custom") && <span className="text-blue-600 text-sm">●</span>}
                  </div>
                  <button
                    onClick={() => setPledgeDropdownOpen(!pledgeDropdownOpen)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md hover:bg-muted/50 ${(filterBin.length > 0 || pledgeMode === "custom") ? "ring-2 ring-blue-400 border-blue-400" : ""}`}
                  >
                    <span className={(filterBin.length === 0 && pledgeMode !== "custom") ? "text-muted-foreground" : ""}>
                      {filterBin.length === 0 && pledgeMode !== "custom"
                        ? "All Pledges"
                        : filterBin.length > 0 && pledgeMode === "custom"
                        ? `${filterBin.length} + custom`
                        : pledgeMode === "custom"
                        ? `Custom: $${minPledge || "0"}-$${maxPledge || "∞"}`
                        : `${filterBin.length} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {pledgeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setPledgeDropdownOpen(false)} />
                      <div className="absolute z-20 w-full mt-1 bg-white border rounded-md shadow-lg max-h-80 overflow-y-auto">
                        {(filterBin.length > 0 || pledgeMode === "custom") && (
                          <button
                            onClick={() => {
                              setFilterBin([]);
                              setMinPledge("");
                              setMaxPledge("");
                              setPledgeMode("bins");
                            }}
                            className="w-full px-3 py-2 text-sm text-left text-blue-600 hover:bg-blue-50 border-b font-medium"
                          >
                            Clear (show all)
                          </button>
                        )}
                        {[
                          { value: "$1-$1,799", label: "$1-$1,799" },
                          { value: "$1,800-$2,499", label: "$1,800-$2,499" },
                          { value: "$2,500-$3,599", label: "$2,500-$3,599" },
                          { value: "$3,600-$5,399", label: "$3,600-$5,399" },
                          { value: "$5,400+", label: "$5,400+" }
                        ].map(option => (
                          <label key={option.value} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterBin.includes(option.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterBin([...filterBin, option.value]);
                                } else {
                                  setFilterBin(filterBin.filter(b => b !== option.value));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{option.label}</span>
                            {filterBin.includes(option.value) && <Check className="h-4 w-4 ml-auto text-blue-600" />}
                          </label>
                        ))}
                        <div className="border-t bg-muted/20">
                          <label className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={pledgeMode === "custom"}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPledgeMode("custom");
                                } else {
                                  setPledgeMode("bins");
                                  setMinPledge("");
                                  setMaxPledge("");
                                }
                              }}
                              className="rounded mt-0.5"
                            />
                            <div className="flex-1 flex items-start justify-between">
                              <div className="flex-1">
                                <span className="text-sm block mb-2">Custom Range</span>
                                <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                                  <Input
                                    type="number"
                                    placeholder="Min"
                                    value={minPledge}
                                    onChange={(e) => setMinPledge(e.target.value)}
                                    className={`w-20 h-8 text-sm ${pledgeMode === "custom" ? "bg-white" : ""}`}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={pledgeMode !== "custom"}
                                  />
                                  <span className="text-xs text-muted-foreground">to</span>
                                  <Input
                                    type="number"
                                    placeholder="Max"
                                    value={maxPledge}
                                    onChange={(e) => setMaxPledge(e.target.value)}
                                    className={`w-20 h-8 text-sm ${pledgeMode === "custom" ? "bg-white" : ""}`}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={pledgeMode !== "custom"}
                                  />
                                </div>
                              </div>
                              {pledgeMode === "custom" && <Check className="h-4 w-4 ml-2 text-blue-600 flex-shrink-0" />}
                            </div>
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Age Filter */}
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1.5 h-7">
                    <label className={`text-xs font-medium ${(filterCohort.length > 0 || ageCustomEnabled) ? "text-blue-700 font-semibold" : "text-muted-foreground"}`}>
                      Age
                    </label>
                    {(filterCohort.length > 0 || ageCustomEnabled) && <span className="text-blue-600 text-sm">●</span>}
                  </div>
                  <button
                    onClick={() => setAgeDropdownOpen(!ageDropdownOpen)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md hover:bg-muted/50 ${(filterCohort.length > 0 || ageCustomEnabled) ? "ring-2 ring-blue-400 border-blue-400" : ""}`}
                  >
                    <span className={(filterCohort.length === 0 && !ageCustomEnabled) ? "text-muted-foreground" : ""}>
                      {filterCohort.length === 0 && !ageCustomEnabled
                        ? "All Ages"
                        : filterCohort.length > 0 && ageCustomEnabled
                        ? `${filterCohort.length} + custom`
                        : ageCustomEnabled
                        ? `Custom: ${minAge || "0"}-${maxAge || "∞"}`
                        : `${filterCohort.length} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {ageDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setAgeDropdownOpen(false)} />
                      <div className="absolute z-20 w-full mt-1 bg-white border rounded-md shadow-lg max-h-80 overflow-y-auto">
                        {(filterCohort.length > 0 || ageCustomEnabled) && (
                          <button
                            onClick={() => {
                              setFilterCohort([]);
                              setMinAge("");
                              setMaxAge("");
                              setAgeCustomEnabled(false);
                            }}
                            className="w-full px-3 py-2 text-sm text-left text-blue-600 hover:bg-blue-50 border-b font-medium"
                          >
                            Clear (show all)
                          </button>
                        )}
                        {[
                          { value: "Under 40", label: "Under 40" },
                          { value: "40-49", label: "40-49" },
                          { value: "50-64", label: "50-64" },
                          { value: "65+", label: "65+" }
                        ].map(option => (
                          <label key={option.value} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterCohort.includes(option.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterCohort([...filterCohort, option.value]);
                                } else {
                                  setFilterCohort(filterCohort.filter(c => c !== option.value));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{option.label}</span>
                            {filterCohort.includes(option.value) && <Check className="h-4 w-4 ml-auto text-blue-600" />}
                          </label>
                        ))}
                        <div className="border-t bg-muted/20">
                          <label className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ageCustomEnabled}
                              onChange={(e) => {
                                setAgeCustomEnabled(e.target.checked);
                                if (!e.target.checked) {
                                  setMinAge("");
                                  setMaxAge("");
                                }
                              }}
                              className="rounded mt-0.5"
                            />
                            <div className="flex-1 flex items-start justify-between">
                              <div className="flex-1">
                                <span className="text-sm block mb-2">Custom Range</span>
                                <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                                  <Input
                                    type="number"
                                    placeholder="Min"
                                    value={minAge}
                                    onChange={(e) => setMinAge(e.target.value)}
                                    className={`w-20 h-8 text-sm ${ageCustomEnabled ? "bg-white" : ""}`}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={!ageCustomEnabled}
                                  />
                                  <span className="text-xs text-muted-foreground">to</span>
                                  <Input
                                    type="number"
                                    placeholder="Max"
                                    value={maxAge}
                                    onChange={(e) => setMaxAge(e.target.value)}
                                    className={`w-20 h-8 text-sm ${ageCustomEnabled ? "bg-white" : ""}`}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={!ageCustomEnabled}
                                  />
                                </div>
                              </div>
                              {ageCustomEnabled && <Check className="h-4 w-4 ml-2 text-blue-600 flex-shrink-0" />}
                            </div>
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Pledge Change Filter */}
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1.5 h-7">
                    <label className={`text-xs font-medium ${filterChange.length > 0 ? "text-blue-700 font-semibold" : "text-muted-foreground"}`}>
                      Pledge Change
                    </label>
                    {filterChange.length > 0 && <span className="text-blue-600 text-sm">●</span>}
                  </div>
                  <button
                    onClick={() => setChangeDropdownOpen(!changeDropdownOpen)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md hover:bg-muted/50 ${filterChange.length > 0 ? "ring-2 ring-blue-400 border-blue-400" : ""}`}
                  >
                    <span className={filterChange.length === 0 ? "text-muted-foreground" : ""}>
                      {filterChange.length === 0 ? "All Changes" : `${filterChange.length} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {changeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setChangeDropdownOpen(false)} />
                      <div className="absolute z-20 w-full mt-1 bg-white border rounded-md shadow-lg">
                        {filterChange.length > 0 && (
                          <button
                            onClick={() => setFilterChange([])}
                            className="w-full px-3 py-2 text-sm text-left text-blue-600 hover:bg-blue-50 border-b font-medium"
                          >
                            Clear (show all)
                          </button>
                        )}
                        {[
                          { value: "increased", label: "Increased" },
                          { value: "decreased", label: "Decreased" },
                          { value: "no-change", label: "No Change" }
                        ].map(option => (
                          <label key={option.value} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterChange.includes(option.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterChange([...filterChange, option.value]);
                                } else {
                                  setFilterChange(filterChange.filter(c => c !== option.value));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{option.label}</span>
                            {filterChange.includes(option.value) && <Check className="h-4 w-4 ml-auto text-blue-600" />}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>


            {/* Definitions */}
            {showDefinitions && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">Status Definitions</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div><strong className="text-foreground">Renewed:</strong> Pledged &gt; $0 in both current and prior year</div>
                    <div><strong className="text-foreground">New: Current Year Only:</strong> Pledged &gt; $0 in current year, $0 in prior year</div>
                    <div><strong className="text-foreground">Prior Year Only:</strong> Pledged $0 in current year, &gt; $0 in prior year</div>
                    <div><strong className="text-foreground">No Pledge:</strong> Pledged $0 in both years</div>
                  </div>
                </div>

                <div className="pt-2 border-t text-xs text-muted-foreground">
                  <strong>Fiscal Year:</strong> FY26 (July 1, 2025 - June 30, 2026)
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-white/60 backdrop-blur-sm border border-[#bae0ff] rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-[#1886d9] flex-shrink-0" />
            <div className="text-xs md:text-sm text-[#0e2546]">
              <strong>Note:</strong> Time-based pledge progress requires gift dates; this version computes a snapshot from the imported files.
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200 rounded-lg p-2 md:p-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <div className="text-xs md:text-sm text-blue-900">
                <strong>Filtered View:</strong> Showing {totals.totalHouseholds} of {data.length} households. All metrics and charts below reflect the active filters.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className={hasActiveFilters ? "border-l-4 border-l-blue-400" : ""}>
            <CardHeader className="py-4 md:py-6">
              <CardDescription className="text-xs md:text-sm mb-2">Total Households</CardDescription>
              <CardTitle className="text-2xl md:text-3xl">
                {totals.totalHouseholds}
                {hasActiveFilters && (
                  <span className="text-base md:text-lg text-muted-foreground font-normal ml-2">
                    of {data.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="py-4 md:py-6">
              <CardDescription className="text-xs md:text-sm mb-2">Current Pledges</CardDescription>
              <CardTitle className="text-2xl md:text-3xl">{formatCurrency(totals.totalPledgedCurrent)}</CardTitle>
              <CardDescription className="text-xs md:text-sm mt-2">
                Average: {formatCurrency(totals.totalPledgedCurrent / totals.totalHouseholds)}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="py-4 md:py-6">
              <CardDescription className="text-xs md:text-sm mb-2">Change from Prior Year</CardDescription>
              <CardTitle className={`text-2xl md:text-3xl flex items-center gap-2 ${totals.deltaDollar >= 0 ? "text-green-600" : "text-red-600"}`}>
                <span>{totals.deltaDollar >= 0 ? "↑" : "↓"}</span>
                <span>{formatCurrency(Math.abs(totals.deltaDollar))}</span>
              </CardTitle>
              <CardDescription className="text-xs md:text-sm mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={totals.deltaDollar >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatPercent(totals.deltaPercent)} {totals.deltaDollar >= 0 ? "increase" : "decrease"}
                </span>
                <span className="text-muted-foreground">
                  Prior: {formatCurrency(totals.totalPledgedPrior)}
                </span>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="py-4 md:py-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4 min-w-0">
                  <CardDescription className="text-xs md:text-sm flex-shrink-0">Pledge Status</CardDescription>
                  <CardDescription className="text-xs text-right truncate min-w-0">
                    {totals.totalHouseholds} of {data.length} Households
                  </CardDescription>
                </div>
                <div className="flex items-baseline gap-3 md:gap-6 flex-wrap">
                  <div className="flex-shrink-0">
                    <CardTitle className="text-2xl md:text-3xl">{totals.renewed}</CardTitle>
                    <CardDescription className="text-xs mt-1">Renewed</CardDescription>
                  </div>
                  <div className="hidden sm:block border-l border-border flex-shrink-0" />
                  <div className="flex gap-3 md:gap-4 flex-wrap">
                    <div className="flex-shrink-0">
                      <div className="font-semibold text-lg">{totals.currentOnly}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">New</div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="font-semibold text-lg">{totals.priorOnly}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Lapsed</div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="font-semibold text-lg">{totals.noPledgeBoth}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">None</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {showStatusChart && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Pledge Status Distribution</CardTitle>
                <CardDescription className="text-xs">
                  {filteredData.length} of {data.length} Households
                </CardDescription>
              </CardHeader>
              <CardContent>
                {statusChartData.length === 0 || statusChartData.every(d => d.value === 0) ? (
                  <div className="h-[220px] md:h-[250px] flex items-center justify-center text-center p-4">
                    <div className="text-muted-foreground">
                      <p className="font-medium">No households match the current filters</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220} className="md:!h-[250px]">
                      <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                        <Pie
                          data={statusChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                          onClick={(data) => {
                            // Map display name back to status value
                            const statusMap: Record<string, string> = {
                              "Renewed": "renewed",
                              "New: Current Year Only": "current-only",
                              "Prior Year Only": "prior-only",
                              "No Pledge": "no-pledge-both"
                            };
                            const status = statusMap[data.name];
                            if (status) {
                              // Set filter to just this status (drill down)
                              setFilterStatus([status]);
                            }
                          }}
                          cursor="pointer"
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Custom Legend */}
                    <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-4">
                      {statusChartData.map((entry, index) => (
                        <button
                          key={entry.name}
                          onClick={() => {
                            const statusMap: Record<string, string> = {
                              "Renewed": "renewed",
                              "New: Current Year Only": "current-only",
                              "Prior Year Only": "prior-only",
                              "No Pledge": "no-pledge-both"
                            };
                            const status = statusMap[entry.name];
                            if (status) {
                              // Set filter to just this status (drill down)
                              setFilterStatus([status]);
                            }
                          }}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm">{entry.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {showChangeChart && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Renewed Pledge Changes</CardTitle>
                <CardDescription className="text-xs">
                  {filteredData.filter(r => r.status === "renewed").length} Renewed of {filteredData.length} Households
                </CardDescription>
              </CardHeader>
              <CardContent>
                {changeData.every(d => d.value === 0) ? (
                  <div className="h-[250px] md:h-[300px] flex items-center justify-center text-center p-4">
                    <div className="text-muted-foreground">
                      <p className="font-medium mb-2">No renewed households to display</p>
                      <p className="text-sm">
                        {filteredData.length === 0
                          ? "No households match the current filters"
                          : "Only renewed households (pledged in both years) show change direction"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250} className="md:!h-[300px]">
                    <BarChart data={changeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Bar
                        dataKey="value"
                        fill="#0e69bb"
                        name="Households"
                        onClick={(data) => {
                          const changeMap: Record<string, string> = {
                            "Increased": "increased",
                            "Decreased": "decreased",
                            "No Change": "no-change"
                          };
                          const change = changeMap[data.name];
                          if (change) {
                            // Set filter to just this change direction (drill down)
                            setFilterChange([change]);
                          }
                        }}
                        cursor="pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}

          {showCohortChart && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Households by Age Cohort</CardTitle>
                <CardDescription className="text-xs">
                  {filteredData.length} of {data.length} Households
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cohortChartData.length === 0 || cohortChartData.every(d => d.Households === 0) ? (
                  <div className="h-[250px] md:h-[300px] flex items-center justify-center text-center p-4">
                    <div className="text-muted-foreground">
                      <p className="font-medium">No households match the current filters</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250} className="md:!h-[300px]">
                    <BarChart data={cohortChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Bar
                        dataKey="Households"
                        fill="#1886d9"
                        onClick={(data) => {
                          // Set filter to just this cohort (drill down)
                          setFilterCohort([data.name]);
                          // Clear custom age range when selecting a cohort
                          setAgeCustomEnabled(false);
                          setMinAge("");
                          setMaxAge("");
                        }}
                        cursor="pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}

          {showBinChart && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Households by Pledge Bin</CardTitle>
                <CardDescription className="text-xs">
                  {filteredData.filter(r => r.pledgeCurrent > 0).length} with Pledges &gt; $0 of {filteredData.length} Households
                </CardDescription>
              </CardHeader>
              <CardContent>
                {binChartData.length === 0 ? (
                  <div className="h-[250px] md:h-[300px] flex items-center justify-center text-center p-4">
                    <div className="text-muted-foreground">
                      <p className="font-medium mb-2">No pledges &gt; $0 to display</p>
                      <p className="text-sm">
                        {filteredData.length === 0
                          ? "No households match the current filters"
                          : `All ${filteredData.length} households have $0 pledges`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250} className="md:!h-[300px]">
                    <BarChart data={binChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tickFormatter={(value) => {
                          // Abbreviate bin labels for chart
                          if (value.includes("$1-")) return "$1-$1.8K";
                          if (value.includes("$1,800")) return "$1.8K-$2.5K";
                          if (value.includes("$2,500")) return "$2.5K-$3.6K";
                          if (value.includes("$3,600")) return "$3.6K-$5.4K";
                          if (value.includes("$5,400")) return "$5.4K+";
                          return value;
                        }}
                      />
                      <YAxis />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Bar
                        dataKey="Households"
                        fill="#e6aa0f"
                        onClick={(data) => {
                          // Set filter to just this bin (drill down)
                          setFilterBin([data.name]);
                          // Clear custom pledge range when selecting a bin
                          setPledgeMode("bins");
                          setMinPledge("");
                          setMaxPledge("");
                        }}
                        cursor="pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Age Cohort Metrics</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 md:pb-6">
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <table className="w-full text-xs md:text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 md:p-2 pl-2">Cohort</th>
                    <th className="text-right p-2 md:p-2">Households</th>
                    <th className="text-right p-2 md:p-2">Total Current</th>
                    <th className="text-right p-2 md:p-2">Average Current</th>
                    <th className="text-right p-2 md:p-2">Median Current</th>
                    <th className="text-right p-2 md:p-2 pr-2">Renewal Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortMetrics.filter(c => c.householdCount > 0).map((cohort) => (
                    <tr key={cohort.cohort} className="border-b">
                      <td className="p-2 md:p-2 pl-2 font-medium">{cohort.cohort}</td>
                      <td className="text-right p-2 md:p-2">{cohort.householdCount}</td>
                      <td className="text-right p-2 md:p-2">{formatCurrency(cohort.totalCurrent)}</td>
                      <td className="text-right p-2 md:p-2">{formatCurrency(cohort.averageCurrent)}</td>
                      <td className="text-right p-2 md:p-2">{formatCurrency(cohort.medianCurrent)}</td>
                      <td className="text-right p-2 md:p-2 pr-2">{formatPercent(cohort.renewalRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">
              {pledgeMode === "custom" ? "Custom Range Metrics" : "Pledge Bin Metrics"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 md:pb-6">
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <table className="w-full text-xs md:text-sm min-w-[550px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 md:p-2 pl-2">
                      {pledgeMode === "custom" ? "Range" : "Bin"}
                    </th>
                    <th className="text-right p-2 md:p-2">Households</th>
                    <th className="text-right p-2 md:p-2">Total</th>
                    <th className="text-right p-2 md:p-2">Average</th>
                    <th className="text-right p-2 md:p-2 pr-2">Median</th>
                  </tr>
                </thead>
                <tbody>
                  {pledgeMode === "custom" && customBinMetrics ? (
                    <>
                      {/* Show $0 separately if min > 0 */}
                      {customZeroMetrics && customZeroMetrics.householdCount > 0 && (
                        <tr className="border-b bg-muted/30">
                          <td className="p-2 md:p-2 pl-2 font-medium text-muted-foreground">
                            $0 (No Current Pledge)
                          </td>
                          <td className="text-right p-2 md:p-2">{customZeroMetrics.householdCount}</td>
                          <td className="text-right p-2 md:p-2">{formatCurrency(customZeroMetrics.total)}</td>
                          <td className="text-right p-2 md:p-2 text-muted-foreground">—</td>
                          <td className="text-right p-2 md:p-2 pr-2 text-muted-foreground">—</td>
                        </tr>
                      )}
                      {/* Custom range row */}
                      <tr className="border-b">
                        <td className="p-2 md:p-2 pl-2 font-medium">
                          {minPledge && maxPledge
                            ? `${formatCurrency(minPledgeNum)} - ${formatCurrency(maxPledgeNum)}`
                            : minPledge && minPledgeNum > 0
                            ? `${formatCurrency(minPledgeNum)}+`
                            : maxPledge
                            ? `Up to ${formatCurrency(maxPledgeNum)}`
                            : !minPledge || minPledgeNum === 0
                            ? "All Pledges (including $0)"
                            : "All Pledges"}
                        </td>
                        <td className="text-right p-2 md:p-2">{customBinMetrics.householdCount}</td>
                        <td className="text-right p-2 md:p-2">{formatCurrency(customBinMetrics.total)}</td>
                        <td className="text-right p-2 md:p-2">{formatCurrency(customBinMetrics.average)}</td>
                        <td className="text-right p-2 md:p-2 pr-2">{formatCurrency(customBinMetrics.median)}</td>
                      </tr>
                    </>
                  ) : (
                    <>
                      {/* Show $0 row first */}
                      {zeroPledgeMetrics.householdCount > 0 && (
                        <tr className="border-b bg-muted/30">
                          <td className="p-2 md:p-2 pl-2 font-medium text-muted-foreground">
                            $0 (No Current Pledge)
                          </td>
                          <td className="text-right p-2 md:p-2">{zeroPledgeMetrics.householdCount}</td>
                          <td className="text-right p-2 md:p-2">{formatCurrency(zeroPledgeMetrics.total)}</td>
                          <td className="text-right p-2 md:p-2 text-muted-foreground">—</td>
                          <td className="text-right p-2 md:p-2 pr-2 text-muted-foreground">—</td>
                        </tr>
                      )}
                      {/* Standard bins */}
                      {binMetrics.filter(b => b.householdCount > 0).map((bin) => (
                        <tr key={bin.bin} className="border-b">
                          <td className="p-2 md:p-2 pl-2 font-medium">{bin.bin}</td>
                          <td className="text-right p-2 md:p-2">{bin.householdCount}</td>
                          <td className="text-right p-2 md:p-2">{formatCurrency(bin.total)}</td>
                          <td className="text-right p-2 md:p-2">{formatCurrency(bin.average)}</td>
                          <td className="text-right p-2 md:p-2 pr-2">{formatCurrency(bin.median)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
