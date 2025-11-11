"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PledgeRow } from "@/lib/schema/types";
import { TrendingUp, AlertTriangle, Users, DollarSign, Target, Calendar, LineChart } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LineChart as RechartsLineChart, Line, ComposedChart } from "recharts";
import { AppNav } from "@/components/ui/AppNav";

interface ForecastMetrics {
  nextYearProjection: {
    conservative: number;
    expected: number;
    optimistic: number;
    method: string;
  };
  retentionForecast: {
    expectedRenewals: number;
    expectedAttrition: number;
    attritionRate: number;
    replacementNeeded: number;
  };
  revenueAtRisk: {
    fromPriorNoRenewal: { count: number; amount: number };
    fromLikelyDecreases: { count: number; estimatedLoss: number };
    totalAtRisk: number;
  };
  upgradeTrend: {
    currentUpgradeRate: number;
    averageUpgradeAmount: number;
    projectedNextYear: number;
    threeYearProjection: number;
  };
  growthScenarios: {
    conservative: { rate: number; amount: number };
    expected: { rate: number; amount: number };
    optimistic: { rate: number; amount: number };
  };
}

function calculateLinearRegression(rows: PledgeRow[]): { slope: number; intercept: number; rSquared: number } {
  // Only use renewed pledgers for regression (both prior and current > 0)
  const renewed = rows.filter(r => r.pledgePrior > 0 && r.pledgeCurrent > 0);

  if (renewed.length === 0) {
    return { slope: 1, intercept: 0, rSquared: 0 };
  }

  const n = renewed.length;
  const sumX = renewed.reduce((sum, r) => sum + r.pledgePrior, 0);
  const sumY = renewed.reduce((sum, r) => sum + r.pledgeCurrent, 0);
  const sumXY = renewed.reduce((sum, r) => sum + r.pledgePrior * r.pledgeCurrent, 0);
  const sumX2 = renewed.reduce((sum, r) => sum + r.pledgePrior * r.pledgePrior, 0);
  const sumY2 = renewed.reduce((sum, r) => sum + r.pledgeCurrent * r.pledgeCurrent, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R²
  const meanY = sumY / n;
  const ssTotal = renewed.reduce((sum, r) => sum + Math.pow(r.pledgeCurrent - meanY, 2), 0);
  const ssResidual = renewed.reduce((sum, r) => {
    const predicted = slope * r.pledgePrior + intercept;
    return sum + Math.pow(r.pledgeCurrent - predicted, 2);
  }, 0);
  const rSquared = 1 - (ssResidual / ssTotal);

  return { slope, intercept, rSquared };
}

function calculateForecasts(rows: PledgeRow[]): ForecastMetrics {
  const currentTotal = rows.reduce((sum, r) => sum + r.pledgeCurrent, 0);
  const priorTotal = rows.reduce((sum, r) => sum + r.pledgePrior, 0);

  // Growth rate from prior to current
  const overallGrowthRate = priorTotal > 0 ? (currentTotal - priorTotal) / priorTotal : 0;

  // Retention analysis
  const hadPriorPledge = rows.filter(r => r.pledgePrior > 0);
  const renewed = rows.filter(r => r.status === "renewed");
  const retentionRate = hadPriorPledge.length > 0 ? renewed.length / hadPriorPledge.length : 0;

  const currentPledgers = rows.filter(r => r.pledgeCurrent > 0);
  const expectedRenewals = Math.round(currentPledgers.length * retentionRate);
  const expectedAttrition = currentPledgers.length - expectedRenewals;

  // Revenue at risk
  const priorNoRenewal = rows.filter(r => r.pledgePrior > 0 && r.pledgeCurrent === 0);
  const priorNoRenewalAmount = priorNoRenewal.reduce((sum, r) => sum + r.pledgePrior, 0);

  // Households that decreased might decrease again
  const decreased = rows.filter(r => r.status === "renewed" && r.changeDollar < 0);
  const avgDecrease = decreased.length > 0
    ? decreased.reduce((sum, r) => sum + Math.abs(r.changeDollar), 0) / decreased.length
    : 0;
  const likelyDecreases = Math.round(decreased.length * 0.5); // Assume 50% might decrease again
  const estimatedLoss = likelyDecreases * avgDecrease;

  // Upgrade trends
  const upgraded = rows.filter(r => r.status === "renewed" && r.changeDollar > 0);
  const upgradeRate = renewed.length > 0 ? upgraded.length / renewed.length : 0;
  const avgUpgrade = upgraded.length > 0
    ? upgraded.reduce((sum, r) => sum + r.changeDollar, 0) / upgraded.length
    : 0;

  const projectedUpgrades = Math.round(expectedRenewals * upgradeRate);
  const projectedUpgradeRevenue = projectedUpgrades * avgUpgrade;

  // Growth scenarios based on historical changes
  const changes = renewed
    .map(r => r.changePercent)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);

  const q1 = changes[Math.floor(changes.length * 0.25)] || 0;
  const median = changes[Math.floor(changes.length * 0.5)] || overallGrowthRate;
  const q3 = changes[Math.floor(changes.length * 0.75)] || 0;

  // Next year projections
  const conservativeRate = Math.min(q1, 0); // Use Q1 but cap at 0 for conservative
  const expectedRate = overallGrowthRate;
  const optimisticRate = Math.max(q3, overallGrowthRate * 1.5);

  const conservativeAmount = currentTotal * (1 + conservativeRate);
  const expectedAmount = currentTotal * (1 + expectedRate);
  const optimisticAmount = currentTotal * (1 + optimisticRate);

  // 3-year projection with compounding
  const threeYearUpgrade = currentTotal * Math.pow(1 + (avgUpgrade / currentTotal * upgradeRate), 3);

  return {
    nextYearProjection: {
      conservative: conservativeAmount,
      expected: expectedAmount,
      optimistic: optimisticAmount,
      method: "Based on prior→current growth rate",
    },
    retentionForecast: {
      expectedRenewals,
      expectedAttrition,
      attritionRate: 1 - retentionRate,
      replacementNeeded: expectedAttrition,
    },
    revenueAtRisk: {
      fromPriorNoRenewal: { count: priorNoRenewal.length, amount: priorNoRenewalAmount },
      fromLikelyDecreases: { count: likelyDecreases, estimatedLoss },
      totalAtRisk: priorNoRenewalAmount + estimatedLoss,
    },
    upgradeTrend: {
      currentUpgradeRate: upgradeRate,
      averageUpgradeAmount: avgUpgrade,
      projectedNextYear: currentTotal + projectedUpgradeRevenue,
      threeYearProjection: threeYearUpgrade,
    },
    growthScenarios: {
      conservative: { rate: conservativeRate, amount: conservativeAmount },
      expected: { rate: expectedRate, amount: expectedAmount },
      optimistic: { rate: optimisticRate, amount: optimisticAmount },
    },
  };
}

