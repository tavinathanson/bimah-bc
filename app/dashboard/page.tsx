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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pledgeMode, setPledgeMode] = useState<"bins" | "custom">("bins");
  const [filterBin, setFilterBin] = useState<string>("all");
  const [minPledge, setMinPledge] = useState<string>("");
  const [maxPledge, setMaxPledge] = useState<string>("");
  const [showDefinitions, setShowDefinitions] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("pledgeData");
    if (!stored) {
      router.push("/upload");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as PledgeRow[];
      setData(parsed);
    } catch {
      router.push("/upload");
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
                Please upload and validate files first.
              </p>
              <Button onClick={() => router.push("/upload")}>
                Go to Upload
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

  const filteredData = data.filter((row) => {
    // Cohort filter
    if (filterCohort !== "all" && getAgeCohort(row.age) !== filterCohort) {
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
    filterChange !== "all" || filterBin !== "all" || minPledge !== "" || maxPledge !== "";

  const clearFilters = () => {
    setFilterCohort("all");
    setFilterStatus("all");
    setFilterChange("all");
    setFilterBin("all");
    setMinPledge("");
    setMaxPledge("");
    setPledgeMode("bins");
  };

  // Smart chart visibility
  const showCohortChart = filterCohort === "all";
  const showStatusChart = filterStatus === "all";
  const showBinChart = filterBin === "all" && pledgeMode !== "custom";
  const showChangeChart = filterStatus === "all" || filterStatus === "renewed";

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

  const handleExportCSV = () => {
    const headers = ["Age", "Prior Pledge", "Current Pledge", "Change $", "Change %", "Status"];
    const rows = filteredData.map((row) => [
      row.age,
      row.pledgePrior.toFixed(2),
      row.pledgeCurrent.toFixed(2),
      row.changeDollar.toFixed(2),
      row.changePercent !== null ? (row.changePercent * 100).toFixed(2) + "%" : "n/a",
      row.status,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pledge-data-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const statusChartData = statusMetrics.map((s) => ({
    name: s.status.charAt(0).toUpperCase() + s.status.slice(1).replace("-", " "),
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
    <div className="min-h-screen bg-gradient-to-br from-[#f8fbff] to-[#e0eefb] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BimahLogoWithText
              logoSize={32}
              textClassName="font-mono text-2xl tracking-tight text-[#0e2546]"
            />
            <div className="border-l border-border pl-4">
              <h1 className="text-2xl font-bold">Pledge Analytics</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                FY26 (July 2025 - June 2026)
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/upload")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Upload
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel Report
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Quick Filters */}
            <div className="flex items-center gap-3 flex-wrap">
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

              <Select
                value={filterCohort}
                onChange={(e) => setFilterCohort(e.target.value)}
                className="w-36"
              >
                <option value="all">All Ages</option>
                <option value="Under 40">Under 40</option>
                <option value="40-49">40-49</option>
                <option value="50-64">50-64</option>
                <option value="65+">65+</option>
              </Select>

              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-36"
              >
                <option value="all">All Status</option>
                <option value="renewed">Renewed</option>
                <option value="new">New</option>
                <option value="resigned">Resigned</option>
                <option value="no-pledge-both">No Pledge</option>
              </Select>

              <Select
                value={filterChange}
                onChange={(e) => setFilterChange(e.target.value)}
                className="w-36"
              >
                <option value="all">All Changes</option>
                <option value="increased">Increased</option>
                <option value="decreased">Decreased</option>
                <option value="no-change">No Change</option>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="gap-1"
              >
                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Pledge Amount
              </Button>

              {hasActiveFilters && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear All
                  </Button>
                  <span className="text-sm text-muted-foreground ml-auto">
                    {filteredData.length} of {data.length} households
                  </span>
                </>
              )}
            </div>

            {/* Definitions */}
            {showDefinitions && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">Status Definitions</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div><strong className="text-foreground">Renewed:</strong> Pledged &gt; $0 in both current and prior year</div>
                    <div><strong className="text-foreground">New:</strong> Pledged &gt; $0 in current year, $0 in prior year</div>
                    <div><strong className="text-foreground">Resigned:</strong> Pledged $0 in current year, &gt; $0 in prior year</div>
                    <div><strong className="text-foreground">No Pledge:</strong> Pledged $0 in both years</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Age Cohorts</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div><strong className="text-foreground">Under 40:</strong> Age ≤ 39</div>
                    <div><strong className="text-foreground">40-49:</strong> Ages 40-49</div>
                    <div><strong className="text-foreground">50-64:</strong> Ages 50-64</div>
                    <div><strong className="text-foreground">65+:</strong> Age ≥ 65</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Pledge Bins</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div><strong className="text-foreground">$1-$1,799:</strong> Pledges from $1 to $1,799</div>
                    <div><strong className="text-foreground">$1,800-$2,499:</strong> Pledges from $1,800 to $2,499</div>
                    <div><strong className="text-foreground">$2,500-$3,599:</strong> Pledges from $2,500 to $3,599</div>
                    <div><strong className="text-foreground">$3,600-$5,399:</strong> Pledges from $3,600 to $5,399</div>
                    <div><strong className="text-foreground">$5,400+:</strong> Pledges $5,400 and above</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Change Direction (Renewed Only)</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div><strong className="text-foreground">Increased:</strong> Current pledge &gt; prior pledge</div>
                    <div><strong className="text-foreground">Decreased:</strong> Current pledge &lt; prior pledge</div>
                    <div><strong className="text-foreground">No Change:</strong> Current pledge = prior pledge</div>
                  </div>
                </div>

                <div className="pt-2 border-t text-xs text-muted-foreground">
                  <strong>Fiscal Year:</strong> FY26 (July 1, 2025 - June 30, 2026)
                </div>
              </div>
            )}

            {/* Advanced - Pledge Amount */}
            {showAdvanced && (
              <div className="border-t pt-3 space-y-3">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="pledgeMode"
                        checked={pledgeMode === "bins"}
                        onChange={() => setPledgeMode("bins")}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Standard bins</span>
                    </label>

                    {pledgeMode === "bins" && (
                      <Select
                        value={filterBin}
                        onChange={(e) => setFilterBin(e.target.value)}
                        className="w-40"
                      >
                        <option value="all">All Bins</option>
                        <option value="$1-$1,799">$1-$1,799</option>
                        <option value="$1,800-$2,499">$1,800-$2,499</option>
                        <option value="$2,500-$3,599">$2,500-$3,599</option>
                        <option value="$3,600-$5,399">$3,600-$5,399</option>
                        <option value="$5,400+">$5,400+</option>
                      </Select>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="pledgeMode"
                        checked={pledgeMode === "custom"}
                        onChange={() => setPledgeMode("custom")}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Custom range</span>
                    </label>

                    {pledgeMode === "custom" && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={minPledge}
                            onChange={(e) => setMinPledge(e.target.value)}
                            className="w-28"
                          />
                          <span className="text-sm text-muted-foreground">to</span>
                          <Input
                            type="number"
                            placeholder="Max"
                            value={maxPledge}
                            onChange={(e) => setMaxPledge(e.target.value)}
                            className="w-28"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {!minPledge || minPledgeNum === 0
                            ? "Includes $0 pledges in metrics"
                            : "Excludes $0 pledges (shown separately)"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-white/60 backdrop-blur-sm border border-[#bae0ff] rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-[#1886d9] mt-0.5 flex-shrink-0" />
            <div className="text-sm text-[#0e2546]">
              <strong>Note:</strong> Time-based pledge progress requires gift dates; this version computes a snapshot from the uploaded files.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Households</CardDescription>
              <CardTitle className="text-3xl">{totals.totalHouseholds}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current Pledges</CardDescription>
              <CardTitle className="text-3xl">{formatCurrency(totals.totalPledgedCurrent)}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Change from Prior Year</CardDescription>
              <CardTitle className="text-3xl">
                {formatCurrency(totals.deltaDollar)}
              </CardTitle>
              <CardDescription className={totals.deltaDollar >= 0 ? "text-green-600" : "text-red-600"}>
                {formatPercent(totals.deltaPercent)}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Renewed Households</CardDescription>
              <CardTitle className="text-3xl">{totals.renewed}</CardTitle>
              <CardDescription>
                {totals.new} new, {totals.resigned} resigned
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {showStatusChart && (
            <Card>
              <CardHeader>
                <CardTitle>Pledge Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {showChangeChart && (
            <Card>
              <CardHeader>
                <CardTitle>Change Direction (Renewed Only)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={changeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0e69bb" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {showCohortChart && (
            <Card>
              <CardHeader>
                <CardTitle>Households by Age Cohort</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={cohortChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="Households" fill="#1886d9" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {showBinChart && (
            <Card>
              <CardHeader>
                <CardTitle>Households by Pledge Bin</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
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
                    <Tooltip />
                    <Bar dataKey="Households" fill="#e6aa0f" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Age Cohort Metrics</CardTitle>
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
                  {cohortMetrics.map((cohort) => (
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
            <CardTitle>
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
