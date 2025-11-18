"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { getFileHeaders, parseFile, previewFile, guessColumnMapping } from "@/lib/parsing/parser";
import { detectFormat, type FormatDetectionResult } from "@/lib/parsing/formatDetection";
import { parseTransactionFile, aggregateTransactionsToPledgeRows, getTransactionYears, type ParsedTransactions } from "@/lib/parsing/transactionParser";
import type { ColumnMapping, ParsedFile, Transaction } from "@/lib/schema/types";
import { enrichRows } from "@/lib/math/calculations";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Sparkles, Database, Calendar } from "lucide-react";
import { AppNav } from "@/components/ui/AppNav";
import { generateDemoData } from "@/lib/demo/generate-demo";
import { RecentDashboards } from "@/components/RecentDashboards";
import { AddressInput } from "@/components/geo/AddressInput";
import type { Coordinates } from "@/lib/geo/geocoding";

interface FileState {
  file: File;
  status: "pending" | "mapping" | "validated" | "error";
  headers: string[];
  mapping?: ColumnMapping;
  parsed?: ParsedFile;
  preview?: Record<string, unknown>[];
  // New fields for format detection
  formatDetection?: FormatDetectionResult;
  // Transaction-based data
  transactionData?: ParsedTransactions;
  selectedChargeTypes?: string[];
  selectedCurrentYear?: number;
  selectedPriorYear?: number;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileState[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState<number | null>(null);
  const [primaryGivingType, setPrimaryGivingType] = useState<string>("");
  const [synagogueAddress, setSynagogueAddress] = useState<string>("");
  const [synagogueCoords, setSynagogueCoords] = useState<Coordinates | null>(null);
  const router = useRouter();

  const handleAddressSelect = (address: string, coords: Coordinates) => {
    setSynagogueAddress(address);
    setSynagogueCoords(coords);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    onDrop: async (acceptedFiles) => {
      const newFiles = await Promise.all(
        acceptedFiles.map(async (file) => {
          const headers = await getFileHeaders(file);
          const preview = await previewFile(file, 25);
          const formatDetection = detectFormat(headers);

          // If ShulCloud format detected, parse as transactions
          if (formatDetection.format?.id === "shulcloud-transactions") {
            const transactionData = await parseTransactionFile(file);
            const years = getTransactionYears(transactionData.transactions);

            return {
              file,
              status: "mapping" as const,
              headers,
              preview,
              formatDetection,
              transactionData,
              selectedChargeTypes: transactionData.chargeTypes, // Default: all
              selectedCurrentYear: years[0], // Most recent
              selectedPriorYear: years[1], // Second most recent
            };
          }

          // Legacy format - use existing column guessing
          const guessedMapping = guessColumnMapping(headers);

          return {
            file,
            status: "mapping" as const,
            headers,
            preview,
            formatDetection,
            mapping: guessedMapping as ColumnMapping,
          };
        })
      );

      setFiles((prev) => [...prev, ...newFiles]);
      if (newFiles.length > 0 && currentFileIndex === null) {
        setCurrentFileIndex(files.length);
      }
    },
  });

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

  const handleChargeTypeToggle = (chargeType: string) => {
    if (currentFileIndex === null) return;

    setFiles((prev) => {
      const updated = [...prev];
      const current = updated[currentFileIndex];
      if (!current || !current.selectedChargeTypes) return prev;

      const newSelected = current.selectedChargeTypes.includes(chargeType)
        ? current.selectedChargeTypes.filter(ct => ct !== chargeType)
        : [...current.selectedChargeTypes, chargeType];

      updated[currentFileIndex] = {
        ...current,
        selectedChargeTypes: newSelected,
      };
      return updated;
    });
  };

  const handleYearChange = (field: "current" | "prior", value: number) => {
    if (currentFileIndex === null) return;

    setFiles((prev) => {
      const updated = [...prev];
      const current = updated[currentFileIndex];
      if (!current) return prev;

      updated[currentFileIndex] = {
        ...current,
        selectedCurrentYear: field === "current" ? value : current.selectedCurrentYear,
        selectedPriorYear: field === "prior" ? value : current.selectedPriorYear,
      };
      return updated;
    });
  };

