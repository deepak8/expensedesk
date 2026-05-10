"use client";

import { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2, Sparkles, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseButton,
} from "@/components/ui/dialog";
import type { PaymentMethodRow } from "@/lib/supabase/types";
import {
  uploadReceiptFile,
  validateReceiptFile,
} from "@/lib/supabase/storage";
import { createClient } from "@/lib/supabase/client";
import { extractReceiptAction } from "@/app/upload/extract-receipt";

interface MarkPaidExpense {
  id: string;
  vendor: string;
  amount: number;
  date: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: MarkPaidExpense;
  paymentMethodRows: PaymentMethodRow[];
  onSaved: () => void;
}

const inputCls =
  "w-full h-9 px-3 text-sm rounded-md border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-colors disabled:opacity-60";

const selectCls =
  "w-full h-9 px-3 text-sm rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-colors disabled:opacity-60 appearance-none cursor-pointer";

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-foreground ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function MarkPaidModal({
  open,
  onOpenChange,
  expense,
  paymentMethodRows,
  onSaved,
}: Props) {
  const today = new Date().toISOString().split("T")[0];
  const activePaymentMethods = paymentMethodRows.filter((method) => method.is_active);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [extractingProof, setExtractingProof] = useState(false);
  const [paymentDate, setPaymentDate] = useState(today);
  const [paidAmount, setPaidAmount] = useState(String(expense.amount));
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");

  function handleClose() {
    if (isPending) return;
    setError(null);
    setProofFile(null);
    setProofPath(null);
    setPaymentDate(today);
    setPaidAmount(String(expense.amount));
    setPaymentMethodId("");
    setPaymentReference("");
    setNotes("");
    onOpenChange(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const validationErr = validateReceiptFile(file);
      if (validationErr) {
        setError(validationErr);
        e.target.value = "";
        return;
      }
    }
    setProofFile(file);
    setProofPath(null);
    setError(null);
  }

  async function uploadProofIfNeeded(): Promise<string | null> {
    if (proofPath) return proofPath;
    if (!proofFile) return null;

    setUploadingProof(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated.");

    const result = await uploadReceiptFile(user.id, proofFile);
    if (result.error) throw new Error(result.error);
    setProofPath(result.path);
    setUploadingProof(false);
    return result.path;
  }

  async function handleExtractProof() {
    if (!proofFile && !proofPath) {
      setError("Choose a payment proof file before extracting.");
      return;
    }

    setError(null);
    setExtractingProof(true);
    try {
      const path = await uploadProofIfNeeded();
      if (!path) throw new Error("Choose a payment proof file before extracting.");

      const result = await extractReceiptAction(
        path,
        [],
        activePaymentMethods.map((m) => m.name)
      );

      if (result.error || !result.data) {
        throw new Error(result.error ?? "Extraction failed. Please enter details manually.");
      }

      const ai = result.data;
      const matchedMethod = activePaymentMethods.find(
        (m) => m.name.toLowerCase() === ai.payment_method_guess?.toLowerCase()
      );

      if (ai.expense_date) setPaymentDate(ai.expense_date);
      if (ai.amount !== null) setPaidAmount(String(ai.amount));
      if (matchedMethod) setPaymentMethodId(String(matchedMethod.id));
      if (ai.invoice_number) setPaymentReference(ai.invoice_number);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setUploadingProof(false);
      setExtractingProof(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setIsPending(true);

    try {
      // 1. Upload payment proof if selected and not already uploaded for extraction
      const uploadedProofPath = await uploadProofIfNeeded();

      // 2. Call mark-paid API
      const body = {
        payment_date: (fd.get("payment_date") as string)?.trim(),
        paid_amount: Number(fd.get("paid_amount")),
        payment_method_id: fd.get("payment_method_id") || null,
        payment_reference: (fd.get("payment_reference") as string)?.trim() || null,
        payment_proof_file_path: uploadedProofPath,
        notes: (fd.get("notes") as string)?.trim() || null,
      };

      const res = await fetch(`/api/expenses/${expense.id}/mark-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to mark as paid.");
      }

      setProofFile(null);
      setProofPath(null);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
      setUploadingProof(false);
    } finally {
      setIsPending(false);
    }
  }

  const paidAmountNumber = Number(paidAmount);
  const showAmountWarning =
    paidAmount.trim() !== "" && !Number.isNaN(paidAmountNumber) && paidAmountNumber !== expense.amount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Paid</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {/* Expense summary */}
            <div className="p-3 rounded-md bg-[rgb(248_248_248)] border border-border">
              <p className="text-sm font-medium text-foreground">{expense.vendor}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {expense.date} · ₹{expense.amount.toLocaleString("en-IN")}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-[rgb(254_221_241)] border border-[rgb(254_221_241)] flex items-start gap-2 text-xs text-foreground">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Payment Date" required>
                <input
                  type="date"
                  name="payment_date"
                  required
                  disabled={isPending}
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={inputCls}
                />
              </FormField>
              <FormField label="Paid Amount" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
                  <input
                    type="number"
                    name="paid_amount"
                    required
                    min="0"
                    step="0.01"
                    disabled={isPending}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className={inputCls + " pl-7"}
                  />
                </div>
              </FormField>
            </div>

            {showAmountWarning && (
              <div className="p-2.5 rounded-md bg-[rgb(254_221_241)] border border-[rgb(254_221_241)] flex items-start gap-2 text-xs text-foreground">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                Paid amount differs from invoice amount.
              </div>
            )}

            <FormField label="Payment Method">
              <select
                name="payment_method_id"
                disabled={isPending}
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className={selectCls}
              >
                <option value="">Select…</option>
                {activePaymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Payment Reference / UPI Transaction ID">
              <input
                type="text"
                name="payment_reference"
                disabled={isPending}
                placeholder="e.g. UPI-TXNID-123456"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className={inputCls}
              />
            </FormField>

            {/* Payment proof file upload */}
            <FormField label="Upload Payment Proof (optional)">
              <div className="flex items-center gap-3 flex-wrap">
                <label
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-white text-xs font-medium text-foreground hover:bg-[rgb(248_248_248)] transition-colors cursor-pointer ${
                    isPending ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Choose File
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    disabled={isPending}
                    onChange={handleFileChange}
                  />
                </label>
                {proofFile && (
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {proofFile.name}
                  </span>
                )}
                {(proofFile || proofPath) && (
                  <button
                    type="button"
                    disabled={isPending || extractingProof || uploadingProof}
                    onClick={handleExtractProof}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[rgb(191_178_255)] text-foreground text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {extractingProof || uploadingProof ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {uploadingProof ? "Uploading…" : "Extracting…"}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Extract payment details
                      </>
                    )}
                  </button>
                )}
              </div>
            </FormField>

            <FormField label="Notes">
              <textarea
                name="notes"
                rows={2}
                disabled={isPending}
                placeholder="Optional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-colors resize-none disabled:opacity-60"
              />
            </FormField>
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              disabled={isPending}
              onClick={handleClose}
              className="px-4 py-2 rounded-md border border-border bg-white text-sm font-medium text-foreground hover:bg-[rgb(248_248_248)] disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {uploadingProof ? "Uploading…" : "Saving…"}
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Mark as Paid
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
