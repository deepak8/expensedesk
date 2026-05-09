import { deriveReviewIssues, findDuplicateIds, type ReviewIssue } from "@/lib/review-issues";
import type { ExpenseWithRefs, PaymentStatus } from "@/lib/supabase/types";

export interface ReportExpenseRow {
  id: string;
  expense_date: string;
  vendor: string;
  description: string | null;
  amount: number;
  category_name: string | null;
  payment_method_name: string | null;
  expense_type: string;
  status: string;
  document_type: string | null;
  payment_status: PaymentStatus;
  receipt_file_path: string | null;
  invoice_number: string | null;
  ai_confidence: number | null;
  notes: string | null;
  due_date: string | null;
  payment_date: string | null;
  paid_amount: number | null;
  payment_reference: string | null;
  payment_proof_file_path: string | null;
  review_issues: ReviewIssue[];
}

export interface MonthlySummary {
  totalExpenses: number;
  paidExpenses: number;
  unpaidInvoices: number;
  partiallyPaidInvoices: number;
  salaryTotal: number;
  nonSalaryTotal: number;
  expenseCount: number;
  attachmentCount: number;
  needsAttentionCount: number;
  paidExpenseCount: number;
  unpaidInvoiceCount: number;
  partiallyPaidInvoiceCount: number;
}

export interface CategorySummaryRow {
  category: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  count: number;
}

export interface VendorSummaryRow {
  vendor: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  count: number;
  lastExpenseDate: string;
}

export interface PaymentStatusSummaryRow {
  status: PaymentStatus;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  count: number;
}

export interface SalaryReportRow {
  id: string;
  employee: string;
  amount: number;
  paymentStatus: PaymentStatus;
  paymentDate: string | null;
  paymentMethod: string;
}

export interface NeedsAttentionReportRow {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  paymentStatus: PaymentStatus;
  issues: string[];
}

export interface MonthlyReportData {
  month: string;
  fromDate: string;
  toDate: string;
  expenses: ReportExpenseRow[];
  summary: MonthlySummary;
  categorySummary: CategorySummaryRow[];
  vendorSummary: VendorSummaryRow[];
  paymentStatusSummary: PaymentStatusSummaryRow[];
  salaryReport: SalaryReportRow[];
  needsAttention: NeedsAttentionReportRow[];
  unpaidInvoices: ReportExpenseRow[];
}

