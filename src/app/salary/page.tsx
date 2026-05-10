import {
  isSupabaseConfigured,
  getExpenses,
  getPaymentMethods,
  getEmployees,
} from "@/lib/supabase/queries";
import SalaryShell from "@/components/salary/SalaryShell";
import type { ExpenseWithRefs, PaymentMethodRow, EmployeeRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function SalaryPage() {
  let salaryRows: ExpenseWithRefs[] = [];
  let paymentMethodRows: PaymentMethodRow[] = [];
  let employeeRows: EmployeeRow[] = [];

  if (isSupabaseConfigured()) {
    try {
      [salaryRows, paymentMethodRows, employeeRows] = await Promise.all([
        getExpenses({ expenseType: "salary" }),
        getPaymentMethods(),
        getEmployees(),
      ]);
    } catch (err) {
      console.error("[SalaryPage] Supabase fetch failed, using empty data:", err);
    }
  }

  return (
    <SalaryShell
      salaryRows={salaryRows}
      paymentMethodRows={paymentMethodRows}
      employeeRows={employeeRows}
    />
  );
}
