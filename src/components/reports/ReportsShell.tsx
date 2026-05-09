"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Calendar, Download, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import type {
  CategorySummaryRow,
  MonthlyReportData,
  NeedsAttentionReportRow,
  PaymentStatusSummaryRow,
  ReportExpenseRow,
  SalaryReportRow,
  VendorSummaryRow,
} from "@/lib/reports-data";
import type { PaymentStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type CsvValue = string | number | boolean | null | undefined;

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  paid: "bg-green-50 text-green-700 border-green-200",
  unpaid: "bg-orange-50 text-orange-700 border-orange-200",
  partially_paid: "bg-amber-50 text-amber-700 border-amber-200",
};

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function fmtCurrency(amount: number) {
  return "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function titleCaseStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);
  return date.toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function escapeCsv(value: CsvValue) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadCsv<T>(
  filename: string,
  columns: Array<{ header: string; value: (row: T) => CsvValue }>,
  rows: T[]
) {
  const header = columns.map((column) => escapeCsv(column.header)).join(",");
  const body = rows
    .map((row) => columns.map((column) => escapeCsv(column.value(row))).join(","))
    .join("\n");
  const csv = [header, body].filter(Boolean).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        PAYMENT_STATUS_STYLES[status]
      )}
    >
      {titleCaseStatus(status)}
    </span>
  );
}

function ExportButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
    >
      <Download className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function SummaryCard({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
    </div>
  );
}

