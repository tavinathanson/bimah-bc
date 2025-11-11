"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
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
import { AlertCircle, Filter, X, ChevronDown, ChevronUp, Info, Check, MapPin, Loader2 } from "lucide-react";
import { generateExcelWorkbook } from "@/lib/export/excelExporter";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import numeral from "numeral";
import { AppNav } from "@/components/ui/AppNav";
import { PublishModal } from "@/components/PublishModal";
import { STATUS_DISPLAY_NAMES, STATUS_DISPLAY_NAMES_SHORT, DISPLAY_NAME_TO_STATUS, type StatusValue } from "@/lib/constants/statusDisplayNames";
import { GeoToggle } from "@/components/dashboard/GeoToggle";
import type { Coordinates } from "@/lib/geo/geocoding";
import { hasZipCodeData, aggregateByZipCode, type ZipAggregate } from "@/lib/geo/aggregation";
import { geocodeZipCode, calculateDistanceFromPoint } from "@/lib/geo/geocoding";
import { DistanceHistogram } from "@/components/geo/DistanceHistogram";

const ZipMap = dynamic(() => import("@/components/geo/ZipMap").then(mod => ({ default: mod.ZipMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-muted rounded-lg flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

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

interface DashboardPageProps {
  isPublishedView?: boolean;
}

export default function DashboardPage({ isPublishedView = false }: DashboardPageProps = {}) {
  const [data, setData] = useState<PledgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Published dashboard metadata (only used when isPublishedView is true)
  const [publishedMeta, setPublishedMeta] = useState<{ title: string; snapshotDate: string } | null>(null);

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
  const [distanceDropdownOpen, setDistanceDropdownOpen] = useState(false);

  // Pledge mode
  const [pledgeMode, setPledgeMode] = useState<"bins" | "custom">("bins");
  const [ageCustomEnabled, setAgeCustomEnabled] = useState(false);
  const [minPledge, setMinPledge] = useState<string>("");
  const [maxPledge, setMaxPledge] = useState<string>("");
  const [minAge, setMinAge] = useState<string>("");
  const [maxAge, setMaxAge] = useState<string>("");
  const [showDefinitions, setShowDefinitions] = useState(false);

  // Publish modal state
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Geographic state
  const hasZips = hasZipCodeData(data);
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [geoToggleOpen, setGeoToggleOpen] = useState(false);
  const [synagogueAddress, setSynagogueAddress] = useState<string>("");
  const [synagogueCoords, setSynagogueCoords] = useState<Coordinates | null>(null);
  const [geoAggregates, setGeoAggregates] = useState<ZipAggregate[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Geographic filters (only active when location is set)
  const [filterDistance, setFilterDistance] = useState<string[]>([]);

  // Load saved geographic location on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem("bimah_bc_synagogue_address");
    const savedCoordsStr = localStorage.getItem("bimah_bc_synagogue_coords");

    if (savedAddress && savedCoordsStr) {
      try {
        const savedCoords = JSON.parse(savedCoordsStr) as Coordinates;
        setSynagogueAddress(savedAddress);
        setSynagogueCoords(savedCoords);
      } catch (e) {
        console.error("Failed to parse saved coordinates:", e);
      }
    }
  }, []);

  const handleGeoAddressSelect = (address: string, coords: Coordinates) => {
    setSynagogueAddress(address);
    setSynagogueCoords(coords);
    localStorage.setItem("bimah_bc_synagogue_address", address);
    localStorage.setItem("bimah_bc_synagogue_coords", JSON.stringify(coords));
  };

  const handleGeoClear = () => {
    setSynagogueAddress("");
    setSynagogueCoords(null);
    localStorage.removeItem("bimah_bc_synagogue_address");
    localStorage.removeItem("bimah_bc_synagogue_coords");
  };

  // Enable geo by default when ZIP data is detected
  useEffect(() => {
    if (hasZips && data.length > 0) {
      setGeoEnabled(true);
    }
  }, [hasZips, data.length]);

  useEffect(() => {
    const stored = sessionStorage.getItem("pledgeData");
    if (!stored) {
      router.push("/import");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as PledgeRow[];
      setData(parsed);

      // Load published dashboard metadata if viewing a published dashboard
      if (isPublishedView) {
        const metaStored = sessionStorage.getItem("publishedReportMetadata");
        if (metaStored) {
          const meta = JSON.parse(metaStored);
          setPublishedMeta({ title: meta.title, snapshotDate: meta.snapshotDate });
        }
      }

      // Restore filter state
      const savedFilters = sessionStorage.getItem("dashboardFilters");
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        // Migrate old string-based filters ("all") to new array format
        setFilterCohort(Array.isArray(filters.filterCohort) ? filters.filterCohort : []);
        setFilterStatus(Array.isArray(filters.filterStatus) ? filters.filterStatus : []);
        setFilterChange(Array.isArray(filters.filterChange) ? filters.filterChange : []);
        setFilterBin(Array.isArray(filters.filterBin) ? filters.filterBin : []);
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
  }, [router, isPublishedView]);

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

  // Track the last geocoded coords to avoid re-geocoding unnecessarily
  const lastGeocodedCoordsRef = useRef<string | null>(null);

  // Geocode ZIPs when synagogue coords change
  useEffect(() => {
    if (!geoEnabled || !hasZips || !synagogueCoords || data.length === 0) {
      // Don't clear aggregates when just disabling - keep the cached data
      if (!geoEnabled) {
        return;
      }
      setGeoAggregates([]);
      return;
    }

    // Create a stable key for coords to detect actual changes
    const coordsKey = `${synagogueCoords.lat},${synagogueCoords.lon}`;

    // Skip if we've already geocoded for these coords
    if (lastGeocodedCoordsRef.current === coordsKey) {
      return;
    }

    let cancelled = false;

    const geocodeAllZips = async () => {
      setIsGeocoding(true);

      // Aggregate by ZIP using ALL data (not filtered - we'll apply filters in render)
      const zipAggregates = aggregateByZipCode(data);
      const updatedAggregates: ZipAggregate[] = [];

      for (const agg of zipAggregates) {
        if (cancelled) break;

        try {
          const location = await geocodeZipCode(agg.zip);
          if (location) {
            const distance = calculateDistanceFromPoint(synagogueCoords, location);
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
        setGeoAggregates(updatedAggregates);
        setIsGeocoding(false);
        lastGeocodedCoordsRef.current = coordsKey;
      }
    };

    geocodeAllZips();

    return () => {
      cancelled = true;
    };
  }, [geoEnabled, synagogueCoords?.lat, synagogueCoords?.lon, hasZips, data.length]);

  // Calculate dynamic distance ranges based on actual data distribution
  // Must be before early returns to maintain hook order
  const distanceRanges = React.useMemo(() => {
    if (geoAggregates.length === 0) return [];

    const distances = geoAggregates
      .filter(agg => agg.distanceMiles !== undefined)
      .map(agg => agg.distanceMiles!)
      .sort((a, b) => a - b);

    if (distances.length === 0) return [];

    const max = Math.max(...distances);

    // Create 4 ranges based on data distribution
    const ranges: { value: string; label: string; min: number; max: number }[] = [];

    if (max <= 10) {
      // Very local congregation - use small increments
      ranges.push(
        { value: "0-2", label: "0-2 mi", min: 0, max: 2 },
        { value: "2-5", label: "2-5 mi", min: 2, max: 5 },
        { value: "5-10", label: "5-10 mi", min: 5, max: 10 },
        { value: "10+", label: "10+ mi", min: 10, max: Infinity }
      );
    } else if (max <= 50) {
      // Regional congregation
      ranges.push(
        { value: "0-5", label: "0-5 mi", min: 0, max: 5 },
        { value: "5-15", label: "5-15 mi", min: 5, max: 15 },
        { value: "15-30", label: "15-30 mi", min: 15, max: 30 },
        { value: "30+", label: "30+ mi", min: 30, max: Infinity }
      );
    } else {
      // Wide geographic spread
      ranges.push(
        { value: "0-10", label: "0-10 mi", min: 0, max: 10 },
        { value: "10-30", label: "10-30 mi", min: 10, max: 30 },
        { value: "30-100", label: "30-100 mi", min: 30, max: 100 },
        { value: "100+", label: "100+ mi", min: 100, max: Infinity }
      );
    }

    return ranges;
  }, [geoAggregates]);

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

    // Distance filter (only applies when geo is enabled and location is set)
    if (geoEnabled && synagogueCoords && filterDistance.length > 0 && row.zipCode) {
      // Find this ZIP's distance in geoAggregates
      const geoAgg = geoAggregates.find(g => g.zip === row.zipCode);
      if (!geoAgg || geoAgg.distanceMiles === undefined) {
        return false; // Exclude if no distance data
      }

      const distance = geoAgg.distanceMiles;
      let distanceMatches = false;

      // Check if distance falls within any selected range
      for (const selectedRange of filterDistance) {
        const range = distanceRanges.find(r => r.value === selectedRange);
        if (range && distance >= range.min && distance < range.max) {
          distanceMatches = true;
          break;
        }
      }

      if (!distanceMatches) return false;
    }

    return true;
  });

  const hasActiveFilters = filterCohort.length > 0 || filterStatus.length > 0 ||
    filterChange.length > 0 || filterBin.length > 0 || pledgeMode === "custom" ||
    ageCustomEnabled || filterDistance.length > 0;

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
    setFilterDistance([]);
  };

  // Filter geo aggregates based on filteredData
  const filteredGeoAggregates = geoAggregates.length > 0 && synagogueCoords
    ? aggregateByZipCode(filteredData).map(filteredAgg => {
        // Find the corresponding aggregate with coords from geoAggregates
        const geoAgg = geoAggregates.find(g => g.zip === filteredAgg.zip);
        return {
          ...filteredAgg,
          coords: geoAgg?.coords,
          distanceMiles: geoAgg?.distanceMiles,
        };
      })
    : [];

  // Smart chart visibility - show when no filters OR multiple filters (comparison is useful)
  const ageFilterCount = filterCohort.length + (ageCustomEnabled ? 1 : 0);
  const showCohortChart = ageFilterCount === 0 || ageFilterCount >= 2;

  const showStatusChart = filterStatus.length === 0 || filterStatus.length >= 2;

  const pledgeFilterCount = filterBin.length + (pledgeMode === "custom" ? 1 : 0);
  const showBinChart = pledgeFilterCount === 0 || pledgeFilterCount >= 2;

  const showChangeChart = (filterChange.length === 0 || filterChange.length >= 2) &&
    (filterStatus.length === 0 || filterStatus.includes("renewed") || filterStatus.length >= 2);

  const showDistanceHistogram = filterDistance.length === 0 || filterDistance.length >= 2;

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

  const handlePublish = () => {
    setShowPublishModal(true);
  };

  // Filter chart data to only show selected options when filters are active
  const statusChartData = statusMetrics
    .filter((s) => filterStatus.length === 0 || filterStatus.includes(s.status))
    .map((s) => ({
      name: STATUS_DISPLAY_NAMES[s.status as StatusValue] || s.status,
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

  // Helper to parse numerical ranges from labels
  // Handles formats like: "Under 40", "40-49", "65+", "$1-$1,799", "$5,400+"
  interface ParsedRange {
    min: number;
    max: number;
    hasMin: boolean;
    hasMax: boolean;
    original: string;
  }

  const parseRange = (label: string): ParsedRange | null => {
    // Remove currency symbols, commas, and spaces for parsing
    const cleaned = label.replace(/[$,\s]/g, "");

    // Pattern: "Under X" or "< X"
    if (/^(under|<)/i.test(cleaned)) {
      const match = cleaned.match(/(\d+)/);
      if (match) {
        return { min: 0, max: parseInt(match[1]!), hasMin: false, hasMax: true, original: label };
      }
    }

    // Pattern: "X+" or "> X" or "X and up"
    if (/\d+\+|>\d+/i.test(cleaned)) {
      const match = cleaned.match(/(\d+)/);
      if (match) {
        return { min: parseInt(match[1]!), max: Infinity, hasMin: true, hasMax: false, original: label };
      }
    }

    // Pattern: "X-Y" (range)
    const rangeMatch = cleaned.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      return {
        min: parseInt(rangeMatch[1]!),
        max: parseInt(rangeMatch[2]!),
        hasMin: true,
        hasMax: true,
        original: label
      };
    }

    return null;
  };

  // Generic smart range summary that works for any numerical ranges
  const getSmartRangeSummary = (ranges: string[], currencySymbol: string = ""): string => {
    if (ranges.length === 0) return "";
    if (ranges.length === 1) return ranges[0]!;

    // Try to parse all ranges
    const parsed = ranges.map(r => ({ label: r, range: parseRange(r) }));
    const parseable = parsed.filter(p => p.range !== null);

    // If we can't parse most of them, just show count
    if (parseable.length < ranges.length * 0.5) {
      return `${ranges.length} selected`;
    }

    // Sort by min value
    const sorted = parseable.sort((a, b) => a.range!.min - b.range!.min);

    // Check if ranges are contiguous (no gaps)
    let isContiguous = true;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!.range!;
      const curr = sorted[i]!.range!;

      // Check if current min starts where previous max ended (or overlaps)
      // Allow some tolerance for different labeling (e.g., 1-1799 followed by 1800-2499)
      if (curr.min > prev.max + 1) {
        isContiguous = false;
        break;
      }
    }

    if (isContiguous && sorted.length > 1) {
      const first = sorted[0]!.range!;
      const last = sorted[sorted.length - 1]!.range!;

      // Build collapsed range text
      const formatNum = (num: number) => {
        if (num === Infinity) return "";
        if (currencySymbol) {
          return `${currencySymbol}${num.toLocaleString()}`;
        }
        return num.toString();
      };

      if (!first.hasMin && !last.hasMax) {
        return "All"; // Full range selected
      } else if (!first.hasMin) {
        // Starts from 0/bottom, goes up to last.max (inclusive)
        return `Up to ${formatNum(last.max)}`;
      } else if (!last.hasMax) {
        // Starts at first.min, goes to infinity
        return `${formatNum(first.min)}+`;
      } else {
        // Both bounds are defined - inclusive range
        return `${formatNum(first.min)}-${formatNum(last.max)}`;
      }
    }

    // Non-contiguous ranges - show count
    return `${ranges.length} ranges`;
  };

  const getFilterSummaryText = (): string[] => {
    const summaries: string[] = [];

    if (filterStatus.length > 0) {
      const labels = filterStatus.map(s => STATUS_DISPLAY_NAMES_SHORT[s as StatusValue] || s);
      summaries.push(`Status: ${labels.join(", ")}`);
    }

    if (filterBin.length > 0 || pledgeMode === "custom") {
      if (filterBin.length > 0 && pledgeMode === "custom" && (minPledge || maxPledge)) {
        const rangeSummary = getSmartRangeSummary(filterBin, "$");
        const customText = `$${minPledge || "0"}-$${maxPledge || "∞"}`;
        summaries.push(`Pledge: ${rangeSummary}, ${customText}`);
      } else if (filterBin.length > 0) {
        const rangeSummary = getSmartRangeSummary(filterBin, "$");
        summaries.push(`Pledge: ${rangeSummary}`);
      } else if (pledgeMode === "custom") {
        const customText = minPledge && maxPledge
          ? `$${minPledge}-$${maxPledge}`
          : minPledge
          ? `≥$${minPledge}`
          : maxPledge
          ? `≤$${maxPledge}`
          : "custom range";
        summaries.push(`Pledge: ${customText}`);
      }
    }

    if (filterCohort.length > 0 || (ageCustomEnabled && (minAge || maxAge))) {
      if (filterCohort.length > 0 && ageCustomEnabled && (minAge || maxAge)) {
        const cohortSummary = getSmartRangeSummary(filterCohort);
        const customText = `${minAge || "0"}-${maxAge || "∞"}`;
        summaries.push(`Age: ${cohortSummary}, ${customText}`);
      } else if (filterCohort.length > 0) {
        const cohortSummary = getSmartRangeSummary(filterCohort);
        summaries.push(`Age: ${cohortSummary}`);
      } else if (ageCustomEnabled) {
        const customText = minAge && maxAge
          ? `${minAge}-${maxAge}`
          : minAge
          ? `≥${minAge}`
          : maxAge
          ? `≤${maxAge}`
          : "custom range";
        summaries.push(`Age: ${customText}`);
      }
    }

    if (filterChange.length > 0) {
      const changeLabels = {
        "increased": "Increased",
        "decreased": "Decreased",
        "no-change": "No Change"
      };
      const labels = filterChange.map(c => changeLabels[c as keyof typeof changeLabels] || c);
      summaries.push(`Change: ${labels.join(", ")}`);
    }

    if (filterDistance.length > 0) {
      const labels = filterDistance.map(d => {
        const range = distanceRanges.find(r => r.value === d);
        return range ? range.label : d;
      });
      summaries.push(`Distance: ${labels.join(", ")}`);
    }

    return summaries;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-5 md:space-y-6">
        <AppNav
          onExport={handleExportExcel}
          showExport={true}
          onPublish={handlePublish}
          showPublish={!isPublishedView}
          isPublishedView={isPublishedView}
          publishedTitle={publishedMeta?.title}
          publishedDate={publishedMeta?.snapshotDate ? new Date(publishedMeta.snapshotDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }) : undefined}
        />

        {/* Published Dashboard Info Banner */}
        {isPublishedView && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Read-only snapshot view</p>
              <p className="text-gray-600">
                All data is anonymized for privacy (no names or personal information).
                Use the filters below to explore pledge patterns and demographics.
              </p>
            </div>
          </div>
        )}

        <Card className="border-0 shadow-lg shadow-blue-100/50 bg-white/70 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6 space-y-4">
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
                      className="gap-1.5 h-8 px-3 rounded-lg border-slate-300 hover:bg-red-50 hover:border-red-400 hover:text-red-700 transition-all duration-200 shadow-sm"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear All Filters
                    </Button>
                  </div>
                )}
              </div>

              {/* Geographic Location Setting - Compact */}
              <div className="border-t pt-3 pb-2">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex items-center gap-2 min-h-[32px] pt-0.5">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">Geographic:</label>
                      <button
                        onClick={() => {
                          if (!hasZips && !geoEnabled) {
                            alert("ZIP code data not available in the imported file. Geographic analysis requires a ZIP code column.");
                          } else {
                            setGeoEnabled(!geoEnabled);
                          }
                        }}
                        className={`px-2 py-1 text-xs border rounded-lg transition-all duration-200 whitespace-nowrap ${
                          geoEnabled
                            ? "ring-2 ring-purple-400/50 border-purple-400 bg-purple-50/50 shadow-sm"
                            : hasZips
                            ? "border-slate-200 bg-white text-muted-foreground hover:bg-slate-50/80 shadow-sm"
                            : "border-slate-200 bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                        }`}
                        disabled={!hasZips && !geoEnabled}
                      >
                        {geoEnabled ? "ON" : "OFF"}
                      </button>
                    </div>

                    {geoEnabled ? (
                      <div className="flex-1 min-w-0">
                        <GeoToggle
                          synagogueAddress={synagogueAddress}
                          synagogueCoords={synagogueCoords}
                          onAddressSelect={handleGeoAddressSelect}
                          onClear={handleGeoClear}
                          isOpen={geoToggleOpen}
                          setIsOpen={setGeoToggleOpen}
                          renderButton={true}
                        />
                      </div>
                    ) : !hasZips ? (
                      <span className="text-xs text-muted-foreground italic pt-1.5">ZIP code data not available</span>
                    ) : null}
                  </div>

                  {/* Drawer appears here at full width */}
                  {geoEnabled && (
                    <GeoToggle
                      synagogueAddress={synagogueAddress}
                      synagogueCoords={synagogueCoords}
                      onAddressSelect={handleGeoAddressSelect}
                      onClear={handleGeoClear}
                      isOpen={geoToggleOpen}
                      setIsOpen={setGeoToggleOpen}
                      renderButton={false}
                    />
                  )}
                </div>
              </div>

              <div className={`grid grid-cols-1 md:grid-cols-2 ${geoEnabled && synagogueCoords ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
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
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm border rounded-lg hover:bg-slate-50/80 transition-all duration-200 ${filterStatus.length > 0 ? "ring-2 ring-blue-400/50 border-blue-400 bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white shadow-sm hover:shadow"}`}
                  >
                    <span className={filterStatus.length === 0 ? "text-muted-foreground" : ""}>
                      {filterStatus.length === 0
                        ? "All Status"
                        : filterStatus.length === 1
                        ? STATUS_DISPLAY_NAMES[filterStatus[0] as StatusValue]
                        : filterStatus.length === 2
                        ? filterStatus.map(s => STATUS_DISPLAY_NAMES_SHORT[s as StatusValue]).join(", ")
                        : `${filterStatus.length} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {statusDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownOpen(false)} />
                      <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50">
                        {filterStatus.length > 0 && (
                          <button
                            onClick={() => setFilterStatus([])}
                            className="w-full px-3 py-2 text-sm text-left text-blue-600 hover:bg-blue-50 border-b font-medium"
                          >
                            Clear (show all)
                          </button>
                        )}
                        {(Object.keys(STATUS_DISPLAY_NAMES) as StatusValue[]).map(statusValue => (
                          <label key={statusValue} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterStatus.includes(statusValue)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterStatus([...filterStatus, statusValue]);
                                } else {
                                  setFilterStatus(filterStatus.filter(s => s !== statusValue));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{STATUS_DISPLAY_NAMES[statusValue]}</span>
                            {filterStatus.includes(statusValue) && <Check className="h-4 w-4 ml-auto text-blue-600" />}
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
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm border rounded-lg hover:bg-slate-50/80 transition-all duration-200 ${(filterBin.length > 0 || pledgeMode === "custom") ? "ring-2 ring-blue-400/50 border-blue-400 bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white shadow-sm hover:shadow"}`}
                  >
                    <span className={(filterBin.length === 0 && pledgeMode !== "custom") ? "text-muted-foreground" : ""}>
                      {filterBin.length === 0 && pledgeMode !== "custom"
                        ? "All Pledges"
                        : filterBin.length > 0 && pledgeMode === "custom" && (minPledge || maxPledge)
                        ? `${getSmartRangeSummary(filterBin, "$")} + custom`
                        : filterBin.length > 0
                        ? getSmartRangeSummary(filterBin, "$")
                        : pledgeMode === "custom"
                        ? (minPledge && maxPledge
                          ? `$${minPledge}-$${maxPledge}`
                          : minPledge
                          ? `≥$${minPledge}`
                          : maxPledge
                          ? `≤$${maxPledge}`
                          : "Custom range")
                        : `${filterBin.length} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {pledgeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setPledgeDropdownOpen(false)} />
                      <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 max-h-80 overflow-y-auto">
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
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm border rounded-lg hover:bg-slate-50/80 transition-all duration-200 ${(filterCohort.length > 0 || ageCustomEnabled) ? "ring-2 ring-blue-400/50 border-blue-400 bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white shadow-sm hover:shadow"}`}
                  >
                    <span className={(filterCohort.length === 0 && !ageCustomEnabled) ? "text-muted-foreground" : ""}>
                      {filterCohort.length === 0 && !ageCustomEnabled
                        ? "All Ages"
                        : filterCohort.length > 0 && ageCustomEnabled && (minAge || maxAge)
                        ? `${getSmartRangeSummary(filterCohort)} + custom`
                        : filterCohort.length > 0
                        ? getSmartRangeSummary(filterCohort)
                        : ageCustomEnabled
                        ? (minAge && maxAge
                          ? `${minAge}-${maxAge}`
                          : minAge
                          ? `≥${minAge}`
                          : maxAge
                          ? `≤${maxAge}`
                          : "Custom range")
                        : `${filterCohort.length} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {ageDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setAgeDropdownOpen(false)} />
                      <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 max-h-80 overflow-y-auto">
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
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm border rounded-lg hover:bg-slate-50/80 transition-all duration-200 ${filterChange.length > 0 ? "ring-2 ring-blue-400/50 border-blue-400 bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white shadow-sm hover:shadow"}`}
                  >
                    <span className={filterChange.length === 0 ? "text-muted-foreground" : ""}>
                      {filterChange.length === 0
                        ? "All Changes"
                        : filterChange.length <= 2
                        ? filterChange.map(c => {
                            const labels: Record<string, string> = {
                              "increased": "Increased",
                              "decreased": "Decreased",
                              "no-change": "No Change"
                            };
                            return labels[c] || c;
                          }).join(", ")
                        : "All selected"}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {changeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setChangeDropdownOpen(false)} />
                      <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50">
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

                {/* Distance Filter - only shown when geo is enabled and location is set */}
                {geoEnabled && synagogueCoords && (
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-1.5 h-7">
                      <label className={`text-xs font-medium ${filterDistance.length > 0 ? "text-purple-700 font-semibold" : "text-muted-foreground"}`}>
                        Distance
                      </label>
                      {filterDistance.length > 0 && <span className="text-purple-600 text-sm">●</span>}
                    </div>
                    <button
                      onClick={() => setDistanceDropdownOpen(!distanceDropdownOpen)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm border rounded-lg hover:bg-slate-50/80 transition-all duration-200 ${filterDistance.length > 0 ? "ring-2 ring-purple-400/50 border-purple-400 bg-purple-50/50 shadow-sm" : "border-slate-200 bg-white shadow-sm hover:shadow"}`}
                    >
                      <span className={filterDistance.length === 0 ? "text-muted-foreground" : ""}>
                        {filterDistance.length === 0 ? "All Distances" : `${filterDistance.length} selected`}
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {distanceDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setDistanceDropdownOpen(false)} />
                        <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50">
                          {filterDistance.length > 0 && (
                            <button
                              onClick={() => setFilterDistance([])}
                              className="w-full px-3 py-2 text-sm text-left text-purple-600 hover:bg-purple-50 border-b font-medium"
                            >
                              Clear (show all)
                            </button>
                          )}
                          {distanceRanges.map(option => (
                            <label key={option.value} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={filterDistance.includes(option.value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFilterDistance([...filterDistance, option.value]);
                                  } else {
                                    setFilterDistance(filterDistance.filter(d => d !== option.value));
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm">{option.label}</span>
                              {filterDistance.includes(option.value) && <Check className="h-4 w-4 ml-auto text-purple-600" />}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>


            {/* Active Filters Summary */}
            {hasActiveFilters && (
              <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200/60 rounded-xl p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <Filter className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-blue-900 mb-1.5">Active Filters:</div>
                    <div className="flex flex-wrap gap-2">
                      {getFilterSummaryText().map((summary, idx) => (
                        <div key={idx} className="inline-flex items-center gap-1 bg-white/80 text-blue-900 px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm border border-blue-100">
                          {summary}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Definitions */}
            {showDefinitions && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">Status Definitions</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div><strong className="text-foreground">{STATUS_DISPLAY_NAMES["renewed"]}:</strong> Pledged &gt; $0 in both current and prior year</div>
                    <div><strong className="text-foreground">{STATUS_DISPLAY_NAMES["current-only"]}:</strong> Pledged &gt; $0 in current year, $0 in prior year</div>
                    <div><strong className="text-foreground">{STATUS_DISPLAY_NAMES["prior-only"]}:</strong> Pledged $0 in current year, &gt; $0 in prior year</div>
                    <div><strong className="text-foreground">{STATUS_DISPLAY_NAMES["no-pledge-both"]}:</strong> Pledged $0 in both years</div>
                  </div>
                </div>

                <div className="pt-2 border-t text-xs text-muted-foreground">
                  <strong>Fiscal Year:</strong> FY26 (July 1, 2025 - June 30, 2026)
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {hasActiveFilters && (
          <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200/60 rounded-xl p-3 md:p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <div className="text-xs md:text-sm text-blue-900">
                <strong className="font-semibold">Filtered View:</strong> Showing {totals.totalHouseholds} of {data.length} households. All metrics and charts below reflect the active filters.
              </div>
            </div>
          </div>
        )}

        {filteredData.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No Households Match Filters</h2>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filter criteria to see results.
                </p>
                <Button onClick={clearFilters} variant="outline">
                  Clear All Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <Card className={`border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${hasActiveFilters ? "ring-2 ring-blue-400/50 ring-offset-2" : ""}`}>
            <CardHeader className="py-5 md:py-6">
              <CardDescription className="text-xs md:text-sm mb-2 font-medium text-slate-600">Total Households</CardDescription>
              <CardTitle className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-blue-600 to-blue-400 bg-clip-text text-transparent">
                {totals.totalHouseholds}
                {hasActiveFilters && (
                  <span className="text-base md:text-lg text-muted-foreground font-normal ml-2">
                    of {data.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="py-5 md:py-6">
              <CardDescription className="text-xs md:text-sm mb-2 font-medium text-slate-600">Current Pledges</CardDescription>
              <CardTitle className="text-2xl md:text-3xl font-bold">{formatCurrency(totals.totalPledgedCurrent)}</CardTitle>
              <CardDescription className="text-xs md:text-sm mt-2.5 text-slate-500">
                Average: <span className="font-semibold text-slate-700">{formatCurrency(totals.totalPledgedCurrent / totals.totalHouseholds)}</span>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="py-5 md:py-6">
              <CardDescription className="text-xs md:text-sm mb-2 font-medium text-slate-600">Change from Prior Year</CardDescription>
              <CardTitle className={`text-2xl md:text-3xl flex items-center gap-2 font-bold ${totals.deltaDollar >= 0 ? "text-green-600" : "text-red-600"}`}>
                <span className="text-2xl">{totals.deltaDollar >= 0 ? "↑" : "↓"}</span>
                <span>{formatCurrency(Math.abs(totals.deltaDollar))}</span>
              </CardTitle>
              <CardDescription className="text-xs md:text-sm mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`font-semibold ${totals.deltaDollar >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatPercent(totals.deltaPercent)} {totals.deltaDollar >= 0 ? "increase" : "decrease"}
                </span>
                <span className="text-slate-500">
                  Prior: <span className="font-medium">{formatCurrency(totals.totalPledgedPrior)}</span>
                </span>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="py-5 md:py-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4 min-w-0">
                  <CardDescription className="text-xs md:text-sm flex-shrink-0 font-medium text-slate-600">Pledge Status</CardDescription>
                  <CardDescription className="text-xs text-right truncate min-w-0 text-slate-500">
                    {totals.totalHouseholds} of {data.length}
                  </CardDescription>
                </div>
                <div className="flex items-baseline gap-3 md:gap-6 flex-wrap">
                  <div className="flex-shrink-0">
                    <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-br from-blue-600 to-indigo-500 bg-clip-text text-transparent">{totals.renewed}</CardTitle>
                    <CardDescription className="text-xs mt-1.5 font-medium">Renewed</CardDescription>
                  </div>
                  <div className="hidden sm:block border-l border-slate-200 flex-shrink-0" />
                  <div className="flex gap-3 md:gap-4 flex-wrap">
                    <div className="flex-shrink-0">
                      <div className="font-bold text-lg text-slate-700">{totals.currentOnly}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-medium">New</div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="font-bold text-lg text-slate-700">{totals.priorOnly}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-medium">Lapsed</div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="font-bold text-lg text-slate-700">{totals.noPledgeBoth}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-medium">None</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          {showStatusChart && (
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg md:text-xl font-bold text-slate-800">Pledge Status Distribution</CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500">
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
                            const status = DISPLAY_NAME_TO_STATUS[data.name];
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
                            const status = DISPLAY_NAME_TO_STATUS[entry.name];
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
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg md:text-xl font-bold text-slate-800">Renewed Pledge Changes</CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500">
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
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg md:text-xl font-bold text-slate-800">Households by Age Cohort</CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500">
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
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg md:text-xl font-bold text-slate-800">Households by Pledge Bin</CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500">
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

          {/* Geographic Map Card */}
          {geoEnabled && (
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-purple-600" />
                  Geographic Distribution
                </CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500">
                  {synagogueCoords ? `${filteredData.length} Households • ${synagogueAddress}` : "Set your location to view"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!synagogueCoords ? (
                  <div className="h-[300px] flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed border-purple-300">
                    <div className="text-center px-4">
                      <MapPin className="h-12 w-12 text-purple-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-purple-900 mb-1">Set Your Location</p>
                      <p className="text-xs text-muted-foreground">
                        Click "Set Location" above to enable the map
                      </p>
                    </div>
                  </div>
                ) : isGeocoding ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredGeoAggregates.length > 0 ? (
                  <ZipMap
                    aggregates={filteredGeoAggregates}
                    synagogueCoords={synagogueCoords}
                    synagogueAddress={synagogueAddress || undefined}
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">No ZIP codes match current filters</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Distance Histogram Card */}
          {geoEnabled && showDistanceHistogram && (
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-purple-600" />
                  Distance Distribution
                </CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500">
                  {synagogueCoords ? `${filteredData.length} Households` : "Set your location to view"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!synagogueCoords ? (
                  <div className="h-[300px] flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed border-purple-300">
                    <div className="text-center px-4">
                      <MapPin className="h-12 w-12 text-purple-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-purple-900 mb-1">Set Your Location</p>
                      <p className="text-xs text-muted-foreground">
                        Click "Set Location" above to see distance analysis
                      </p>
                    </div>
                  </div>
                ) : isGeocoding ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredGeoAggregates.length > 0 ? (
                  <DistanceHistogram
                    aggregates={filteredGeoAggregates}
                    distanceBins={distanceRanges}
                    locationName={synagogueAddress || ""}
                    selectedBins={
                      filterDistance.length > 0
                        ? filterDistance.map(value => {
                            const range = distanceRanges.find(r => r.value === value);
                            return range?.label || value;
                          })
                        : undefined
                    }
                    onBinClick={(binLabel) => {
                      // Find the range with matching label and use its value
                      const matchingRange = distanceRanges.find(r => r.label === binLabel);
                      if (matchingRange) {
                        setFilterDistance([matchingRange.value]);
                      }
                    }}
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">No ZIP codes match current filters</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl font-bold text-slate-800">Age Cohort Metrics</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 md:pb-6">
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <table className="w-full text-xs md:text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50/50">
                    <th className="text-left p-3 md:p-3 pl-3 font-semibold text-slate-700">Cohort</th>
                    <th className="text-right p-3 md:p-3 font-semibold text-slate-700">Households</th>
                    <th className="text-right p-3 md:p-3 font-semibold text-slate-700">Total Current</th>
                    <th className="text-right p-3 md:p-3 font-semibold text-slate-700">Average Current</th>
                    <th className="text-right p-3 md:p-3 font-semibold text-slate-700">Median Current</th>
                    <th className="text-right p-3 md:p-3 pr-3 font-semibold text-slate-700">Renewal Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortMetrics.filter(c => c.householdCount > 0).map((cohort) => (
                    <tr key={cohort.cohort} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                      <td className="p-3 md:p-3 pl-3 font-semibold text-slate-700">{cohort.cohort}</td>
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

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl font-bold text-slate-800">
              {pledgeMode === "custom" ? "Custom Range Metrics" : "Pledge Bin Metrics"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 md:pb-6">
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <table className="w-full text-xs md:text-sm min-w-[550px]">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50/50">
                    <th className="text-left p-3 md:p-3 pl-3 font-semibold text-slate-700">
                      {pledgeMode === "custom" ? "Range" : "Bin"}
                    </th>
                    <th className="text-right p-3 md:p-3 font-semibold text-slate-700">Households</th>
                    <th className="text-right p-3 md:p-3 font-semibold text-slate-700">Total</th>
                    <th className="text-right p-3 md:p-3 font-semibold text-slate-700">Average</th>
                    <th className="text-right p-3 md:p-3 pr-3 font-semibold text-slate-700">Median</th>
                  </tr>
                </thead>
                <tbody>
                  {pledgeMode === "custom" && customBinMetrics ? (
                    <>
                      {/* Show $0 separately if min > 0 */}
                      {customZeroMetrics && customZeroMetrics.householdCount > 0 && (
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <td className="p-3 md:p-3 pl-3 font-medium text-slate-500">
                            $0 (No Current Pledge)
                          </td>
                          <td className="text-right p-2 md:p-2">{customZeroMetrics.householdCount}</td>
                          <td className="text-right p-2 md:p-2">{formatCurrency(customZeroMetrics.total)}</td>
                          <td className="text-right p-2 md:p-2 text-muted-foreground">—</td>
                          <td className="text-right p-2 md:p-2 pr-2 text-muted-foreground">—</td>
                        </tr>
                      )}
                      {/* Custom range row */}
                      <tr className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                        <td className="p-3 md:p-3 pl-3 font-semibold text-slate-700">
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
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <td className="p-3 md:p-3 pl-3 font-medium text-slate-500">
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
                        <tr key={bin.bin} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                          <td className="p-3 md:p-3 pl-3 font-semibold text-slate-700">{bin.bin}</td>
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
          </>
        )}
      </div>

      {/* Publish Modal */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        data={data}
      />
    </div>
  );
}
