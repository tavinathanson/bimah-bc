"use client";

import { useRouter } from "next/navigation";
import { FlaskConical, BarChart3, TrendingUp } from "lucide-react";

export function ExperimentalNotice() {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-center gap-2">
      <FlaskConical className="h-4 w-4 text-orange-600 flex-shrink-0" />
      <p className="text-sm text-orange-800">
        <span className="font-medium">Experimental:</span> These features are in development and may be inaccurate. Verify results independently.
      </p>
    </div>
  );
}

export function ExperimentalSectionNav({ active }: { active?: "insights" | "forecasts" }) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {active === "insights" ? (
        <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-blue-200 bg-blue-50/50">
          <div className="p-2 rounded-lg bg-blue-100">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="font-medium text-slate-900">Insights</div>
            <div className="text-sm text-slate-500">Retention, concentration, and giving patterns</div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => router.push("/insights")}
          className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors text-left"
        >
          <div className="p-2 rounded-lg bg-blue-50">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="font-medium text-slate-900">Insights</div>
            <div className="text-sm text-slate-500">Retention, concentration, and giving patterns</div>
          </div>
        </button>
      )}

      {active === "forecasts" ? (
        <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-green-200 bg-green-50/50">
          <div className="p-2 rounded-lg bg-green-100">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <div className="font-medium text-slate-900">Forecasts</div>
            <div className="text-sm text-slate-500">Projections, trends, and risk analysis</div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => router.push("/forecasts")}
          className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors text-left"
        >
          <div className="p-2 rounded-lg bg-green-50">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <div className="font-medium text-slate-900">Forecasts</div>
            <div className="text-sm text-slate-500">Projections, trends, and risk analysis</div>
          </div>
        </button>
      )}
    </div>
  );
}
