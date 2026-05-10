"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import {
  Upload,
  FileImage,
  FileText,
  CheckCircle,
  AlertCircle,
  Save,
  X,
  ExternalLink,
  Sparkles,
  Loader2,
  Info,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  uploadReceiptFile,
  getReceiptSignedUrl,
  deleteReceiptFile,
  validateReceiptFile,
} from "@/lib/supabase/storage";
import { saveReceiptExpenseAction } from "@/app/upload/actions";
import { extractReceiptAction } from "@/app/upload/extract-receipt";
import { createClient } from "@/lib/supabase/client";
import type { CategoryRow, PaymentMethodRow } from "@/lib/supabase/types";
import type { ExtractionResult } from "@/lib/openai/extract";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "uploading" | "ready" | "extracting" | "saving" | "saved";
type CaptureMode = "unpaid_bill" | "paid_bill_proof" | "payment_proof_only" | "manual";
type UploadSlot = "primary" | "paymentProof";

interface UploadedFile {
  file: File;
  path: string;
  signedUrl: string;
  isImage: boolean;
}

interface FormFields {
  expense_date: string;
  vendor: string;
  amount: string;
  category_id: string;
  payment_method_id: string;
  status: string;
  description: string;
  invoice_number: string;
  notes: string;
  currency: string;
  due_date: string;
  payment_status: "unpaid" | "partially_paid" | "paid";
  payment_date: string;
  paid_amount: string;
  payment_reference: string;
}

interface Props {
  categoryRows: CategoryRow[];
  paymentMethodRows: PaymentMethodRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: "needs_review", label: "Needs Review" },
  { value: "verified", label: "Verified" },
  { value: "draft", label: "Draft" },
];

const CONFIDENCE_THRESHOLD = 0.85;

const CAPTURE_MODES: Array<{
  value: CaptureMode;
  title: string;
  label: string;
}> = [
  {
    value: "unpaid_bill",
    title: "Unpaid Bill / Invoice",
    label: "I have a bill, but payment is not done yet.",
  },
  {
    value: "paid_bill_proof",
    title: "Paid Bill + Payment Proof",
    label: "I have the bill and the payment proof now.",
  },
  {
    value: "payment_proof_only",
    title: "Payment Proof Only",
    label: "I only have proof of payment or a receipt.",
  },
  {
    value: "manual",
    title: "Manual Entry",
    label: "No file right now; I'll enter details manually.",
  },
];

function selectedCaptureModeClass(mode: CaptureMode) {
  if (mode === "unpaid_bill") return "bg-[rgb(254_221_241)] text-foreground";
  if (mode === "paid_bill_proof" || mode === "payment_proof_only") {
    return "bg-[rgb(191_178_255)] text-foreground";
  }
  return "bg-[rgb(191_178_255)] text-foreground";
}

const inputCls =
  "w-full h-9 px-3 text-sm rounded-md border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-colors disabled:opacity-60";

const inputHighlightCls =
  "w-full h-9 px-3 text-sm rounded-md border border-[rgb(254_221_241)] bg-[rgb(254_221_241)]/35 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-colors disabled:opacity-60";

const selectCls =
  "w-full h-9 px-3 text-sm rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-colors disabled:opacity-60 appearance-none cursor-pointer";

const selectHighlightCls =
  "w-full h-9 px-3 text-sm rounded-md border border-[rgb(254_221_241)] bg-[rgb(254_221_241)]/35 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-colors disabled:opacity-60 appearance-none cursor-pointer";

