"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Clock, Copy, Check, ChevronDown, EyeOff } from "lucide-react";

interface RecentDashboard {
  title: string;
  url: string;
  reportId: string;
  publishedAt: string;
}

interface RecentDashboardsProps {
  showPrivacyNote?: boolean;
}

export function RecentDashboards({ showPrivacyNote = false }: RecentDashboardsProps) {
  const [dashboards, setDashboards] = useState<RecentDashboard[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

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
    <Card className="border border-gray-100 shadow-lg bg-white/70 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left group cursor-pointer hover:bg-gray-50/50 -mx-2 px-2 py-1 rounded-lg transition-colors"
          aria-expanded={isExpanded}
          aria-controls="recent-dashboards-content"
        >
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-[#1886d9]" />
            <span>Recently Published Dashboards</span>
            <span className="text-sm font-normal text-gray-500">({dashboards.length})</span>
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-base text-gray-600 group-hover:text-gray-900 transition-colors">
              {isExpanded ? "Click to hide" : "Click to show"}
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 group-hover:bg-[#1886d9] group-hover:text-white transition-all">
              <ChevronDown className={`h-6 w-6 transition-transform duration-300 ease-in-out ${isExpanded ? "rotate-180" : ""}`} />
            </div>
          </div>
        </button>
        {showPrivacyNote && (
          <div className="flex items-center gap-2 mt-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
            <EyeOff className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm text-amber-800">
              <strong>Private to you:</strong> Only you can see this list on your computer.
            </span>
          </div>
        )}
      </CardHeader>
      <div
        id="recent-dashboards-content"
        className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <CardContent className="pt-0">
            <div className="space-y-2">
              {dashboards.map((dashboard) => (
                <div
                  key={dashboard.reportId}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{dashboard.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Published {new Date(dashboard.publishedAt).toLocaleDateString('en-US', {
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
                          Copy
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
              These links are saved on this computer. The dashboards themselves are online and accessible from any device.
            </p>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