export default function ForecastsPage() {
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

  const forecasts = calculateForecasts(data);
  const currentTotal = data.reduce((sum, r) => sum + r.pledgeCurrent, 0);
  const priorTotal = data.reduce((sum, r) => sum + r.pledgePrior, 0);
  const regression = calculateLinearRegression(data);

  // Prepare scatter plot data (sample for performance if large dataset)
  const renewedPledgers = data.filter(r => r.pledgePrior > 0 && r.pledgeCurrent > 0);
  const scatterData = renewedPledgers.map(r => ({
    prior: r.pledgePrior,
    current: r.pledgeCurrent,
  }));

  // Prepare regression line data - create many points for a smooth line
  const maxPrior = Math.max(...renewedPledgers.map(r => r.pledgePrior));
  const minPrior = Math.min(...renewedPledgers.map(r => r.pledgePrior));
  const regressionLineData = [];
  const step = (maxPrior - minPrior) / 50;
  for (let x = minPrior; x <= maxPrior; x += step) {
    regressionLineData.push({
      prior: x,
      predicted: regression.slope * x + regression.intercept,
    });
  }

  // Prepare growth trajectory data - combine historical and projections
  const combinedData = [
    { year: "FY25", actual: priorTotal, conservative: null, expected: null, optimistic: null },
    { year: "FY26", actual: currentTotal, conservative: currentTotal, expected: currentTotal, optimistic: currentTotal },
    { year: "FY27", actual: null, conservative: forecasts.nextYearProjection.conservative, expected: forecasts.nextYearProjection.expected, optimistic: forecasts.nextYearProjection.optimistic },
  ];

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-5 md:space-y-6">
        <AppNav />

        {/* Warning Banner */}
        <div className="bg-gradient-to-r from-yellow-50/90 to-amber-50/70 border border-yellow-200/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <div className="text-sm">
              <strong className="text-yellow-900 font-semibold">Note:</strong>{" "}
              <span className="text-yellow-800">
                These are statistical projections based on historical patterns. Actual results will vary based on
                outreach, engagement, and external factors.
              </span>
            </div>
          </div>
        </div>

        {/* Next Year Revenue Projection */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#1886d9]" />
              Next Year Revenue Projection (FY27)
            </CardTitle>
            <CardDescription>
              Method: Conservative uses lowest growth rates seen, Expected uses actual FY25→FY26 growth, Optimistic uses highest growth rates seen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="text-sm font-medium text-muted-foreground mb-1">Current FY26</div>
                <div className="text-2xl font-bold">{formatCurrency(currentTotal)}</div>
                <div className="text-xs text-muted-foreground mt-1">Baseline</div>
              </div>

              <div className="p-4 rounded-lg border bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <div className="text-sm font-medium text-orange-900 mb-1">Conservative</div>
                <div className="text-2xl font-bold text-orange-700">{formatCurrency(forecasts.nextYearProjection.conservative)}</div>
                <div className="text-xs text-orange-600 mt-1">
                  {formatPercent(forecasts.growthScenarios.conservative.rate)} growth
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="text-sm font-medium text-blue-900 mb-1">Expected</div>
                <div className="text-2xl font-bold text-blue-700">{formatCurrency(forecasts.nextYearProjection.expected)}</div>
                <div className="text-xs text-blue-600 mt-1">
                  {formatPercent(forecasts.growthScenarios.expected.rate)} growth
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <div className="text-sm font-medium text-green-900 mb-1">Optimistic</div>
                <div className="text-2xl font-bold text-green-700">{formatCurrency(forecasts.nextYearProjection.optimistic)}</div>
                <div className="text-xs text-green-600 mt-1">
                  {formatPercent(forecasts.growthScenarios.optimistic.rate)} growth
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Conservative = Lower quartile change rate | Expected = Actual FY25→FY26 rate | Optimistic = Upper quartile or 1.5x expected
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          {/* Retention Forecast */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="h-5 w-5 text-[#1886d9]" />
                Retention Forecast
              </CardTitle>
              <CardDescription>
                Method: Historical retention rate applied to current pledger count
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-green-50 border border-green-200">
                  <div>
                    <div className="text-sm font-medium text-green-900">Expected to Renew</div>
                    <div className="text-xs text-green-700 mt-1">
                      Of {data.filter(r => r.pledgeCurrent > 0).length} current pledgers
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-green-700">
                    {forecasts.retentionForecast.expectedRenewals}
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-red-50 border border-red-200">
                  <div>
                    <div className="text-sm font-medium text-red-900">Expected Attrition</div>
                    <div className="text-xs text-red-700 mt-1">
                      {formatPercent(forecasts.retentionForecast.attritionRate)} of current pledgers
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-red-700">
                    {forecasts.retentionForecast.expectedAttrition}
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div>
                    <div className="text-sm font-medium text-blue-900">Replacement Needed</div>
                    <div className="text-xs text-blue-700 mt-1">
                      New pledgers to maintain current count
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-blue-700">
                    {forecasts.retentionForecast.replacementNeeded}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue at Risk */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Revenue at Risk Analysis
              </CardTitle>
              <CardDescription>
                Method: Observed losses + (average decrease × 50% probability for households that decreased)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 rounded-lg border">
                  <div className="text-sm font-medium mb-2">Lost This Year (Prior → $0)</div>
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                      {forecasts.revenueAtRisk.fromPriorNoRenewal.count} households stopped pledging
                    </div>
                    <div className="text-lg font-bold text-red-600">
                      {formatCurrency(forecasts.revenueAtRisk.fromPriorNoRenewal.amount)}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border">
                  <div className="text-sm font-medium mb-2">Potential Decreases</div>
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                      Est. {forecasts.revenueAtRisk.fromLikelyDecreases.count} may decrease again
                    </div>
                    <div className="text-lg font-bold text-orange-600">
                      {formatCurrency(forecasts.revenueAtRisk.fromLikelyDecreases.estimatedLoss)}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-sm font-medium text-red-900 mb-2">Total Revenue at Risk</div>
                  <div className="text-2xl font-bold text-red-700">
                    {formatCurrency(forecasts.revenueAtRisk.totalAtRisk)}
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    {formatPercent(forecasts.revenueAtRisk.totalAtRisk / currentTotal)} of current revenue
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upgrade Trend Impact */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              If Upgrade Trend Continues
            </CardTitle>
            <CardDescription>
              Method: Compound annual growth rate (CAGR) — current upgrade rate × avg increase, compounded yearly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border">
                <div className="text-sm font-medium text-muted-foreground mb-1">Current FY26</div>
                <div className="text-2xl font-bold">{formatCurrency(currentTotal)}</div>
              </div>

              <div className="p-4 rounded-lg border bg-blue-50">
                <div className="text-sm font-medium text-blue-900 mb-1">Next Year (FY27)</div>
                <div className="text-2xl font-bold text-blue-700">
                  {formatCurrency(forecasts.upgradeTrend.projectedNextYear)}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  +{formatCurrency(forecasts.upgradeTrend.projectedNextYear - currentTotal)}
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-green-50">
                <div className="text-sm font-medium text-green-900 mb-1">3-Year Projection (FY29)</div>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(forecasts.upgradeTrend.threeYearProjection)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Compounded growth
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Assumes same upgrade rate and average increase continues (simple model for illustration)
            </div>
          </CardContent>
        </Card>

        {/* Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          {/* Scatter Plot with Regression */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                <LineChart className="h-5 w-5 text-[#1886d9]" />
                Prior vs. Current Pledge (Renewed Only)
              </CardTitle>
              <CardDescription>
                Linear regression: slope = {regression.slope.toFixed(2)}, R² = {regression.rSquared.toFixed(3)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart margin={{ top: 20, right: 30, bottom: 50, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="prior"
                    name="Prior Year Pledge"
                    label={{ value: "Prior Year ($)", position: "insideBottom", offset: -10 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                    domain={['dataMin', 'dataMax']}
                  />
                  <YAxis
                    type="number"
                    name="Current Year Pledge"
                    label={{ value: "Current Year ($)", angle: -90, position: "insideLeft" }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                    domain={['dataMin', 'dataMax']}
                  />
                  <Tooltip
                    formatter={(value: number) => `$${value.toLocaleString()}`}
                    labelFormatter={() => ""}
                  />
                  {/* Scatter points for actual households */}
                  <Scatter name="Households" data={scatterData} fill="#3b82f6" opacity={0.5} dataKey="current" />
                  {/* Regression line */}
                  <Line
                    data={regressionLineData}
                    type="monotone"
                    dataKey="predicted"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={false}
                    name="Best Fit"
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="text-xs text-muted-foreground mt-2">
                Each blue point = 1 household. Red line = linear regression (best fit). Slope &gt; 1 means pledges growing on average.
              </div>
            </CardContent>
          </Card>

          {/* Growth Trajectory */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Revenue Growth Trajectory
              </CardTitle>
              <CardDescription>
                Historical actuals + three FY27 scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={combinedData} margin={{ top: 20, right: 30, bottom: 40, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value) => value !== null ? `$${Number(value).toLocaleString()}` : "N/A"}
                  />
                  {/* Historical line (solid) */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "#3b82f6" }}
                    name="Actual"
                    connectNulls={false}
                  />
                  {/* Projection lines (dashed) */}
                  <Line
                    type="monotone"
                    dataKey="conservative"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4 }}
                    name="Conservative"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expected"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4 }}
                    name="Expected"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="optimistic"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4 }}
                    name="Optimistic"
                    connectNulls={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
              <div className="text-xs text-muted-foreground mt-2">
                Solid line = actual FY25→FY26. Dashed lines = three FY27 scenarios (conservative/expected/optimistic).
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Items */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
              <Target className="h-5 w-5 text-[#1886d9]" />
              Strategic Implications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg border-l-4 border-l-blue-500 bg-blue-50">
                <strong className="text-blue-900">Recruitment Goal:</strong>{" "}
                <span className="text-blue-800">
                  Need ~{forecasts.retentionForecast.replacementNeeded} new pledgers to offset expected attrition
                </span>
              </div>

              <div className="p-3 rounded-lg border-l-4 border-l-orange-500 bg-orange-50">
                <strong className="text-orange-900">Risk Mitigation:</strong>{" "}
                <span className="text-orange-800">
                  {formatCurrency(forecasts.revenueAtRisk.totalAtRisk)} at risk — prioritize engagement with households who decreased
                </span>
              </div>

              <div className="p-3 rounded-lg border-l-4 border-l-green-500 bg-green-50">
                <strong className="text-green-900">Growth Opportunity:</strong>{" "}
                <span className="text-green-800">
                  {formatPercent(forecasts.upgradeTrend.currentUpgradeRate)} naturally increase — stewardship could amplify this
                </span>
              </div>

              <div className="p-3 rounded-lg border-l-4 border-l-purple-500 bg-purple-50">
                <strong className="text-purple-900">Expected Range:</strong>{" "}
                <span className="text-purple-800">
                  FY27 revenue likely between {formatCurrency(forecasts.nextYearProjection.conservative)} and{" "}
                  {formatCurrency(forecasts.nextYearProjection.optimistic)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
