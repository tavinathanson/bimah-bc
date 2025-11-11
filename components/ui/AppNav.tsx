"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BimahLogoWithText } from "@/components/ui/BimahLogoWithText";
import { BarChart3, Lightbulb, TrendingUp, Upload, Download, Share2 } from "lucide-react";

interface AppNavProps {
  onExport?: () => void;
  showExport?: boolean;
  onPublish?: () => void;
  showPublish?: boolean;
}

export function AppNav({ onExport, showExport = false, onPublish, showPublish = false }: AppNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-slate-200 rounded-lg p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-3 md:gap-4 flex-shrink min-w-0 overflow-hidden">
        <button
          onClick={() => router.push("/")}
          className="hover:opacity-70 transition-opacity duration-200 flex-shrink-0"
          title="Go to home"
        >
          <BimahLogoWithText
            logoSize={24}
            textClassName="font-mono text-xl md:text-2xl tracking-tight text-[#1886d9]"
          />
        </button>
        <div className="border-l border-slate-200 pl-3 md:pl-4 min-w-0 overflow-hidden">
          <h1 className="text-base md:text-xl font-bold text-slate-800 truncate">
            {pathname === "/dashboard" && "Pledge Analytics"}
            {pathname === "/insights" && "Advanced Insights"}
            {pathname === "/forecasts" && "Forecasts"}
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5 truncate">
            {pathname === "/dashboard" && "FY26 (July 2025 - June 2026)"}
            {pathname === "/insights" && "Deep dive analytics and trends"}
            {pathname === "/forecasts" && "Projections and scenarios"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {/* Main Navigation */}
        <Button
          variant={isActive("/dashboard") ? "default" : "outline"}
          onClick={() => router.push("/dashboard")}
          className={`whitespace-nowrap rounded-lg transition-all duration-200 ${
            isActive("/dashboard")
              ? "bg-[#1886d9] hover:bg-[#0e69bb] shadow-sm text-white"
              : "border-slate-200 shadow-sm hover:shadow hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700"
          }`}
        >
          <BarChart3 className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Dashboard</span>
        </Button>

        <Button
          variant={isActive("/insights") ? "default" : "outline"}
          onClick={() => router.push("/insights")}
          className={`whitespace-nowrap rounded-lg transition-all duration-200 ${
            isActive("/insights")
              ? "bg-[#1886d9] hover:bg-[#0e69bb] shadow-sm text-white"
              : "border-slate-200 shadow-sm hover:shadow hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700"
          }`}
        >
          <Lightbulb className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Insights</span>
        </Button>

        <Button
          variant={isActive("/forecasts") ? "default" : "outline"}
          onClick={() => router.push("/forecasts")}
          className={`whitespace-nowrap rounded-lg transition-all duration-200 ${
            isActive("/forecasts")
              ? "bg-[#1886d9] hover:bg-[#0e69bb] shadow-sm text-white"
              : "border-slate-200 shadow-sm hover:shadow hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700"
          }`}
        >
          <TrendingUp className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Forecasts</span>
        </Button>

        {/* Divider */}
        <div className="border-l border-slate-200 mx-1 hidden sm:block" />

        {/* Actions */}
        <Button
          variant="outline"
          onClick={() => router.push("/import")}
          className="whitespace-nowrap rounded-lg transition-all duration-200 border-slate-200 shadow-sm hover:shadow hover:border-slate-400 hover:bg-slate-100"
        >
          <Upload className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Import Data</span>
        </Button>

        {showExport && onExport && (
          <Button
            onClick={onExport}
            className="whitespace-nowrap rounded-lg bg-[#e6aa0f] hover:bg-[#c98109] text-white shadow-sm transition-all duration-200"
          >
            <Download className="h-4 w-4 md:mr-2" />
            <span className="hidden sm:inline">Export Summary</span>
            <span className="sm:hidden">Export</span>
          </Button>
        )}

        {showPublish && onPublish && (
          <Button
            onClick={onPublish}
            className="whitespace-nowrap rounded-lg bg-[#1886d9] hover:bg-[#0e69bb] text-white shadow-sm transition-all duration-200"
          >
            <Share2 className="h-4 w-4 md:mr-2" />
            <span className="hidden sm:inline">Publish Report</span>
            <span className="sm:hidden">Publish</span>
          </Button>
        )}
      </div>
    </div>
  );
}