function FormField({
  label,
  required,
  needsReview,
  children,
}: {
  label: string;
  required?: boolean;
  needsReview?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-foreground ml-0.5">*</span>}
        {needsReview && (
          <span className="ml-1 text-[10px] font-medium text-foreground bg-[rgb(254_221_241)] border border-[rgb(254_221_241)] rounded-sm px-1 py-0.5">
            Review
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function UploadReceiptShell({ categoryRows, paymentMethodRows }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().split("T")[0];

  // ── Phase & file state ────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("ready");
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [paymentProof, setPaymentProof] = useState<UploadedFile | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<UploadSlot | null>(null);

  // ── Capture mode choice ──────────────────────────────────────────────────
  const [captureMode, setCaptureMode] = useState<CaptureMode>("unpaid_bill");

  // ── AI state ──────────────────────────────────────────────────────────────
  const [aiData, setAiData] = useState<ExtractionResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Controlled form fields ────────────────────────────────────────────────
  const blankFields: FormFields = {
    expense_date: today,
    vendor: "",
    amount: "",
    category_id: "",
    payment_method_id: "",
    status: "needs_review",
    description: "",
    invoice_number: "",
    notes: "",
    currency: "INR",
    due_date: "",
    payment_status: "unpaid",
    payment_date: today,
    paid_amount: "",
    payment_reference: "",
  };

  const [fields, setFields] = useState<FormFields>(blankFields);

  function setField(name: keyof FormFields, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function needsReview(fieldName: string): boolean {
    return !!aiData?.fields_needing_review.includes(fieldName);
  }

  function inputClass(fieldName: string): string {
    return aiData && needsReview(fieldName) ? inputHighlightCls : inputCls;
  }

  function selectClass(fieldName: string): string {
    return aiData && needsReview(fieldName) ? selectHighlightCls : selectCls;
  }

  // ── File processing ───────────────────────────────────────────────────────

  async function processFile(file: File, slot: UploadSlot = "primary") {
    setUploadError(null);
    setSaveError(null);
    if (slot === "primary") {
      setAiData(null);
      setAiError(null);
    }

    const validationError = validateReceiptFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setPhase("uploading");
    setUploadingSlot(slot);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUploadError("You must be signed in to upload receipts.");
      setPhase("idle");
      setUploadingSlot(null);
      return;
    }

    const uploadResult = await uploadReceiptFile(user.id, file);
    if (uploadResult.error || !uploadResult.path) {
      setUploadError(uploadResult.error ?? "Upload failed.");
      setPhase("idle");
      setUploadingSlot(null);
      return;
    }

    const urlResult = await getReceiptSignedUrl(uploadResult.path);
    if (urlResult.error) {
      console.warn("[UploadReceiptShell] Could not get signed URL:", urlResult.error);
    }

    const nextUpload = {
      file,
      path: uploadResult.path,
      signedUrl: urlResult.signedUrl ?? "",
      isImage: file.type.startsWith("image/"),
    };

    if (slot === "primary") {
      setUploaded(nextUpload);
      setFields((prev) => ({ ...blankFields, payment_status: prev.payment_status }));
    } else {
      setPaymentProof(nextUpload);
    }
    setUploadingSlot(null);
    setPhase("ready");
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file, "primary");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, slot: UploadSlot = "primary") => {
    const file = e.target.files?.[0];
    if (file) processFile(file, slot);
    e.target.value = "";
  };

  // ── AI extraction ─────────────────────────────────────────────────────────

  async function handleExtract() {
    if (!uploaded) return;
    setAiError(null);
    setAiData(null);
    setPhase("extracting");

    const result = await extractReceiptAction(
      uploaded.path,
      categoryRows.map((c) => c.name),
      paymentMethodRows.map((m) => m.name)
    );

    if (result.error || !result.data) {
      setAiError(result.error ?? "Extraction failed. Please enter details manually.");
      setPhase("ready");
      return;
    }

    const ai = result.data;
    setAiData(ai);

    const matchedCat = categoryRows.find(
      (c) => c.name.toLowerCase() === ai.category_guess?.toLowerCase()
    );
    const matchedMethod = paymentMethodRows.find(
      (m) => m.name.toLowerCase() === ai.payment_method_guess?.toLowerCase()
    );

    const matchedPaidAmount = ai.amount !== null ? String(ai.amount) : "";
    const extractedDate = ai.expense_date ?? today;

    setFields({
      expense_date: ai.expense_date ?? today,
      vendor: ai.vendor ?? "",
      amount: ai.amount !== null ? String(ai.amount) : "",
      category_id: matchedCat ? String(matchedCat.id) : "",
      payment_method_id: matchedMethod ? String(matchedMethod.id) : "",
      status: ai.confidence >= CONFIDENCE_THRESHOLD ? "verified" : "needs_review",
      description: ai.description ?? "",
      invoice_number: ai.invoice_number ?? "",
      notes: "",
      currency: ai.currency ?? "INR",
      due_date: ai.due_date ?? "",
      payment_status:
        captureMode === "unpaid_bill" ? "unpaid" : captureMode === "manual" ? fields.payment_status : "paid",
      payment_date: captureMode === "unpaid_bill" ? "" : extractedDate,
      paid_amount: captureMode === "unpaid_bill" ? "" : matchedPaidAmount,
      payment_reference: ai.invoice_number ?? "",
    });

    setPhase("ready");
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (captureMode !== "manual" && !uploaded) {
      setSaveError("Upload the required document before saving.");
      return;
    }
    if (captureMode === "paid_bill_proof" && !paymentProof) {
      setSaveError("Upload payment proof before saving this paid bill.");
      return;
    }

    setSaveError(null);
    setPhase("saving");

    const formData = new FormData(e.currentTarget);
    const result = await saveReceiptExpenseAction(null, formData);

    if (result.error) {
      setSaveError(result.error);
      setPhase("ready");
      return;
    }

    setPhase("saved");
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  async function handleClear() {
    if (uploaded?.path) {
      deleteReceiptFile(uploaded.path).catch(() => {});
    }
    if (paymentProof?.path) {
      deleteReceiptFile(paymentProof.path).catch(() => {});
    }
    setUploaded(null);
    setPaymentProof(null);
    setUploadError(null);
    setSaveError(null);
    setAiData(null);
    setAiError(null);
    setUploadingSlot(null);
    setPhase("ready");
    setFields({ ...blankFields });
  }

  function resetForAnother() {
    setUploaded(null);
    setPaymentProof(null);
    setAiData(null);
    setAiError(null);
    setSaveError(null);
    setUploadingSlot(null);
    setPhase("ready");
    setFields({ ...blankFields });
  }

  function handleModeChange(mode: CaptureMode) {
    setCaptureMode(mode);
    setSaveError(null);
    setUploadError(null);
    setAiError(null);
    setAiData(null);
    const nextStatus =
      mode === "unpaid_bill" ? "unpaid" : mode === "manual" ? fields.payment_status : "paid";
    setFields((prev) => ({
      ...prev,
      payment_status: nextStatus,
      payment_date: nextStatus === "unpaid" ? "" : prev.payment_date || today,
      paid_amount: nextStatus === "unpaid" ? "" : prev.paid_amount || prev.amount,
    }));
    setPhase("ready");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const isFormDisabled = phase === "saving" || phase === "extracting";
  const isUnpaidBill = captureMode === "unpaid_bill";
  const isPaidBillWithProof = captureMode === "paid_bill_proof";
  const isPaymentProofOnly = captureMode === "payment_proof_only";
  const isManual = captureMode === "manual";
  const selectedMode = CAPTURE_MODES.find((m) => m.value === captureMode)!;
  const amountNum = Number(fields.amount || 0);
  const paidAmountNum = Number(fields.paid_amount || 0);
  const computedPaymentStatus =
    isUnpaidBill || fields.payment_status === "unpaid"
      ? "unpaid"
      : paidAmountNum > 0 && amountNum > 0 && paidAmountNum < amountNum
      ? "partially_paid"
      : fields.payment_status === "partially_paid"
      ? "partially_paid"
      : "paid";
  const documentType = isManual ? "manual" : isPaymentProofOnly ? "payment_proof" : "invoice";
  const expenseType =
    isManual && computedPaymentStatus === "unpaid"
      ? "invoice"
      : isManual
      ? "manual"
      : isPaymentProofOnly
      ? "receipt"
      : "invoice";

  const savedLabel =
    computedPaymentStatus === "unpaid" ? "Expense saved as unpaid" : "Expense saved";
  const savedSubLabel =
    computedPaymentStatus === "unpaid"
      ? "You can mark it as paid later from the Expenses page."
      : "Your expense has been added successfully.";

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Upload Receipt"
        subtitle="Upload a receipt or invoice and review expense details"
      />

      <div className="px-6 py-5 flex-1">
        {/* ── Success state ── */}
        {phase === "saved" && (
          <div className="max-w-md mx-auto mt-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[rgb(176_242_213)] flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">{savedLabel}</p>
            <p className="text-sm text-muted-foreground">{savedSubLabel}</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => router.push("/expenses")}
                className="px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold transition-opacity hover:opacity-90"
              >
                Go to Expenses
              </button>
              <button
                onClick={resetForAnother}
                className="px-5 py-2 rounded-md border border-border bg-white text-sm font-medium text-foreground hover:bg-[rgb(248_248_248)] transition-colors"
              >
                Upload Another
              </button>
            </div>
          </div>
        )}

        {/* ── Main 2-col layout ── */}
        {phase !== "saved" && (
          <div className="grid grid-cols-5 gap-6 h-full">
            {/* Left: Upload Zone + Preview */}
            <div className="col-span-2 flex flex-col gap-4">
              <div className="bg-white border-y border-border py-4">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2">Capture mode</p>
                <div className="divide-y divide-border border-y border-border">
                  {CAPTURE_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => handleModeChange(mode.value)}
                      disabled={isFormDisabled}
                      className={cn(
                        "w-full text-left px-3 py-3 transition-colors",
                        captureMode === mode.value
                          ? selectedCaptureModeClass(mode.value)
                          : "bg-white hover:bg-[rgb(248_248_248)]"
                      )}
                    >
                      <p className="text-xs font-semibold text-foreground">{mode.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{mode.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Zone */}
              {!isManual ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!uploaded && uploadingSlot !== "primary") setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-md border border-dashed transition-colors min-h-[180px] p-6 text-center",
                    !uploaded && uploadingSlot !== "primary"
                      ? dragging
                        ? "border-foreground bg-[rgb(248_248_248)] cursor-copy"
                        : "border-border bg-white hover:bg-[rgb(248_248_248)] cursor-pointer"
                      : uploadingSlot === "primary"
                      ? "border-[rgb(191_178_255)] bg-[rgb(191_178_255)]/25 cursor-default"
                      : "border-[rgb(176_242_213)] bg-[rgb(176_242_213)]/30 cursor-default"
                  )}
                  onClick={() => {
                    if (!uploaded && uploadingSlot !== "primary") {
                      document.getElementById("file-input")?.click();
                    }
                  }}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileInput(e, "primary")}
                  />

                  {!uploaded && uploadingSlot !== "primary" && (
                  <>
                    <div className="w-12 h-12 rounded-md bg-[rgb(248_248_248)] flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6 text-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">
                      {isPaymentProofOnly ? "Drop payment proof or receipt here" : "Drop bill or invoice here"}
                    </p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      JPG, PNG, WebP, PDF · max 10 MB
                    </p>
                    {uploadError && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-foreground">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {uploadError}
                      </div>
                    )}
                  </>
                  )}

                  {uploadingSlot === "primary" && (
                  <>
                    <div className="w-12 h-12 rounded-md bg-[rgb(191_178_255)]/35 flex items-center justify-center mb-3 animate-pulse">
                      <Upload className="w-6 h-6 text-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">Uploading…</p>
                    <p className="text-xs text-muted-foreground">Please wait</p>
                  </>
                  )}

                  {uploaded && uploadingSlot !== "primary" && (
                    <>
                      <div className="w-12 h-12 rounded-md bg-[rgb(176_242_213)] flex items-center justify-center mb-3">
                        <CheckCircle className="w-6 h-6 text-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        Upload complete
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {uploaded.file.name}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClear();
                        }}
                        className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Replace file
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-md border border-border bg-[rgb(248_248_248)] min-h-[180px] p-6 text-center">
                  <div className="w-12 h-12 rounded-md bg-white border border-border flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">Manual capture</p>
                  <p className="text-xs text-muted-foreground max-w-[260px]">
                    No file is required. Enter the expense details in the review form.
                  </p>
                </div>
              )}

              {isPaidBillWithProof && (
                <div className="border-y border-border bg-white py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Payment proof</p>
                      <p className="text-[11px] text-muted-foreground">
                        Upload UPI, bank, card, or receipt proof.
                      </p>
                    </div>
                    <label
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-white text-xs font-medium text-foreground hover:bg-[rgb(248_248_248)] transition-colors cursor-pointer",
                        isFormDisabled ? "opacity-60 pointer-events-none" : ""
                      )}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {paymentProof ? "Replace" : "Choose"}
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        disabled={isFormDisabled}
                        onChange={(e) => handleFileInput(e, "paymentProof")}
                      />
                    </label>
                  </div>
                  {uploadingSlot === "paymentProof" && (
                    <p className="text-xs text-muted-foreground mt-3">Uploading payment proof…</p>
                  )}
                  {paymentProof && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-[rgb(191_178_255)] border border-[rgb(191_178_255)] px-3 py-2">
                      <p className="text-xs text-foreground truncate">{paymentProof.file.name}</p>
                      <button
                        type="button"
                        disabled={isFormDisabled}
                        onClick={() => {
                          deleteReceiptFile(paymentProof.path).catch(() => {});
                          setPaymentProof(null);
                        }}
                        className="text-[11px] text-foreground hover:underline disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Receipt Preview */}
              <div className="bg-white border-y border-border py-4 flex flex-col items-center justify-center min-h-[200px] flex-1">
                {!uploaded ? (
                  <div className="text-center">
                    <FileImage className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Receipt preview will appear here
                    </p>
                  </div>
                ) : uploaded.isImage ? (
                  <div className="w-full h-full flex flex-col gap-2">
                    <p className="text-xs font-semibold text-foreground">Document Preview</p>
                    {uploaded.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={uploaded.signedUrl}
                        alt={uploaded.file.name}
                        className="w-full rounded-md object-contain max-h-[280px] border border-border"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-32 rounded-md bg-muted text-xs text-muted-foreground">
                        Preview unavailable
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 rounded-md bg-[rgb(248_248_248)] flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6 text-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground truncate max-w-[180px]">
                        {uploaded.file.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {(uploaded.file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    {uploaded.signedUrl && (
                      <a
                        href={uploaded.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-foreground hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open PDF
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Expense Details Form */}
            <div className="col-span-3">
              <div className="bg-white border-y border-border h-full flex flex-col">
                {/* Panel header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-foreground" />
                    <p className="text-sm font-semibold text-foreground">Expense Details</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploaded && (
                      <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                        {uploaded.file.name}
                      </span>
                    )}
                    {(phase === "ready" || phase === "extracting") && uploaded && !isManual && (
                      <button
                        type="button"
                        disabled={phase === "extracting"}
                        onClick={handleExtract}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[rgb(191_178_255)] text-foreground text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {phase === "extracting" ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Extracting…
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Extract with AI
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 p-5 overflow-y-auto">
                  {/* Empty / uploading placeholder */}
                  {(phase === "idle" || phase === "uploading") && (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-3">
                        <Upload className="w-5 h-5 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {phase === "uploading"
                          ? "Uploading receipt…"
                          : "Upload a receipt or invoice to get started"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {phase === "uploading"
                          ? "Please wait"
                          : "Then extract with AI or enter details manually"}
                      </p>
                    </div>
                  )}

                  {/* Extracting overlay */}
                  {phase === "extracting" && (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                      <div className="w-12 h-12 rounded-md bg-[rgb(191_178_255)]/35 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-foreground animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Extracting details…
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          This usually takes a few seconds
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Form (ready / saving) ── */}
                  {(phase === "ready" || phase === "saving") && (
                    <form ref={formRef} onSubmit={handleSave} className="space-y-4">
                      {/* Hidden fields */}
                      <input type="hidden" name="receipt_file_path" value={uploaded?.path ?? ""} />
                      <input type="hidden" name="payment_proof_file_path" value={paymentProof?.path ?? ""} />
                      <input type="hidden" name="currency" value={fields.currency} />
                      <input type="hidden" name="document_type" value={documentType} />
                      <input type="hidden" name="payment_status" value={computedPaymentStatus} />
                      <input type="hidden" name="expense_type" value={expenseType} />
                      {aiData && (
                        <>
                          <input
                            type="hidden"
                            name="raw_ai_json"
                            value={JSON.stringify(aiData)}
                          />
                          <input
                            type="hidden"
                            name="ai_confidence"
                            value={String(aiData.confidence)}
                          />
                        </>
                      )}

                      {/* Mode banner */}
                      {isUnpaidBill && (
                        <div className="p-3 rounded-md bg-[rgb(254_221_241)] border border-[rgb(254_221_241)] flex items-start gap-2.5">
                          <Info className="w-3.5 h-3.5 text-foreground mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-foreground">
                            <p className="font-medium">This invoice will be saved as unpaid.</p>
                            <p className="mt-0.5 text-foreground/80">
                              You can mark it as paid later from the Expenses page when payment is made.
                            </p>
                          </div>
                        </div>
                      )}

                      {isPaidBillWithProof && (
                        <div className="p-3 rounded-md bg-[rgb(176_242_213)] border border-[rgb(176_242_213)] flex items-start gap-2.5">
                          <Info className="w-3.5 h-3.5 text-foreground mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-foreground">
                            <p className="font-medium">This bill will be saved with payment details.</p>
                            <p className="mt-0.5 text-foreground/80">
                              Paid status is based on paid amount compared with bill amount.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Capture mode */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Capture mode:</span>
                        <span className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-sm border",
                          isUnpaidBill
                            ? "bg-[rgb(254_221_241)] text-foreground border-[rgb(254_221_241)]"
                            : isManual
                            ? "bg-[rgb(191_178_255)] text-foreground border-[rgb(191_178_255)]"
                            : "bg-[rgb(176_242_213)] text-foreground border-[rgb(176_242_213)]"
                        )}>
                          {selectedMode.title}
                        </span>
                      </div>

                      {/* AI result banner */}
                      {aiData && (
                        <div className="p-3 rounded-md bg-[rgb(191_178_255)]/25 border border-[rgb(191_178_255)] flex items-start gap-2.5">
                          <Sparkles className="w-3.5 h-3.5 text-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-medium text-foreground">
                                AI extracted details
                              </p>
                              <span
                                className={cn(
                                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-sm border",
                                  aiData.confidence >= CONFIDENCE_THRESHOLD
                                    ? "bg-[rgb(176_242_213)] text-foreground border-[rgb(176_242_213)]"
                                    : "bg-[rgb(254_221_241)] text-foreground border-[rgb(254_221_241)]"
                                )}
                              >
                                {Math.round(aiData.confidence * 100)}% confidence
                              </span>
                            </div>
                            {aiData.fields_needing_review.length > 0 && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Review highlighted fields before saving.
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* AI error banner */}
                      {aiError && (
                        <div className="p-3 rounded-md bg-[rgb(254_221_241)] border border-[rgb(254_221_241)] flex items-start gap-2 text-xs text-foreground">
                          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>AI extraction failed:</strong> {aiError} You can still
                            enter details manually below.
                          </span>
                        </div>
                      )}

                      {/* Save error banner */}
                      {saveError && (
                        <div className="p-3 rounded-md bg-[rgb(254_221_241)] border border-[rgb(254_221_241)] flex items-start gap-2 text-xs text-foreground">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          {saveError}
                        </div>
                      )}

                      {/* Row 1: Date + Vendor */}
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Date" required needsReview={needsReview("expense_date")}>
                          <input
                            type="date"
                            name="expense_date"
                            required
                            disabled={isFormDisabled}
                            value={fields.expense_date}
                            onChange={(e) => setField("expense_date", e.target.value)}
                            className={inputClass("expense_date")}
                          />
                        </FormField>
                        <FormField label="Vendor" required needsReview={needsReview("vendor")}>
                          <input
                            type="text"
                            name="vendor"
                            required
                            disabled={isFormDisabled}
                            value={fields.vendor}
                            onChange={(e) => setField("vendor", e.target.value)}
                            placeholder="e.g. Amazon"
                            className={inputClass("vendor")}
                          />
                        </FormField>
                      </div>

                      {/* Row 2: Amount + Category */}
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Amount" required needsReview={needsReview("amount")}>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              {fields.currency === "INR" ? "₹" : fields.currency}
                            </span>
                            <input
                              type="number"
                              name="amount"
                              required
                              min="0"
                              step="0.01"
                              disabled={isFormDisabled}
                              value={fields.amount}
                              onChange={(e) => {
                                const next = e.target.value;
                                setFields((prev) => ({
                                  ...prev,
                                  amount: next,
                                  paid_amount:
                                    prev.paid_amount || computedPaymentStatus === "unpaid"
                                      ? prev.paid_amount
                                      : next,
                                }));
                              }}
                              placeholder="0.00"
                              className={inputClass("amount") + " pl-7"}
                            />
                          </div>
                        </FormField>
                        <FormField
                          label="Category"
                          needsReview={needsReview("category_guess")}
                        >
                          <select
                            name="category_id"
                            disabled={isFormDisabled}
                            value={fields.category_id}
                            onChange={(e) => setField("category_id", e.target.value)}
                            className={selectClass("category_guess")}
                          >
                            <option value="">Select…</option>
                            {categoryRows.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </FormField>
                      </div>

                      {/* Row 3: Due Date + Status */}
                      <div className="grid grid-cols-2 gap-3">
                        {!isPaymentProofOnly ? (
                          <FormField label="Due Date" needsReview={needsReview("due_date")}>
                            <input
                              type="date"
                              name="due_date"
                              disabled={isFormDisabled}
                              value={fields.due_date}
                              onChange={(e) => setField("due_date", e.target.value)}
                              className={inputClass("due_date")}
                            />
                          </FormField>
                        ) : (
                          <input type="hidden" name="due_date" value="" />
                        )}
                        <FormField label="Status">
                          <select
                            name="status"
                            disabled={isFormDisabled}
                            value={fields.status}
                            onChange={(e) => setField("status", e.target.value)}
                            className={selectCls}
                          >
                            {STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </FormField>
                      </div>

                      {/* Manual payment status */}
                      {isManual && (
                        <FormField label="Payment Status">
                          <select
                            disabled={isFormDisabled}
                            value={fields.payment_status}
                            onChange={(e) => {
                              const next = e.target.value as FormFields["payment_status"];
                              setFields((prev) => ({
                                ...prev,
                                payment_status: next,
                                payment_date: next === "unpaid" ? "" : prev.payment_date || today,
                                paid_amount: next === "unpaid" ? "" : prev.paid_amount || prev.amount,
                              }));
                            }}
                            className={selectCls}
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                            <option value="partially_paid">Partially Paid</option>
                          </select>
                        </FormField>
                      )}

                      {/* Payment details */}
                      {computedPaymentStatus !== "unpaid" && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <FormField label="Payment Date" required needsReview={needsReview("expense_date")}>
                              <input
                                type="date"
                                name="payment_date"
                                required
                                disabled={isFormDisabled}
                                value={fields.payment_date}
                                onChange={(e) => setField("payment_date", e.target.value)}
                                className={inputCls}
                              />
                            </FormField>
                            <FormField label="Paid Amount" required needsReview={needsReview("amount")}>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  {fields.currency === "INR" ? "₹" : fields.currency}
                                </span>
                                <input
                                  type="number"
                                  name="paid_amount"
                                  required
                                  min="0"
                                  step="0.01"
                                  disabled={isFormDisabled}
                                  value={fields.paid_amount}
                                  onChange={(e) => setField("paid_amount", e.target.value)}
                                  placeholder={fields.amount || "0.00"}
                                  className={inputCls + " pl-7"}
                                />
                              </div>
                            </FormField>
                          </div>

                          <FormField
                            label="Payment Method"
                            needsReview={needsReview("payment_method_guess")}
                          >
                            <select
                              name="payment_method_id"
                              disabled={isFormDisabled}
                              value={fields.payment_method_id}
                              onChange={(e) => setField("payment_method_id", e.target.value)}
                              className={selectClass("payment_method_guess")}
                            >
                              <option value="">Select…</option>
                              {paymentMethodRows.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </FormField>
                        </>
                      )}

                      {computedPaymentStatus === "unpaid" && (
                        <>
                          <input type="hidden" name="payment_date" value="" />
                          <input type="hidden" name="paid_amount" value="" />
                          <input type="hidden" name="payment_method_id" value="" />
                        </>
                      )}

                      {/* Row 4: Description */}
                      <FormField
                        label="Description"
                        needsReview={needsReview("description")}
                      >
                        <input
                          type="text"
                          name="description"
                          disabled={isFormDisabled}
                          value={fields.description}
                          onChange={(e) => setField("description", e.target.value)}
                          placeholder="Optional"
                          className={inputClass("description")}
                        />
                      </FormField>

                      {/* Row 5: Invoice Number */}
                      <FormField
                        label="Invoice Number"
                        needsReview={needsReview("invoice_number")}
                      >
                        <input
                          type="text"
                          name="invoice_number"
                          disabled={isFormDisabled}
                          value={fields.invoice_number}
                          onChange={(e) => setField("invoice_number", e.target.value)}
                          placeholder="Optional"
                          className={inputClass("invoice_number")}
                        />
                      </FormField>

                      {/* Row 5.5: Payment Reference */}
                      {computedPaymentStatus !== "unpaid" && (
                        <FormField label="Payment Reference">
                          <input
                            type="text"
                            name="payment_reference"
                            disabled={isFormDisabled}
                            value={fields.payment_reference}
                            onChange={(e) => setField("payment_reference", e.target.value)}
                            placeholder="e.g. UPI Transaction ID"
                            className={inputCls}
                          />
                        </FormField>
                      )}

                      {/* Row 6: Notes */}
                      <FormField label="Notes">
                        <textarea
                          name="notes"
                          rows={2}
                          disabled={isFormDisabled}
                          value={fields.notes}
                          onChange={(e) => setField("notes", e.target.value)}
                          placeholder="Optional"
                          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-colors resize-none disabled:opacity-60"
                        />
                      </FormField>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isFormDisabled}
                          className={cn(
                            "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60 transition-colors",
                            isUnpaidBill
                              ? "bg-[rgb(191_178_255)] text-primary-foreground hover:opacity-90"
                              : "bg-primary text-primary-foreground hover:opacity-90"
                          )}
                        >
                          <Save className="w-3.5 h-3.5" />
                          {phase === "saving"
                            ? "Saving…"
                            : isUnpaidBill
                            ? "Save as Unpaid Invoice"
                            : "Save Expense"}
                        </button>
                        <button
                          type="button"
                          disabled={isFormDisabled}
                          onClick={handleClear}
                          className="ml-auto text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
