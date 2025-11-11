"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface DeleteDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  dashboardTitle: string;
}

export function DeleteDashboardModal({ isOpen, onClose, reportId, dashboardTitle }: DeleteDashboardModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  if (!isOpen) return null;

  const isConfirmed = confirmText === "permanently delete";

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete dashboard");
      }

      // Clear sessionStorage
      sessionStorage.removeItem("pledgeData");
      sessionStorage.removeItem("publishedReportMetadata");

      // Remove from recent dashboards
      const recentDashboards = JSON.parse(localStorage.getItem("recentDashboards") || "[]");
      const updated = recentDashboards.filter((d: any) => d.reportId !== reportId);
      localStorage.setItem("recentDashboards", JSON.stringify(updated));

      // Redirect to home
      router.push("/");
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete dashboard. Please try again.");
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Delete Dashboard?</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isDeleting}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Warning Message */}
          <div className="mb-6 space-y-3">
            <p className="text-gray-700">
              You are about to permanently delete:
            </p>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="font-semibold text-gray-900">{dashboardTitle}</p>
            </div>
            <p className="text-sm text-red-600 font-medium">
              ⚠️ This action cannot be undone. All data will be permanently deleted.
            </p>
          </div>

          {/* Confirmation Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">permanently delete</span> to confirm:
            </label>
            <Input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="permanently delete"
              className="w-full"
              disabled={isDeleting}
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={isDeleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={!isConfirmed || isDeleting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Dashboard"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