function amountOf(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function paidAmountFor(expense: Pick<ReportExpenseRow, "amount" | "paid_amount" | "payment_status">) {
  const amount = amountOf(expense.amount);
  const paidAmount = expense.paid_amount == null ? null : amountOf(expense.paid_amount);

  if (expense.payment_status === "unpaid") return 0;
  if (paidAmount !== null) return paidAmount;
  if (expense.payment_status === "paid") return amount;
  return 0;
}

function unpaidAmountFor(expense: Pick<ReportExpenseRow, "amount" | "paid_amount" | "payment_status">) {
  return Math.max(amountOf(expense.amount) - paidAmountFor(expense), 0);
}

function upsertGroup<K extends string, T extends { totalAmount: number; paidAmount: number; unpaidAmount: number; count: number }>(
  map: Map<K, T>,
  key: K,
  seed: T,
  expense: ReportExpenseRow
) {
  const current = map.get(key) ?? seed;
  current.totalAmount += amountOf(expense.amount);
  current.paidAmount += paidAmountFor(expense);
  current.unpaidAmount += unpaidAmountFor(expense);
  current.count += 1;
  map.set(key, current);
  return current;
}

export function monthRange(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;

  const fromDate = `${match[1]}-${match[2]}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const toDate = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;
  return { fromDate, toDate };
}

export function deriveMonthlyReport(
  rows: ExpenseWithRefs[],
  month: string,
  range = monthRange(month)
): MonthlyReportData {
  const duplicateIds = findDuplicateIds(rows);
  const expenses: ReportExpenseRow[] = rows.map((row) => ({
    id: row.id,
    expense_date: row.expense_date,
    vendor: row.vendor,
    description: row.description,
    amount: amountOf(row.amount),
    category_name: row.category_name,
    payment_method_name: row.payment_method_name,
    expense_type: row.expense_type,
    status: row.status,
    document_type: row.document_type,
    payment_status: row.payment_status ?? "paid",
    receipt_file_path: row.receipt_file_path,
    invoice_number: row.invoice_number,
    ai_confidence: row.ai_confidence,
    notes: row.notes,
    due_date: row.due_date,
    payment_date: row.payment_date,
    paid_amount: row.paid_amount == null ? null : amountOf(row.paid_amount),
    payment_reference: row.payment_reference,
    payment_proof_file_path: row.payment_proof_file_path,
    review_issues: deriveReviewIssues(row, duplicateIds),
  }));

  const categoryMap = new Map<string, CategorySummaryRow>();
  const vendorMap = new Map<string, VendorSummaryRow>();
  const statusMap = new Map<PaymentStatus, PaymentStatusSummaryRow>();

  expenses.forEach((expense) => {
    const category = expense.category_name ?? "Uncategorised";
    upsertGroup(categoryMap, category, { category, totalAmount: 0, paidAmount: 0, unpaidAmount: 0, count: 0 }, expense);

    const vendor = expense.vendor || "Unknown Vendor";
    const vendorRow = upsertGroup(
      vendorMap,
      vendor,
      { vendor, totalAmount: 0, paidAmount: 0, unpaidAmount: 0, count: 0, lastExpenseDate: expense.expense_date },
      expense
    );
    if (expense.expense_date > vendorRow.lastExpenseDate) vendorRow.lastExpenseDate = expense.expense_date;

    upsertGroup(
      statusMap,
      expense.payment_status,
      { status: expense.payment_status, totalAmount: 0, paidAmount: 0, unpaidAmount: 0, count: 0 },
      expense
    );
  });

  const unpaidInvoices = expenses.filter(
    (expense) => expense.payment_status === "unpaid" && expense.expense_type === "invoice"
  );
  const partiallyPaidInvoices = expenses.filter((expense) => expense.payment_status === "partially_paid");
  const paidExpenses = expenses.filter((expense) => expense.payment_status === "paid");
  const salaryExpenses = expenses.filter((expense) => expense.expense_type === "salary");
  const needsAttention = expenses
    .filter((expense) => expense.review_issues.length > 0)
    .map((expense) => ({
      id: expense.id,
      date: expense.expense_date,
      vendor: expense.vendor,
      amount: expense.amount,
      paymentStatus: expense.payment_status,
      issues: expense.review_issues.map((issue) => issue.label),
    }));

  const summary: MonthlySummary = {
    totalExpenses: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    paidExpenses: paidExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    unpaidInvoices: unpaidInvoices.reduce((sum, expense) => sum + expense.amount, 0),
    partiallyPaidInvoices: partiallyPaidInvoices.reduce((sum, expense) => sum + expense.amount, 0),
    salaryTotal: salaryExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    nonSalaryTotal: expenses
      .filter((expense) => expense.expense_type !== "salary")
      .reduce((sum, expense) => sum + expense.amount, 0),
    expenseCount: expenses.length,
    attachmentCount: expenses.filter((expense) => expense.receipt_file_path || expense.payment_proof_file_path).length,
    needsAttentionCount: needsAttention.length,
    paidExpenseCount: paidExpenses.length,
    unpaidInvoiceCount: unpaidInvoices.length,
    partiallyPaidInvoiceCount: partiallyPaidInvoices.length,
  };

  return {
    month,
    fromDate: range?.fromDate ?? `${month}-01`,
    toDate: range?.toDate ?? `${month}-31`,
    expenses,
    summary,
    categorySummary: [...categoryMap.values()].sort((a, b) => b.totalAmount - a.totalAmount),
    vendorSummary: [...vendorMap.values()].sort((a, b) => b.totalAmount - a.totalAmount),
    paymentStatusSummary: (["paid", "unpaid", "partially_paid"] as PaymentStatus[]).map(
      (status) => statusMap.get(status) ?? { status, totalAmount: 0, paidAmount: 0, unpaidAmount: 0, count: 0 }
    ),
    salaryReport: salaryExpenses.map((expense) => ({
      id: expense.id,
      employee: expense.vendor,
      amount: expense.amount,
      paymentStatus: expense.payment_status,
      paymentDate: expense.payment_date ?? expense.expense_date,
      paymentMethod: expense.payment_method_name ?? "—",
    })),
    needsAttention,
    unpaidInvoices,
  };
}
