import { isSupabaseConfigured, getExpenses } from "@/lib/supabase/queries";
import { deriveDashboardData, type FlatExpense } from "@/lib/dashboard-data";
import {
  EXPENSES,
  MONTHLY_TREND,
  CATEGORY_SPLIT,
  PAYMENT_SPLIT,
  TOP_VENDORS,
  NEEDS_REVIEW,
  DASHBOARD_SUMMARY,
} from "@/lib/mock-data";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const dynamic = "force-dynamic";

// Current display month (hardcoded for Phase 1 — will be dynamic in Phase 2)
const MONTH_LABEL = "May 2026 Expenses";
const MONTH_SUBTITLE = "01 May – 31 May 2026";
const FROM_DATE = "2026-05-01";
const TO_DATE = "2026-05-31";

export default async function DashboardPage() {
  if (isSupabaseConfigured()) {
    const rows = await getExpenses({ fromDate: FROM_DATE, toDate: TO_DATE });

    const flat: FlatExpense[] = rows.map((r) => ({
      id: r.id,
      expense_date: r.expense_date,
      vendor: r.vendor,
      description: r.description,
      amount: Number(r.amount),
      category_name: r.category_name,
      payment_method_name: r.payment_method_name,
      expense_type: r.expense_type,
      status: r.status,
      document_type: r.document_type,
      payment_status: r.payment_status,
      receipt_file_path: r.receipt_file_path,
      invoice_number: r.invoice_number,
      ai_confidence: r.ai_confidence,
      paid_amount: r.paid_amount,
      payment_reference: r.payment_reference,
      payment_proof_file_path: r.payment_proof_file_path,
    }));

    const dashboard = deriveDashboardData(flat);

    return (
      <DashboardShell
        monthLabel={MONTH_LABEL}
        monthSubtitle={MONTH_SUBTITLE}
        monthlyTrend={MONTHLY_TREND}
        dashboard={dashboard}
      />
    );
  }

  // Mock data fallback only when Supabase is intentionally not configured.
  const mockDashboard = {
    summary: DASHBOARD_SUMMARY,
    categorySplit: CATEGORY_SPLIT,
    paymentSplit: PAYMENT_SPLIT,
    topVendors: TOP_VENDORS,
    needsReview: NEEDS_REVIEW.map((e) => ({
      id: e.id,
      vendor: e.vendor,
      description: e.description,
      date: e.date,
      amount: e.amount,
      issue: e.status,
    })),
  };

  return (
    <DashboardShell
      monthLabel={MONTH_LABEL}
      monthSubtitle={MONTH_SUBTITLE}
      monthlyTrend={MONTHLY_TREND}
      dashboard={mockDashboard}
    />
  );
}
