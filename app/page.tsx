"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Sparkles, Lock, BarChart3, Share2, ArrowRight } from "lucide-react";
import { generateDemoData } from "@/lib/demo/generate-demo";
import { enrichRows } from "@/lib/math/calculations";
import { RecentDashboards } from "@/components/RecentDashboards";

export default function HomePage() {
  const router = useRouter();

  const handleLaunchDemo = () => {
    const demoData = generateDemoData();
    const enrichedData = enrichRows("demo", demoData);
    sessionStorage.setItem("pledgeData", JSON.stringify(enrichedData));
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="80" height="80">
                <path d="M0,120 L200,120 L180,160 L20,160 Z" fill="#0F2C73"/>
                <path d="M20,80 L180,80 L160,120 L40,120 Z" fill="#3C78FF"/>
              </svg>
            </div>

            {/* Title */}
            <div className="mb-4">
              <h1 className="font-space text-7xl md:text-8xl font-bold text-[#0F2C73] mb-2">
                Bimah
              </h1>
              <div className="inline-block bg-white/60 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-200">
                <div className="flex items-center justify-center gap-2 text-xl text-gray-400">
                  <span>/ bee-mah /</span>
                  <span className="text-xs">•</span>
                  <span className="text-2xl">בִּימָה</span>
                  <span className="text-xs">•</span>
                  <span>platform</span>
                </div>
              </div>
            </div>

            {/* Tagline */}
            <div className="max-w-4xl mx-auto mb-16 mt-10">
              <h2 className="font-space text-4xl md:text-5xl font-semibold text-[#0F2C73] mb-8 leading-tight">
                Analytics for Synagogues
              </h2>

              <p className="text-xl md:text-2xl text-gray-700 leading-relaxed mb-10 max-w-2xl mx-auto">
                Upload your data. Explore insights. Share dashboards.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
                <Button
                  onClick={() => router.push("/import")}
                  size="lg"
                  className="w-full sm:w-auto bg-[#3C78FF] hover:bg-[#2C68EF] text-white text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Your Data
                </Button>
                <Button
                  onClick={handleLaunchDemo}
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-2 border-[#3C78FF] text-[#3C78FF] hover:bg-[#3C78FF] hover:text-white text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Launch Demo Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>

              <p className="text-sm text-gray-500">
                No signup • Instant access • Works in your browser
              </p>
            </div>
          </div>

          {/* Recent Dashboards - Above feature cards for visibility */}
          <div className="mt-16 max-w-5xl mx-auto">
            <RecentDashboards />
          </div>

          {/* Feature Cards - Angled like old design */}
          <div className="mt-20 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
              {/* Privacy-First */}
              <div
                className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform -rotate-2 hover:scale-105 hover:rotate-0"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Lock className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Privacy-First</h3>
                <p className="text-gray-600 text-sm">
                  Your data stays in your browser. Optionally publish anonymized dashboards—no names, ever.
                </p>
              </div>

              {/* Insights */}
              <div
                className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform rotate-2 hover:scale-105 hover:rotate-0"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Powerful Insights</h3>
                <p className="text-gray-600 text-sm">
                  Interactive charts, filters, and analytics to understand patterns and demographics.
                </p>
              </div>

              {/* Shareable */}
              <div
                className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform -rotate-2 hover:scale-105 hover:rotate-0"
              >
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <Share2 className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Easy Sharing</h3>
                <p className="text-gray-600 text-sm">
                  Publish secure dashboards with a single click. Share the link with your board—no login required.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
