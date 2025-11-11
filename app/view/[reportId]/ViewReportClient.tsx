"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { enrichRows } from "@/lib/math/calculations";
import {
  calculateTotals,
  calculateCohortMetrics,
  calculateBinMetrics,
  calculateZeroPledgeMetrics,
  calculateStatusMetrics,
} from "@/lib/math/calculations";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Info, Download } from "lucide-react";
import { generateExcelWorkbook } from "@/lib/export/excelExporter";
import numeral from "numeral";
import { STATUS_DISPLAY_NAMES } from "@/lib/constants/statusDisplayNames";
import type { PublishedReport } from '@/app/api/reports/[reportId]/route';

// Theme colors - Blue dominant with gold accents (Jewish theme)
const COLORS = [
  "#1886d9", // star-blue-500 (primary blue)
  "#36a5f1", // star-blue-400 (lighter blue)
  "#e6aa0f", // menorah-gold-500 (gold accent)
  "#0e69bb", // star-blue-600 (deeper blue)
  "#f2c41e", // menorah-gold-400 (lighter gold)
];

interface ViewReportClientProps {
  report: PublishedReport;
}

export function ViewReportClient({ report }: ViewReportClientProps) {
  // Enrich rows with calculated fields
  const enrichedRows = useMemo(() => {
    return enrichRows(report.reportId, report.rows);
  }, [report]);

  // Calculate all metrics
  const totals = useMemo(() => calculateTotals(enrichedRows), [enrichedRows]);
  const cohortMetrics = useMemo(() => calculateCohortMetrics(enrichedRows), [enrichedRows]);
  const binMetrics = useMemo(() => calculateBinMetrics(enrichedRows), [enrichedRows]);
  const zeroPledgeMetrics = useMemo(() => calculateZeroPledgeMetrics(enrichedRows), [enrichedRows]);
  const statusMetrics = useMemo(() => calculateStatusMetrics(enrichedRows), [enrichedRows]);

  // Prepare chart data
  const statusChartData = statusMetrics
    .filter(m => m.householdCount > 0)
    .map(m => ({
      name: STATUS_DISPLAY_NAMES[m.status as keyof typeof STATUS_DISPLAY_NAMES] || m.status,
      value: m.householdCount,
    }));

  const cohortChartData = cohortMetrics.map(c => ({
    name: c.cohort,
    value: c.householdCount,
  }));

  const binChartData = [
    ...binMetrics.map(b => ({ name: b.bin, value: b.householdCount })),
    { name: "$0", value: zeroPledgeMetrics.householdCount },
  ];

  // Export handler
  const handleExport = async () => {
    try {
      const blob = await generateExcelWorkbook(enrichedRows);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.title.replace(/[^a-z0-9]/gi, '_')}_${report.snapshotDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data. Please try again.");
    }
  };

  // Format snapshot date
  const snapshotDateFormatted = new Date(report.snapshotDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{report.title}</h1>
              <p className="mt-2 text-sm text-gray-600">
                Snapshot Date: {snapshotDateFormatted}
              </p>
            </div>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-semibold mb-1">Privacy-Protected Report</p>
                <p>
                  This report contains only anonymous pledge data (ages, amounts, and ZIP codes).
                  Individual donor names and personal information are never included.
                  Ages and data reflect values as of {snapshotDateFormatted}.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Summary Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Households</CardDescription>
              <CardTitle className="text-3xl">{totals.totalHouseholds}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Pledged (Current FY)</CardDescription>
              <CardTitle className="text-3xl">{numeral(totals.totalPledgedCurrent).format("$0,0")}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Change from Prior FY</CardDescription>
              <CardTitle className={`text-3xl ${totals.deltaDollar >= 0 ? "text-green-600" : "text-red-600"}`}>
                {numeral(totals.deltaDollar).format("$0,0")}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Renewed Pledges</CardDescription>
              <CardTitle className="text-3xl">{totals.renewed}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Pledge Status Distribution</CardTitle>
              <CardDescription>Breakdown by renewal status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Age Cohorts */}
          <Card>
            <CardHeader>
              <CardTitle>Age Cohorts</CardTitle>
              <CardDescription>Distribution by age group</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cohortChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pledge Bins */}
          <Card>
            <CardHeader>
              <CardTitle>Pledge Bins</CardTitle>
              <CardDescription>Distribution by pledge amount</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={binChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS[2]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>Summary Statistics</CardTitle>
              <CardDescription>Key metrics at a glance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Households</span>
                  <span className="font-semibold">{totals.totalHouseholds}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Pledged (Current)</span>
                  <span className="font-semibold">{numeral(totals.totalPledgedCurrent).format("$0,0")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Pledged (Prior)</span>
                  <span className="font-semibold">{numeral(totals.totalPledgedPrior).format("$0,0")}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-gray-600">Change ($)</span>
                  <span className={`font-semibold ${totals.deltaDollar >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {numeral(totals.deltaDollar).format("$0,0")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Change (%)</span>
                  <span className={`font-semibold ${(totals.deltaPercent ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {totals.deltaPercent !== null ? numeral(totals.deltaPercent).format("0.0%") : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-gray-600">Renewed</span>
                  <span className="font-semibold">{totals.renewed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">New (Current Only)</span>
                  <span className="font-semibold">{totals.currentOnly}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Lapsed (Prior Only)</span>
                  <span className="font-semibold">{totals.priorOnly}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
