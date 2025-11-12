"use client";

import React, { useEffect, useState } from "react";
import { enrichRows } from "@/lib/math/calculations";
import type { PublishedReport } from '@/app/api/reports/[reportId]/route';
import { Loader2 } from "lucide-react";
import DashboardPage from "@/app/dashboard/page";

interface ViewReportClientProps {
  report: PublishedReport;
}

/**
 * Loads a published report and renders the dashboard
 * This allows us to reuse 100% of the dashboard code without duplication
 */
export function ViewReportClient({ report }: ViewReportClientProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Enrich the data (add calculated fields)
    const enrichedData = enrichRows(report.reportId, report.rows);

    // Store in sessionStorage (same as regular dashboard)
    sessionStorage.setItem("pledgeData", JSON.stringify(enrichedData));

    // Store metadata about the published report
    sessionStorage.setItem("publishedReportMetadata", JSON.stringify({
      title: report.title,
      snapshotDate: report.snapshotDate,
      reportId: report.reportId,
      isPublished: true,
    }));

    // Store synagogue location if present in the published report
    if (report.synagogueAddress && report.synagogueLat !== undefined && report.synagogueLng !== undefined) {
      localStorage.setItem("bimah_bc_synagogue_address", report.synagogueAddress);
      localStorage.setItem("bimah_bc_synagogue_coords", JSON.stringify({
        lat: report.synagogueLat,
        lng: report.synagogueLng,
      }));
    }

    setReady(true);
  }, [report]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return <DashboardPage isPublishedView={true} />;
}
