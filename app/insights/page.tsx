"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PledgeRow } from "@/lib/schema/types";
import { calculateAdvancedInsights } from "@/lib/math/calculations";
import { TrendingUp, TrendingDown, Users, Target, BarChart3, Award } from "lucide-react";
import { AppNav } from "@/components/ui/AppNav";

export default function InsightsPage() {
  const [data, setData] = useState<PledgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
    router.push("/import");
    return null;
  }

  const insights = calculateAdvancedInsights(data);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return (value * 100).toFixed(1) + "%";
  };

  const formatNumber = (value: number, decimals: number = 1) => {
    return value.toFixed(decimals);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fbff] to-[#e0eefb] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <AppNav />

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardHeader className="py-4 md:py-6">
              <CardDescription className="text-xs md:text-sm flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                Retention Rate
              </CardDescription>
              <CardTitle className="text-2xl md:text-3xl text-green-600">
                {formatPercent(insights.retentionRate)}
              </CardTitle>
              <CardDescription className="text-xs mt-2">
                {data.filter(r => r.status === "renewed").length} renewed ÷ {data.filter(r => r.pledgePrior > 0).length} had prior pledge &gt; $0
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="py-4 md:py-6">
              <CardDescription className="text-xs md:text-sm flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4" />
                Upgrade Rate
              </CardDescription>
              <CardTitle className="text-2xl md:text-3xl text-blue-600">
                {formatPercent(insights.upgradeDowngradeRates.upgradeRate)}
              </CardTitle>
              <CardDescription className="text-xs mt-2">
                {insights.upgradeDowngradeRates.upgraded} renewed with increase ÷ all renewed
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="py-4 md:py-6">
              <CardDescription className="text-xs md:text-sm flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4" />
                Downgrade Rate
              </CardDescription>
              <CardTitle className="text-2xl md:text-3xl text-orange-600">
                {formatPercent(insights.upgradeDowngradeRates.downgradeRate)}
              </CardTitle>
              <CardDescription className="text-xs mt-2">
                {insights.upgradeDowngradeRates.downgraded} renewed with decrease ÷ all renewed
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="py-4 md:py-6">
              <CardDescription className="text-xs md:text-sm flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4" />
                Mean Age
              </CardDescription>
              <CardTitle className="text-2xl md:text-3xl">
                {formatNumber(insights.ageStats.mean, 0)}
              </CardTitle>
              <CardDescription className="text-xs mt-2">
                Average of all {data.length} households
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Pledge Concentration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <Award className="h-5 w-5" />
              Pledge Concentration Analysis
            </CardTitle>
            <CardDescription>
              Among households with pledges &gt; $0, what % of total dollars comes from the top pledgers?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm p-3 bg-muted/50 rounded-lg">
                <strong>Based on:</strong> {data.filter(r => r.pledgeCurrent > 0).length} households with pledges &gt; $0
                (out of {data.length} total households)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                  <div className="text-sm font-medium text-yellow-900 mb-1">Top 10% of Pledging Households</div>
                  <div className="text-xs text-yellow-800 mb-2">
                    {insights.pledgeConcentration.top10Percent.households} of {data.filter(r => r.pledgeCurrent > 0).length} households
                  </div>
                  <div className="text-2xl font-bold text-yellow-700 mb-1">
                    {formatPercent(insights.pledgeConcentration.top10Percent.percentOfTotal / 100)}
                  </div>
                  <div className="text-xs text-yellow-800">
                    of total dollars = {formatCurrency(insights.pledgeConcentration.top10Percent.amount)}
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <div className="text-sm font-medium text-blue-900 mb-1">Top 25% of Pledging Households</div>
                  <div className="text-xs text-blue-800 mb-2">
                    {insights.pledgeConcentration.top25Percent.households} of {data.filter(r => r.pledgeCurrent > 0).length} households
                  </div>
                  <div className="text-2xl font-bold text-blue-700 mb-1">
                    {formatPercent(insights.pledgeConcentration.top25Percent.percentOfTotal / 100)}
                  </div>
                  <div className="text-xs text-blue-800">
                    of total dollars = {formatCurrency(insights.pledgeConcentration.top25Percent.amount)}
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <div className="text-sm font-medium text-purple-900 mb-1">Top 50% of Pledging Households</div>
                  <div className="text-xs text-purple-800 mb-2">
                    {insights.pledgeConcentration.top50Percent.households} of {data.filter(r => r.pledgeCurrent > 0).length} households
                  </div>
                  <div className="text-2xl font-bold text-purple-700 mb-1">
                    {formatPercent(insights.pledgeConcentration.top50Percent.percentOfTotal / 100)}
                  </div>
                  <div className="text-xs text-purple-800">
                    of total dollars = {formatCurrency(insights.pledgeConcentration.top50Percent.amount)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* New vs. Renewed Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <Target className="h-5 w-5" />
              Current Year Only vs. Renewed Pledgers
            </CardTitle>
            <CardDescription>Average current pledge: Current year only vs. Renewed (excludes $0 pledges)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border">
                <div className="text-sm font-medium text-muted-foreground mb-1">Current Year Only Average</div>
                <div className="text-2xl font-bold">{formatCurrency(insights.newVsRenewedAverage.currentOnly)}</div>
              </div>

              <div className="p-4 rounded-lg border">
                <div className="text-sm font-medium text-muted-foreground mb-1">Renewed Average</div>
                <div className="text-2xl font-bold">{formatCurrency(insights.newVsRenewedAverage.renewed)}</div>
              </div>

              <div className="p-4 rounded-lg border">
                <div className="text-sm font-medium text-muted-foreground mb-1">Difference</div>
                <div className={`text-2xl font-bold ${insights.newVsRenewedAverage.difference >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {insights.newVsRenewedAverage.difference >= 0 ? "+" : ""}
                  {formatCurrency(insights.newVsRenewedAverage.difference)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {insights.newVsRenewedAverage.difference >= 0
                    ? "Renewed pledgers give more on average"
                    : "Current year only pledgers give more on average"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generational Giving */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Generational Giving Patterns</CardTitle>
            <CardDescription>Current pledges grouped by generation (ages as of current FY, excludes $0)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Generation</th>
                    <th className="text-left p-2">Age Range</th>
                    <th className="text-right p-2">Households</th>
                    <th className="text-right p-2">Total Pledged</th>
                    <th className="text-right p-2">Average Pledge</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.generationalGiving.filter(g => g.count > 0).map((gen) => (
                    <tr key={gen.generation} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{gen.generation}</td>
                      <td className="p-2 text-muted-foreground">{gen.ageRange}</td>
                      <td className="text-right p-2">{gen.count}</td>
                      <td className="text-right p-2">{formatCurrency(gen.totalPledge)}</td>
                      <td className="text-right p-2 font-semibold">{formatCurrency(gen.averagePledge)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pledge Change Behavior */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">How Much Do Pledges Change?</CardTitle>
            <CardDescription>Patterns in pledge changes year-over-year (renewed pledgers only)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border bg-green-50">
                <div className="text-sm font-medium text-green-900 mb-1">Stable Pledgers</div>
                <div className="text-2xl font-bold text-green-700">{formatPercent(insights.pledgeChangeBehavior.percentStable)}</div>
                <div className="text-xs text-green-800 mt-1">Changed by ±10% or less</div>
              </div>

              <div className="p-4 rounded-lg border bg-orange-50">
                <div className="text-sm font-medium text-orange-900 mb-1">Significant Changes</div>
                <div className="text-2xl font-bold text-orange-700">{formatPercent(insights.pledgeChangeBehavior.percentSignificantChange)}</div>
                <div className="text-xs text-orange-800 mt-1">Changed by more than $500</div>
              </div>

              <div className="p-4 rounded-lg border">
                <div className="text-sm font-medium text-muted-foreground mb-1">Range of Changes</div>
                <div className="text-xl font-bold">
                  {formatCurrency(insights.pledgeChangeBehavior.rangeMin)} to {formatCurrency(insights.pledgeChangeBehavior.rangeMax)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Largest decrease to largest increase</div>
              </div>

              <div className="p-4 rounded-lg border">
                <div className="text-sm font-medium text-muted-foreground mb-1">Middle 50% Changed By</div>
                <div className="text-xl font-bold">
                  {formatCurrency(insights.pledgeChangeBehavior.q1)} to {formatCurrency(insights.pledgeChangeBehavior.q3)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Between 25th and 75th percentile</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Pledge by Age Cohort */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Average Pledge by Age Cohort</CardTitle>
            <CardDescription>Mean current pledge per age group (excludes $0 pledges)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {insights.averagePledgeByAge.map((cohort) => (
                <div key={cohort.cohort} className="p-3 rounded-lg border text-center">
                  <div className="text-sm font-medium text-muted-foreground mb-1">{cohort.cohort}</div>
                  <div className="text-lg font-bold">{formatCurrency(cohort.average)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
