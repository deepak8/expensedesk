"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  createSalaryAction,
  updateSalaryAction,
  type SalaryActionState,
} from "@/app/salary/actions";
import type { PaymentMethodRow, ExpenseWithRefs, EmployeeRow } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseWithRefs;
  paymentMethodRows: PaymentMethodRow[];
  employeeRows: EmployeeRow[];
}

const SALARY_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "verified", label: "Verified" },
  { value: "needs_review", label: "Needs Review" },
];

const PAYMENT_STATUSES = [
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
];

/** "Salary for May 2026" → "2026-05" */
function descriptionToMonth(description: string | null): string {
  if (!description) return "";
  const match = description.match(/^Salary for (\w+) (\d{4})$/);
  if (!match) return "";
  const names: Record<string, string> = {
    January: "01", February: "02", March: "03", April: "04",
    May: "05", June: "06", July: "07", August: "08",
    September: "09", October: "10", November: "11", December: "12",
  };
  const m = names[match[1]];
  return m ? `${match[2]}-${m}` : "";
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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

export default function SalaryFormModal({
  open,
  onOpenChange,
  expense,
  paymentMethodRows,
  employeeRows,
}: Props) {
  const router = useRouter();
  const isEdit = !!expense;
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(expense?.employee_id ?? "");
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [amount, setAmount] = useState(expense?.amount != null ? String(expense.amount) : "");
  const [paymentMethodId, setPaymentMethodId] = useState(expense?.payment_method_id != null ? String(expense.payment_method_id) : "");

  const action = isEdit ? updateSalaryAction : createSalaryAction;
  const [state, formAction, isPending] = useActionState<SalaryActionState | null, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state?.success]);

  useEffect(() => {
    if (!open) {
      formRef.current?.reset();
    }
    if (open) {
      setSelectedEmployeeId(expense?.employee_id ?? "");
      setVendor(expense?.vendor ?? "");
      setAmount(expense?.amount != null ? String(expense.amount) : "");
      setPaymentMethodId(expense?.payment_method_id != null ? String(expense.payment_method_id) : "");
    }
  }, [open]);

  const today = new Date().toISOString().split("T")[0];
  const defaultMonth = expense
    ? descriptionToMonth(expense.description)
    : currentMonth();
  const activeEmployees = employeeRows.filter((employee) => employee.is_active || employee.id === expense?.employee_id);
  const paymentMethodOptions = paymentMethodRows.filter(
    (method) => method.is_active || method.id === expense?.payment_method_id
  );

  function handleEmployeeChange(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    const employee = employeeRows.find((row) => row.id === employeeId);
    if (!employee) return;

    setVendor(employee.name);
    if (employee.default_salary !== null) setAmount(String(employee.default_salary));
    if (employee.default_payment_method_id !== null) {
      setPaymentMethodId(String(employee.default_payment_method_id));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Salary Expense" : "Add Salary Expense"}
          </DialogTitle>
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

            <FormField label="Employee / Contractor">
              <select
                name="employee_id"
                disabled={isPending}
                value={selectedEmployeeId}
                onChange={(event) => handleEmployeeChange(event.target.value)}
                className={selectCls}
              >
                <option value="">Manual entry / not in directory</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {employee.role ? ` · ${employee.role}` : ""}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Row 1: Employee Name + Salary Month */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Employee / Contractor Name" required>
                <input
                  type="text"
                  name="vendor"
                  required
                  disabled={isPending}
                  value={vendor}
                  onChange={(event) => setVendor(event.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className={inputCls}
                />
              </FormField>
              <FormField label="Salary Month">
                <input
                  type="month"
                  name="salary_month"
                  disabled={isPending}
                  defaultValue={defaultMonth}
                  className={inputCls}
                />
              </FormField>
            </div>

            {/* Row 2: Payment Date + Amount */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Payment Date" required>
                <input
                  type="date"
                  name="expense_date"
                  required
                  disabled={isPending}
                  defaultValue={expense?.expense_date ?? today}
                  className={inputCls}
                />
              </FormField>
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
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    className={inputCls + " pl-7"}
                  />
                </div>
              </FormField>
            </div>

            {/* Row 3: Payment Method + Status */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Payment Method" required>
                <select
                  name="payment_method_id"
                  required
                  disabled={isPending}
                  value={paymentMethodId}
                  onChange={(event) => setPaymentMethodId(event.target.value)}
                  className={selectCls}
                >
                  <option value="">Select…</option>
                  {paymentMethodOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
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
                  {SALARY_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Payment Status" required>
              <select
                name="payment_status"
                required
                disabled={isPending}
                defaultValue={expense?.payment_status ?? "paid"}
                className={selectCls}
              >
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Row 4: Notes */}
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
                ? isEdit ? "Saving…" : "Adding…"
                : isEdit ? "Save Changes" : "Add Salary Expense"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
