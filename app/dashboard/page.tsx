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
  calculateStatusMetrics,
  getAgeCohort,
  getPledgeBin,
} from "@/lib/math/calculations";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AlertCircle, ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { generateExcelWorkbook } from "@/lib/export/excelExporter";

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

export default function DashboardPage() {
  const [data, setData] = useState<PledgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  const totals = calculateTotals(data);
  const cohortMetrics = calculateCohortMetrics(data);
  const binMetrics = calculateBinMetrics(data);
  const statusMetrics = calculateStatusMetrics(data);

  const handleExportCSV = () => {
    const headers = ["Age", "Prior Pledge", "Current Pledge", "Change $", "Change %", "Status"];
    const rows = data.map((row) => [
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
    const blob = await generateExcelWorkbook(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pledge-report-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusChartData = statusMetrics.map((s) => ({
    name: s.status.charAt(0).toUpperCase() + s.status.slice(1).replace("-", " "),
    value: s.householdCount,
  }));

  const cohortChartData = cohortMetrics.map((c) => ({
    name: c.cohort,
    households: c.householdCount,
  }));

  const binChartData = binMetrics.filter((b) => b.householdCount > 0).map((b) => ({
    name: b.bin,
    households: b.householdCount,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pledge Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              FY26 (July 2025 - June 2026)
            </p>
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

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
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
                  <Bar dataKey="value" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

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
                  <Bar dataKey="households" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Households by Pledge Bin</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={binChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="households" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
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
            <CardTitle>Pledge Bin Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Bin</th>
                    <th className="text-right p-2">Households</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Average</th>
                    <th className="text-right p-2">Median</th>
                  </tr>
                </thead>
                <tbody>
                  {binMetrics.filter(b => b.householdCount > 0).map((bin) => (
                    <tr key={bin.bin} className="border-b">
                      <td className="p-2 font-medium">{bin.bin}</td>
                      <td className="text-right p-2">{bin.householdCount}</td>
                      <td className="text-right p-2">{formatCurrency(bin.total)}</td>
                      <td className="text-right p-2">{formatCurrency(bin.average)}</td>
                      <td className="text-right p-2">{formatCurrency(bin.median)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
