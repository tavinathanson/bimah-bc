"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Transaction, HouseholdYearData } from "@/lib/schema/types";
import {
  AlertCircle, Download, Loader2, RefreshCw, DollarSign, Users,
  TrendingUp, TrendingDown, BarChart3, ChevronDown, Filter, MapPin, RotateCcw
} from "lucide-react";
import { AppNav } from "@/components/ui/AppNav";
import { PublishModal } from "@/components/PublishModal";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

// New components
import { SimpleClickableBarChart } from "@/components/dashboard/ClickableChart";
import { MetricCard, TimeSeriesLineChart, StackedBarChart } from "@/components/dashboard/TimeSeriesCharts";
import { ChargeTypeGroupSelector } from "@/components/dashboard/ChargeTypeGroupSelector";
import { useFilterStack } from "@/lib/hooks/useFilterStack";
import { useChargeTypeGroups } from "@/lib/hooks/useChargeTypeGroups";
import {
  transformToHouseholdData,
  computeYearMetrics,
  getAvailableYears,
  getAvailableChargeTypes,
  prepareTimeSeriesData,
  computeHouseholdComparisons,
  computeComparisonMetrics,
  aggregateComparisonsByField,
  type HouseholdComparison,
} from "@/lib/analysis/dataTransformations";
import { generateInsights, InsightCard } from "@/lib/analysis/insightsEngine";
import { AGE_COHORTS, TENURE_COHORTS, PLEDGE_BINS } from "@/lib/schema/constants";
import { formatAxisLabel } from "@/lib/utils";
import { CollapsibleSection } from "@/components/dashboard/CollapsibleSection";
import { DistanceHistogram } from "@/components/geo/DistanceHistogram";
import { hasZipCodeData, aggregateByZipCode, type ZipAggregate, type DistanceBin } from "@/lib/geo/aggregation";
import { geocodeZipCode, calculateDistanceFromPoint, type Coordinates } from "@/lib/geo/geocoding";

