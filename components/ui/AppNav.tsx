"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BimahLogoWithText } from "@/components/ui/BimahLogoWithText";
import { BarChart3, Lightbulb, TrendingUp, Upload, Download } from "lucide-react";

interface AppNavProps {
  onExport?: () => void;
  showExport?: boolean;
}

export function AppNav({ onExport, showExport = false }: AppNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
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
          <h1 className="text-xl md:text-2xl font-bold">
            {pathname === "/dashboard" && "Pledge Analytics"}
            {pathname === "/insights" && "Advanced Insights"}
            {pathname === "/forecasts" && "Forecasts"}
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
            {pathname === "/dashboard" && "FY26 (July 2025 - June 2026)"}
            {pathname === "/insights" && "Deep dive analytics and trends"}
            {pathname === "/forecasts" && "Projections and scenarios"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* Main Navigation */}
        <Button
          variant={isActive("/dashboard") ? "default" : "outline"}
          onClick={() => router.push("/dashboard")}
          className="whitespace-nowrap"
        >
          <BarChart3 className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Dashboard</span>
        </Button>

        <Button
          variant={isActive("/insights") ? "default" : "outline"}
          onClick={() => router.push("/insights")}
          className="whitespace-nowrap"
        >
          <Lightbulb className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Insights</span>
        </Button>

        <Button
          variant={isActive("/forecasts") ? "default" : "outline"}
          onClick={() => router.push("/forecasts")}
          className="whitespace-nowrap"
        >
          <TrendingUp className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Forecasts</span>
        </Button>

        {/* Divider */}
        <div className="border-l border-border mx-1" />

        {/* Actions */}
        <Button
          variant="outline"
          onClick={() => router.push("/import")}
          className="whitespace-nowrap"
        >
          <Upload className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Import Data</span>
        </Button>

        {showExport && onExport && (
          <Button onClick={onExport} className="whitespace-nowrap">
            <Download className="h-4 w-4 md:mr-2" />
            <span className="hidden sm:inline">Export Summary</span>
            <span className="sm:hidden">Export</span>
          </Button>
        )}
      </div>
    </div>
  );
}
