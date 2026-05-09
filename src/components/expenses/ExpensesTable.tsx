"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Plus, Filter, Receipt, Pencil, Trash2, Loader2, CheckCircle, FileText, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseButton,
} from "@/components/ui/dialog";
import ExpenseDetailDrawer from "@/components/expenses/ExpenseDetailDrawer";
import type { CategoryRow, PaymentMethodRow, ExpenseWithRefs } from "@/lib/supabase/types";
import {
  deriveReviewIssues,
  findDuplicateIds,
  type ReviewIssue,
  type ReviewIssueType,
} from "@/lib/review-issues";

const ExpenseFormModal = dynamic(
  () => import("@/components/expenses/ExpenseFormModal"),
  { ssr: false }
);
const ReceiptPreviewModal = dynamic(
  () => import("@/components/expenses/ReceiptPreviewModal"),
  { ssr: false }
);
const MarkPaidModal = dynamic(
  () => import("@/components/expenses/MarkPaidModal"),
  { ssr: false }
);

export interface DisplayExpense {
  id: string;
  date: string;
  vendor: string;
  category: string;
  description: string;
  paymentMethod: string;
  amount: number;
  hasReceipt: boolean;
  receiptPath: string | null;
  paymentProofPath: string | null;
  status: "Verified" | "Needs Review" | "Pending" | "Draft" | "Missing Receipt";
  paymentStatus: "Paid" | "Unpaid" | "Partially Paid";
  documentType: string;
  dueDate: string | null;
  reviewIssues: ReviewIssue[];
}

const STATUS_STYLES: Record<DisplayExpense["status"], string> = {
  Verified: "bg-green-50 text-green-700 border-green-200",
  "Needs Review": "bg-amber-50 text-amber-700 border-amber-200",
  Pending: "bg-gray-100 text-gray-600 border-gray-200",
  Draft: "bg-gray-100 text-gray-500 border-gray-200",
  "Missing Receipt": "bg-red-50 text-red-600 border-red-200",
};

const STATUS_MAP: Record<string, DisplayExpense["status"]> = {
  verified: "Verified",
  needs_review: "Needs Review",
  draft: "Draft",
  missing_receipt: "Missing Receipt",
};

const PAYMENT_STATUS_STYLES: Record<DisplayExpense["paymentStatus"], string> = {
  Paid: "bg-green-50 text-green-700 border-green-200",
  Unpaid: "bg-orange-50 text-orange-700 border-orange-200",
  "Partially Paid": "bg-amber-50 text-amber-700 border-amber-200",
};

const PAYMENT_STATUS_MAP: Record<string, DisplayExpense["paymentStatus"]> = {
  paid: "Paid",
  unpaid: "Unpaid",
  partially_paid: "Partially Paid",
};

const REVIEW_STYLES: Record<ReviewIssue["tone"], string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
};

const REVIEW_FILTERS: Array<{ value: "All Review" | ReviewIssueType; label: string }> = [
  { value: "All Review", label: "All Review" },
  { value: "needs_review", label: "Needs Review" },
  { value: "possible_duplicate", label: "Possible Duplicate" },
  { value: "missing_proof", label: "Missing Proof" },
  { value: "amount_mismatch", label: "Amount Mismatch" },
  { value: "low_ai_confidence", label: "Low AI Confidence" },
];

function toDisplay(row: ExpenseWithRefs, duplicateIds: Set<string>): DisplayExpense {
  return {
    id: row.id,
    date: row.expense_date,
    vendor: row.vendor,
    category: row.category_name ?? "Uncategorised",
    description: row.description ?? "",
    paymentMethod: row.payment_method_name ?? "—",
    amount: Number(row.amount),
    hasReceipt: !!row.receipt_file_path,
    receiptPath: row.receipt_file_path ?? null,
    paymentProofPath: row.payment_proof_file_path ?? null,
    status: STATUS_MAP[row.status] ?? "Draft",
    paymentStatus: PAYMENT_STATUS_MAP[row.payment_status] ?? "Paid",
    documentType: row.document_type ?? "receipt",
    dueDate: row.due_date ?? null,
    reviewIssues: deriveReviewIssues(row, duplicateIds),
  };
}

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
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

