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

// Current display month (hardcoded for Phase 1 — will be dynamic in Phase 2)
const MONTH_LABEL = "May 2026 Expenses";
const MONTH_SUBTITLE = "01 May – 31 May 2026";
const FROM_DATE = "2026-05-01";
const TO_DATE = "2026-05-31";

export default async function DashboardPage() {
  if (isSupabaseConfigured()) {
    try {
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
    } catch (err) {
      console.error("[DashboardPage] Supabase fetch failed, using mock data:", err);
    }
  }

  // Mock data fallback
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
