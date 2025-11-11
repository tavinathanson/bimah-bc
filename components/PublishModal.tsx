"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { X, Lock, Upload, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import type { RawRow } from "@/lib/schema/types";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: RawRow[];
}

export function PublishModal({ isOpen, onClose, data }: PublishModalProps) {
  const [title, setTitle] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [reportUrl, setReportUrl] = useState("");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handlePublish = async () => {
    if (!title.trim()) {
      alert("Please enter a title for your report");
      return;
    }

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
        throw new Error("Failed to publish report");
      }

      const result = await response.json();
      setReportUrl(result.url);
      setPublished(true);
    } catch (error) {
      console.error("Publishing error:", error);
      alert("Failed to publish report. Please try again.");
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
    setPublished(false);
    setReportUrl("");
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {published ? "Report Published!" : "Publish Report"}
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
              {/* Privacy Notice */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-700">
                    <p className="font-semibold mb-2">What gets shared when you publish?</p>

                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-green-700">✓ SHARED:</p>
                        <ul className="list-disc list-inside ml-2 text-gray-600">
                          <li>Pledge amounts ($1,800, $3,600, etc.)</li>
                          <li>Age groups (45-year-old, 62-year-old, etc.)</li>
                          <li>ZIP codes (if you included them)</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-medium text-red-700">✗ NEVER SHARED:</p>
                        <ul className="list-disc list-inside ml-2 text-gray-600">
                          <li>Names</li>
                          <li>Full addresses</li>
                          <li>Any other personal information</li>
                        </ul>
                      </div>
                    </div>

                    <p className="mt-3 text-gray-700">
                      Your published report will only show anonymous data needed for charts and statistics.
                      Individual donors cannot be identified from this data.
                    </p>
                  </div>
                </div>
              </div>

              {/* Report Details */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report Title
                  </label>
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., FY25 Pledge Report"
                    className="w-full"
                    maxLength={200}
                    disabled={isPublishing}
                  />
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
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
              </div>

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
                      Publish Report
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

                <p className="text-center text-gray-700 mb-6">
                  Your report has been published successfully! Share this link with your team.
                </p>

                <div className="p-4 bg-gray-50 rounded-lg mb-4">
                  <p className="text-xs text-gray-600 mb-2">Shareable Link:</p>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={reportUrl}
                      readOnly
                      className="flex-1 font-mono text-sm"
                    />
                    <Button
                      onClick={handleCopyLink}
                      variant="outline"
                      size="sm"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleClose}
                    variant="outline"
                    className="flex-1"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => window.open(reportUrl, '_blank')}
                    className="flex-1 bg-[#1886d9] hover:bg-[#0e69bb]"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Report
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
