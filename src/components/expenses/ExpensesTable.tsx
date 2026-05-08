"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Filter, Receipt, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import ExpenseFormModal from "@/components/expenses/ExpenseFormModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { deleteExpenseAction } from "@/app/expenses/actions";
import type { CategoryRow, PaymentMethodRow, ExpenseWithRefs } from "@/lib/supabase/types";

export interface DisplayExpense {
  id: string;
  date: string;
  vendor: string;
  category: string;
  description: string;
  paymentMethod: string;
  amount: number;
  hasReceipt: boolean;
  status: "Verified" | "Needs Review" | "Pending" | "Draft" | "Missing Receipt";
}

const STATUS_STYLES: Record<DisplayExpense["status"], string> = {
  Verified: "bg-green-50 text-green-700 border-green-200",
  "Needs Review": "bg-amber-50 text-amber-700 border-amber-200",
  Pending: "bg-gray-100 text-gray-600 border-gray-200",
  Draft: "bg-gray-100 text-gray-500 border-gray-200",
  "Missing Receipt": "bg-red-50 text-red-600 border-red-200",
};

function FilterSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-border rounded-lg px-3 py-2 bg-white text-foreground appearance-none cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

interface Props {
  initialExpenses: DisplayExpense[];
  rawExpenses: ExpenseWithRefs[];
  categoryRows: CategoryRow[];
  paymentMethodRows: PaymentMethodRow[];
}

export default function ExpensesTable({
  initialExpenses,
  rawExpenses,
  categoryRows,
  paymentMethodRows,
}: Props) {
  const router = useRouter();
  const [isPendingDelete, startDeleteTransition] = useTransition();

  // Filter state
  const [category, setCategory] = useState("All Categories");
  const [method, setMethod] = useState("All Methods");
  const [status, setStatus] = useState("All Statuses");

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseWithRefs | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<DisplayExpense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(categoryRows.map((c) => c.name))].sort(), [categoryRows]);
  const paymentMethods = useMemo(() => [...new Set(paymentMethodRows.map((m) => m.name))].sort(), [paymentMethodRows]);

  const categoryOptions = ["All Categories", ...categories];
  const methodOptions = ["All Methods", ...paymentMethods];
  const statusOptions = ["All Statuses", "Verified", "Needs Review", "Pending", "Draft", "Missing Receipt"];

  const filtered = useMemo(() => {
    return initialExpenses.filter((e) => {
      if (category !== "All Categories" && e.category !== category) return false;
      if (method !== "All Methods" && e.paymentMethod !== method) return false;
      if (status !== "All Statuses" && e.status !== status) return false;
      return true;
    });
  }, [initialExpenses, category, method, status]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const hasFilters =
    category !== "All Categories" || method !== "All Methods" || status !== "All Statuses";

  function openCreate() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    const raw = rawExpenses.find((r) => r.id === id);
    setEditTarget(raw);
    setFormOpen(true);
  }

  function confirmDelete(expense: DisplayExpense) {
    setDeleteError(null);
    setDeleteTarget(expense);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const result = await deleteExpenseAction(deleteTarget.id);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Expenses"
        subtitle={`${filtered.length} transactions · ₹${total.toLocaleString("en-IN")} total`}
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Expense
          </button>
        }
      />

      <div className="p-6 space-y-4 flex-1">
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <FilterSelect options={categoryOptions} value={category} onChange={setCategory} />
          <FilterSelect options={methodOptions} value={method} onChange={setMethod} />
          <FilterSelect options={statusOptions} value={status} onChange={setStatus} />
          {hasFilters && (
            <button
              onClick={() => {
                setCategory("All Categories");
                setMethod("All Methods");
                setStatus("All Statuses");
              }}
              className="text-xs text-primary hover:underline font-medium ml-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Vendor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Method</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Receipt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3 text-xs font-medium text-foreground whitespace-nowrap">{e.vendor}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {e.category || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                    {e.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {e.paymentMethod || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-foreground text-right whitespace-nowrap">
                    ₹{e.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {e.hasReceipt ? (
                      <Receipt className="w-3.5 h-3.5 text-green-500 mx-auto" />
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-md border font-medium",
                        STATUS_STYLES[e.status] ?? STATUS_STYLES["Draft"]
                      )}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(e.id)}
                        title="Edit"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => confirmDelete(e)}
                        title="Delete"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No expenses match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{filtered.length} records</p>
              <p className="text-xs font-semibold text-foreground">
                Total: ₹{total.toLocaleString("en-IN")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      <ExpenseFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editTarget}
        categoryRows={categoryRows}
        paymentMethodRows={paymentMethodRows}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <DialogBody>
            {deleteError && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {deleteError}
              </div>
            )}
            <p className="text-sm text-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteTarget?.vendor}</span>
              {deleteTarget?.date ? ` on ${deleteTarget.date}` : ""}?
            </p>
            <p className="text-xs text-muted-foreground mt-1">This action cannot be undone.</p>
          </DialogBody>
          <DialogFooter>
            <button
              disabled={isPendingDelete}
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-lg border border-border bg-white text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={isPendingDelete}
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {isPendingDelete ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
