"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrencyAxis, formatAxisLabel } from "@/lib/utils";

interface YearDataPoint {
  year: number;
  value: number;
  label?: string;
}

interface TimeSeriesLineChartProps {
  data: YearDataPoint[];
  title: string;
  subtitle?: string;
  valueFormatter?: (value: number) => string;
  color?: string;
  showTrend?: boolean;
  height?: number;
}

/**
 * Line chart showing trends over multiple years
 */
export function TimeSeriesLineChart({
  data,
  title,
  subtitle,
  valueFormatter = (v) => `$${v.toLocaleString()}`,
  color = "#3b82f6",
  showTrend = true,
  height = 200,
}: TimeSeriesLineChartProps) {
  if (data.length === 0) return null;

  // Calculate trend
  const sortedData = [...data].sort((a, b) => a.year - b.year);
  const firstValue = sortedData[0]?.value || 0;
  const lastValue = sortedData[sortedData.length - 1]?.value || 0;
  const percentChange = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {showTrend && data.length > 1 && (
            <TrendBadge percentChange={percentChange} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={sortedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: "#e0e0e0" }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={formatCurrencyAxis}
              axisLine={{ stroke: "#e0e0e0" }}
              width={60}
            />
            <Tooltip
              formatter={(value: number) => [valueFormatter(value), title]}
              labelFormatter={(year) => `${year}`}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${title})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Multi-line chart for comparing multiple series over time
 */
interface MultiSeriesData {
  year: number;
  [key: string]: number;
}

interface MultiSeriesLineChartProps {
  data: MultiSeriesData[];
  series: { key: string; name: string; color: string }[];
  title: string;
  subtitle?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}

export function MultiSeriesLineChart({
  data,
  series,
  title,
  subtitle,
  valueFormatter = (v) => `$${v.toLocaleString()}`,
  height = 250,
}: MultiSeriesLineChartProps) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: "#e0e0e0" }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={formatCurrencyAxis}
              axisLine={{ stroke: "#e0e0e0" }}
              width={60}
            />
            <Tooltip
              formatter={(value: number, name: string) => [valueFormatter(value), name]}
              labelFormatter={(year) => `${year}`}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
            />
            <Legend />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Sparkline component for use in summary cards
 */
interface SparklineProps {
  data: YearDataPoint[];
  color?: string;
  height?: number;
  width?: number;
  showDots?: boolean;
}

export function Sparkline({
  data,
  color = "#3b82f6",
  height = 30,
  width = 100,
  showDots = false,
}: SparklineProps) {
  if (data.length === 0) return null;

  const sortedData = [...data].sort((a, b) => a.year - b.year);

  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={sortedData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-gradient-${color})`}
          dot={showDots ? { r: 2, fill: color } : false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Trend badge component
 */
interface TrendBadgeProps {
  percentChange: number;
  className?: string;
}

export function TrendBadge({ percentChange, className = "" }: TrendBadgeProps) {
  const isPositive = percentChange > 0.5;
  const isNegative = percentChange < -0.5;
  const isNeutral = !isPositive && !isNegative;

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const bgColor = isPositive ? "bg-green-100" : isNegative ? "bg-red-100" : "bg-gray-100";
  const textColor = isPositive ? "text-green-700" : isNegative ? "text-red-700" : "text-gray-600";

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${bgColor} ${textColor} ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{isNeutral ? "0%" : `${percentChange > 0 ? "+" : ""}${percentChange.toFixed(1)}%`}</span>
    </div>
  );
}

/**
 * Summary metric card with sparkline
 */
interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: YearDataPoint[];
  trendColor?: string;
  icon?: React.ReactNode;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendColor = "#3b82f6",
  icon,
}: MetricCardProps) {
  // Calculate trend percentage if we have data
  let percentChange = 0;
  if (trend && trend.length > 1) {
    const sortedTrend = [...trend].sort((a, b) => a.year - b.year);
    const first = sortedTrend[0]?.value || 0;
    const last = sortedTrend[sortedTrend.length - 1]?.value || 0;
    percentChange = first > 0 ? ((last - first) / first) * 100 : 0;
  }

  return (
    <Card>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">
              {icon}
              {title}
            </div>
            <div className="text-4xl font-bold tracking-tight text-gray-900">{value}</div>
            {subtitle && (
              <p className="text-base text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          {trend && trend.length > 1 && (
            <div className="flex flex-col items-end gap-2">
              <Sparkline data={trend} color={trendColor} width={110} height={35} />
              <TrendBadge percentChange={percentChange} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Stacked bar chart for comparing distributions across years
 */
interface StackedBarData {
  year: number;
  [key: string]: number;
}

interface StackedBarChartProps {
  data: StackedBarData[];
  categories: { key: string; name: string; color: string }[];
  title: string;
  subtitle?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
  onBarClick?: (year: number, category: string) => void;
}

export function StackedBarChart({
  data,
  categories,
  title,
  subtitle,
  valueFormatter = (v) => v.toLocaleString(),
  height = 250,
  onBarClick,
}: StackedBarChartProps) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: "#e0e0e0" }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={formatAxisLabel}
              axisLine={{ stroke: "#e0e0e0" }}
              width={50}
            />
            <Tooltip
              formatter={(value: number, name: string) => [valueFormatter(value), name]}
              labelFormatter={(year) => `${year}`}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e0e0e0" }}
            />
            <Legend />
            {categories.map((cat) => (
              <Bar
                key={cat.key}
                dataKey={cat.key}
                name={cat.name}
                stackId="a"
                fill={cat.color}
                onClick={onBarClick ? (data) => onBarClick(data.year, cat.key) : undefined}
                cursor={onBarClick ? "pointer" : "default"}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Small multiples - same chart repeated for different categories
 */
interface SmallMultiplesProps {
  title: string;
  subtitle?: string;
  charts: {
    label: string;
    data: YearDataPoint[];
    color?: string;
  }[];
  valueFormatter?: (value: number) => string;
  columns?: number;
}

export function SmallMultiples({
  title,
  subtitle,
  charts,
  valueFormatter = (v) => v.toLocaleString(),
  columns = 2,
}: SmallMultiplesProps) {
  if (charts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {charts.map((chart) => {
            const sortedData = [...chart.data].sort((a, b) => a.year - b.year);
            const lastValue = sortedData[sortedData.length - 1]?.value || 0;

            return (
              <div key={chart.label} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{chart.label}</span>
                  <span className="text-sm font-semibold">{valueFormatter(lastValue)}</span>
                </div>
                <Sparkline
                  data={chart.data}
                  color={chart.color || "#3b82f6"}
                  height={40}
                  width={120}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
