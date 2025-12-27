"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { X, Lock, Upload, Check, Copy, ExternalLink, Loader2, Globe, AlertCircle, Eye, EyeOff } from "lucide-react";
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
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handlePublish = async () => {
    // Validate title
    if (!title.trim()) {
      setTitleError("Please enter a title for your dashboard");
      return;
    }
    setTitleError("");

    // Validate password if enabled
    if (enablePassword && password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    setPasswordError("");

    setIsPublishing(true);

    try {
      // Get synagogue location from localStorage if it exists
      const synagogueAddress = localStorage.getItem("bimah_bc_synagogue_address");
      const synagogueCoordsStr = localStorage.getItem("bimah_bc_synagogue_coords");
      let synagogueCoords = null;
      if (synagogueCoordsStr) {
        try {
          synagogueCoords = JSON.parse(synagogueCoordsStr);
        } catch (e) {
          console.error("Failed to parse synagogue coords:", e);
        }
      }

      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          snapshotDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
          rows: data,
          synagogueAddress: synagogueAddress || undefined,
          synagogueLat: synagogueCoords?.lat || undefined,
          synagogueLng: synagogueCoords?.lon || undefined,
          password: enablePassword ? password : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to publish dashboard");
      }

      const result = await response.json();
      setReportUrl(result.url);
      setIsPasswordProtected(result.isPasswordProtected);
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
    setEnablePassword(false);
    setPassword("");
    setPasswordError("");
    setIsPasswordProtected(false);
    onClose();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    if (titleError) setTitleError(""); // Clear error when user starts typing
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4">
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
              {/* Dashboard Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dashboard Title <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="e.g., FY25 Annual Report"
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

              {/* Password Protection Toggle - Inline style */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Password protect</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEnablePassword(!enablePassword);
                      if (!enablePassword) {
                        setPasswordError("");
                      }
                    }}
                    disabled={isPublishing}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      enablePassword ? "bg-[#1886d9]" : "bg-gray-300"
                    } ${isPublishing ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        enablePassword ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Password Input */}
                {enablePassword && (
                  <div className="mt-3 pl-6">
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (passwordError) setPasswordError("");
                        }}
                        placeholder="Enter password (min 8 characters)"
                        className={`w-full pr-10 ${passwordError ? "border-red-500" : ""}`}
                        maxLength={100}
                        disabled={isPublishing}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={isPublishing}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {passwordError && (
                      <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>{passwordError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Divider */}
              <hr className="my-4 border-gray-200" />

              {/* Summary info - compact */}
              <div className="mb-4 text-sm text-gray-600 space-y-2">
                <p><strong>{data.length}</strong> households · <strong>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></p>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Your link will look like:</p>
                  <p className="font-mono text-xs text-gray-700">
                    {typeof window !== 'undefined' ? window.location.host : 'your-domain.com'}/<span className="text-blue-600">xK9mP2qR8tBvN5hZ</span>
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  {enablePassword
                    ? "Anyone with the link and password can view"
                    : "Anyone with the link can view"
                  }
                </p>
              </div>

              {/* What Gets Shared - Collapsed by default */}
              <details className="mb-4">
                <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700">
                  What data gets shared?
                </summary>
                <div className="mt-2 text-xs text-gray-600 space-y-1 pl-2">
                  <p><span className="text-green-600">Shared:</span> Pledge amounts, ages, ZIP codes</p>
                  <p><span className="text-red-600">Never shared:</span> Names, addresses, emails</p>
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
                    {isPasswordProtected ? (
                      <Lock className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Globe className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">
                        {isPasswordProtected
                          ? "Password protected"
                          : "Anyone with the link can view"
                        }
                      </p>
                      <p className="text-sm text-gray-600">
                        {isPasswordProtected
                          ? "Share the link and password separately with people who need access."
                          : "Share this link via email, Slack, or any messaging app. No password needed."
                        }
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
