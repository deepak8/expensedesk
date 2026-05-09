"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseButton,
} from "@/components/ui/dialog";
import type { CategoryRow, PaymentMethodRow, ExpenseWithRefs } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseWithRefs;
  categoryRows: CategoryRow[];
  paymentMethodRows: PaymentMethodRow[];
  onSaved: () => void;
}

const EXPENSE_TYPES = [
  { value: "manual", label: "Manual" },
  { value: "receipt", label: "Receipt" },
  { value: "salary", label: "Salary" },
  { value: "reimbursement", label: "Reimbursement" },
];

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "needs_review", label: "Needs Review" },
  { value: "verified", label: "Verified" },
  { value: "missing_receipt", label: "Missing Receipt" },
];

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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

const inputCls =
  "w-full h-9 px-3 text-sm rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors disabled:opacity-60";

const selectCls =
  "w-full h-9 px-3 text-sm rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors disabled:opacity-60 appearance-none cursor-pointer";

export default function ExpenseFormModal({
  open,
  onOpenChange,
  expense,
  categoryRows,
  paymentMethodRows,
  onSaved,
}: Props) {
  const isEdit = !!expense;
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      formRef.current?.reset();
    }
  }, [open]);

  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      expense_date: (fd.get("expense_date") as string)?.trim(),
      vendor: (fd.get("vendor") as string)?.trim(),
      amount: fd.get("amount"),
      category_id: fd.get("category_id"),
      payment_method_id: fd.get("payment_method_id"),
      expense_type: fd.get("expense_type"),
      status: fd.get("status"),
      description: (fd.get("description") as string)?.trim() || null,
      invoice_number: (fd.get("invoice_number") as string)?.trim() || null,
      notes: (fd.get("notes") as string)?.trim() || null,
    };

    try {
      const url = isEdit ? `/api/expenses/${expense!.id}` : "/api/expenses";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "An error occurred.");
      } else {
        onOpenChange(false);
        onSaved();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Expense" : "Add Expense"}</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Date" required>
                <input
                  type="date"
                  name="expense_date"
                  required
                  disabled={isPending}
                  defaultValue={expense?.expense_date ?? today}
                  className={inputCls}
                />
              </FormField>
              <FormField label="Vendor" required>
                <input
                  type="text"
                  name="vendor"
                  required
                  disabled={isPending}
                  defaultValue={expense?.vendor ?? ""}
                  placeholder="e.g. Amazon"
                  className={inputCls}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Amount" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                  <input
                    type="number"
                    name="amount"
                    required
                    min="0"
                    step="0.01"
                    disabled={isPending}
                    defaultValue={expense?.amount ?? ""}
                    placeholder="0.00"
                    className={inputCls + " pl-7"}
                  />
                </div>
              </FormField>
              <FormField label="Description">
                <input
                  type="text"
                  name="description"
                  disabled={isPending}
                  defaultValue={expense?.description ?? ""}
                  placeholder="Optional"
                  className={inputCls}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Category" required>
                <select
                  name="category_id"
                  required
                  disabled={isPending}
                  defaultValue={expense?.category_id ?? ""}
                  className={selectCls}
                >
                  <option value="">Select…</option>
                  {categoryRows.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Payment Method" required>
                <select
                  name="payment_method_id"
                  required
                  disabled={isPending}
                  defaultValue={expense?.payment_method_id ?? ""}
                  className={selectCls}
                >
                  <option value="">Select…</option>
                  {paymentMethodRows.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Type" required>
                <select
                  name="expense_type"
                  required
                  disabled={isPending}
                  defaultValue={expense?.expense_type ?? "manual"}
                  className={selectCls}
                >
                  {EXPENSE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status" required>
                <select
                  name="status"
                  required
                  disabled={isPending}
                  defaultValue={expense?.status ?? "draft"}
                  className={selectCls}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Invoice Number">
              <input
                type="text"
                name="invoice_number"
                disabled={isPending}
                defaultValue={expense?.invoice_number ?? ""}
                placeholder="Optional"
                className={inputCls}
              />
            </FormField>

            <FormField label="Notes">
              <textarea
                name="notes"
                rows={2}
                disabled={isPending}
                defaultValue={expense?.notes ?? ""}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors resize-none disabled:opacity-60"
              />
            </FormField>
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg border border-border bg-white text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {isPending ? (isEdit ? "Saving…" : "Adding…") : isEdit ? "Save Changes" : "Add Expense"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
