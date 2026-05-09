"use client";

import { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
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
  "w-full h-9 px-3 text-sm rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors disabled:opacity-60";

const selectCls =
  "w-full h-9 px-3 text-sm rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors disabled:opacity-60 appearance-none cursor-pointer";

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
        {required && <span className="text-red-500 ml-0.5">*</span>}
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
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  function handleClose() {
    if (isPending) return;
    setError(null);
    setProofFile(null);
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
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setIsPending(true);

    try {
      // 1. Upload payment proof if selected
      let proofPath: string | null = null;
      if (proofFile) {
        setUploadingProof(true);
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated.");

        const result = await uploadReceiptFile(user.id, proofFile);
        if (result.error) throw new Error(result.error);
        proofPath = result.path;
        setUploadingProof(false);
      }

      // 2. Call mark-paid API
      const body = {
        payment_date: (fd.get("payment_date") as string)?.trim(),
        paid_amount: Number(fd.get("paid_amount")),
        payment_method_id: fd.get("payment_method_id") || null,
        payment_reference: (fd.get("payment_reference") as string)?.trim() || null,
        payment_proof_file_path: proofPath,
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
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
      setUploadingProof(false);
    } finally {
      setIsPending(false);
    }
  }

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
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm font-medium text-foreground">{expense.vendor}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {expense.date} · ₹{expense.amount.toLocaleString("en-IN")}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700">
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
                  defaultValue={today}
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
                    defaultValue={expense.amount}
                    className={inputCls + " pl-7"}
                  />
                </div>
              </FormField>
            </div>

            <FormField label="Payment Method">
              <select
                name="payment_method_id"
                disabled={isPending}
                defaultValue=""
                className={selectCls}
              >
                <option value="">Select…</option>
                {paymentMethodRows.map((m) => (
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
                className={inputCls}
              />
            </FormField>

            {/* Payment proof file upload */}
            <FormField label="Upload Payment Proof (optional)">
              <div className="flex items-center gap-3">
                <label
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer ${
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
              </div>
            </FormField>

            <FormField label="Notes">
              <textarea
                name="notes"
                rows={2}
                disabled={isPending}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors resize-none disabled:opacity-60"
              />
            </FormField>
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              disabled={isPending}
              onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-border bg-white text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
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
