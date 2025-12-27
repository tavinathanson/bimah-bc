"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { getFileHeaders, parseFile, previewFile, guessColumnMapping } from "@/lib/parsing/parser";
import { detectShulCloudFormat, parseShulCloudFile, combineShulCloudResults, type ShulCloudDetectionResult, type ShulCloudParseResult } from "@/lib/parsing/shulcloud-parser";
import type { ColumnMapping, ParsedFile, ImportFormat } from "@/lib/schema/types";
import { enrichRows } from "@/lib/math/calculations";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { AppNav } from "@/components/ui/AppNav";
import { generateDemoData } from "@/lib/demo/generate-demo";
import { RecentDashboards } from "@/components/RecentDashboards";

interface FileState {
  file: File;
  status: "pending" | "mapping" | "validated" | "error";
  headers: string[];
  mapping?: ColumnMapping;
  parsed?: ParsedFile;
  preview?: Record<string, unknown>[];
  // ShulCloud-specific
  shulcloudResult?: ShulCloudParseResult;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileState[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState<number | null>(null);
  const [importFormat, setImportFormat] = useState<ImportFormat | null>(null);
  const [formatDetection, setFormatDetection] = useState<ShulCloudDetectionResult | null>(null);
  const [showFormatConfirmation, setShowFormatConfirmation] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const router = useRouter();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      // Get headers from first file to detect format
      const firstFile = acceptedFiles[0];
      const headers = await getFileHeaders(firstFile);
      const detection = detectShulCloudFormat(headers);

      // If format already set, check for mixing
      if (importFormat !== null) {
        const isNewFileShulCloud = detection.confidence === "high";
        const formatMismatch =
          (importFormat === "shulcloud" && !isNewFileShulCloud) ||
          (importFormat === "standard" && isNewFileShulCloud);

        if (formatMismatch) {
          // Show error - can't mix formats
          alert(
            `You've already added files in ${importFormat === "shulcloud" ? "ShulCloud Transactions" : "standard"} format. ` +
            `Please use the same format or start over.`
          );
          return;
        }
      }

      // If no format set yet, detect and potentially confirm
      if (importFormat === null) {
        if (detection.confidence === "high") {
          // ShulCloud detected - ask for confirmation
          setFormatDetection(detection);
          setPendingFiles(acceptedFiles);
          setShowFormatConfirmation(true);
          return;
        } else if (detection.confidence === "partial") {
          // Almost looks like ShulCloud - show warning
          setFormatDetection(detection);
          setPendingFiles(acceptedFiles);
          setShowFormatConfirmation(true);
          return;
        } else {
          // Standard format
          setImportFormat("standard");
        }
      }

      // Process files based on format
      if (importFormat === "shulcloud") {
        await processFilesAsShulCloud(acceptedFiles);
      } else {
        await processFilesAsStandard(acceptedFiles);
      }
    },
  });

  // Process files as standard format
  const processFilesAsStandard = async (acceptedFiles: File[]) => {
    const newFiles = await Promise.all(
      acceptedFiles.map(async (file) => {
        const headers = await getFileHeaders(file);
        const preview = await previewFile(file, 25);
        const guessedMapping = guessColumnMapping(headers);

        return {
          file,
          status: "mapping" as const,
          headers,
          preview,
          mapping: guessedMapping as ColumnMapping,
        };
      })
    );

    setFiles((prev) => [...prev, ...newFiles]);
    if (newFiles.length > 0 && currentFileIndex === null) {
      setCurrentFileIndex(files.length);
    }
  };

  // Process files as ShulCloud format
  const processFilesAsShulCloud = async (acceptedFiles: File[]) => {
    const newFiles = await Promise.all(
      acceptedFiles.map(async (file) => {
        const headers = await getFileHeaders(file);
        const preview = await previewFile(file, 25);
        const result = await parseShulCloudFile(file);

        return {
          file,
          status: (result.errors.length === 0 ? "validated" : "error") as "validated" | "error",
          headers,
          preview,
          shulcloudResult: result,
          // Create a pseudo-parsed structure for compatibility
          parsed: {
            fileName: file.name,
            rows: result.rows,
            errors: result.errors,
          },
        };
      })
    );

    setFiles((prev) => [...prev, ...newFiles]);
    if (newFiles.length > 0 && currentFileIndex === null) {
      setCurrentFileIndex(files.length);
    }
  };

  // Handle format confirmation
  const handleConfirmShulCloud = async () => {
    setImportFormat("shulcloud");
    setShowFormatConfirmation(false);
    await processFilesAsShulCloud(pendingFiles);
    setPendingFiles([]);
    setFormatDetection(null);
  };

  const handleConfirmStandard = async () => {
    setImportFormat("standard");
    setShowFormatConfirmation(false);
    await processFilesAsStandard(pendingFiles);
    setPendingFiles([]);
    setFormatDetection(null);
  };

  const handleCancelConfirmation = () => {
    setShowFormatConfirmation(false);
    setPendingFiles([]);
    setFormatDetection(null);
  };

  const handleResetFormat = async () => {
    // Get the raw files from current state
    const rawFiles = files.map((f) => f.file);

    // Clear format and files
    setImportFormat(null);
    setFiles([]);
    setCurrentFileIndex(null);
    setFormatDetection(null);
    setShowFormatConfirmation(false);
    setPendingFiles([]);

    // If we have files, re-trigger format detection with them
    if (rawFiles.length > 0) {
      // Small delay to ensure state is cleared
      setTimeout(async () => {
        const firstFile = rawFiles[0];
        const headers = await getFileHeaders(firstFile);
        const detection = detectShulCloudFormat(headers);

        if (detection.confidence === "high" || detection.confidence === "partial") {
          setFormatDetection(detection);
          setPendingFiles(rawFiles);
          setShowFormatConfirmation(true);
        } else {
          // Standard format - process directly
          setImportFormat("standard");
          await processFilesAsStandard(rawFiles);
        }
      }, 0);
    }
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    if (currentFileIndex === null) return;

    setFiles((prev) => {
      const updated = [...prev];
      const current = updated[currentFileIndex];
      if (!current) return prev;

      updated[currentFileIndex] = {
        ...current,
        mapping: {
          ...current.mapping,
          [field]: value,
        } as ColumnMapping,
      };
      return updated;
    });
  };

  const handleValidate = async () => {
    if (currentFileIndex === null) return;

    const fileState = files[currentFileIndex];
    if (!fileState || !fileState.mapping) return;

    const parsed = await parseFile(fileState.file, fileState.mapping);

    setFiles((prev) => {
      const updated = [...prev];
      updated[currentFileIndex] = {
        ...fileState,
        parsed,
        status: parsed.errors.length === 0 ? "validated" : "error",
      };
      return updated;
    });
  };

  const handleContinue = () => {
    // Combine all validated files and store in sessionStorage
    const validatedFiles = files.filter((f) => f.status === "validated" || (f.status === "error" && f.shulcloudResult && f.shulcloudResult.errors.length === 0));

    let allRows;

    if (importFormat === "shulcloud") {
      // For ShulCloud, combine results across all files
      const shulcloudResults = validatedFiles
        .map((f) => f.shulcloudResult)
        .filter((r): r is ShulCloudParseResult => r !== undefined);

      const combined = combineShulCloudResults(shulcloudResults);

      if (combined.error) {
        alert(combined.error);
        return;
      }

      allRows = enrichRows("ShulCloud Import", combined.rows);
    } else {
      // Standard import
      allRows = validatedFiles.flatMap((f) =>
        enrichRows(f.file.name, f.parsed!.rows)
      );
    }

    sessionStorage.setItem("pledgeData", JSON.stringify(allRows));
    // Clear saved filters when new data is imported
    sessionStorage.removeItem("dashboardFilters");
    router.push("/dashboard");
  };

  const handleDemoData = () => {
    // Generate demo data and go straight to dashboard
    const demoRows = generateDemoData(500);
    const enrichedRows = enrichRows("Demo Data", demoRows);
    sessionStorage.setItem("pledgeData", JSON.stringify(enrichedRows));
    // Clear saved filters when demo data is loaded
    sessionStorage.removeItem("dashboardFilters");
    router.push("/dashboard");
  };

  const currentFile = currentFileIndex !== null ? files[currentFileIndex] : null;
  const allValidated = files.length > 0 && files.every((f) => f.status === "validated");

  // For ShulCloud: compute combined validation across all files
  const shulcloudCombined = importFormat === "shulcloud" && files.length > 0
    ? (() => {
        const results = files
          .map((f) => f.shulcloudResult)
          .filter((r): r is ShulCloudParseResult => r !== undefined);
        if (results.length === 0) return null;
        return combineShulCloudResults(results);
      })()
    : null;

  const shulcloudReady = shulcloudCombined && !shulcloudCombined.error && shulcloudCombined.rows.length > 0;
  const canContinue = importFormat === "shulcloud" ? shulcloudReady : allValidated;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-5 md:space-y-6">
        <AppNav hideRecentDashboards />

        {/* Privacy Notice */}
        <div className="bg-gradient-to-r from-green-50/90 to-emerald-50/70 border border-green-200/60 rounded-lg p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className="text-sm text-green-900">
              <strong className="font-semibold">Your data stays private:</strong> All processing happens in your browser. Nothing is uploaded unless you choose to publish with anonymized data only.
            </div>
          </div>
        </div>

        {/* Recent Dashboards */}
        <RecentDashboards />

        {files.length === 0 ? (
          /* Format Confirmation Dialog - replaces drag & drop when detected */
          showFormatConfirmation && formatDetection ? (
          <Card className="border-0 shadow-lg shadow-blue-100/50 bg-white/70 backdrop-blur-sm">
            <CardContent className="p-6">
              {formatDetection.confidence === "high" ? (
                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-slate-900">ShulCloud Transactions Export Detected</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        This file looks like a ShulCloud Transactions export. We&apos;ll automatically extract Hineini pledges and group them by account.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={handleConfirmStandard}>
                      Use Standard Import
                    </Button>
                    <Button onClick={handleConfirmShulCloud} className="bg-[#1886d9] hover:bg-[#0e69bb]">
                      Yes, Import as ShulCloud Transactions
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-slate-900">Partial ShulCloud Match</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        This file looks similar to a ShulCloud export but is missing some expected columns:
                      </p>
                      <ul className="text-sm text-slate-600 mt-2 list-disc list-inside">
                        {formatDetection.missingColumns.map((col) => (
                          <li key={col}>{col}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={handleCancelConfirmation}>
                      Cancel
                    </Button>
                    <Button variant="outline" onClick={handleConfirmStandard}>
                      Use Standard Import
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-lg shadow-blue-100/50 bg-white/70 backdrop-blur-sm">
            <CardContent className="p-6 space-y-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                  isDragActive
                    ? "border-blue-500 bg-blue-50/50 shadow-sm"
                    : "border-slate-300 hover:border-blue-400 hover:bg-blue-50/30"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-base font-medium mb-1">
                  {isDragActive ? "Drop files here" : "Drag & drop files here"}
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports .xlsx and .csv files
                </p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-muted-foreground/25" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <div className="text-center">
                <Button
                  onClick={handleDemoData}
                  variant="outline"
                  size="lg"
                  className="gap-2 rounded-lg border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                >
                  <Sparkles className="h-4 w-4" />
                  Try Demo with Sample Data
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Explore with 500 realistic sample records
                </p>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm md:text-base">Files</h2>
                {importFormat && (
                  <button
                    onClick={handleResetFormat}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Change format
                  </button>
                )}
              </div>
              {importFormat && (
                <div className="text-xs text-muted-foreground bg-slate-100 rounded px-2 py-1">
                  Format: {importFormat === "shulcloud" ? "ShulCloud Transactions" : "Standard"}
                </div>
              )}
              {files.map((f, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentFileIndex(idx)}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                    currentFileIndex === idx
                      ? "border-blue-500 bg-blue-50/50 shadow-sm ring-2 ring-blue-400/30"
                      : "border-slate-200 hover:border-blue-400 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <FileSpreadsheet className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{f.file.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {f.status === "validated" && importFormat === "shulcloud" && f.shulcloudResult?.yearsFound.length === 1 ? (
                          <>
                            <svg className="h-3.5 w-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs text-amber-600">FY{f.shulcloudResult.yearsFound[0]} only</span>
                          </>
                        ) : f.status === "validated" ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-xs text-green-600">Ready</span>
                          </>
                        ) : null}
                        {f.status === "error" && (
                          <>
                            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                            <span className="text-xs text-destructive">Errors</span>
                          </>
                        )}
                        {f.status === "mapping" && (
                          <span className="text-xs text-muted-foreground">Needs mapping</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {/* Add more files - smaller when we have combined status */}
              {!(importFormat === "shulcloud" && shulcloudCombined) && (
                <div
                  {...getRootProps()}
                  className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all duration-200 border-slate-300"
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Add more files</p>
                </div>
              )}

              {/* ShulCloud Combined Status - in sidebar */}
              {importFormat === "shulcloud" && shulcloudCombined && (
                <div className="space-y-2 pt-2">
                  {shulcloudCombined.error ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-amber-900 text-sm">
                          <strong className="block">Need Another Year</strong>
                          <p className="text-xs mt-1 text-amber-800">
                            {shulcloudCombined.allYears.length === 1
                              ? `Only FY${shulcloudCombined.allYears[0]} found`
                              : "Need 2 fiscal years"
                            }
                          </p>
                        </div>
                      </div>
                      <div {...getRootProps()} className="mt-3">
                        <input {...getInputProps()} />
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          <Upload className="h-3 w-3 mr-1.5" />
                          Add Another File
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="text-green-900 text-sm">
                          <strong className="block">Ready to Analyze</strong>
                          <p className="text-xs mt-1 text-green-800">
                            {shulcloudCombined.totalAccounts} households
                            <br />
                            FY{shulcloudCombined.allYears.join(" & FY")}
                          </p>
                        </div>
                      </div>
                      <Button onClick={handleContinue} size="sm" className="w-full mt-3 text-xs bg-[#1886d9] hover:bg-[#0e69bb]">
                        Continue to Dashboard →
                      </Button>
                      <div {...getRootProps()} className="mt-2">
                        <input {...getInputProps()} />
                        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                          <Upload className="h-3 w-3 mr-1.5" />
                          Add more files
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Standard Import - Continue button in sidebar */}
              {importFormat === "standard" && allValidated && (
                <div className="pt-2">
                  <Button onClick={handleContinue} size="sm" className="w-full text-xs bg-[#1886d9] hover:bg-[#0e69bb]">
                    Continue to Dashboard →
                  </Button>
                </div>
              )}
            </div>

            <div className="lg:col-span-3">
              {currentFile && (
                <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="text-lg md:text-xl font-bold text-slate-800 truncate">
                      {importFormat === "shulcloud" ? "ShulCloud Transactions: " : "Configure: "}{currentFile.file.name}
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm font-medium text-slate-500">
                      {importFormat === "shulcloud"
                        ? "Automatically extracting Hineini pledges"
                        : "Map columns to required fields"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 md:space-y-6">
                    {/* ShulCloud Mode - Show status info */}
                    {importFormat === "shulcloud" && currentFile.shulcloudResult && (
                      <div className="space-y-3">
                        {/* Single year case - needs more data */}
                        {currentFile.shulcloudResult.yearsFound.length === 1 && currentFile.shulcloudResult.accountCount > 0 && (
                          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-amber-900">
                              <strong>Found {currentFile.shulcloudResult.accountCount} accounts</strong> with Hineini pledges for FY{currentFile.shulcloudResult.yearsFound[0]}
                              <p className="mt-1 text-amber-800">
                                To compare year-to-year, add another file containing a different fiscal year.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Multiple years in this file - show success */}
                        {currentFile.shulcloudResult.yearsFound.length >= 2 && currentFile.shulcloudResult.errors.length === 0 && (
                          <>
                            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                              <FileSpreadsheet className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="text-blue-900">
                                <strong>Fiscal years found:</strong> {currentFile.shulcloudResult.yearsFound.join(", ")}
                                <span className="text-blue-700 ml-2">
                                  (Using {currentFile.shulcloudResult.yearsFound[0]} as current, {currentFile.shulcloudResult.yearsFound[1]} as prior)
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <div className="text-green-900">
                                <strong>{currentFile.shulcloudResult.rows.length} households</strong> ready to analyze from {currentFile.shulcloudResult.accountCount} accounts
                              </div>
                            </div>
                          </>
                        )}

                        {/* Summing explanation - show when we have account data */}
                        {currentFile.shulcloudResult.accountCount > 0 && currentFile.shulcloudResult.errors.length === 0 && (
                          <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                            <svg className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-slate-700">
                              {currentFile.shulcloudResult.hasNegativeValues ? (
                                <>All transactions (including credits/refunds) are summed per account per fiscal year.</>
                              ) : (
                                <>Multiple transactions per account are summed together for each fiscal year.</>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Standard Mode - Show smart mapping notice */}
                    {importFormat !== "shulcloud" && (currentFile.mapping?.age || currentFile.mapping?.dob || currentFile.mapping?.pledgeCurrent || currentFile.mapping?.pledgePrior) && (
                      <div className="flex items-start gap-2 p-3 bg-[#fcf7c5] border border-[#f2c41e] rounded-lg text-sm">
                        <Sparkles className="h-4 w-4 text-[#c98109] mt-0.5 flex-shrink-0" />
                        <div className="text-[#401e09]">
                          <strong>Smart mapping applied!</strong> We auto-detected some columns. Please verify they&apos;re correct.
                        </div>
                      </div>
                    )}

                    {/* Standard Mode - Column Mapping UI */}
                    {importFormat !== "shulcloud" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Age / Date of Birth
                        </label>
                        <Select
                          value={currentFile.mapping?.age || currentFile.mapping?.dob || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            const header = value.toLowerCase();

                            // Smart detection: check if this looks like a DOB column
                            const isDOB = /^(dob|date\s*of\s*birth|birth\s*date|birthday|birth\s*day|bdate)$/i.test(header);

                            if (isDOB) {
                              handleMappingChange("dob", value);
                              handleMappingChange("age", "");
                            } else {
                              handleMappingChange("age", value);
                              handleMappingChange("dob", "");
                            }
                          }}
                        >
                          <option value="">Select column...</option>
                          {currentFile.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          ZIP Code <span className="text-muted-foreground">(optional)</span>
                        </label>
                        <Select
                          value={currentFile.mapping?.zipCode || ""}
                          onChange={(e) => handleMappingChange("zipCode", e.target.value)}
                        >
                          <option value="">Select column...</option>
                          {currentFile.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Current FY Pledge</label>
                        <Select
                          value={currentFile.mapping?.pledgeCurrent || ""}
                          onChange={(e) => handleMappingChange("pledgeCurrent", e.target.value)}
                        >
                          <option value="">Select column...</option>
                          {currentFile.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Prior FY Pledge</label>
                        <Select
                          value={currentFile.mapping?.pledgePrior || ""}
                          onChange={(e) => handleMappingChange("pledgePrior", e.target.value)}
                        >
                          <option value="">Select column...</option>
                          {currentFile.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    )}

                    {/* Standard Mode - Show validation results */}
                    {importFormat !== "shulcloud" && currentFile.parsed && (
                      <div className="space-y-4">
                        {currentFile.parsed.errors.length > 0 ? (
                          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="h-5 w-5 text-destructive" />
                              <h3 className="font-semibold text-destructive">
                                Validation Errors ({currentFile.parsed.errors.length})
                              </h3>
                            </div>
                            <div className="space-y-1 text-sm">
                              {currentFile.parsed.errors.slice(0, 10).map((err, idx) => (
                                <div key={idx}>
                                  {err.row > 0 ? `Row ${err.row}: ` : ""}{err.message}
                                </div>
                              ))}
                              {currentFile.parsed.errors.length > 10 && (
                                <div className="text-muted-foreground italic">
                                  ...and {currentFile.parsed.errors.length - 10} more errors
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                              <h3 className="font-semibold text-green-600">
                                File validated successfully
                              </h3>
                            </div>
                            <p className="text-sm mt-1">
                              {currentFile.parsed.rows.length} rows parsed
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ShulCloud Mode - Show errors if any */}
                    {importFormat === "shulcloud" && currentFile.shulcloudResult && currentFile.shulcloudResult.errors.length > 0 && (
                      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-5 w-5 text-destructive" />
                          <h3 className="font-semibold text-destructive">
                            Parsing Errors ({currentFile.shulcloudResult.errors.length})
                          </h3>
                        </div>
                        <div className="space-y-1 text-sm">
                          {currentFile.shulcloudResult.errors.slice(0, 10).map((err, idx) => (
                            <div key={idx}>
                              {err.row > 0 ? `Row ${err.row}: ` : ""}{err.message}
                            </div>
                          ))}
                          {currentFile.shulcloudResult.errors.length > 10 && (
                            <div className="text-muted-foreground italic">
                              ...and {currentFile.shulcloudResult.errors.length - 10} more errors
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Standard Mode - Validate Button */}
                    {importFormat !== "shulcloud" &&
                      (currentFile.mapping?.age || currentFile.mapping?.dob) &&
                      currentFile.mapping?.pledgeCurrent &&
                      currentFile.mapping?.pledgePrior &&
                      !currentFile.parsed && (
                        <div className="flex justify-end">
                          <Button onClick={handleValidate} size="lg" className="w-full sm:w-auto bg-[#1886d9] hover:bg-[#0e69bb] text-white rounded-lg">
                            Validate File →
                          </Button>
                        </div>
                      )}

                    {currentFile.preview && currentFile.preview.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Preview (first 5 rows)</h3>
                        <div className="rounded-lg border overflow-auto max-h-64">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                {Object.keys(currentFile.preview[0] || {}).map((key) => (
                                  <th key={key} className="text-left p-2 font-medium">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {currentFile.preview.slice(0, 5).map((row, idx) => (
                                <tr key={idx} className="border-t">
                                  {Object.entries(row).map(([key, val], colIdx) => {
                                    // Format the value for display
                                    let displayValue = String(val);

                                    // Check if this is a date column (either Excel serial or date string)
                                    if (typeof val === 'number' && val > 10000 && val < 100000) {
                                      // Likely an Excel date serial number
                                      const excelEpoch = new Date(1899, 11, 30);
                                      const date = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
                                      displayValue = date.toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit'
                                      });
                                    }

                                    return (
                                      <td key={colIdx} className="p-2">
                                        {displayValue}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Bottom action bar - secondary location for key actions */}
                    {importFormat === "shulcloud" && shulcloudCombined && (
                      <div className="pt-4 border-t">
                        {shulcloudCombined.error ? (
                          <div className="flex items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="text-amber-900 text-sm">
                              <strong>Need another fiscal year</strong> to enable year-to-year comparisons
                            </div>
                            <div {...getRootProps()}>
                              <input {...getInputProps()} />
                              <Button size="lg" className="bg-[#1886d9] hover:bg-[#0e69bb]">
                                <Upload className="h-4 w-4 mr-2" />
                                Add Another File
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="text-green-900 text-sm">
                              <strong>{shulcloudCombined.totalAccounts} households</strong> ready across FY{shulcloudCombined.allYears.join(" & FY")}
                            </div>
                            <Button onClick={handleContinue} size="lg" className="bg-[#1886d9] hover:bg-[#0e69bb]">
                              Continue to Dashboard →
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {importFormat === "standard" && allValidated && (
                      <div className="pt-4 border-t">
                        <div className="flex justify-end">
                          <Button onClick={handleContinue} size="lg" className="bg-[#1886d9] hover:bg-[#0e69bb]">
                            Continue to Dashboard →
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
