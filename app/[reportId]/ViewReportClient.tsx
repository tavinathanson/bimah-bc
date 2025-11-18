"use client";

import React, { useEffect, useState } from "react";
import { enrichRows } from "@/lib/math/calculations";
import type { PublishedReport } from '@/app/api/reports/[reportId]/route';
import { Loader2, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import DashboardPage from "@/app/dashboard/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface ViewReportClientProps {
  report: PublishedReport;
}

/**
 * Loads a published report and renders the dashboard
 * This allows us to reuse 100% of the dashboard code without duplication
 */
export function ViewReportClient({ report }: ViewReportClientProps) {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [reportData, setReportData] = useState(report);

  // Check if already unlocked in this session
  const sessionKey = `unlocked_${report.reportId}`;
  const dataKey = `reportData_${report.reportId}`;
  const [unlocked, setUnlocked] = useState(() => {
    if (!report.isPasswordProtected) return true;
    if (typeof window === 'undefined') return false;
    // Check if we have cached data from previous unlock
    const cached = sessionStorage.getItem(dataKey);
    if (cached && sessionStorage.getItem(sessionKey) === 'true') {
      return true;
    }
    return false;
  });

  const handleUnlock = async () => {
    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const response = await fetch(`/api/reports/${report.reportId}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update report data with the actual rows from server
        const updatedReport = {
          ...report,
          rows: data.rows,
          ...(data.synagogueAddress && { synagogueAddress: data.synagogueAddress }),
          ...(data.synagogueLat !== undefined && { synagogueLat: data.synagogueLat }),
          ...(data.synagogueLng !== undefined && { synagogueLng: data.synagogueLng }),
        };
        setReportData(updatedReport);
        // Cache in session storage
        sessionStorage.setItem(dataKey, JSON.stringify(updatedReport));
        sessionStorage.setItem(sessionKey, 'true');
        setUnlocked(true);
      } else {
        const data = await response.json();
        setError(data.error || "Incorrect password");
      }
    } catch {
      setError("Failed to verify password. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isVerifying) {
      handleUnlock();
    }
  };

  // Load cached data on mount if previously unlocked
  useEffect(() => {
    if (report.isPasswordProtected && typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(dataKey);
      if (cached && sessionStorage.getItem(sessionKey) === 'true') {
        try {
          setReportData(JSON.parse(cached));
        } catch {
          // Invalid cache, will need to re-authenticate
        }
      }
    }
  }, [report.isPasswordProtected, dataKey, sessionKey]);

  useEffect(() => {
    if (!unlocked) return;
    if (reportData.rows.length === 0) return; // Wait for data

    // Enrich the data (add calculated fields)
    const enrichedData = enrichRows(reportData.reportId, reportData.rows);

    // Store in sessionStorage (same as regular dashboard)
    sessionStorage.setItem("pledgeData", JSON.stringify(enrichedData));

    // Store metadata about the published report
    sessionStorage.setItem("publishedReportMetadata", JSON.stringify({
      title: reportData.title,
      snapshotDate: reportData.snapshotDate,
      reportId: reportData.reportId,
      isPublished: true,
    }));

    // Store synagogue location if present in the published report
    if (reportData.synagogueAddress && reportData.synagogueLat !== undefined && reportData.synagogueLng !== undefined) {
      localStorage.setItem("bimah_bc_synagogue_address", reportData.synagogueAddress);
      localStorage.setItem("bimah_bc_synagogue_coords", JSON.stringify({
        lat: reportData.synagogueLat,
        lon: reportData.synagogueLng,  // Note: localStorage uses 'lon' to match Coordinates interface
      }));
    }

    setReady(true);
  }, [reportData, unlocked]);

  // Password unlock screen
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center mb-6">
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Lock className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Password Protected
            </h1>
            <p className="text-gray-600 text-center mb-6">
              This dashboard requires a password to view.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter password"
                    className={`w-full pr-10 ${error ? "border-red-500" : ""}`}
                    disabled={isVerifying}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={isVerifying}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {error && (
                  <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <Button
                onClick={handleUnlock}
                disabled={isVerifying}
                className="w-full bg-[#1886d9] hover:bg-[#0e69bb]"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Unlock Dashboard"
                )}
              </Button>
            </div>

            <p className="mt-4 text-xs text-gray-500 text-center">
              Contact the person who shared this link if you don&apos;t have the password.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading screen
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