  const handleValidate = async () => {
    if (currentFileIndex === null) return;

    const fileState = files[currentFileIndex];
    if (!fileState) return;

    // For transaction-based files
    if (fileState.transactionData) {
      const hasErrors = fileState.transactionData.errors.length > 0;
      const hasData = fileState.transactionData.transactions.length > 0;

      setFiles((prev) => {
        const updated = [...prev];
        updated[currentFileIndex] = {
          ...fileState,
          status: hasErrors ? "error" : (hasData ? "validated" : "error"),
        };
        return updated;
      });
      return;
    }

    // For legacy format
    if (!fileState.mapping) return;

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
    const validatedFiles = files.filter((f) => f.status === "validated");

    // Check if we have transaction data
    const hasTransactionData = validatedFiles.some(f => f.transactionData);

    if (hasTransactionData) {
      // Store raw transactions for flexible analysis in dashboard
      const txnFile = validatedFiles.find(f => f.transactionData);
      if (txnFile?.transactionData) {
        // Serialize transactions (convert dates to ISO strings)
        const serializedTransactions = txnFile.transactionData.transactions.map(t => ({
          ...t,
          date: t.date.toISOString(),
          primaryBirthday: t.primaryBirthday?.toISOString(),
          memberSince: t.memberSince?.toISOString(),
          joinDate: t.joinDate?.toISOString(),
        }));

        sessionStorage.setItem("transactionData", JSON.stringify(serializedTransactions));
        sessionStorage.setItem("dataSourceType", "transactions");
        sessionStorage.setItem("transactionMetadata", JSON.stringify({
          chargeTypes: txnFile.transactionData.chargeTypes,
          years: getTransactionYears(txnFile.transactionData.transactions),
          dateRange: txnFile.transactionData.dateRange ? {
            min: txnFile.transactionData.dateRange.min.toISOString(),
            max: txnFile.transactionData.dateRange.max.toISOString(),
          } : null,
          primaryGivingType: primaryGivingType || null,
        }));

        // Save synagogue address and coords to localStorage (persists across sessions)
        if (synagogueAddress.trim()) {
          localStorage.setItem("bimah_bc_synagogue_address", synagogueAddress.trim());
          if (synagogueCoords) {
            localStorage.setItem("bimah_bc_synagogue_coords", JSON.stringify(synagogueCoords));
          }
        }

        // Clear legacy data
        sessionStorage.removeItem("pledgeData");
      }
    } else {
      // Legacy format - aggregate and store as before
      let allRows: any[] = [];
      for (const f of validatedFiles) {
        if (f.parsed) {
          const enriched = enrichRows(f.file.name, f.parsed.rows);
          allRows = allRows.concat(enriched);
        }
      }

      sessionStorage.setItem("pledgeData", JSON.stringify(allRows));
      sessionStorage.setItem("dataSourceType", "legacy-pledges");

      // Clear transaction data
      sessionStorage.removeItem("transactionData");
      sessionStorage.removeItem("transactionMetadata");
    }

    // Clear saved filters when new data is imported
    sessionStorage.removeItem("dashboardFilters");
    router.push("/dashboard");
  };

  const handleDemoData = () => {
    const demoRows = generateDemoData(500);
    const enrichedRows = enrichRows("Demo Data", demoRows);
    sessionStorage.setItem("pledgeData", JSON.stringify(enrichedRows));
    sessionStorage.setItem("dataSourceType", "legacy-pledges");
    sessionStorage.removeItem("dashboardFilters");
    router.push("/dashboard");
  };

  const currentFile = currentFileIndex !== null ? files[currentFileIndex] : null;
  const allValidated = files.length > 0 && files.every((f) => f.status === "validated");

  // Check if current file is ready for validation
  const isReadyToValidate = currentFile && (
    // Transaction format: just needs data
    (currentFile.transactionData && currentFile.transactionData.transactions.length > 0) ||
    // Legacy format: has required mappings
    ((currentFile.mapping?.age || currentFile.mapping?.dob) &&
      currentFile.mapping?.pledgeCurrent &&
      currentFile.mapping?.pledgePrior)
  );

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
              <strong className="font-semibold">Your data stays private:</strong> All processing happens in your browser. Nothing is uploaded unless you choose to share, and only anonymized data is included.
            </div>
          </div>
        </div>

