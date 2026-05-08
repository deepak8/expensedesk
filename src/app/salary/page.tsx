import {
  isSupabaseConfigured,
  getExpenses,
  getPaymentMethods,
} from "@/lib/supabase/queries";
import SalaryShell from "@/components/salary/SalaryShell";
import type { ExpenseWithRefs, PaymentMethodRow } from "@/lib/supabase/types";

export default async function SalaryPage() {
  let salaryRows: ExpenseWithRefs[] = [];
  let paymentMethodRows: PaymentMethodRow[] = [];

  if (isSupabaseConfigured()) {
    try {
      [salaryRows, paymentMethodRows] = await Promise.all([
        getExpenses({ expenseType: "salary" }),
        getPaymentMethods(),
      ]);
    } catch (err) {
      console.error("[SalaryPage] Supabase fetch failed, using empty data:", err);
    }
  }

  return (
    <SalaryShell
      salaryRows={salaryRows}
      paymentMethodRows={paymentMethodRows}
    />
  );
}
