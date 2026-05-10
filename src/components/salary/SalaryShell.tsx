"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Plus, Users, TrendingUp, CheckCircle, Clock, Pencil, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import SalaryFormModal from "./SalaryFormModal";
import EmployeeFormModal from "./EmployeeFormModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteExpenseAction } from "@/app/expenses/actions";
import { setEmployeeActiveAction } from "@/app/salary/actions";
import type { ExpenseWithRefs, PaymentMethodRow, EmployeeRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  salaryRows: ExpenseWithRefs[];
  paymentMethodRows: PaymentMethodRow[];
  employeeRows: EmployeeRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthLabel(): string {
  return new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
}

/** Group all salary rows by month, return last 6 months with ₹0 fill. */
function deriveTrend(rows: ExpenseWithRefs[]): { month: string; total: number }[] {
  const now = new Date();
  const result: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-IN", { month: "short" });
    const total = rows
      .filter((r) => r.expense_date.startsWith(key))
      .reduce((s, r) => s + Number(r.amount), 0);
    result.push({ month: label, total });
  }
  return result;
}

const STATUS_DISPLAY: Record<string, { label: string; cls: string }> = {
  verified: { label: "Verified", cls: "bg-[rgb(176_242_213)] text-foreground border-[rgb(176_242_213)]" },
  draft: { label: "Draft", cls: "bg-[rgb(254_221_241)] text-foreground border-[rgb(254_221_241)]" },
  needs_review: { label: "Needs Review", cls: "bg-[rgb(254_221_241)] text-foreground border-[rgb(254_221_241)]" },
  missing_receipt: { label: "Missing Receipt", cls: "bg-[rgb(248_248_248)] text-muted-foreground border-border" },
};

