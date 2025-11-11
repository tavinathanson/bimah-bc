"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BimahLogoWithText } from "@/components/ui/BimahLogoWithText";
import { Upload, Download, Share2, Trash2, Clock, ChevronDown, ExternalLink, Copy, Check } from "lucide-react";

interface RecentDashboard {
  title: string;
  url: string;
  reportId: string;
  publishedAt: string;
}

interface AppNavProps {
  onExport?: () => void;
  showExport?: boolean;
  onPublish?: () => void;
  showPublish?: boolean;
  onDelete?: () => void;
  isPublishedView?: boolean;
  publishedTitle?: string;
  publishedDate?: string;
}

export function AppNav({ onExport, showExport = false, onPublish, showPublish = false, onDelete, isPublishedView = false, publishedTitle, publishedDate }: AppNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [recentDropdownOpen, setRecentDropdownOpen] = useState(false);
  const [recentDashboards, setRecentDashboards] = useState<RecentDashboard[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("recentDashboards");
    if (stored) {
      setRecentDashboards(JSON.parse(stored));
    }
  }, []);

  const handleCopy = (dashboard: RecentDashboard, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(dashboard.url);
    setCopiedId(dashboard.reportId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isActive = (path: string) => pathname === path;

  // Published view: Show simplified nav
  if (isPublishedView) {
    return (
      <nav className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 md:p-5">
          {/* Left side: Logo + Title */}
          <div className="flex items-center gap-3 md:gap-4 flex-shrink min-w-0">
            <button
              onClick={() => router.push("/")}
              className="hover:opacity-70 transition-opacity flex-shrink-0"
            >
              <BimahLogoWithText
                logoSize={24}
                textClassName="font-mono text-xl md:text-2xl tracking-tight text-[#1886d9]"
              />
            </button>
            <div className="border-l border-slate-200 pl-3 md:pl-4 min-w-0">
              <h1 className="text-base md:text-xl font-bold text-slate-800 truncate">
                {publishedTitle || "Published Dashboard"}
              </h1>
              <p className="text-muted-foreground text-xs md:text-sm mt-0.5 truncate">
                {publishedDate ? `Snapshot: ${publishedDate}` : "Read-only view"}
              </p>
            </div>
          </div>

          {/* Right side: Actions */}
          <div className="flex gap-2 flex-wrap">
            {/* Recently Published Dropdown */}
            {recentDashboards.length > 0 && (
              <div className="relative">
                <Button
                  onClick={() => setRecentDropdownOpen(!recentDropdownOpen)}
                  variant="outline"
                  className="whitespace-nowrap rounded-lg"
                >
                  <Clock className="h-4 w-4 md:mr-2" />
                  <span className="hidden sm:inline">Recently Published</span>
                  <span className="sm:hidden">Recent</span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
                {recentDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setRecentDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
                      <div className="p-2">
                        {recentDashboards.map((dashboard) => (
                          <div
                            key={dashboard.reportId}
                            className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">{dashboard.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {new Date(dashboard.publishedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={(e) => handleCopy(dashboard, e)}
                                className="p-2 hover:bg-slate-100 rounded"
                                title="Copy link"
                              >
                                {copiedId === dashboard.reportId ? (
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 text-gray-600" />
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  window.open(dashboard.url, '_blank');
                                  setRecentDropdownOpen(false);
                                }}
                                className="p-2 hover:bg-slate-100 rounded"
                                title="Open"
                              >
                                <ExternalLink className="h-3.5 w-3.5 text-gray-600" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {showExport && onExport && (
              <Button
                onClick={onExport}
                className="whitespace-nowrap rounded-lg bg-[#e6aa0f] hover:bg-[#c98109] text-white"
              >
                <Download className="h-4 w-4 md:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            )}

            {onDelete && (
              <Button
                onClick={onDelete}
                variant="outline"
                className="whitespace-nowrap rounded-lg border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 md:mr-2" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            )}
          </div>
        </div>
      </nav>
    );
  }

  // Regular view: Logo + Import Data + Actions
  return (
    <nav className="bg-white border border-slate-200 rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 md:p-5">
        {/* Left side: Logo + Import Data */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.push("/")}
            className="hover:opacity-70 transition-opacity flex-shrink-0"
          >
            <BimahLogoWithText
              logoSize={24}
              textClassName="font-mono text-xl md:text-2xl tracking-tight text-[#1886d9]"
            />
          </button>

          <Button
            variant="ghost"
            onClick={() => router.push("/import")}
            className="rounded-lg hover:bg-slate-100 text-slate-700 hover:text-slate-900"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Data
          </Button>
        </div>

        {/* Right side: Actions */}
        <div className="flex gap-2 flex-wrap">
          {/* Recently Published Dropdown */}
          {recentDashboards.length > 0 && (
            <div className="relative">
              <Button
                onClick={() => setRecentDropdownOpen(!recentDropdownOpen)}
                variant="outline"
                className="whitespace-nowrap rounded-lg"
              >
                <Clock className="h-4 w-4 md:mr-2" />
                <span className="hidden sm:inline">Recently Published</span>
                <span className="sm:hidden">Recent</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
              {recentDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setRecentDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
                    <div className="p-2">
                      {recentDashboards.map((dashboard) => (
                        <div
                          key={dashboard.reportId}
                          className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{dashboard.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(dashboard.publishedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={(e) => handleCopy(dashboard, e)}
                              className="p-2 hover:bg-slate-100 rounded"
                              title="Copy link"
                            >
                              {copiedId === dashboard.reportId ? (
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-gray-600" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                window.open(dashboard.url, '_blank');
                                setRecentDropdownOpen(false);
                              }}
                              className="p-2 hover:bg-slate-100 rounded"
                              title="Open"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {showExport && onExport && (
            <Button
              onClick={onExport}
              className="whitespace-nowrap rounded-lg bg-[#e6aa0f] hover:bg-[#c98109] text-white"
            >
              <Download className="h-4 w-4 md:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}

          {showPublish && onPublish && (
            <Button
              onClick={onPublish}
              className="whitespace-nowrap rounded-lg bg-[#1886d9] hover:bg-[#0e69bb] text-white"
            >
              <Share2 className="h-4 w-4 md:mr-2" />
              <span className="hidden sm:inline">Publish</span>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
