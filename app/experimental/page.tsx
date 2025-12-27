"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical } from "lucide-react";
import { AppNav } from "@/components/ui/AppNav";
import { ExperimentalNotice, ExperimentalSectionNav } from "@/components/experimental/ExperimentalNav";

const STORAGE_KEY = "experimental-acknowledged";

export default function ExperimentalPage() {
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setAcknowledged(stored === "true");
  }, []);

  const handleAcknowledge = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setAcknowledged(true);
  };

  // Still loading
  if (acknowledged === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Gate: show acknowledgement screen
  if (!acknowledged) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-8">
        <div className="max-w-md mx-auto mt-24">
          <Card className="border border-slate-200 shadow-lg">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-3 p-3 rounded-full bg-amber-50">
                <FlaskConical className="h-8 w-8 text-amber-500" />
              </div>
              <CardTitle className="text-xl font-semibold text-slate-800">
                Experimental Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 text-center">
                These insights and forecasts are still in development.
                Results may be incomplete and should be verified independently.
              </p>

              <Button
                onClick={handleAcknowledge}
                className="w-full bg-[#1886d9] hover:bg-[#1470b8]"
              >
                Continue
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="w-full"
              >
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Acknowledged: show sub-tabs
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/20 to-orange-50/10 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-5 md:space-y-6">
        <AppNav />

        {/* Navigation Tabs */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-2">
          <div className="flex gap-1">
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-colors text-slate-600 hover:bg-slate-100"
            >
              Dashboard
            </button>
            <button
              className="px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-amber-500 text-white flex items-center gap-1.5"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Experimental
            </button>
          </div>
        </div>

        <ExperimentalNotice />
        <ExperimentalSectionNav />
      </div>
    </div>
  );
}
