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
  createEmployeeAction,
  updateEmployeeAction,
  type SalaryActionState,
} from "@/app/salary/actions";
import type { EmployeeRow, PaymentMethodRow } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EmployeeRow;
  paymentMethodRows: PaymentMethodRow[];
}

const WORKER_TYPES = [
  { value: "employee", label: "Employee" },
  { value: "contractor", label: "Contractor" },
  { value: "freelancer", label: "Freelancer" },
  { value: "other", label: "Other" },
];

const PAYMENT_CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "ad_hoc", label: "Ad Hoc" },
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
      <label className="mb-1.5 block text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

const selectCls =
  "h-9 w-full cursor-pointer appearance-none rounded-lg border border-border bg-white px-3 text-sm text-foreground transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

export default function EmployeeFormModal({
  open,
  onOpenChange,
  employee,
  paymentMethodRows,
}: Props) {
  const router = useRouter();
  const isEdit = !!employee;
  const paymentMethodOptions = paymentMethodRows.filter(
    (method) => method.is_active || method.id === employee?.default_payment_method_id
  );
  const formRef = useRef<HTMLFormElement>(null);
  const action = isEdit ? updateEmployeeAction : createEmployeeAction;
  const [state, formAction, isPending] = useActionState<SalaryActionState | null, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state?.success, onOpenChange, router]);

  useEffect(() => {
    if (!open) formRef.current?.reset();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Employee" : "Add Employee"}</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>

        <form ref={formRef} action={formAction}>
          {isEdit && <input type="hidden" name="employee_id" value={employee.id} />}

          <DialogBody className="space-y-4">
            {state?.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {state.error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Name" required>
                <input
                  name="name"
                  required
                  disabled={isPending}
                  defaultValue={employee?.name ?? ""}
                  placeholder="e.g. Kumar"
                  className={inputCls}
                />
              </FormField>
              <FormField label="Worker Type" required>
                <select
                  name="worker_type"
                  required
                  disabled={isPending}
                  defaultValue={employee?.worker_type ?? "employee"}
                  className={selectCls}
                >
                  {WORKER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Role">
                <input
                  name="role"
                  disabled={isPending}
                  defaultValue={employee?.role ?? ""}
                  placeholder="Optional"
                  className={inputCls}
                />
              </FormField>
              <FormField label="Department">
                <input
                  name="department"
                  disabled={isPending}
                  defaultValue={employee?.department ?? ""}
                  placeholder="Optional"
                  className={inputCls}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Email">
                <input
                  type="email"
                  name="email"
                  disabled={isPending}
                  defaultValue={employee?.email ?? ""}
                  placeholder="Optional"
                  className={inputCls}
                />
              </FormField>
              <FormField label="Phone">
                <input
                  name="phone"
                  disabled={isPending}
                  defaultValue={employee?.phone ?? ""}
                  placeholder="Optional"
                  className={inputCls}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Default Salary">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
                  <input
                    type="number"
                    name="default_salary"
                    min="0"
                    step="0.01"
                    disabled={isPending}
                    defaultValue={employee?.default_salary ?? ""}
                    placeholder="0.00"
                    className={inputCls + " pl-7"}
                  />
                </div>
              </FormField>
              <FormField label="Default Payment Method">
                <select
                  name="default_payment_method_id"
                  disabled={isPending}
                  defaultValue={employee?.default_payment_method_id ?? ""}
                  className={selectCls}
                >
                  <option value="">Select...</option>
                  {paymentMethodOptions.map((method) => (
                    <option key={method.id} value={method.id}>{method.name}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Payment Cycle" required>
                <select
                  name="payment_cycle"
                  required
                  disabled={isPending}
                  defaultValue={employee?.payment_cycle ?? "monthly"}
                  className={selectCls}
                >
                  {PAYMENT_CYCLES.map((cycle) => (
                    <option key={cycle.value} value={cycle.value}>{cycle.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status">
                <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    name="is_active"
                    disabled={isPending}
                    defaultChecked={employee?.is_active ?? true}
                    className="h-4 w-4 accent-primary"
                  />
                  Active
                </label>
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea
                name="notes"
                rows={2}
                disabled={isPending}
                defaultValue={employee?.notes ?? ""}
                placeholder="Optional"
                className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </FormField>
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Employee"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
