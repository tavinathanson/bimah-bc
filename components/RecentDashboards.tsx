"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Clock, Copy, Check, Lock } from "lucide-react";

interface RecentDashboard {
  title: string;
  url: string;
  reportId: string;
  publishedAt: string;
  isPasswordProtected?: boolean;
}

export function RecentDashboards() {
  const [dashboards, setDashboards] = useState<RecentDashboard[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("recentDashboards");
    if (stored) {
      setDashboards(JSON.parse(stored));
    }
  }, []);

  const handleCopy = (dashboard: RecentDashboard) => {
    navigator.clipboard.writeText(dashboard.url);
    setCopiedId(dashboard.reportId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (dashboards.length === 0) {
    return null;
  }

  return (
    <Card className="border border-gray-100 shadow-lg bg-white/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-[#1886d9]" />
          Your Shared Dashboards
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {dashboards.map((dashboard) => (
            <div
              key={dashboard.reportId}
              className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-gray-900 truncate">{dashboard.title}</p>
                  {dashboard.isPasswordProtected && (
                    <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Shared {new Date(dashboard.publishedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  onClick={() => handleCopy(dashboard)}
                  size="sm"
                  variant="outline"
                  className={copiedId === dashboard.reportId ? "bg-green-50 border-green-200" : ""}
                >
                  {copiedId === dashboard.reportId ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-600" />
                      <span className="text-green-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Link
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => window.open(dashboard.url, '_blank')}
                  size="sm"
                  variant="outline"
                  className="whitespace-nowrap"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4">
          This list is private to you.
        </p>
      </CardContent>
    </Card>
  );
}