export default function ExpensesTable() {
  // ─── Data state ──────────────────────────────────────────────────────────────
  const [rawExpenses, setRawExpenses] = useState<ExpenseWithRefs[]>([]);
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [paymentMethodRows, setPaymentMethodRows] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ─── Filter state ────────────────────────────────────────────────────────────
  const [category, setCategory] = useState("All Categories");
  const [method, setMethod] = useState("All Methods");
  const [status, setStatus] = useState("All Statuses");
  const [paymentFilter, setPaymentFilter] = useState("All Payments");
  const [reviewFilter, setReviewFilter] = useState<"All Review" | ReviewIssueType>("All Review");

  // ─── Modal state ─────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseWithRefs | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<DisplayExpense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<{
    path: string;
    vendor: string;
    label?: string;
  } | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<DisplayExpense | null>(null);
  const [detailTargetId, setDetailTargetId] = useState<string | null>(null);

  // ─── Load all data ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [expRes, catRes, pmRes] = await Promise.all([
        fetch("/api/expenses"),
        fetch("/api/categories"),
        fetch("/api/payment-methods"),
      ]);

      if (!expRes.ok || !catRes.ok || !pmRes.ok) {
        const failing = !expRes.ok ? expRes : !catRes.ok ? catRes : pmRes;
        const errJson = await failing.json().catch(() => ({}));
        throw new Error(errJson.error ?? "Failed to load data.");
      }

      const [expenses, cats, methods] = await Promise.all([
        expRes.json(),
        catRes.json(),
        pmRes.json(),
      ]);

      setRawExpenses(expenses);
      setCategoryRows(cats);
      setPaymentMethodRows(methods);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Derived display data ────────────────────────────────────────────────────
  const duplicateIds = useMemo(() => findDuplicateIds(rawExpenses), [rawExpenses]);

  const expenses = useMemo(() => {
    return rawExpenses.map((row) => toDisplay(row, duplicateIds));
  }, [rawExpenses, duplicateIds]);

  const categories = useMemo(() => [...new Set(categoryRows.map((c) => c.name))].sort(), [categoryRows]);
  const paymentMethods = useMemo(() => [...new Set(paymentMethodRows.map((m) => m.name))].sort(), [paymentMethodRows]);

  const categoryOptions = ["All Categories", ...categories];
  const methodOptions = ["All Methods", ...paymentMethods];
  const statusOptions = ["All Statuses", "Verified", "Needs Review", "Pending", "Draft", "Missing Receipt"];
  const paymentOptions = ["All Payments", "Paid", "Unpaid", "Partially Paid"];

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (category !== "All Categories" && e.category !== category) return false;
      if (method !== "All Methods" && e.paymentMethod !== method) return false;
      if (status !== "All Statuses" && e.status !== status) return false;
      if (paymentFilter !== "All Payments" && e.paymentStatus !== paymentFilter) return false;
      if (reviewFilter !== "All Review" && !e.reviewIssues.some((issue) => issue.type === reviewFilter)) return false;
      return true;
    });
  }, [expenses, category, method, status, paymentFilter, reviewFilter]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const hasFilters =
    category !== "All Categories" ||
    method !== "All Methods" ||
    status !== "All Statuses" ||
    paymentFilter !== "All Payments" ||
    reviewFilter !== "All Review";

  const detailTarget = useMemo(
    () => rawExpenses.find((row) => row.id === detailTargetId),
    [rawExpenses, detailTargetId]
  );

  const detailDisplay = useMemo(
    () => expenses.find((expense) => expense.id === detailTargetId),
    [expenses, detailTargetId]
  );

  const detailReviewIssues = useMemo(
    () => (detailTarget ? deriveReviewIssues(detailTarget, duplicateIds) : []),
    [detailTarget, duplicateIds]
  );

  // ─── Actions ─────────────────────────────────────────────────────────────────
  function openCreate() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    setEditTarget(rawExpenses.find((r) => r.id === id));
    setFormOpen(true);
  }

  function openDetails(id: string) {
    setDetailTargetId(id);
  }

  function confirmDelete(expense: DisplayExpense) {
    setDeleteError(null);
    setDeleteTarget(expense);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        setDeleteError(json.error ?? "Delete failed.");
        return;
      }
      setDeleteTarget(null);
      loadData();
    } catch {
      setDeleteError("Network error — please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  function clearFilters() {
    setCategory("All Categories");
    setMethod("All Methods");
    setStatus("All Statuses");
    setPaymentFilter("All Payments");
    setReviewFilter("All Review");
  }

  /** Determine the label for the receipt/document preview modal */
  function docLabel(e: DisplayExpense): string {
    if (e.documentType === "invoice") return "Invoice";
    return "Receipt";
  }

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header
          title="Expenses"
          subtitle="Loading…"
          action={
            <button disabled className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium opacity-50">
              <Plus className="w-3.5 h-3.5" />
              Add Expense
            </button>
          }
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading expenses…</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Expenses" subtitle="Error loading data" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700 space-y-3">
            <p className="font-medium">Failed to load expenses</p>
            <p className="text-xs">{fetchError}</p>
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Table ───────────────────────────────────────────────────────────────────
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
          <FilterSelect options={paymentOptions} value={paymentFilter} onChange={setPaymentFilter} />
          <FilterSelect
            options={REVIEW_FILTERS.map((r) => r.label)}
            value={REVIEW_FILTERS.find((r) => r.value === reviewFilter)?.label ?? "All Review"}
            onChange={(label) => {
              const next = REVIEW_FILTERS.find((r) => r.label === label)?.value ?? "All Review";
              setReviewFilter(next);
            }}
          />
          {hasFilters && (
            <button
              onClick={clearFilters}
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
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Docs</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Attention</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Payment</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground w-28">Actions</th>
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
                  {/* Docs column — receipt / invoice / payment proof icons */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {e.receiptPath ? (
                        <button
                          onClick={() =>
                            setPreviewReceipt({
                              path: e.receiptPath!,
                              vendor: e.vendor,
                              label: docLabel(e),
                            })
                          }
                          title={`View ${docLabel(e).toLowerCase()}`}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-green-500 hover:bg-green-50 hover:text-green-600 transition-colors"
                        >
                          {e.documentType === "invoice" ? (
                            <FileText className="w-3.5 h-3.5" />
                          ) : (
                            <Receipt className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                      {e.paymentProofPath && (
                        <button
                          onClick={() =>
                            setPreviewReceipt({
                              path: e.paymentProofPath!,
                              vendor: e.vendor,
                              label: "Payment Proof",
                            })
                          }
                          title="View payment proof"
                          className="w-6 h-6 rounded-md flex items-center justify-center text-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {e.reviewIssues.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {e.reviewIssues.slice(0, 2).map((issue) => (
                          <span
                            key={issue.type}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-md border font-medium whitespace-nowrap",
                              REVIEW_STYLES[issue.tone]
                            )}
                          >
                            {issue.label}
                          </span>
                        ))}
                        {e.reviewIssues.length > 2 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border bg-muted text-muted-foreground font-medium">
                            +{e.reviewIssues.length - 2}
                          </span>
                        )}
                      </div>
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
                  {/* Payment status */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-md border font-medium",
                        PAYMENT_STATUS_STYLES[e.paymentStatus] ?? PAYMENT_STATUS_STYLES["Paid"]
                      )}
                    >
                      {e.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openDetails(e.id)}
                        title="View Details"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                      {/* Mark Paid button — only for unpaid/partially paid */}
                      {(e.paymentStatus === "Unpaid" || e.paymentStatus === "Partially Paid") && (
                        <button
                          onClick={() => setMarkPaidTarget(e)}
                          title="Mark as Paid"
                          className="w-6 h-6 rounded-md flex items-center justify-center text-green-600 hover:bg-green-50 hover:text-green-700 transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                        </button>
                      )}
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
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
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
        onSaved={loadData}
      />

      {/* Receipt / Invoice / Payment proof preview modal */}
      {previewReceipt && (
        <ReceiptPreviewModal
          open={!!previewReceipt}
          onOpenChange={(open) => { if (!open) setPreviewReceipt(null); }}
          receiptPath={previewReceipt.path}
          vendor={previewReceipt.vendor}
          label={previewReceipt.label}
        />
      )}

      {/* Mark Paid modal */}
      {markPaidTarget && (
        <MarkPaidModal
          open={!!markPaidTarget}
          onOpenChange={(open) => { if (!open) setMarkPaidTarget(null); }}
          expense={markPaidTarget}
          paymentMethodRows={paymentMethodRows}
          onSaved={loadData}
        />
      )}

      <ExpenseDetailDrawer
        open={!!detailTarget}
        onOpenChange={(open) => { if (!open) setDetailTargetId(null); }}
        expense={detailTarget}
        reviewIssues={detailReviewIssues}
        onEdit={() => {
          if (!detailTarget) return;
          setDetailTargetId(null);
          openEdit(detailTarget.id);
        }}
        onMarkPaid={() => {
          if (!detailDisplay) return;
          setDetailTargetId(null);
          setMarkPaidTarget(detailDisplay);
        }}
        onDelete={() => {
          if (!detailDisplay) return;
          setDetailTargetId(null);
          confirmDelete(detailDisplay);
        }}
        onViewDocument={(path, label) => {
          if (!detailTarget) return;
          setPreviewReceipt({ path, vendor: detailTarget.vendor, label });
        }}
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
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-lg border border-border bg-white text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={isDeleting}
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
