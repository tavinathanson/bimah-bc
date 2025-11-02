"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { getFileHeaders, parseFile, previewFile } from "@/lib/parsing/parser";
import type { ColumnMapping, ParsedFile } from "@/lib/schema/types";
import { enrichRows } from "@/lib/math/calculations";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";

interface FileState {
  file: File;
  status: "pending" | "mapping" | "validated" | "error";
  headers: string[];
  mapping?: ColumnMapping;
  parsed?: ParsedFile;
  preview?: Record<string, unknown>[];
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileState[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState<number | null>(null);
  const router = useRouter();

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
          return {
            file,
            status: "mapping" as const,
            headers,
            preview,
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
    const validatedFiles = files.filter((f) => f.status === "validated" && f.parsed);

    const allRows = validatedFiles.flatMap((f) =>
      enrichRows(f.file.name, f.parsed!.rows)
    );

    sessionStorage.setItem("pledgeData", JSON.stringify(allRows));
    router.push("/dashboard");
  };

  const currentFile = currentFileIndex !== null ? files[currentFileIndex] : null;
  const allValidated = files.length > 0 && files.every((f) => f.status === "validated");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Upload Pledge Data</h1>
            <p className="text-muted-foreground mt-1">
              Upload XLSX or CSV files from ShulCloud exports
            </p>
          </div>
          {allValidated && (
            <Button onClick={handleContinue} size="lg">
              Continue to Dashboard
            </Button>
          )}
        </div>

        {files.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  {isDragActive ? "Drop files here" : "Drag & drop files here"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports .xlsx and .csv files
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <h2 className="font-semibold">Files</h2>
              {files.map((f, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentFileIndex(idx)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    currentFileIndex === idx
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
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
                          <span className="text-xs text-muted-foreground">Needs mapping</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              <div
                {...getRootProps()}
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Add more files</p>
              </div>
            </div>

            <div className="lg:col-span-3">
              {currentFile && (
                <Card>
                  <CardHeader>
                    <CardTitle>Configure: {currentFile.file.name}</CardTitle>
                    <CardDescription>
                      Map columns to required fields
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Age Column</label>
                        <Select
                          value={currentFile.mapping?.age || ""}
                          onChange={(e) => handleMappingChange("age", e.target.value)}
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

                    {currentFile.mapping?.age &&
                      currentFile.mapping?.pledgeCurrent &&
                      currentFile.mapping?.pledgePrior && (
                        <div>
                          <Button onClick={handleValidate}>Validate File</Button>
                        </div>
                      )}

                    {currentFile.parsed && (
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
                                  {Object.values(row).map((val, colIdx) => (
                                    <td key={colIdx} className="p-2">
                                      {String(val)}
                                    </td>
                                  ))}
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
      </div>
    </div>
  );
}
