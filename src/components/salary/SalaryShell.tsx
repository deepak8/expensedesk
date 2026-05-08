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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteExpenseAction } from "@/app/expenses/actions";
import type { ExpenseWithRefs, PaymentMethodRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  salaryRows: ExpenseWithRefs[];
  paymentMethodRows: PaymentMethodRow[];
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
  verified: { label: "Verified", cls: "bg-green-50 text-green-700 border-green-200" },
  draft: { label: "Draft", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  needs_review: { label: "Needs Review", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  missing_receipt: { label: "Missing Receipt", cls: "bg-gray-100 text-gray-600 border-gray-200" },
};

function statusDisplay(status: string) {
  return STATUS_DISPLAY[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-md p-3 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary">Total: {fmt(payload[0].value)}</p>
    </div>
  );
};

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function SalaryShell({ salaryRows, paymentMethodRows }: Props) {
  const router = useRouter();

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithRefs | undefined>();

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

  function openEdit(expense: ExpenseWithRefs) {
    setEditingExpense(expense);
    setFormOpen(true);
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

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Salary Expenses"
        subtitle={`${currentMonthLabel()} · ${headcount} employee${headcount !== 1 ? "s" : ""}`}
        action={
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Salary Expense
          </button>
        }
      />

      <div className="p-6 space-y-6 flex-1">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-border p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Total Salary</p>
              <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{fmt(totalSalary)}</p>
            <p className="text-xs text-muted-foreground font-medium">this month</p>
          </div>

          <div className="bg-white rounded-xl border border-border p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Headcount</p>
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{headcount}</p>
            <p className="text-xs text-muted-foreground font-medium">employees this month</p>
          </div>

          <div className="bg-white rounded-xl border border-border p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Verified</p>
              <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{paidCount}</p>
            <p className="text-xs text-green-600 font-medium">
              of {headcount} processed
            </p>
          </div>

          <div className="bg-white rounded-xl border border-border p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Pending</p>
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{pendingCount}</p>
            <p className="text-xs text-amber-600 font-medium">awaiting payment</p>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Salary Trend</p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => "₹" + (v / 1000).toFixed(0) + "k"}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#4ade80"
                strokeWidth={2.5}
                dot={{ fill: "#4ade80", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#22c55e" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Salary Table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Salary Details</p>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">
                      Employee
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">
                      Description
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">
                      Payment Date
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground">
                      Amount
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">
                      Method
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="px-5 py-3" />
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
                        className="hover:bg-muted/20 transition-colors group"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary flex-shrink-0">
                              {initials}
                            </div>
                            <span className="text-xs font-medium text-foreground">
                              {row.vendor}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          {row.description ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          {row.expense_date}
                        </td>
                        <td className="px-5 py-3 text-xs font-semibold text-foreground text-right">
                          {fmt(Number(row.amount))}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          {row.payment_method_name ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "text-[11px] px-2 py-0.5 rounded-md border font-medium",
                              sd.cls
                            )}
                          >
                            {sd.label}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button
                              onClick={() => openEdit(row)}
                              title="Edit"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openDelete(row)}
                              title="Delete"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
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

              <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
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
      </div>

      {/* Form Modal */}
      <SalaryFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editingExpense}
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
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
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
              className="px-4 py-2 rounded-lg border border-border bg-white text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={deleteLoading}
              onClick={confirmDelete}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
