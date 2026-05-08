"use client";

import { useState, useCallback } from "react";
import Header from "@/components/Header";
import { Progress } from "@/components/ui/progress";
import { Upload, FileImage, CheckCircle, AlertCircle, Sparkles, Save, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExtractedField {
  label: string;
  value: string;
  confidence: number;
}

const MOCK_EXTRACTED: ExtractedField[] = [
  { label: "Vendor", value: "Amazon Web Services", confidence: 98 },
  { label: "Amount", value: "₹18,400", confidence: 97 },
  { label: "Date", value: "2026-05-01", confidence: 95 },
  { label: "Category", value: "Software", confidence: 88 },
  { label: "Payment Method", value: "Credit Card", confidence: 82 },
  { label: "Description", value: "Cloud infrastructure – May 2026", confidence: 76 },
];

function ConfidencePill({ confidence }: { confidence: number }) {
  const color = confidence >= 90 ? "text-green-600 bg-green-50" : confidence >= 75 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", color)}>
      {confidence}%
    </span>
  );
}

type UploadState = "idle" | "dropped" | "extracted";

export default function UploadReceiptPage() {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [dragging, setDragging] = useState(false);
  const [fields, setFields] = useState(MOCK_EXTRACTED.map((f) => ({ ...f, editValue: f.value })));
  const overallConfidence = Math.round(fields.reduce((s, f) => s + f.confidence, 0) / fields.length);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    setUploadState("dropped");
    setTimeout(() => setUploadState("extracted"), 1200);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setUploadState("dropped");
      setTimeout(() => setUploadState("extracted"), 1200);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Upload Receipt" subtitle="Upload a receipt image for AI-assisted data extraction" />

      <div className="p-6 flex-1">
        <div className="grid grid-cols-5 gap-5 h-full">
          {/* Left: Upload Zone */}
          <div className="col-span-2 flex flex-col gap-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all cursor-pointer min-h-[280px] p-8 text-center",
                dragging
                  ? "border-primary bg-accent scale-[1.01]"
                  : uploadState === "idle"
                  ? "border-border bg-white hover:border-primary/50 hover:bg-accent/30"
                  : "border-green-300 bg-green-50/50"
              )}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileInput}
              />

              {uploadState === "idle" && (
                <>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">Drop receipt here</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                  <p className="text-[11px] text-muted-foreground mt-3">Supports JPG, PNG, PDF</p>
                </>
              )}

              {uploadState === "dropped" && (
                <>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">Analysing receipt…</p>
                  <p className="text-xs text-muted-foreground">Extracting data with AI</p>
                  <div className="w-32 mt-4">
                    <Progress value={65} className="h-1.5" />
                  </div>
                </>
              )}

              {uploadState === "extracted" && (
                <>
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">Extraction complete</p>
                  <p className="text-xs text-muted-foreground">Review and confirm details</p>
                </>
              )}
            </div>

            {/* Receipt Preview Placeholder */}
            <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex flex-col items-center justify-center min-h-[200px]">
              {uploadState === "idle" ? (
                <div className="text-center">
                  <FileImage className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Receipt preview will appear here</p>
                </div>
              ) : (
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-foreground">Receipt Preview</p>
                    <span className="text-[11px] text-muted-foreground">aws-may2026.pdf</span>
                  </div>
                  {/* Simulated receipt lines */}
                  <div className="space-y-1.5">
                    {["AWS INVOICE", "Invoice #INV-2026-05-001", "May 1, 2026", "EC2 Instances — ₹12,200", "S3 Storage — ₹3,800", "Data Transfer — ₹2,400", "─────────────────", "Total: ₹18,400"].map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-3 rounded",
                          i === 0 ? "bg-foreground/10 w-1/2 mx-auto" : i === 6 ? "bg-border w-full" : i === 7 ? "bg-primary/20 w-2/3 ml-auto" : "bg-muted w-full"
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Extracted Details */}
          <div className="col-span-3">
            <div className="bg-white rounded-xl border border-border shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">AI-Extracted Details</p>
                </div>
                {uploadState === "extracted" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Overall confidence</span>
                    <div className="flex items-center gap-1.5">
                      <Progress value={overallConfidence} className="w-20 h-1.5" />
                      <span className={cn("text-xs font-semibold", overallConfidence >= 90 ? "text-green-600" : "text-amber-600")}>
                        {overallConfidence}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 p-5">
                {uploadState !== "extracted" ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
                      <Sparkles className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {uploadState === "dropped" ? "Extracting data…" : "Upload a receipt to get started"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      AI will extract vendor, amount, date, and category
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-green-800">Extraction successful</p>
                        <p className="text-[11px] text-green-700 mt-0.5">Review the fields below. Low-confidence items are highlighted — please verify before saving.</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {fields.map((field, i) => (
                        <div key={field.label} className={cn("rounded-lg border p-3 transition-colors", field.confidence < 80 ? "border-amber-200 bg-amber-50/40" : "border-border bg-muted/20")}>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                              {field.label}
                            </label>
                            <div className="flex items-center gap-1">
                              {field.confidence < 80 && <AlertCircle className="w-3 h-3 text-amber-500" />}
                              <ConfidencePill confidence={field.confidence} />
                            </div>
                          </div>
                          <input
                            type="text"
                            value={field.editValue}
                            onChange={(e) => {
                              const updated = [...fields];
                              updated[i] = { ...updated[i], editValue: e.target.value };
                              setFields(updated);
                            }}
                            className="w-full text-sm text-foreground bg-transparent focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    <div className="rounded-lg border border-border p-3 bg-muted/20">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                        Notes (optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Add any additional context…"
                        className="w-full text-sm text-foreground bg-transparent focus:outline-none resize-none placeholder:text-muted-foreground"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
                        <Save className="w-3.5 h-3.5" />
                        Save Expense
                      </button>
                      <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors">
                        <Clock className="w-3.5 h-3.5" />
                        Mark for Later
                      </button>
                      <button
                        onClick={() => { setUploadState("idle"); setFields(MOCK_EXTRACTED.map((f) => ({ ...f, editValue: f.value }))); }}
                        className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