        {files.length === 0 ? (
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
                  Supports ShulCloud exports, .xlsx, and .csv files
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
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="space-y-2">
              <h2 className="font-semibold text-sm md:text-base">Files</h2>
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
                        {f.status === "validated" && (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-xs text-green-600">Validated</span>
                          </>
                        )}
                        {f.status === "error" && (
                          <>
                            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                            <span className="text-xs text-destructive">Errors</span>
                          </>
                        )}
                        {f.status === "mapping" && (
                          <span className="text-xs text-muted-foreground">
                            {f.formatDetection?.format ? f.formatDetection.format.name : "Needs mapping"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              <div
                {...getRootProps()}
                className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all duration-200 border-slate-300"
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Add more files</p>
              </div>
            </div>

            <div className="lg:col-span-3">
              {currentFile && (
                <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="text-lg md:text-xl font-bold text-slate-800 truncate">
                      Configure: {currentFile.file.name}
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm font-medium text-slate-500">
                      {currentFile.formatDetection?.format
                        ? `Detected: ${currentFile.formatDetection.format.name}`
                        : "Map columns to required fields"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 md:space-y-6">
                    {/* Format detection notice */}
                    {currentFile.formatDetection?.format && (
                      <div className="flex items-start gap-2 p-3 bg-[#fcf7c5] border border-[#f2c41e] rounded-lg text-sm">
                        <Database className="h-4 w-4 text-[#c98109] mt-0.5 flex-shrink-0" />
                        <div className="text-[#401e09]">
                          <strong>Format detected:</strong> {currentFile.formatDetection.format.name}
                          {currentFile.formatDetection.confidence >= 0.9 && " (high confidence)"}
                        </div>
                      </div>
                    )}

                    {/* ShulCloud Transaction Summary */}
                    {currentFile.transactionData && (
                      <div className="space-y-4">
                        {/* Transaction summary */}
                        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Transactions</div>
                              <div className="font-semibold text-lg">{currentFile.transactionData.transactions.length.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Years</div>
                              <div className="font-semibold">
                                {getTransactionYears(currentFile.transactionData.transactions).join(", ")}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Charge Types</div>
                              <div className="font-semibold">{currentFile.transactionData.chargeTypes.length}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Date Range</div>
                              <div className="font-semibold text-xs">
                                {currentFile.transactionData.dateRange && (
                                  <>{currentFile.transactionData.dateRange.min.toLocaleDateString()} - {currentFile.transactionData.dateRange.max.toLocaleDateString()}</>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Show charge types */}
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Charge Types Found:</div>
                            <div className="flex flex-wrap gap-1">
                              {currentFile.transactionData.chargeTypes.map((ct) => (
                                <span key={ct} className="text-xs bg-white border rounded px-2 py-0.5">
                                  {ct}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Configuration Options */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          {/* Primary Giving Type */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                              Primary Membership/Pledge Type
                              <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                            </label>
                            <select
                              value={primaryGivingType}
                              onChange={(e) => setPrimaryGivingType(e.target.value)}
                              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                            >
                              <option value="">None - use generic "giving" terminology</option>
                              {currentFile.transactionData.chargeTypes.map((ct) => (
                                <option key={ct} value={ct}>{ct}</option>
                              ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                              If selected, this charge type will use "pledge" terminology and show pledge-specific insights.
                            </p>
                          </div>

                          {/* Synagogue Address */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                              Synagogue Location
                              <span className="text-xs text-muted-foreground ml-1">(optional, for distance analysis)</span>
                            </label>
                            <AddressInput
                              onAddressSelect={handleAddressSelect}
                              defaultAddress={synagogueAddress}
                              defaultCoords={synagogueCoords || undefined}
                            />
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Year selection and charge type filtering will be available in the dashboard.
                        </div>

                        {/* Errors */}
                        {currentFile.transactionData.errors.length > 0 && (
                          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="h-5 w-5 text-destructive" />
                              <h3 className="font-semibold text-destructive">
                                Parse Errors ({currentFile.transactionData.errors.length})
                              </h3>
                            </div>
                            <div className="space-y-1 text-sm">
                              {currentFile.transactionData.errors.slice(0, 10).map((err, idx) => (
                                <div key={idx}>
                                  Row {err.row}: {err.message}
                                </div>
                              ))}
                              {currentFile.transactionData.errors.length > 10 && (
                                <div className="text-muted-foreground italic">
                                  ...and {currentFile.transactionData.errors.length - 10} more errors
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Legacy Format Column Mapping */}
                    {!currentFile.transactionData && (
                      <>
                        {(currentFile.mapping?.age || currentFile.mapping?.dob || currentFile.mapping?.pledgeCurrent || currentFile.mapping?.pledgePrior) && (
                          <div className="flex items-start gap-2 p-3 bg-[#fcf7c5] border border-[#f2c41e] rounded-lg text-sm">
                            <Sparkles className="h-4 w-4 text-[#c98109] mt-0.5 flex-shrink-0" />
                            <div className="text-[#401e09]">
                              <strong>Smart mapping applied!</strong> We auto-detected some columns. Please verify they're correct.
                            </div>
                          </div>
                        )}
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
                      </>
                    )}

                    {/* Validation Results for Legacy Format */}
                    {!currentFile.transactionData && currentFile.parsed && (
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
                                  Row {err.row}: {err.message}
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
                          <div className="space-y-4">
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
                          </div>
                        )}
                      </div>
                    )}

                    {/* Validation success for transaction data */}
                    {currentFile.transactionData && currentFile.status === "validated" && (
                      <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <h3 className="font-semibold text-green-600">
                            Data validated successfully
                          </h3>
                        </div>
                        <p className="text-sm mt-1">
                          {currentFile.transactionData.transactions.length.toLocaleString()} transactions ready for analysis
                        </p>
                      </div>
                    )}

                    {/* Continue button */}
                    {allValidated && (
                      <div className="flex justify-end">
                        <Button onClick={handleContinue} size="lg" className="w-full sm:w-auto bg-[#1886d9] hover:bg-[#0e69bb] text-white rounded-lg">
                          Continue to Dashboard →
                        </Button>
                      </div>
                    )}

                    {/* Validate button */}
                    {isReadyToValidate && !currentFile.parsed && currentFile.status !== "validated" && (
                      <div className="flex justify-end">
                        <Button onClick={handleValidate} size="lg" className="w-full sm:w-auto bg-[#1886d9] hover:bg-[#0e69bb] text-white rounded-lg">
                          Validate File →
                        </Button>
                      </div>
                    )}

                    {/* Preview table */}
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
                                    let displayValue = String(val);

                                    if (typeof val === 'number' && val > 10000 && val < 100000) {
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
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Your Shared Dashboards - shown at bottom */}
        <RecentDashboards />
      </div>
    </div>
  );
}
