"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  Pencil,
  Receipt,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseButton,
} from "@/components/ui/dialog";
import type { ExpenseWithRefs } from "@/lib/supabase/types";
import type { ReviewIssue } from "@/lib/review-issues";
import { cn } from "@/lib/utils";

interface ExpenseDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseWithRefs;
  reviewIssues: ReviewIssue[];
  onEdit: () => void;
  onMarkPaid: () => void;
  onDelete: () => void;
  onViewDocument: (path: string, label: string) => void;
}

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  paid: "bg-[rgb(176_242_213)] text-foreground border-[rgb(176_242_213)]",
  unpaid: "bg-[rgb(254_221_241)] text-foreground border-[rgb(254_221_241)]",
  partially_paid: "bg-[rgb(254_221_241)] text-foreground border-[rgb(254_221_241)]",
};

const REVIEW_STYLES: Record<ReviewIssue["tone"], string> = {
  pink: "bg-[rgb(254_221_241)] text-foreground border-[rgb(254_221_241)]",
};

const AI_SUMMARY_KEYS = [
  "vendor",
  "amount",
  "currency",
  "expense_date",
  "due_date",
  "payment_method_guess",
  "category_guess",
  "description",
  "invoice_number",
  "payment_reference",
] as const;

function fmtCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function titleCase(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm text-foreground">{value || "—"}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{title}</p>
      {children}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
        variant === "danger"
          ? "border-[rgb(254_221_241)] bg-[rgb(254_221_241)] text-foreground hover:bg-[rgb(248_248_248)]"
          : "border-border bg-white text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

function fieldsNeedingReview(raw: Record<string, unknown> | null | undefined) {
  const value = raw?.fields_needing_review;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function aiSummary(raw: Record<string, unknown> | null | undefined) {
  if (!raw) return [];
  return AI_SUMMARY_KEYS.map((key) => ({ key, value: raw[key] }))
    .filter(({ value }) => value !== null && value !== undefined && value !== "")
    .slice(0, 8);
}

export default function ExpenseDetailDrawer({
  open,
  onOpenChange,
  expense,
  reviewIssues,
  onEdit,
  onMarkPaid,
  onDelete,
  onViewDocument,
}: ExpenseDetailDrawerProps) {
  if (!expense) return null;

  const paymentStatus = expense.payment_status ?? "paid";
  const primaryDocLabel = expense.document_type === "invoice" ? "Invoice / Bill" : "Primary Document";
  const canMarkPaid = paymentStatus === "unpaid" || paymentStatus === "partially_paid";
  const aiFields = fieldsNeedingReview(expense.raw_ai_json);
  const aiRows = aiSummary(expense.raw_ai_json);
  const hasAi = expense.ai_confidence !== null || !!expense.raw_ai_json;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 flex h-screen max-h-screen w-full max-w-xl translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-y-0 border-r-0">
        <DialogHeader className="items-start gap-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate">{expense.vendor}</DialogTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xl font-semibold text-foreground">
                {fmtCurrency(expense.amount)}
              </span>
              <span
                className={cn(
                  "rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
                  PAYMENT_STATUS_STYLES[paymentStatus] ?? PAYMENT_STATUS_STYLES.paid
                )}
              >
                {titleCase(paymentStatus)}
              </span>
              <span className="text-xs text-muted-foreground">{expense.expense_date}</span>
            </div>
            {reviewIssues.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {reviewIssues.map((issue) => (
                  <span
                    key={issue.type}
                    className={cn(
                      "rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
                      REVIEW_STYLES[issue.tone]
                    )}
                  >
                    {issue.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <DialogCloseButton />
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 space-y-5 overflow-y-auto">
          <Section title="Expense Details">
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Description" value={expense.description} />
              <DetailField label="Category" value={expense.category_name ?? "Uncategorised"} />
              <DetailField label="Expense Type" value={titleCase(expense.expense_type)} />
              <DetailField label="Document Type" value={titleCase(expense.document_type)} />
              <DetailField label="Invoice Number" value={expense.invoice_number} />
              <DetailField label="Due Date" value={expense.due_date} />
              <DetailField label="Payment Method" value={expense.payment_method_name} />
              <DetailField label="Payment Date" value={expense.payment_date} />
              <DetailField label="Paid Amount" value={expense.paid_amount == null ? "—" : fmtCurrency(expense.paid_amount)} />
              <DetailField label="Payment Reference" value={expense.payment_reference} />
            </div>
            <DetailField label="Notes" value={expense.notes} />
          </Section>

          <Section title="Documents">
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={!expense.receipt_file_path}
                onClick={() => expense.receipt_file_path && onViewDocument(expense.receipt_file_path, primaryDocLabel)}
                className="flex min-h-20 items-start gap-3 rounded-md border border-border bg-white p-3 text-left transition-colors hover:bg-[rgb(191_178_255)]/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {expense.document_type === "invoice" ? (
                  <FileText className="mt-0.5 h-4 w-4 text-foreground" />
                ) : (
                  <Receipt className="mt-0.5 h-4 w-4 text-foreground" />
                )}
                <span>
                  <span className="block text-sm font-medium text-foreground">{primaryDocLabel}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {expense.receipt_file_path ? "View signed preview" : "No primary document"}
                  </span>
                </span>
              </button>
              <button
                disabled={!expense.payment_proof_file_path}
                onClick={() =>
                  expense.payment_proof_file_path &&
                  onViewDocument(expense.payment_proof_file_path, "Payment Proof")
                }
                className="flex min-h-20 items-start gap-3 rounded-md border border-border bg-white p-3 text-left transition-colors hover:bg-[rgb(191_178_255)]/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle className="mt-0.5 h-4 w-4 text-foreground" />
                <span>
                  <span className="block text-sm font-medium text-foreground">Payment Proof</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {expense.payment_proof_file_path ? "View signed preview" : "No payment proof"}
                  </span>
                </span>
              </button>
            </div>
          </Section>

          <Section title="AI Extraction">
            {hasAi ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Confidence</span>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                      (expense.ai_confidence ?? 0) >= 0.85
                        ? "border-[rgb(176_242_213)] bg-[rgb(176_242_213)] text-foreground"
                        : "border-[rgb(254_221_241)] bg-[rgb(254_221_241)] text-foreground"
                    )}
                  >
                    {expense.ai_confidence == null ? "Not stored" : `${Math.round(expense.ai_confidence * 100)}%`}
                  </span>
                </div>
                {aiFields.length > 0 && (
                  <div className="rounded-md border border-[rgb(254_221_241)] bg-[rgb(254_221_241)] p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Fields needing review
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {aiFields.map((field) => (
                        <span
                          key={field}
                          className="rounded-sm border border-border bg-white px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                        >
                          {titleCase(field)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {aiRows.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-[rgb(248_248_248)] p-3">
                    {aiRows.map(({ key, value }) => (
                      <DetailField key={key} label={titleCase(key)} value={String(value)} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No AI extraction summary is stored for this expense.</p>
            )}
          </Section>

          <Section title="Review Issues">
            {reviewIssues.length > 0 ? (
              <div className="space-y-2">
                {reviewIssues.map((issue) => (
                  <div
                    key={issue.type}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium",
                      REVIEW_STYLES[issue.tone]
                    )}
                  >
                    {issue.label}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No review issues detected.</p>
            )}
          </Section>
        </DialogBody>

        <DialogFooter className="flex-wrap justify-between">
          <div className="flex flex-wrap gap-2">
            {expense.receipt_file_path && (
              <ActionButton onClick={() => onViewDocument(expense.receipt_file_path!, primaryDocLabel)}>
                <FileText className="h-3.5 w-3.5" />
                Primary Document
              </ActionButton>
            )}
            {expense.payment_proof_file_path && (
              <ActionButton onClick={() => onViewDocument(expense.payment_proof_file_path!, "Payment Proof")}>
                <CheckCircle className="h-3.5 w-3.5" />
                Payment Proof
              </ActionButton>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canMarkPaid && (
              <ActionButton onClick={onMarkPaid}>
                <CheckCircle className="h-3.5 w-3.5" />
                Mark Paid
              </ActionButton>
            )}
            <ActionButton onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </ActionButton>
            <ActionButton onClick={onDelete} variant="danger">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </ActionButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
