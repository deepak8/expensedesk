// Derives all dashboard display data from a flat list of expenses.
// Works with both Supabase rows and mock data mapped to the same shape.

import type { ChartSlice } from "@/components/dashboard/CategorySplitChart";
import type { VendorRow } from "@/components/dashboard/TopVendors";
import type { ReviewItem } from "@/components/dashboard/NeedsReviewQueue";
import type { MonthlyData } from "@/lib/mock-data";
import { deriveReviewIssues, findDuplicateIds } from "@/lib/review-issues";

export interface FlatExpense {
  id: string;
  expense_date: string;
  vendor: string;
  description: string | null;
  amount: number;
  category_name: string | null;
  payment_method_name: string | null;
  expense_type: string;
  status: string;
  document_type?: string | null;
  payment_status?: string | null;
  receipt_file_path?: string | null;
  invoice_number?: string | null;
  ai_confidence?: number | null;
  paid_amount?: number | null;
  payment_reference?: string | null;
  payment_proof_file_path?: string | null;
}

export interface DashboardData {
  summary: {
    totalExpenses: number;
    salary: number;
    nonSalary: number;
    needsReview: number;
  };
  categorySplit: ChartSlice[];
  paymentSplit: ChartSlice[];
  topVendors: VendorRow[];
  needsReview: ReviewItem[];
}

const CATEGORY_COLORS = [
  "#4ade80", "#86efac", "#bbf7d0", "#fcd34d",
  "#fdba74", "#d1d5db", "#e5e7eb", "#a3e635",
];

const PAYMENT_COLORS = [
  "#4ade80", "#86efac", "#fcd34d", "#d1d5db",
  "#fdba74", "#bbf7d0", "#e5e7eb", "#a3e635",
];

export function deriveDashboardData(expenses: FlatExpense[]): DashboardData {
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const salary = expenses
    .filter((e) => e.expense_type === "salary")
    .reduce((s, e) => s + Number(e.amount), 0);
  const nonSalary = total - salary;
  const duplicateIds = findDuplicateIds(expenses);
  const reviewItems = expenses
    .map((expense) => ({
      expense,
      issues: deriveReviewIssues(expense, duplicateIds),
    }))
    .filter(({ issues }) => issues.length > 0);
  const needsReviewTotal = reviewItems.reduce((s, { expense }) => s + Number(expense.amount), 0);

  // Category split
  const catMap = new Map<string, number>();
  expenses.forEach((e) => {
    const key = e.category_name ?? "Uncategorised";
    catMap.set(key, (catMap.get(key) ?? 0) + Number(e.amount));
  });
  const categorySplit: ChartSlice[] = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name,
      value,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));

  // Payment split
  const pmMap = new Map<string, number>();
  expenses.forEach((e) => {
    const key = e.payment_method_name ?? "Other";
    pmMap.set(key, (pmMap.get(key) ?? 0) + Number(e.amount));
  });
  const paymentSplit: ChartSlice[] = [...pmMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name,
      value,
      color: PAYMENT_COLORS[i % PAYMENT_COLORS.length],
    }));

  // Top vendors
  const vendorMap = new Map<string, { amount: number; category: string }>();
  expenses.forEach((e) => {
    const existing = vendorMap.get(e.vendor);
    vendorMap.set(e.vendor, {
      amount: (existing?.amount ?? 0) + Number(e.amount),
      category: e.category_name ?? existing?.category ?? "—",
    });
  });
  const topVendors: VendorRow[] = [...vendorMap.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5)
    .map(([vendor, { amount, category }]) => ({ vendor, category, amount }));

  // Needs review queue
  const needsReview: ReviewItem[] = reviewItems.slice(0, 6).map(({ expense, issues }) => ({
    id: expense.id,
    vendor: expense.vendor,
    description: expense.description ?? "",
    date: expense.expense_date,
    amount: Number(expense.amount),
    issue: issues[0].label,
  }));

  return {
    summary: { totalExpenses: total, salary, nonSalary, needsReview: needsReviewTotal },
    categorySplit,
    paymentSplit,
    topVendors,
    needsReview,
  };
}
