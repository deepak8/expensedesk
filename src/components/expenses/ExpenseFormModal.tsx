"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseButton,
} from "@/components/ui/dialog";
import {
  createExpenseAction,
  updateExpenseAction,
  type ExpenseActionState,
} from "@/app/expenses/actions";
import type { CategoryRow, PaymentMethodRow, ExpenseWithRefs } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseWithRefs;
  categoryRows: CategoryRow[];
  paymentMethodRows: PaymentMethodRow[];
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
}: Props) {
  const router = useRouter();
  const isEdit = !!expense;
  const formRef = useRef<HTMLFormElement>(null);

  const action = isEdit ? updateExpenseAction : createExpenseAction;
  const [state, formAction, isPending] = useActionState<ExpenseActionState | null, FormData>(
    action,
    null
  );

  // Close and refresh on success
  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state?.success]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      formRef.current?.reset();
    }
  }, [open]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Expense" : "Add Expense"}</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>

        <form ref={formRef} action={formAction}>
          {isEdit && (
            <input type="hidden" name="expense_id" value={expense.id} />
          )}

          <DialogBody className="space-y-4">
            {state?.error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {state.error}
              </div>
            )}

            {/* Row 1: Date + Vendor */}
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

            {/* Row 2: Amount + Currency (fixed) */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Amount" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
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

            {/* Row 3: Category + Payment Method */}
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
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
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
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Row 4: Type + Status */}
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
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
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
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Row 5: Invoice Number */}
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

            {/* Row 6: Notes */}
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
              {isPending
                ? isEdit
                  ? "Saving…"
                  : "Adding…"
                : isEdit
                ? "Save Changes"
                : "Add Expense"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
