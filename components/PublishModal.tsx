"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { X, Lock, Upload, Check, Copy, ExternalLink, Loader2, Globe, Shield, AlertCircle } from "lucide-react";
import type { RawRow } from "@/lib/schema/types";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: RawRow[];
}

export function PublishModal({ isOpen, onClose, data }: PublishModalProps) {
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [reportUrl, setReportUrl] = useState("");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handlePublish = async () => {
    // Validate title
    if (!title.trim()) {
      setTitleError("Please enter a title for your dashboard");
      return;
    }
    setTitleError("");

    setIsPublishing(true);

    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          snapshotDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
          rows: data,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to publish dashboard");
      }

      const result = await response.json();
      setReportUrl(result.url);
      setPublished(true);

      // Store in recent dashboards (localStorage)
      const recentDashboards = JSON.parse(localStorage.getItem("recentDashboards") || "[]");
      recentDashboards.unshift({
        title: title.trim(),
        url: result.url,
        reportId: result.reportId,
        publishedAt: new Date().toISOString(),
      });
      // Keep only last 10
      localStorage.setItem("recentDashboards", JSON.stringify(recentDashboards.slice(0, 10)));
    } catch (error) {
      console.error("Publishing error:", error);
      alert("Failed to publish dashboard. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(reportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setTitle("");
    setTitleError("");
    setPublished(false);
    setReportUrl("");
    setCopied(false);
    onClose();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    if (titleError) setTitleError(""); // Clear error when user starts typing
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {published ? "Dashboard Published!" : "Publish Dashboard"}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {!published ? (
            <>
              {/* Who Can Access - Like Google Drive */}
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 mb-1">Anyone with the link</p>
                    <p className="text-sm text-gray-600">
                      Anyone who has the link will be able to view this dashboard. No password or login required.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dashboard Title */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dashboard Title <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="e.g., FY25 Pledge Dashboard"
                  className={`w-full ${titleError ? "border-red-500" : ""}`}
                  maxLength={200}
                  disabled={isPublishing}
                />
                {titleError && (
                  <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>{titleError}</span>
                  </div>
                )}
              </div>

              {/* Snapshot Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Snapshot Date:</strong> {new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  <strong>Total Households:</strong> {data.length}
                </p>
              </div>

              {/* URL Example */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-700">
                    <p className="font-semibold mb-2">Your shareable link will look like:</p>
                    <p className="font-mono text-xs bg-white px-3 py-2 rounded border border-gray-200 mb-3">
                      bethchaim.bimah.org/<span className="text-blue-600">xK9mP2qR8tBvN5hZ7wLcJ</span>
                    </p>
                    <ul className="space-y-1 text-gray-600">
                      <li>✓ <strong>Secure:</strong> Impossible to guess (21 random characters)</li>
                      <li>✓ <strong>Private:</strong> Not listed in search engines like Google</li>
                      <li>✓ <strong>Anonymous data only:</strong> No names or personal info</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* What Gets Shared - Collapsed by default */}
              <details className="mb-6">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  What data gets uploaded?
                </summary>
                <div className="mt-3 ml-6 text-sm text-gray-600 space-y-2">
                  <div>
                    <p className="font-medium text-green-700">✓ SHARED:</p>
                    <ul className="list-disc list-inside ml-2">
                      <li>Pledge amounts ($1,800, $3,600, etc.)</li>
                      <li>Age groups (45, 62, etc.)</li>
                      <li>ZIP codes (if you included them)</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-red-700">✗ NEVER SHARED:</p>
                    <ul className="list-disc list-inside ml-2">
                      <li>Names</li>
                      <li>Full addresses</li>
                      <li>Email or phone numbers</li>
                    </ul>
                  </div>
                </div>
              </details>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  disabled={isPublishing}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="flex-1 bg-[#1886d9] hover:bg-[#0e69bb]"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Publish Dashboard
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="mb-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                </div>

                <h3 className="text-center text-xl font-semibold text-gray-900 mb-2">
                  Dashboard Published!
                </h3>

                {/* Save this link */}
                <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Save this link somewhere safe (email it to yourself, save in a doc, etc).</strong> This browser will remember it under "Recently Published", but only on this computer.
                  </p>
                </div>

                {/* Link with Copy Button - Prominent */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Your Shareable Link
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={reportUrl}
                      readOnly
                      onClick={(e) => e.currentTarget.select()}
                      className="flex-1 font-mono text-sm"
                    />
                    <Button
                      onClick={handleCopyLink}
                      className={`whitespace-nowrap ${copied ? "bg-green-600 hover:bg-green-700" : "bg-[#1886d9] hover:bg-[#0e69bb]"}`}
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Access Info */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-6">
                  <div className="flex items-start gap-3">
                    <Globe className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">Anyone with the link can view</p>
                      <p className="text-sm text-gray-600">
                        Share this link via email, Slack, or any messaging app. No password needed.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleClose}
                    variant="outline"
                    className="flex-1"
                  >
                    Done
                  </Button>
                  <Button
                    onClick={() => window.open(reportUrl, '_blank')}
                    variant="outline"
                    className="flex-1"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Dashboard
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