function TableSection({
  title,
  subtitle,
  action,
  headers,
  empty,
  emptyText,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  headers: string[];
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {empty ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {headers.map((header) => (
                  <th
                    key={header}
                    className={cn(
                      "px-5 py-3 text-left text-xs font-semibold text-muted-foreground",
                      header.includes("Amount") || header === "Count" ? "text-right" : ""
                    )}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">{children}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const expenseCsvColumns: Array<{ header: string; value: (row: ReportExpenseRow) => CsvValue }> = [
  { header: "date", value: (row) => row.expense_date },
  { header: "vendor", value: (row) => row.vendor },
  { header: "description", value: (row) => row.description },
  { header: "category", value: (row) => row.category_name ?? "Uncategorised" },
  { header: "amount", value: (row) => row.amount },
  { header: "paid_amount", value: (row) => row.paid_amount },
  { header: "payment_status", value: (row) => row.payment_status },
  { header: "document_type", value: (row) => row.document_type },
  { header: "expense_type", value: (row) => row.expense_type },
  { header: "payment_method", value: (row) => row.payment_method_name },
  { header: "invoice_number", value: (row) => row.invoice_number },
  { header: "payment_reference", value: (row) => row.payment_reference },
  { header: "due_date", value: (row) => row.due_date },
  { header: "payment_date", value: (row) => row.payment_date },
  { header: "has_primary_document", value: (row) => !!row.receipt_file_path },
  { header: "has_payment_proof", value: (row) => !!row.payment_proof_file_path },
  { header: "ai_confidence", value: (row) => row.ai_confidence },
  { header: "review_status", value: (row) => row.status },
  { header: "review_issues", value: (row) => row.review_issues.map((issue) => issue.label).join("; ") },
  { header: "notes", value: (row) => row.notes },
];

const categoryCsvColumns: Array<{ header: string; value: (row: CategorySummaryRow) => CsvValue }> = [
  { header: "category", value: (row) => row.category },
  { header: "total_amount", value: (row) => row.totalAmount },
  { header: "paid_amount", value: (row) => row.paidAmount },
  { header: "unpaid_amount", value: (row) => row.unpaidAmount },
  { header: "count", value: (row) => row.count },
];

const vendorCsvColumns: Array<{ header: string; value: (row: VendorSummaryRow) => CsvValue }> = [
  { header: "vendor", value: (row) => row.vendor },
  { header: "total_amount", value: (row) => row.totalAmount },
  { header: "paid_amount", value: (row) => row.paidAmount },
  { header: "unpaid_amount", value: (row) => row.unpaidAmount },
  { header: "count", value: (row) => row.count },
  { header: "last_expense_date", value: (row) => row.lastExpenseDate },
];

const salaryCsvColumns: Array<{ header: string; value: (row: SalaryReportRow) => CsvValue }> = [
  { header: "employee_or_contractor", value: (row) => row.employee },
  { header: "amount", value: (row) => row.amount },
  { header: "payment_status", value: (row) => row.paymentStatus },
  { header: "payment_date", value: (row) => row.paymentDate },
  { header: "payment_method", value: (row) => row.paymentMethod },
];

const attentionCsvColumns: Array<{ header: string; value: (row: NeedsAttentionReportRow) => CsvValue }> = [
  { header: "date", value: (row) => row.date },
  { header: "vendor", value: (row) => row.vendor },
  { header: "amount", value: (row) => row.amount },
  { header: "payment_status", value: (row) => row.paymentStatus },
  { header: "issues", value: (row) => row.issues.join("; ") },
];

export default function ReportsShell() {
  const [month, setMonth] = useState(currentMonthKey);
  const [report, setReport] = useState<MonthlyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/reports/monthly?month=${encodeURIComponent(month)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Failed to load report.");
        return json as MonthlyReportData;
      })
      .then(setReport)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load report.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [month]);

  const subtitle = useMemo(() => {
    if (!report) return monthLabel(month);
    return `${monthLabel(report.month)} · ${report.fromDate} to ${report.toDate}`;
  }, [month, report]);

  function exportFile<T>(label: string, columns: Array<{ header: string; value: (row: T) => CsvValue }>, rows: T[]) {
    downloadCsv(`expensedesk-${label}-${month}.csv`, columns, rows);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        title="Reports"
        subtitle={subtitle}
        action={
          <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="bg-transparent text-xs outline-none"
            />
          </label>
        }
      />

      <main className="flex-1 space-y-5 p-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !report ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading monthly report...</p>
            </div>
          </div>
        ) : report ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <ExportButton onClick={() => exportFile("expenses", expenseCsvColumns, report.expenses)}>
                All Expenses
              </ExportButton>
              <ExportButton onClick={() => exportFile("category-summary", categoryCsvColumns, report.categorySummary)}>
                Category Summary
              </ExportButton>
              <ExportButton onClick={() => exportFile("vendor-summary", vendorCsvColumns, report.vendorSummary)}>
                Vendor Summary
              </ExportButton>
              <ExportButton onClick={() => exportFile("salary", salaryCsvColumns, report.salaryReport)}>
                Salary Report
              </ExportButton>
              <ExportButton onClick={() => exportFile("needs-attention", attentionCsvColumns, report.needsAttention)}>
                Needs Attention
              </ExportButton>
              <ExportButton onClick={() => exportFile("unpaid-invoices", expenseCsvColumns, report.unpaidInvoices)}>
                Unpaid Invoices
              </ExportButton>
            </div>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Total Expenses"
                value={fmtCurrency(report.summary.totalExpenses)}
                meta={`${report.summary.expenseCount} expense${report.summary.expenseCount === 1 ? "" : "s"}`}
              />
              <SummaryCard
                label="Paid Expenses"
                value={fmtCurrency(report.summary.paidExpenses)}
                meta={`${report.summary.paidExpenseCount} paid item${report.summary.paidExpenseCount === 1 ? "" : "s"}`}
              />
              <SummaryCard
                label="Unpaid Invoices"
                value={fmtCurrency(report.summary.unpaidInvoices)}
                meta={`${report.summary.unpaidInvoiceCount} invoice${report.summary.unpaidInvoiceCount === 1 ? "" : "s"}`}
              />
              <SummaryCard
                label="Partially Paid"
                value={fmtCurrency(report.summary.partiallyPaidInvoices)}
                meta={`${report.summary.partiallyPaidInvoiceCount} invoice${report.summary.partiallyPaidInvoiceCount === 1 ? "" : "s"}`}
              />
              <SummaryCard
                label="Salary Total"
                value={fmtCurrency(report.summary.salaryTotal)}
                meta="salary expenses"
              />
              <SummaryCard
                label="Non-Salary Total"
                value={fmtCurrency(report.summary.nonSalaryTotal)}
                meta="bills, receipts, and manual expenses"
              />
              <SummaryCard
                label="With Attachments"
                value={String(report.summary.attachmentCount)}
                meta="receipts, invoices, or proofs"
              />
              <SummaryCard
                label="Needs Attention"
                value={String(report.summary.needsAttentionCount)}
                meta="items flagged for review"
              />
            </section>

            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-3">
              <TableSection
                title="Payment Status"
                subtitle="Paid, unpaid, and partially paid totals"
                headers={["Status", "Total Amount", "Paid Amount", "Unpaid Amount", "Count"]}
                empty={report.paymentStatusSummary.every((row) => row.count === 0)}
                emptyText="No payment status data for this month."
              >
                {report.paymentStatusSummary.map((row: PaymentStatusSummaryRow) => (
                  <tr key={row.status}>
                    <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-5 py-3 text-right text-xs font-semibold">{fmtCurrency(row.totalAmount)}</td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">{fmtCurrency(row.paidAmount)}</td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">{fmtCurrency(row.unpaidAmount)}</td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">{row.count}</td>
                  </tr>
                ))}
              </TableSection>

              <div className="2xl:col-span-2">
                <TableSection
                  title="Category Summary"
                  subtitle="Month total grouped by category"
                  action={
                    <ExportButton onClick={() => exportFile("category-summary", categoryCsvColumns, report.categorySummary)}>
                      CSV
                    </ExportButton>
                  }
                  headers={["Category", "Total Amount", "Paid Amount", "Unpaid Amount", "Count"]}
                  empty={report.categorySummary.length === 0}
                  emptyText="No category spending for this month."
                >
                  {report.categorySummary.map((row: CategorySummaryRow) => (
                    <tr key={row.category}>
                      <td className="px-5 py-3 text-xs font-medium text-foreground">{row.category}</td>
                      <td className="px-5 py-3 text-right text-xs font-semibold">{fmtCurrency(row.totalAmount)}</td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground">{fmtCurrency(row.paidAmount)}</td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground">{fmtCurrency(row.unpaidAmount)}</td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground">{row.count}</td>
                    </tr>
                  ))}
                </TableSection>
              </div>
            </div>

            <TableSection
              title="Vendor Summary"
              subtitle="Vendor totals and most recent expense date"
              action={<ExportButton onClick={() => exportFile("vendor-summary", vendorCsvColumns, report.vendorSummary)}>CSV</ExportButton>}
              headers={["Vendor", "Total Amount", "Paid Amount", "Unpaid Amount", "Count", "Last Expense Date"]}
              empty={report.vendorSummary.length === 0}
              emptyText="No vendor spending for this month."
            >
              {report.vendorSummary.map((row: VendorSummaryRow) => (
                <tr key={row.vendor}>
                  <td className="px-5 py-3 text-xs font-medium text-foreground">{row.vendor}</td>
                  <td className="px-5 py-3 text-right text-xs font-semibold">{fmtCurrency(row.totalAmount)}</td>
                  <td className="px-5 py-3 text-right text-xs text-muted-foreground">{fmtCurrency(row.paidAmount)}</td>
                  <td className="px-5 py-3 text-right text-xs text-muted-foreground">{fmtCurrency(row.unpaidAmount)}</td>
                  <td className="px-5 py-3 text-right text-xs text-muted-foreground">{row.count}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{row.lastExpenseDate}</td>
                </tr>
              ))}
            </TableSection>

            <TableSection
              title="Salary Report"
              subtitle="Salary expenses in the selected month"
              action={<ExportButton onClick={() => exportFile("salary", salaryCsvColumns, report.salaryReport)}>CSV</ExportButton>}
              headers={["Employee / Contractor", "Amount", "Payment Status", "Payment Date", "Payment Method"]}
              empty={report.salaryReport.length === 0}
              emptyText="No salary expenses for this month."
            >
              {report.salaryReport.map((row: SalaryReportRow) => (
                <tr key={row.id}>
                  <td className="px-5 py-3 text-xs font-medium text-foreground">{row.employee}</td>
                  <td className="px-5 py-3 text-right text-xs font-semibold">{fmtCurrency(row.amount)}</td>
                  <td className="px-5 py-3"><StatusBadge status={row.paymentStatus} /></td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{row.paymentDate ?? "—"}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{row.paymentMethod}</td>
                </tr>
              ))}
            </TableSection>

            <TableSection
              title="Needs Attention"
              subtitle="Duplicates, unpaid items, mismatches, missing proof, and low-confidence AI entries"
              action={<ExportButton onClick={() => exportFile("needs-attention", attentionCsvColumns, report.needsAttention)}>CSV</ExportButton>}
              headers={["Date", "Vendor", "Amount", "Payment Status", "Issues"]}
              empty={report.needsAttention.length === 0}
              emptyText="No attention items for this month."
            >
              {report.needsAttention.map((row: NeedsAttentionReportRow) => (
                <tr key={row.id}>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{row.date}</td>
                  <td className="px-5 py-3 text-xs font-medium text-foreground">{row.vendor}</td>
                  <td className="px-5 py-3 text-right text-xs font-semibold">{fmtCurrency(row.amount)}</td>
                  <td className="px-5 py-3"><StatusBadge status={row.paymentStatus} /></td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.issues.map((issue) => (
                        <span
                          key={issue}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {issue}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </TableSection>
          </>
        ) : null}
      </main>
    </div>
  );
}
