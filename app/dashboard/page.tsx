"use client";

import { useEffect, useState } from "react";
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
import { AlertCircle, ArrowLeft, Download, FileSpreadsheet, Filter, X, ChevronDown, ChevronUp, Info } from "lucide-react";
import { generateExcelWorkbook } from "@/lib/export/excelExporter";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import numeral from "numeral";
import { BimahLogoWithText } from "@/components/ui/BimahLogoWithText";

// Theme colors - Blue dominant with gold accents (Jewish theme)
const COLORS = [
  "#1886d9", // star-blue-500 (primary blue)
  "#36a5f1", // star-blue-400 (lighter blue)
  "#e6aa0f", // menorah-gold-500 (gold accent)
  "#0e69bb", // star-blue-600 (deeper blue)
  "#f2c41e", // menorah-gold-400 (lighter gold)
];

export default function DashboardPage() {
  const [data, setData] = useState<PledgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Filters
  const [filterCohort, setFilterCohort] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterChange, setFilterChange] = useState<string>("all");

  // Advanced filters
  const [showAgeAdvanced, setShowAgeAdvanced] = useState(false);
  const [showPledgeAdvanced, setShowPledgeAdvanced] = useState(false);
  const [pledgeMode, setPledgeMode] = useState<"bins" | "custom">("bins");
  const [filterBin, setFilterBin] = useState<string>("all");
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
    } catch {
      router.push("/import");
    } finally {
      setLoading(false);
    }
  }, [router]);

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
    // Cohort filter (overridden by custom age range if set)
    if (minAge || maxAge) {
      // Custom age range
      if (row.age < minAgeNum || row.age > maxAgeNum) {
        return false;
      }
    } else if (filterCohort !== "all" && getAgeCohort(row.age) !== filterCohort) {
      // Standard cohort filter
      return false;
    }

    // Status filter
    if (filterStatus !== "all" && row.status !== filterStatus) {
      return false;
    }

    // Pledge amount filter - two modes
    if (pledgeMode === "bins" && filterBin !== "all") {
      const bin = getPledgeBin(row.pledgeCurrent);
      if (bin !== filterBin) return false;
    } else if (pledgeMode === "custom") {
      if (row.pledgeCurrent < minPledgeNum || row.pledgeCurrent > maxPledgeNum) {
        return false;
      }
    }

    // Change direction filter (only applies to renewed)
    if (filterChange !== "all" && row.status === "renewed") {
      if (filterChange === "increased" && row.changeDollar <= 0) return false;
      if (filterChange === "decreased" && row.changeDollar >= 0) return false;
      if (filterChange === "no-change" && row.changeDollar !== 0) return false;
    }

    return true;
  });

  const hasActiveFilters = filterCohort !== "all" || filterStatus !== "all" ||
    filterChange !== "all" || filterBin !== "all" || minPledge !== "" || maxPledge !== "" ||
    minAge !== "" || maxAge !== "";

  const clearFilters = () => {
    setFilterCohort("all");
    setFilterStatus("all");
    setFilterChange("all");
    setFilterBin("all");
    setMinPledge("");
    setMaxPledge("");
    setMinAge("");
    setMaxAge("");
    setPledgeMode("bins");
  };

  // Smart chart visibility
  const showCohortChart = filterCohort === "all" && !minAge && !maxAge;
  const showStatusChart = filterStatus === "all";
  const showBinChart = filterBin === "all" && pledgeMode !== "custom";
  const showChangeChart = filterChange === "all" && (filterStatus === "all" || filterStatus === "renewed");

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
    "current-only": "Current only",
    "prior-only": "Prior only",
    "no-pledge-both": "No pledge"
  };

  const statusChartData = statusMetrics.map((s) => ({
    name: statusDisplayNames[s.status] || s.status,
    value: s.householdCount,
  }));

  const cohortChartData = cohortMetrics.map((c) => ({
    name: c.cohort,
    Households: c.householdCount,
  }));

  const binChartData = binMetrics.filter((b) => b.householdCount > 0).map((b) => ({
    name: b.bin,
    Households: b.householdCount,
  }));

  const changeData = [
    { name: "Increased", value: cohortMetrics.reduce((sum, c) => sum + c.increased, 0) },
    { name: "Decreased", value: cohortMetrics.reduce((sum, c) => sum + c.decreased, 0) },
    { name: "No Change", value: cohortMetrics.reduce((sum, c) => sum + c.noChange, 0) },
  ];

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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={() => router.push("/")}
              className="hover:opacity-80 transition-opacity"
              title="Go to home"
            >
              <BimahLogoWithText
                logoSize={24}
                textClassName="font-mono text-xl md:text-2xl tracking-tight text-[#0e2546]"
              />
            </button>
            <div className="border-l border-border pl-3 md:pl-4">
              <h1 className="text-xl md:text-2xl font-bold">Pledge Analytics</h1>
              <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
                FY26 (July 2025 - June 2026)
              </p>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button variant="outline" onClick={() => router.push("/import")} className="whitespace-nowrap">
              <ArrowLeft className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Back to Import</span>
            </Button>
            <Button variant="outline" onClick={() => router.push("/insights")} className="whitespace-nowrap">
              <span className="hidden md:inline">Insights</span>
              <span className="md:hidden">Insights</span>
            </Button>
            <Button variant="outline" onClick={() => router.push("/forecasts")} className="whitespace-nowrap">
              <span className="hidden md:inline">Forecasts</span>
              <span className="md:hidden">Forecasts</span>
            </Button>
            <Button onClick={handleExportExcel} className="whitespace-nowrap">
              <Download className="h-4 w-4 md:mr-2" />
              <span className="hidden sm:inline">Export Summary</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-3 md:p-4 space-y-3">
            {/* Main Filter Bar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 mb-3">
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
                      className="gap-1 h-7"
                    >
                      <X className="h-3 w-3" />
                      Clear All Filters
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Status Filter */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5 h-7">
                    <label className={`text-xs font-medium ${filterStatus !== "all" ? "text-blue-700 font-semibold" : "text-muted-foreground"}`}>
                      Status
                    </label>
                    {filterStatus !== "all" && <span className="text-blue-600 text-sm">●</span>}
                  </div>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={`w-full ${filterStatus !== "all" ? "ring-2 ring-blue-400" : ""}`}
                  >
                    <option value="all">All Status</option>
                    <option value="renewed">Renewed</option>
                    <option value="current-only">Current Year Only</option>
                    <option value="prior-only">Prior Year Only</option>
                    <option value="no-pledge-both">No Pledge</option>
                  </Select>
                </div>

                {/* Pledge Amount Filter */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 h-7">
                    <div className="flex items-center gap-2">
                      <label className={`text-xs font-medium ${(filterBin !== "all" || pledgeMode === "custom") ? "text-blue-700 font-semibold" : "text-muted-foreground"}`}>
                        Pledge Amount
                      </label>
                      {(filterBin !== "all" || pledgeMode === "custom") && <span className="text-blue-600 text-sm">●</span>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPledgeAdvanced(!showPledgeAdvanced)}
                      className="gap-1 h-6 px-2 text-xs shrink-0"
                    >
                      {showPledgeAdvanced ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          Custom
                        </>
                      )}
                    </Button>
                  </div>
                  <Select
                    value={filterBin}
                    onChange={(e) => {
                      setFilterBin(e.target.value);
                      if (e.target.value !== "all") {
                        setPledgeMode("bins");
                        setMinPledge("");
                        setMaxPledge("");
                      }
                    }}
                    className={`w-full ${(filterBin !== "all" || pledgeMode === "custom") ? "ring-2 ring-blue-400" : ""}`}
                    disabled={pledgeMode === "custom"}
                  >
                    <option value="all">All Pledges</option>
                    <option value="$1-$1,799">$1-$1,799</option>
                    <option value="$1,800-$2,499">$1,800-$2,499</option>
                    <option value="$2,500-$3,599">$2,500-$3,599</option>
                    <option value="$3,600-$5,399">$3,600-$5,399</option>
                    <option value="$5,400+">$5,400+</option>
                  </Select>
                </div>

                {/* Age Filter */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 h-7">
                    <div className="flex items-center gap-2">
                      <label className={`text-xs font-medium ${(filterCohort !== "all" || !!minAge || !!maxAge) ? "text-blue-700 font-semibold" : "text-muted-foreground"}`}>
                        Age
                      </label>
                      {(filterCohort !== "all" || !!minAge || !!maxAge) && <span className="text-blue-600 text-sm">●</span>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAgeAdvanced(!showAgeAdvanced)}
                      className="gap-1 h-6 px-2 text-xs shrink-0"
                    >
                      {showAgeAdvanced ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          Custom
                        </>
                      )}
                    </Button>
                  </div>
                  <Select
                    value={filterCohort}
                    onChange={(e) => {
                      setFilterCohort(e.target.value);
                      if (e.target.value !== "all") {
                        setMinAge("");
                        setMaxAge("");
                      }
                    }}
                    className={`w-full ${(filterCohort !== "all" || !!minAge || !!maxAge) ? "ring-2 ring-blue-400" : ""}`}
                    disabled={!!minAge || !!maxAge}
                  >
                    <option value="all">All Ages</option>
                    <option value="Under 40">Under 40</option>
                    <option value="40-49">40-49</option>
                    <option value="50-64">50-64</option>
                    <option value="65+">65+</option>
                  </Select>
                </div>

                {/* Change Direction Filter */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5 h-7">
                    <label className={`text-xs font-medium ${filterChange !== "all" ? "text-blue-700 font-semibold" : "text-muted-foreground"}`}>
                      Change Direction
                    </label>
                    {filterChange !== "all" && <span className="text-blue-600 text-sm">●</span>}
                  </div>
                  <Select
                    value={filterChange}
                    onChange={(e) => setFilterChange(e.target.value)}
                    className={`w-full ${filterChange !== "all" ? "ring-2 ring-blue-400" : ""}`}
                  >
                    <option value="all">All Changes</option>
                    <option value="increased">Increased</option>
                    <option value="decreased">Decreased</option>
                    <option value="no-change">No Change</option>
                  </Select>
                </div>
              </div>
            </div>

            {/* Custom Pledge Range */}
            {showPledgeAdvanced && (
              <div className="border-t pt-3">
                <label className="text-sm font-medium mb-2 block">Custom Pledge Range</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minPledge}
                    onChange={(e) => {
                      setMinPledge(e.target.value);
                      setPledgeMode("custom");
                      setFilterBin("all");
                    }}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxPledge}
                    onChange={(e) => {
                      setMaxPledge(e.target.value);
                      setPledgeMode("custom");
                      setFilterBin("all");
                    }}
                    className="w-32"
                  />
                </div>
                {(minPledge || maxPledge) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {!minPledge || minPledgeNum === 0
                      ? "Includes $0 pledges in metrics"
                      : "Excludes $0 pledges (shown separately)"}
                  </p>
                )}
              </div>
            )}

            {/* Custom Age Range */}
            {showAgeAdvanced && (
              <div className="border-t pt-3">
                <label className="text-sm font-medium mb-2 block">Custom Age Range</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minAge}
                    onChange={(e) => {
                      setMinAge(e.target.value);
                      if (e.target.value) setFilterCohort("all");
                    }}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxAge}
                    onChange={(e) => {
                      setMaxAge(e.target.value);
                      if (e.target.value) setFilterCohort("all");
                    }}
                    className="w-28"
                  />
                </div>
                {(minAge || maxAge) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Custom range overrides standard cohorts
                  </p>
                )}
              </div>
            )}

            {/* Definitions */}
            {showDefinitions && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">Status Definitions</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div><strong className="text-foreground">Renewed:</strong> Pledged &gt; $0 in both current and prior year</div>
                    <div><strong className="text-foreground">Current Year Only:</strong> Pledged &gt; $0 in current year, $0 in prior year</div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className={hasActiveFilters ? "ring-2 ring-blue-400" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardDescription className="text-xs md:text-sm">Total Households</CardDescription>
                {hasActiveFilters && <span className="text-blue-600 text-sm">●</span>}
              </div>
              <CardTitle className="text-2xl md:text-3xl">
                {totals.totalHouseholds}
                {hasActiveFilters && (
                  <span className="text-base md:text-lg text-muted-foreground font-normal ml-2">
                    of {data.length}
                  </span>
                )}
              </CardTitle>
              {hasActiveFilters && (
                <CardDescription className="text-xs text-blue-700 font-medium mt-1">
                  Filtered view
                </CardDescription>
              )}
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">Current Pledges</CardDescription>
              <CardTitle className="text-2xl md:text-3xl">{formatCurrency(totals.totalPledgedCurrent)}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">Change from Prior Year</CardDescription>
              <CardTitle className={`text-2xl md:text-3xl flex items-center gap-2 ${totals.deltaDollar >= 0 ? "text-green-600" : "text-red-600"}`}>
                <span>{totals.deltaDollar >= 0 ? "↑" : "↓"}</span>
                <span>{formatCurrency(Math.abs(totals.deltaDollar))}</span>
              </CardTitle>
              <CardDescription className="text-xs md:text-sm space-y-0.5">
                <div className={totals.deltaDollar >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatPercent(totals.deltaPercent)} {totals.deltaDollar >= 0 ? "increase" : "decrease"}
                </div>
                <div className="text-muted-foreground">
                  Prior: {formatCurrency(totals.totalPledgedPrior)}
                </div>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">Renewed Households</CardDescription>
              <CardTitle className="text-2xl md:text-3xl">{totals.renewed}</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                {totals.currentOnly} current only, {totals.priorOnly} prior only
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {showStatusChart && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Pledge Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
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
                          "Current only": "current-only",
                          "Prior only": "prior-only",
                          "No pledge": "no-pledge-both"
                        };
                        const status = statusMap[data.name];
                        if (status) setFilterStatus(status);
                      }}
                      cursor="pointer"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} Households`]} />
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
                          "Current only": "current-only",
                          "Prior only": "prior-only",
                          "No pledge": "no-pledge-both"
                        };
                        const status = statusMap[entry.name];
                        if (status) setFilterStatus(status);
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
              </CardContent>
            </Card>
          )}

          {showChangeChart && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Change Direction (Renewed Only)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250} className="md:!h-[300px]">
                  <BarChart data={changeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value} Households`, "Count"]} />
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
                        if (change) setFilterChange(change);
                      }}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {showCohortChart && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Households by Age Cohort</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250} className="md:!h-[300px]">
                  <BarChart data={cohortChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}`, "Households"]} />
                    <Bar
                      dataKey="Households"
                      fill="#1886d9"
                      onClick={(data) => {
                        setFilterCohort(data.name);
                      }}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {showBinChart && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Households by Pledge Bin</CardTitle>
              </CardHeader>
              <CardContent>
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
                    <Tooltip formatter={(value) => [`${value}`, "Households"]} />
                    <Bar
                      dataKey="Households"
                      fill="#e6aa0f"
                      onClick={(data) => {
                        // Switch to bins mode and set the filter
                        setPledgeMode("bins");
                        setFilterBin(data.name);
                        setShowPledgeAdvanced(true);
                      }}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Age Cohort Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Cohort</th>
                    <th className="text-right p-2">Households</th>
                    <th className="text-right p-2">Total Current</th>
                    <th className="text-right p-2">Avg Current</th>
                    <th className="text-right p-2">Median Current</th>
                    <th className="text-right p-2">Renewal Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortMetrics.filter(c => c.householdCount > 0).map((cohort) => (
                    <tr key={cohort.cohort} className="border-b">
                      <td className="p-2 font-medium">{cohort.cohort}</td>
                      <td className="text-right p-2">{cohort.householdCount}</td>
                      <td className="text-right p-2">{formatCurrency(cohort.totalCurrent)}</td>
                      <td className="text-right p-2">{formatCurrency(cohort.averageCurrent)}</td>
                      <td className="text-right p-2">{formatCurrency(cohort.medianCurrent)}</td>
                      <td className="text-right p-2">{formatPercent(cohort.renewalRate)}</td>
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
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">
                      {pledgeMode === "custom" ? "Range" : "Bin"}
                    </th>
                    <th className="text-right p-2">Households</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Average</th>
                    <th className="text-right p-2">Median</th>
                  </tr>
                </thead>
                <tbody>
                  {pledgeMode === "custom" && customBinMetrics ? (
                    <>
                      {/* Show $0 separately if min > 0 */}
                      {customZeroMetrics && customZeroMetrics.householdCount > 0 && (
                        <tr className="border-b bg-muted/30">
                          <td className="p-2 font-medium text-muted-foreground">
                            $0 (No Current Pledge)
                          </td>
                          <td className="text-right p-2">{customZeroMetrics.householdCount}</td>
                          <td className="text-right p-2">{formatCurrency(customZeroMetrics.total)}</td>
                          <td className="text-right p-2 text-muted-foreground">—</td>
                          <td className="text-right p-2 text-muted-foreground">—</td>
                        </tr>
                      )}
                      {/* Custom range row */}
                      <tr className="border-b">
                        <td className="p-2 font-medium">
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
                        <td className="text-right p-2">{customBinMetrics.householdCount}</td>
                        <td className="text-right p-2">{formatCurrency(customBinMetrics.total)}</td>
                        <td className="text-right p-2">{formatCurrency(customBinMetrics.average)}</td>
                        <td className="text-right p-2">{formatCurrency(customBinMetrics.median)}</td>
                      </tr>
                    </>
                  ) : (
                    <>
                      {/* Show $0 row first */}
                      {zeroPledgeMetrics.householdCount > 0 && (
                        <tr className="border-b bg-muted/30">
                          <td className="p-2 font-medium text-muted-foreground">
                            $0 (No Current Pledge)
                          </td>
                          <td className="text-right p-2">{zeroPledgeMetrics.householdCount}</td>
                          <td className="text-right p-2">{formatCurrency(zeroPledgeMetrics.total)}</td>
                          <td className="text-right p-2 text-muted-foreground">—</td>
                          <td className="text-right p-2 text-muted-foreground">—</td>
                        </tr>
                      )}
                      {/* Standard bins */}
                      {binMetrics.filter(b => b.householdCount > 0).map((bin) => (
                        <tr key={bin.bin} className="border-b">
                          <td className="p-2 font-medium">{bin.bin}</td>
                          <td className="text-right p-2">{bin.householdCount}</td>
                          <td className="text-right p-2">{formatCurrency(bin.total)}</td>
                          <td className="text-right p-2">{formatCurrency(bin.average)}</td>
                          <td className="text-right p-2">{formatCurrency(bin.median)}</td>
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