const ZipMap = dynamic(() => import("@/components/geo/ZipMap").then(mod => ({ default: mod.ZipMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-muted rounded-lg flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

// Colors
const COLORS = {
  blue: "#1886d9",
  lightBlue: "#36a5f1",
  gold: "#e6aa0f",
  deepBlue: "#0e69bb",
  lightGold: "#f2c41e",
  green: "#10b981",
  red: "#ef4444",
  purple: "#8b5cf6",
};

const CHART_COLORS = [
  COLORS.blue, COLORS.green, COLORS.gold, COLORS.purple,
  COLORS.red, "#06b6d4", "#f97316", "#84cc16",
];

const STATUS_COLORS = {
  renewed: COLORS.blue,
  new: COLORS.lightBlue,
  lapsed: COLORS.gold,
  none: COLORS.deepBlue,
};

const CHANGE_COLORS = {
  increased: COLORS.blue,
  decreased: COLORS.blue,
  "no-change": COLORS.blue,
};

// Distance bins for geographic analysis
const DISTANCE_BINS: DistanceBin[] = [
  { min: 0, max: 5, label: "0-5 mi" },
  { min: 5, max: 10, label: "5-10 mi" },
  { min: 10, max: 20, label: "10-20 mi" },
  { min: 20, max: Infinity, label: "20+ mi" },
];

interface DashboardPageProps {
  isPublishedView?: boolean;
}

export default function DashboardPage({ isPublishedView = false }: DashboardPageProps = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishedMeta, setPublishedMeta] = useState<{ title: string; snapshotDate: string; reportId: string } | null>(null);

  // Raw data
  const [householdData, setHouseholdData] = useState<HouseholdYearData[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableChargeTypes, setAvailableChargeTypes] = useState<string[]>([]);
  const [primaryGivingType, setPrimaryGivingType] = useState<string | null>(null);

  // Year comparison selection
  const [selectedYearPair, setSelectedYearPair] = useState<string>("");

  // Dropdown filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [ageFilter, setAgeFilter] = useState<string[]>([]);
  const [changeFilter, setChangeFilter] = useState<string[]>([]);
  const [pledgeBinFilter, setPledgeBinFilter] = useState<string[]>([]);

  // Unified filter history for undo
  type FilterSnapshot = {
    status: string[];
    age: string[];
    change: string[];
    pledgeBin: string[];
    stackLength: number;
  };
  const [filterHistory, setFilterHistory] = useState<FilterSnapshot[]>([]);

  // Dropdown open states
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [ageDropdownOpen, setAgeDropdownOpen] = useState(false);
  const [changeDropdownOpen, setChangeDropdownOpen] = useState(false);
  const [pledgeDropdownOpen, setPledgeDropdownOpen] = useState(false);

  // Geo state
  const [synagogueAddress, setSynagogueAddress] = useState<string>("");
  const [synagogueCoords, setSynagogueCoords] = useState<Coordinates | null>(null);
  const [geoExpanded, setGeoExpanded] = useState(false);
  const [zipAggregates, setZipAggregates] = useState<ZipAggregate[]>([]);
  const [distanceRanges, setDistanceRanges] = useState<{ range: string; count: number; total: number }[]>([]);

  // Hooks for state management
  const filterStack = useFilterStack();
  const chargeTypeGroups = useChargeTypeGroups(availableChargeTypes);

  // Load data on mount
  useEffect(() => {
    const loadData = () => {
      try {
        const transactionDataStr = sessionStorage.getItem("transactionData");

        if (transactionDataStr) {
          const rawTransactions = JSON.parse(transactionDataStr) as Array<{
            date: string;
            accountId: string;
            chargeType: string;
            amount: number;
            zip?: string;
            primaryBirthday?: string;
            memberSince?: string;
            joinDate?: string;
          }>;

          const transactions: Transaction[] = rawTransactions.map(t => ({
            date: new Date(t.date),
            accountId: t.accountId,
            chargeType: t.chargeType,
            amount: t.amount,
            zip: t.zip,
            primaryBirthday: t.primaryBirthday ? new Date(t.primaryBirthday) : undefined,
            memberSince: t.memberSince ? new Date(t.memberSince) : undefined,
            joinDate: t.joinDate ? new Date(t.joinDate) : undefined,
          }));

          const households = transformToHouseholdData(transactions);
          setHouseholdData(households);

          const years = getAvailableYears(households);
          setAvailableYears(years);
          setAvailableChargeTypes(getAvailableChargeTypes(households));

          // Set default year selection (comparison if multiple years, single if only one)
          if (years.length >= 2) {
            setSelectedYearPair(`${years[1]}-${years[0]}`);
          } else if (years.length === 1) {
            setSelectedYearPair(String(years[0]));
          }

          // Load metadata including primary giving type
          const metadataStr = sessionStorage.getItem("transactionMetadata");
          if (metadataStr) {
            try {
              const metadata = JSON.parse(metadataStr);
              setPrimaryGivingType(metadata.primaryGivingType || null);
            } catch (e) {
              console.error("Error parsing metadata:", e);
            }
          }

          // Load synagogue location from localStorage
          const savedAddress = localStorage.getItem("bimah_bc_synagogue_address");
          const savedCoordsStr = localStorage.getItem("bimah_bc_synagogue_coords");
          if (savedAddress) {
            setSynagogueAddress(savedAddress);
          }
          if (savedCoordsStr) {
            try {
              setSynagogueCoords(JSON.parse(savedCoordsStr));
            } catch (e) {
              console.error("Error parsing synagogue coords:", e);
            }
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Parse selected year option (can be "2025" for single or "2024-2025" for comparison)
  const [priorYear, currentYear] = useMemo(() => {
    if (!selectedYearPair) return [0, 0];
    if (selectedYearPair.includes("-")) {
      const [prior, current] = selectedYearPair.split("-").map(Number);
      return [prior, current];
    } else {
      // Single year mode - both are the same
      const year = Number(selectedYearPair);
      return [year, year];
    }
  }, [selectedYearPair]);

  // Check if single year mode
  const isSingleYear = availableYears.length === 1 || priorYear === currentYear;

  // Generate year options (single years + comparisons)
  const yearOptions = useMemo(() => {
    const options: { value: string; label: string; type: "single" | "comparison" }[] = [];

    // Single year options
    availableYears.forEach(year => {
      options.push({
        value: String(year),
        label: `${year} only`,
        type: "single"
      });
    });

    // Comparison options (if more than one year)
    if (availableYears.length >= 2) {
      for (let i = 0; i < availableYears.length - 1; i++) {
        options.push({
          value: `${availableYears[i + 1]}-${availableYears[i]}`,
          label: `${availableYears[i + 1]} → ${availableYears[i]}`,
          type: "comparison"
        });
      }
    }

    return options;
  }, [availableYears]);

  // Compute household comparisons
  const comparisons = useMemo(() => {
    if (householdData.length === 0 || !currentYear) return [];
    return computeHouseholdComparisons(
      householdData,
      currentYear,
      priorYear,
      chargeTypeGroups.selectedChargeTypes
    );
  }, [householdData, currentYear, priorYear, chargeTypeGroups.selectedChargeTypes]);

  // Apply filters to comparisons
  const filteredComparisons = useMemo(() => {
    let filtered = comparisons;

    // Status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(c => statusFilter.includes(c.status));
    }

    // Age filter
    if (ageFilter.length > 0) {
      filtered = filtered.filter(c => ageFilter.includes(c.ageCohort));
    }

    // Change filter
    if (changeFilter.length > 0) {
      filtered = filtered.filter(c => c.changeDirection && changeFilter.includes(c.changeDirection));
    }

    // Pledge bin filter
    if (pledgeBinFilter.length > 0) {
      filtered = filtered.filter(c => pledgeBinFilter.includes(c.pledgeBin));
    }

    // Apply filter stack
    const { activeFilters } = filterStack;
    if (activeFilters.ageCohorts?.length) {
      filtered = filtered.filter(c => activeFilters.ageCohorts!.includes(c.ageCohort));
    }
    if (activeFilters.tenureCohorts?.length) {
      filtered = filtered.filter(c => activeFilters.tenureCohorts!.includes(c.tenureCohort));
    }
    if (activeFilters.givingLevels?.length) {
      filtered = filtered.filter(c => activeFilters.givingLevels!.includes(c.givingLevel));
    }

    return filtered;
  }, [comparisons, statusFilter, ageFilter, changeFilter, pledgeBinFilter, filterStack.activeFilters]);

  // Compute metrics
  const metrics = useMemo(() => {
    return computeComparisonMetrics(filteredComparisons);
  }, [filteredComparisons]);

  // Compute year metrics for time series
  const yearMetrics = useMemo(() => {
    if (householdData.length === 0) return [];
    return computeYearMetrics(householdData, chargeTypeGroups.selectedChargeTypes);
  }, [householdData, chargeTypeGroups.selectedChargeTypes]);

  // Prepare chart data
  const givingTrendData = useMemo(() => {
    return prepareTimeSeriesData(yearMetrics, "totalGiving");
  }, [yearMetrics]);

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    if (isSingleYear) {
      // Single year: just show who gave vs didn't
      const withGiving = filteredComparisons.filter(c => c.currentYearGiving > 0).length;
      const withoutGiving = filteredComparisons.filter(c => c.currentYearGiving === 0).length;
      return [
        { name: "With Giving", value: withGiving, color: COLORS.blue },
        { name: "No Giving", value: withoutGiving, color: COLORS.lightBlue },
      ].filter(d => d.value > 0);
    }
    return [
      { name: "Renewed", value: metrics.status.renewed, color: STATUS_COLORS.renewed },
      { name: "New: Current Year Only", value: metrics.status.new, color: STATUS_COLORS.new },
      { name: "Lapsed: Prior Year Only", value: metrics.status.lapsed, color: STATUS_COLORS.lapsed },
      { name: "No Pledge", value: metrics.status.none, color: STATUS_COLORS.none },
    ].filter(d => d.value > 0);
  }, [metrics.status, isSingleYear, filteredComparisons]);

  // Change direction for bar chart
  const changeData = useMemo(() => [
    { name: "Increased", value: metrics.changeDirection.increased },
    { name: "Decreased", value: metrics.changeDirection.decreased },
    { name: "No Change", value: metrics.changeDirection.noChange },
  ], [metrics.changeDirection]);

  // Age cohort data
  const ageCohortData = useMemo(() => {
    return aggregateComparisonsByField(filteredComparisons, "ageCohort", "count")
      .map((d, i) => ({ ...d, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [filteredComparisons]);

  // Pledge bin data
  const pledgeBinData = useMemo(() => {
    const binOrder = PLEDGE_BINS.map(b => b.label as string);
    return aggregateComparisonsByField(filteredComparisons, "pledgeBin", "count")
      .filter(d => d.name !== "No Pledge")
      .sort((a, b) => binOrder.indexOf(a.name) - binOrder.indexOf(b.name))
      .map((d) => ({ ...d, color: COLORS.gold }));
  }, [filteredComparisons]);

  // Determine if we should use pledge terminology
  const usePledgeTerminology = useMemo(() => {
    if (!primaryGivingType) return false;
    // Use pledge terminology if:
    // 1. Viewing "All Giving" (includes the primary type)
    // 2. Viewing a group that contains the primary giving type
    // 3. Viewing the primary giving type specifically
    if (chargeTypeGroups.selectedGroupId === "all") return true;
    if (chargeTypeGroups.selectedChargeTypes.includes(primaryGivingType)) return true;
    return false;
  }, [primaryGivingType, chargeTypeGroups.selectedGroupId, chargeTypeGroups.selectedChargeTypes]);

  // Chart labels based on terminology
  const binChartTitle = usePledgeTerminology ? "Households by Pledge Bin" : "Households by Giving Level";
  const binChartSubtitle = usePledgeTerminology
    ? `${filteredComparisons.filter(c => c.currentYearGiving > 0).length} with Pledges > $0 of ${metrics.totalHouseholds} Households`
    : `${filteredComparisons.filter(c => c.currentYearGiving > 0).length} with Giving > $0 of ${metrics.totalHouseholds} Households`;

  // Compute geo data
  useEffect(() => {
    const computeGeoData = async () => {
      if (!synagogueCoords || filteredComparisons.length === 0) {
        setZipAggregates([]);
        setDistanceRanges([]);
        return;
      }

      // Get unique zips with data
      const zipData = new Map<string, { households: number; totalCurrent: number; totalPrior: number }>();
      for (const c of filteredComparisons) {
        if (c.zip) {
          const existing = zipData.get(c.zip) || { households: 0, totalCurrent: 0, totalPrior: 0 };
          existing.households += 1;
          existing.totalCurrent += c.currentYearGiving;
          existing.totalPrior += c.priorYearGiving;
          zipData.set(c.zip, existing);
        }
      }

      // Geocode zips and compute distances
      const aggregates: ZipAggregate[] = [];

      for (const [zip, data] of zipData) {
        try {
          const coords = await geocodeZipCode(zip);
          if (coords) {
            const distanceMiles = calculateDistanceFromPoint(coords, synagogueCoords);
            const deltaDollar = data.totalCurrent - data.totalPrior;
            const deltaPercent = data.totalPrior === 0
              ? "n/a" as const
              : (data.totalCurrent - data.totalPrior) / data.totalPrior;

            aggregates.push({
              zip,
              households: data.households,
              totalPledgeCurrent: data.totalCurrent,
              totalPledgePrior: data.totalPrior,
              avgPledge: data.totalCurrent / data.households,
              deltaDollar,
              deltaPercent,
              coords,
              distanceMiles,
            });
          }
        } catch (e) {
          // Skip zips that fail to geocode
        }
      }

      setZipAggregates(aggregates);

      // Compute distance ranges
      const ranges = [
        { range: "0-5 mi", min: 0, max: 5, count: 0, total: 0 },
        { range: "5-10 mi", min: 5, max: 10, count: 0, total: 0 },
        { range: "10-20 mi", min: 10, max: 20, count: 0, total: 0 },
        { range: "20+ mi", min: 20, max: Infinity, count: 0, total: 0 },
      ];

      for (const agg of aggregates) {
        if (agg.distanceMiles !== undefined) {
          for (const range of ranges) {
            if (agg.distanceMiles >= range.min && agg.distanceMiles < range.max) {
              range.count += agg.households;
              range.total += agg.totalPledgeCurrent;
              break;
            }
          }
        }
      }

      setDistanceRanges(ranges.map(r => ({ range: r.range, count: r.count, total: r.total })));
    };

    computeGeoData();
  }, [filteredComparisons, synagogueCoords]);

  // Tenure cohort data
  const tenureCohortData = useMemo(() => {
    return aggregateComparisonsByField(filteredComparisons, "tenureCohort", "currentYearGiving")
      .map((d, i) => ({ ...d, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [filteredComparisons]);

  // Charge type breakdown
  const chargeTypeData = useMemo(() => {
    const byType = new Map<string, number>();
    for (const c of filteredComparisons) {
      for (const [type, amount] of Object.entries(c.byChargeType)) {
        byType.set(type, (byType.get(type) || 0) + amount);
      }
    }
    return Array.from(byType.entries())
      .map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredComparisons]);

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  // Check if chart has enough data points to be worth showing
  const isChartWorthShowing = (data: { value: number }[]) => {
    const nonZeroItems = data.filter(d => d.value > 0);
    return nonZeroItems.length > 1;
  };

  // Handle chart clicks
  const handleStatusClick = (status: string) => {
    const statusMap: Record<string, string> = {
      "Renewed": "renewed",
      "New: Current Year Only": "new",
      "Lapsed: Prior Year Only": "lapsed",
      "No Pledge": "none",
    };
    const s = statusMap[status];
    if (s) {
      saveFilterState();
      setStatusFilter(prev =>
        prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
      );
    }
  };

  const handleChangeClick = (direction: string) => {
    const dirMap: Record<string, string> = {
      "Increased": "increased",
      "Decreased": "decreased",
      "No Change": "no-change",
    };
    const d = dirMap[direction];
    if (d) {
      saveFilterState();
      setChangeFilter(prev =>
        prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
      );
    }
  };

  // Wrapped filter setters that save history
  const updateStatusFilter = (updater: (prev: string[]) => string[]) => {
    saveFilterState();
    setStatusFilter(updater);
  };

  const updateAgeFilter = (updater: (prev: string[]) => string[]) => {
    saveFilterState();
    setAgeFilter(updater);
  };

  const updatePledgeBinFilter = (updater: (prev: string[]) => string[]) => {
    saveFilterState();
    setPledgeBinFilter(updater);
  };

  const updateChangeFilter = (updater: (prev: string[]) => string[]) => {
    saveFilterState();
    setChangeFilter(updater);
  };

  // Wrapped pushFilter that saves history
  const pushFilterWithHistory = (
    type: Parameters<typeof filterStack.pushFilter>[0],
    value: Parameters<typeof filterStack.pushFilter>[1],
    label: Parameters<typeof filterStack.pushFilter>[2]
  ) => {
    saveFilterState();
    filterStack.pushFilter(type, value, label);
  };

  // Save current filter state to history (call before any filter change)
  const saveFilterState = () => {
    setFilterHistory(prev => [...prev, {
      status: statusFilter,
      age: ageFilter,
      change: changeFilter,
      pledgeBin: pledgeBinFilter,
      stackLength: filterStack.stack.length,
    }]);
  };

  // Undo last filter change
  const undoFilter = () => {
    if (filterHistory.length === 0) return;

    const prevState = filterHistory[filterHistory.length - 1];
    setStatusFilter(prevState.status);
    setAgeFilter(prevState.age);
    setChangeFilter(prevState.change);
    setPledgeBinFilter(prevState.pledgeBin);

    // Restore filter stack to previous length
    while (filterStack.stack.length > prevState.stackLength) {
      filterStack.popFilter();
    }

    setFilterHistory(prev => prev.slice(0, -1));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter([]);
    setAgeFilter([]);
    setChangeFilter([]);
    setPledgeBinFilter([]);
    filterStack.clearFilters();
    setFilterHistory([]);
  };

  const hasFilters = statusFilter.length > 0 || ageFilter.length > 0 ||
    changeFilter.length > 0 || pledgeBinFilter.length > 0 || filterStack.stack.length > 0;

  const canUndo = filterHistory.length > 0;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // No data state
  if (householdData.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Data Found</h2>
              <p className="text-muted-foreground mb-4">
                Please import transaction data first.
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

  return (
    <div className="min-h-screen bg-gray-50">
      {!isPublishedView && <AppNav />}

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {publishedMeta?.title || "Giving Dashboard"}
            </h1>
            <p className="text-gray-600 mt-1">
              {isSingleYear ? `${currentYear} Analysis` : `Comparing ${priorYear} → ${currentYear}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!isPublishedView && (
              <>
                <Button variant="outline" onClick={() => router.push("/import")}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  New Import
                </Button>
                <Button onClick={() => setPublishModalOpen(true)}>
                  <Download className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Controls Row */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Year Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">View:</span>
                <select
                  value={selectedYearPair}
                  onChange={(e) => setSelectedYearPair(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-base font-medium bg-white"
                >
                  {yearOptions.filter(o => o.type === "single").length > 0 && (
                    <optgroup label="Single Year">
                      {yearOptions.filter(o => o.type === "single").map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {yearOptions.filter(o => o.type === "comparison").length > 0 && (
                    <optgroup label="Year Comparison">
                      {yearOptions.filter(o => o.type === "comparison").map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Charge Type Group */}
              <div className="flex-1 max-w-xs">
                <ChargeTypeGroupSelector
                  groups={chargeTypeGroups.groups}
                  selectedGroupId={chargeTypeGroups.selectedGroupId}
                  availableChargeTypes={availableChargeTypes}
                  onSelect={chargeTypeGroups.selectGroup}
                  onAdd={chargeTypeGroups.addGroup}
                  onUpdate={chargeTypeGroups.updateGroup}
                  onDelete={chargeTypeGroups.deleteGroup}
                />
              </div>

              {/* Undo Last Filter */}
              {canUndo && (
                <Button variant="outline" size="sm" onClick={undoFilter}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Undo
                </Button>
              )}

              {/* Clear All Filters */}
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  Clear All
                </Button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t">
              <Filter className="h-4 w-4 text-gray-400" />

              {/* Status Filter - only in comparison mode */}
              {!isSingleYear && (
                <div className="relative">
                  <button
                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg ${
                      statusFilter.length > 0 ? "bg-blue-50 border-blue-300" : "bg-white"
                    }`}
                  >
                    Status {statusFilter.length > 0 && `(${statusFilter.length})`}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {statusDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownOpen(false)} />
                      <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[180px]">
                        {["renewed", "new", "lapsed", "none"].map(s => (
                          <label key={s} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={statusFilter.includes(s)}
                              onChange={() => updateStatusFilter(prev =>
                                prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                              )}
                            />
                            <span className="capitalize">{s === "new" ? "New" : s === "none" ? "No Pledge" : s}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Age Filter */}
              <div className="relative">
                <button
                  onClick={() => setAgeDropdownOpen(!ageDropdownOpen)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg ${
                    ageFilter.length > 0 ? "bg-blue-50 border-blue-300" : "bg-white"
                  }`}
                >
                  Age {ageFilter.length > 0 && `(${ageFilter.length})`}
                  <ChevronDown className="h-4 w-4" />
                </button>
                {ageDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAgeDropdownOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[150px]">
                      {AGE_COHORTS.map(c => (
                        <label key={c.label} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ageFilter.includes(c.label)}
                            onChange={() => updateAgeFilter(prev =>
                              prev.includes(c.label) ? prev.filter(x => x !== c.label) : [...prev, c.label]
                            )}
                          />
                          <span>{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Change Filter - only in comparison mode */}
              {!isSingleYear && (
                <div className="relative">
                  <button
                    onClick={() => setChangeDropdownOpen(!changeDropdownOpen)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg ${
                      changeFilter.length > 0 ? "bg-blue-50 border-blue-300" : "bg-white"
                    }`}
                  >
                    Change {changeFilter.length > 0 && `(${changeFilter.length})`}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {changeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setChangeDropdownOpen(false)} />
                      <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[150px]">
                        {["increased", "decreased", "no-change"].map(d => (
                          <label key={d} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={changeFilter.includes(d)}
                              onChange={() => updateChangeFilter(prev =>
                                prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                              )}
                            />
                            <span className="capitalize">{d.replace("-", " ")}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Pledge Amount Filter */}
              <div className="relative">
                <button
                  onClick={() => setPledgeDropdownOpen(!pledgeDropdownOpen)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg ${
                    pledgeBinFilter.length > 0 ? "bg-blue-50 border-blue-300" : "bg-white"
                  }`}
                >
                  Amount {pledgeBinFilter.length > 0 && `(${pledgeBinFilter.length})`}
                  <ChevronDown className="h-4 w-4" />
                </button>
                {pledgeDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setPledgeDropdownOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[150px]">
                      {PLEDGE_BINS.map(b => (
                        <label key={b.label} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pledgeBinFilter.includes(b.label)}
                            onChange={() => updatePledgeBinFilter(prev =>
                              prev.includes(b.label) ? prev.filter(x => x !== b.label) : [...prev, b.label]
                            )}
                          />
                          <span>{b.label}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Metrics - Original Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Households */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-2">Total Households</p>
              <p className="text-4xl font-bold text-blue-600 mb-2">{metrics.totalHouseholds}</p>
              <p className="text-xs text-gray-500">
                {isSingleYear
                  ? `in ${currentYear}`
                  : `unique across ${priorYear} & ${currentYear}`
                }
              </p>
            </CardContent>
          </Card>

          {/* Current Giving/Pledges */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-2">{usePledgeTerminology ? "Current Pledges" : "Current Giving"}</p>
              <p className="text-3xl font-bold mb-2">{formatCurrency(metrics.currentTotal)}</p>
              <p className="text-sm text-gray-500">Average: {formatCurrency(metrics.avgGift)}</p>
            </CardContent>
          </Card>

          {/* Change from Prior Year - only show in comparison mode */}
          {!isSingleYear && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-2">Change from Prior Year</p>
                <div className="flex items-center gap-2 mb-2">
                  {metrics.changeDollar >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                  <p className={`text-3xl font-bold ${metrics.changeDollar >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {metrics.changeDollar >= 0 ? "+" : ""}{formatCurrency(metrics.changeDollar)}
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  {metrics.changePercent >= 0 ? "+" : ""}{metrics.changePercent.toFixed(1)}% • Prior: {formatCurrency(metrics.priorTotal)}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Median/Average - show in single year mode instead of change */}
          {isSingleYear && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-2">Median Gift</p>
                <p className="text-3xl font-bold mb-2">{formatCurrency(metrics.medianGift)}</p>
                <p className="text-sm text-gray-500">
                  {filteredComparisons.filter(c => c.currentYearGiving > 0).length} households with giving
                </p>
              </CardContent>
            </Card>
          )}

          {/* Status Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">{usePledgeTerminology ? "Pledge Status" : "Giving Status"}</p>
              </div>
              {isSingleYear ? (
                <div className="flex items-baseline gap-4">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {filteredComparisons.filter(c => c.currentYearGiving > 0).length}
                    </p>
                    <p className="text-xs text-gray-500">With Giving</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {filteredComparisons.filter(c => c.currentYearGiving === 0).length}
                    </p>
                    <p className="text-xs text-gray-500">No Giving</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-4 mb-2">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{metrics.status.renewed}</p>
                      <p className="text-xs text-gray-500">Renewed</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{metrics.status.new}</p>
                      <p className="text-xs text-gray-500">New</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{metrics.status.lapsed}</p>
                      <p className="text-xs text-gray-500">Lapsed</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{metrics.status.none}</p>
                      <p className="text-xs text-gray-500">None</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    {metrics.status.renewed + metrics.status.new} in {currentYear} • {metrics.status.renewed + metrics.status.lapsed} in {priorYear}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* COMPARISON VIEW: Status Distribution Pie Chart (Renewed/New/Lapsed/None) */}
          {!isSingleYear && isChartWorthShowing(statusData) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {usePledgeTerminology ? "Pledge" : "Giving"} Status Distribution
                </CardTitle>
                <p className="text-sm text-gray-500">{metrics.totalHouseholds} of {comparisons.length} Households</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ value }) => value}
                      onClick={(data) => handleStatusClick(data.name)}
                      cursor="pointer"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* SINGLE YEAR VIEW: Charge Type Distribution */}
          {isSingleYear && isChartWorthShowing(chargeTypeData) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Giving by Charge Type</CardTitle>
                <p className="text-sm text-gray-500">Distribution across {chargeTypeData.length} charge types</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={chargeTypeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }) => `${formatCurrency(value)}`}
                    >
                      {chargeTypeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* COMPARISON VIEW: Renewed Changes Bar Chart */}
          {!isSingleYear && isChartWorthShowing(changeData) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Renewed {usePledgeTerminology ? "Pledge" : "Giving"} Changes</CardTitle>
                <p className="text-sm text-gray-500">{metrics.status.renewed} Renewed of {metrics.totalHouseholds} Households</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={changeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={formatAxisLabel} />
                    <Tooltip formatter={(value: number) => [value, "Households"]} />
                    <Bar
                      dataKey="value"
                      fill={COLORS.blue}
                      onClick={(data) => handleChangeClick(data.name)}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* BOTH VIEWS: Households by Age Cohort */}
          {isChartWorthShowing(ageCohortData) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Households by Age Cohort</CardTitle>
                <p className="text-sm text-gray-500">{metrics.totalHouseholds} of {comparisons.length} Households</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={ageCohortData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={formatAxisLabel} />
                    <Tooltip formatter={(value: number) => [value, "Households"]} />
                    <Bar
                      dataKey="value"
                      fill={COLORS.blue}
                      onClick={(data) => {
                        updateAgeFilter(prev =>
                          prev.includes(data.name) ? prev.filter(x => x !== data.name) : [...prev, data.name]
                        );
                      }}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* BOTH VIEWS: Households by Pledge/Giving Bin */}
          {isChartWorthShowing(pledgeBinData) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{binChartTitle}</CardTitle>
                <p className="text-sm text-gray-500">{binChartSubtitle}</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={pledgeBinData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={formatAxisLabel} />
                    <Tooltip formatter={(value: number) => [value, "Households"]} />
                    <Bar
                      dataKey="value"
                      fill={COLORS.gold}
                      onClick={(data) => {
                        updatePledgeBinFilter(prev =>
                          prev.includes(data.name) ? prev.filter(x => x !== data.name) : [...prev, data.name]
                        );
                      }}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* COMPARISON VIEW: Giving Over Time (only makes sense with multiple years) */}
          {!isSingleYear && givingTrendData.length > 1 && (
            <TimeSeriesLineChart
              data={givingTrendData}
              title="Total Giving Over Time"
              subtitle="All available years"
              color={COLORS.blue}
            />
          )}

          {/* BOTH VIEWS: Giving by Tenure */}
          {isChartWorthShowing(tenureCohortData) && (
            <SimpleClickableBarChart
              data={tenureCohortData}
              filterType="tenure"
              activeFilters={filterStack.activeFilters}
              onFilter={pushFilterWithHistory}
              title="Giving by Member Tenure"
              subtitle={`${currentYear} totals`}
              valueFormatter={formatCurrency}
            />
          )}

          {/* COMPARISON VIEW: Charge Type Breakdown (single year shows this as pie chart above) */}
          {!isSingleYear && chargeTypeGroups.selectedGroupId === "all" && isChartWorthShowing(chargeTypeData) && (
            <SimpleClickableBarChart
              data={chargeTypeData}
              filterType="chargeType"
              activeFilters={filterStack.activeFilters}
              onFilter={pushFilterWithHistory}
              title="Giving by Charge Type"
              subtitle="Top charge types"
              valueFormatter={formatCurrency}
            />
          )}
        </div>


        {/* Geographic Analysis Section */}
        {synagogueCoords && zipAggregates.length > 0 && (
          <CollapsibleSection
            title="Geographic Analysis"
            badge={`${zipAggregates.length} ZIP codes`}
            icon={<MapPin className="h-5 w-5" />}
            isExpanded={geoExpanded}
            onToggle={() => setGeoExpanded(!geoExpanded)}
          >
            {/* Distance Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distance from Synagogue</CardTitle>
                <p className="text-sm text-gray-500">
                  Household distribution by distance from {synagogueAddress || "synagogue location"}
                </p>
              </CardHeader>
              <CardContent>
                <DistanceHistogram
                  aggregates={zipAggregates}
                  distanceBins={DISTANCE_BINS}
                  locationName={synagogueAddress || "synagogue"}
                />
              </CardContent>
            </Card>

            {/* ZIP Code Map */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Giving by ZIP Code</CardTitle>
                <p className="text-sm text-gray-500">
                  Geographic distribution of {usePledgeTerminology ? "pledges" : "giving"}
                </p>
              </CardHeader>
              <CardContent>
                <ZipMap
                  aggregates={zipAggregates}
                  synagogueCoords={synagogueCoords}
                  synagogueAddress={synagogueAddress}
                />
              </CardContent>
            </Card>

            {/* Top ZIP Codes Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top ZIP Codes by Giving</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">ZIP Code</th>
                        <th className="text-right py-2 font-medium">Households</th>
                        <th className="text-right py-2 font-medium">Total</th>
                        <th className="text-right py-2 font-medium">Average</th>
                        <th className="text-right py-2 font-medium">Distance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zipAggregates
                        .sort((a, b) => b.totalPledgeCurrent - a.totalPledgeCurrent)
                        .slice(0, 10)
                        .map((agg) => (
                          <tr key={agg.zip} className="border-b hover:bg-gray-50">
                            <td className="py-2 font-medium">{agg.zip}</td>
                            <td className="text-right py-2">{agg.households}</td>
                            <td className="text-right py-2">{formatCurrency(agg.totalPledgeCurrent)}</td>
                            <td className="text-right py-2">{formatCurrency(agg.avgPledge)}</td>
                            <td className="text-right py-2">{agg.distanceMiles?.toFixed(1) || "—"} mi</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </CollapsibleSection>
        )}
      </main>

      {/* Publish Modal */}
      {!isPublishedView && (
        <PublishModal
          isOpen={publishModalOpen}
          onClose={() => setPublishModalOpen(false)}
          data={[]}
        />
      )}
    </div>
  );
}