function statusDisplay(status: string) {
  return STATUS_DISPLAY[status] ?? { label: status, cls: "bg-[rgb(248_248_248)] text-muted-foreground border-border" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-md shadow-none p-3 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-muted-foreground">Total: {fmt(payload[0].value)}</p>
    </div>
  );
};

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function SalaryShell({ salaryRows, paymentMethodRows, employeeRows }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"payments" | "employees">("payments");

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithRefs | undefined>();
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | undefined>();
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derived data
  const monthKey = currentMonthKey();
  const thisMonthRows = useMemo(
    () => salaryRows.filter((r) => r.expense_date.startsWith(monthKey)),
    [salaryRows, monthKey]
  );
  const trendData = useMemo(() => deriveTrend(salaryRows), [salaryRows]);

  const totalSalary = thisMonthRows.reduce((s, r) => s + Number(r.amount), 0);
  const headcount = thisMonthRows.length;
  const paidCount = thisMonthRows.filter((r) => r.status === "verified").length;
  const pendingCount = thisMonthRows.filter(
    (r) => r.status === "draft" || r.status === "needs_review"
  ).length;

  const avgMonthly =
    trendData.length > 0
      ? Math.round(trendData.reduce((s, t) => s + t.total, 0) / trendData.filter((t) => t.total > 0).length || 0)
      : 0;

  // Sorted all-time rows for table (newest first)
  const tableRows = useMemo(
    () => [...salaryRows].sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
    [salaryRows]
  );

  function openAdd() {
    setEditingExpense(undefined);
    setFormOpen(true);
  }

  function openAddEmployee() {
    setEditingEmployee(undefined);
    setEmployeeError(null);
    setEmployeeFormOpen(true);
  }

  function openEdit(expense: ExpenseWithRefs) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  function handleSalaryFormOpenChange(open: boolean) {
    setFormOpen(open);
    if (!open) setEditingExpense(undefined);
  }

  function openEditEmployee(employee: EmployeeRow) {
    setEditingEmployee(employee);
    setEmployeeError(null);
    setEmployeeFormOpen(true);
  }

  function openDelete(expense: ExpenseWithRefs) {
    setDeleteId(expense.id);
    setDeleteVendor(expense.vendor);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    setDeleteError(null);
    const result = await deleteExpenseAction(deleteId);
    setDeleteLoading(false);
    if (result.error) {
      setDeleteError(result.error);
    } else {
      setDeleteId(null);
      router.refresh();
    }
  }

  async function toggleEmployeeActive(employee: EmployeeRow) {
    setEmployeeError(null);
    const result = await setEmployeeActiveAction(employee.id, !employee.is_active);
    if (result.error) {
      setEmployeeError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header
        title="Salary Expenses"
        subtitle={
          activeTab === "payments"
            ? `${currentMonthLabel()} · ${headcount} payment${headcount !== 1 ? "s" : ""}`
            : `${employeeRows.filter((employee) => employee.is_active).length} active worker${employeeRows.filter((employee) => employee.is_active).length !== 1 ? "s" : ""}`
        }
        action={
          <button
            onClick={activeTab === "payments" ? openAdd : openAddEmployee}
            className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" />
            {activeTab === "payments" ? "Add Salary Expense" : "Add Employee"}
          </button>
        }
      />

      <div className="px-6 py-5 space-y-6 flex-1">
        <div className="flex items-center gap-2 border-y border-border py-3">
          <button
            onClick={() => setActiveTab("payments")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === "payments"
                ? "border-[rgb(191_178_255)] bg-[rgb(191_178_255)] text-foreground"
                : "border-border bg-white text-muted-foreground hover:bg-[rgb(248_248_248)] hover:text-foreground"
            )}
          >
            Salary Payments
          </button>
          <button
            onClick={() => setActiveTab("employees")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === "employees"
                ? "border-[rgb(191_178_255)] bg-[rgb(191_178_255)] text-foreground"
                : "border-border bg-white text-muted-foreground hover:bg-[rgb(248_248_248)] hover:text-foreground"
            )}
          >
            Employees
          </button>
        </div>

        {activeTab === "payments" && (
          <>
        {/* Summary Cards */}
        <div className="grid grid-cols-4 border-y border-border divide-x divide-border">
          <div className="bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total Salary</p>
              <div className="w-7 h-7 rounded-md bg-[rgb(176_242_213)] flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-foreground" />
              </div>
            </div>
            <p className="text-[26px] font-semibold text-foreground leading-none">{fmt(totalSalary)}</p>
            <p className="text-xs text-muted-foreground font-medium">this month</p>
          </div>

          <div className="bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Headcount</p>
              <div className="w-7 h-7 rounded-md bg-[rgb(248_248_248)] flex items-center justify-center">
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <p className="text-[26px] font-semibold text-foreground leading-none">{headcount}</p>
            <p className="text-xs text-muted-foreground font-medium">employees this month</p>
          </div>

          <div className="bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Verified</p>
              <div className="w-7 h-7 rounded-md bg-[rgb(176_242_213)] flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-foreground" />
              </div>
            </div>
            <p className="text-[26px] font-semibold text-foreground leading-none">{paidCount}</p>
            <p className="text-xs text-muted-foreground font-medium">
              of {headcount} processed
            </p>
          </div>

          <div className="bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Pending</p>
              <div className="w-7 h-7 rounded-md bg-[rgb(254_221_241)] flex items-center justify-center">
                <Clock className="w-4 h-4 text-foreground" />
              </div>
            </div>
            <p className="text-[26px] font-semibold text-foreground leading-none">{pendingCount}</p>
            <p className="text-xs text-muted-foreground font-medium">awaiting payment</p>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="bg-white border-y border-border py-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Salary Trend</p>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            {avgMonthly > 0 && (
              <p className="text-xs text-muted-foreground">
                Avg/month: {fmt(avgMonthly)}
              </p>
            )}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="#e8e8e8" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#696969" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => "₹" + (v / 1000).toFixed(0) + "k"}
                tick={{ fontSize: 11, fill: "#696969" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#b0f2d5"
                strokeWidth={2.5}
                dot={{ fill: "#181818", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#bfb2ff", stroke: "#181818", strokeWidth: 1 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Salary Table */}
        <div className="bg-white border-y border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-[13px] font-semibold text-foreground">Salary Details</p>
            {tableRows.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {tableRows.length} record{tableRows.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {tableRows.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">No salary expenses yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click &ldquo;Add Salary Expense&rdquo; to record the first one.
              </p>
            </div>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-white">
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Employee
                    </th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Description
                    </th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Payment Date
                    </th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Amount
                    </th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Method
                    </th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Status
                    </th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tableRows.map((row) => {
                    const sd = statusDisplay(row.status);
                    const initials = row.vendor
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase();
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-[rgb(248_248_248)] transition-colors group"
                      >
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full border border-border bg-[rgb(248_248_248)] flex items-center justify-center text-[11px] font-semibold text-foreground flex-shrink-0">
                              {initials}
                            </div>
                            <span className="text-xs font-medium text-foreground">
                              {row.vendor}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-2.5 text-xs text-muted-foreground">
                          {row.description ?? "—"}
                        </td>
                        <td className="px-5 py-2.5 text-xs text-muted-foreground">
                          {row.expense_date}
                        </td>
                        <td className="px-5 py-2.5 text-xs font-semibold text-foreground text-right">
                          {fmt(Number(row.amount))}
                        </td>
                        <td className="px-5 py-2.5 text-xs text-muted-foreground">
                          {row.payment_method_name ?? "—"}
                        </td>
                        <td className="px-5 py-2.5">
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-sm border font-medium",
                              sd.cls
                            )}
                          >
                            {sd.label}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button
                              onClick={() => openEdit(row)}
                              title="Edit"
                              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[rgb(248_248_248)] hover:text-foreground transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openDelete(row)}
                              title="Delete"
                              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[rgb(254_221_241)] hover:text-foreground transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="px-5 py-3 border-t border-border bg-white flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {tableRows.length} record{tableRows.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs font-semibold text-foreground">
                  Total (this month): {fmt(totalSalary)}
                </p>
              </div>
            </>
          )}
        </div>
          </>
        )}

        {activeTab === "employees" && (
          <div className="bg-white border-y border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-foreground">Employees & Contractors</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lightweight directory for salary expense entry
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {employeeRows.length} record{employeeRows.length !== 1 ? "s" : ""}
              </p>
            </div>

            {employeeError && (
              <div className="m-5 rounded-md border border-[rgb(254_221_241)] bg-[rgb(254_221_241)] p-3 text-xs text-foreground">
                {employeeError}
              </div>
            )}

            {employeeRows.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">No employees or contractors yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a worker to prefill salary payments.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-white">
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Name</th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Type</th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Role / Department</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Default Salary</th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Payment Method</th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase text-muted-foreground">Status</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employeeRows.map((employee) => {
                    const method = paymentMethodRows.find((row) => row.id === employee.default_payment_method_id);
                    return (
                      <tr key={employee.id} className="hover:bg-[rgb(248_248_248)] transition-colors group">
                        <td className="px-5 py-2.5">
                          <div>
                            <p className="text-xs font-medium text-foreground">{employee.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {employee.email || employee.phone || "No contact saved"}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-2.5 text-xs text-muted-foreground capitalize">
                          {employee.worker_type.replace("_", " ")}
                        </td>
                        <td className="px-5 py-2.5 text-xs text-muted-foreground">
                          {[employee.role, employee.department].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right text-xs font-semibold text-foreground">
                          {employee.default_salary == null ? "—" : fmt(Number(employee.default_salary))}
                        </td>
                        <td className="px-5 py-2.5 text-xs text-muted-foreground">
                          {method?.name ?? "—"}
                        </td>
                        <td className="px-5 py-2.5">
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-sm border font-medium",
                              employee.is_active
                                ? "bg-[rgb(176_242_213)] text-foreground border-[rgb(176_242_213)]"
                                : "bg-[rgb(248_248_248)] text-muted-foreground border-border"
                            )}
                          >
                            {employee.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => openEditEmployee(employee)}
                              title="Edit"
                              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[rgb(248_248_248)] hover:text-foreground transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleEmployeeActive(employee)}
                              title={employee.is_active ? "Deactivate" : "Reactivate"}
                              className={cn(
                                "h-7 rounded-md px-2 text-[11px] font-medium transition-colors",
                                employee.is_active
                                  ? "text-foreground hover:bg-[rgb(254_221_241)]"
                                  : "text-foreground hover:bg-[rgb(176_242_213)]"
                              )}
                            >
                              {employee.is_active ? "Deactivate" : "Reactivate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Form Modal */}
      <SalaryFormModal
        key={editingExpense?.id ?? "new"}
        open={formOpen}
        onOpenChange={handleSalaryFormOpenChange}
        expense={editingExpense}
        paymentMethodRows={paymentMethodRows}
        employeeRows={employeeRows}
      />

      <EmployeeFormModal
        open={employeeFormOpen}
        onOpenChange={setEmployeeFormOpen}
        employee={editingEmployee}
        paymentMethodRows={paymentMethodRows}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Salary Expense</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-foreground">
              Are you sure you want to delete the salary expense for{" "}
              <span className="font-semibold">{deleteVendor}</span>? This cannot be undone.
            </p>
            {deleteError && (
              <div className="p-3 rounded-md bg-[rgb(254_221_241)] border border-[rgb(254_221_241)] text-xs text-foreground">
                {deleteError}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <button
              disabled={deleteLoading}
              onClick={() => {
                setDeleteId(null);
                setDeleteError(null);
              }}
              className="px-4 py-2 rounded-md border border-border bg-white text-sm font-medium text-foreground hover:bg-[rgb(248_248_248)] disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={deleteLoading}
              onClick={confirmDelete}
              className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:bg-neutral-700 disabled:opacity-60 transition-colors"
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
