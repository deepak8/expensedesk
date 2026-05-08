import { isSupabaseConfigured, getExpenses, getCategories, getPaymentMethods } from "@/lib/supabase/queries";
import { EXPENSES } from "@/lib/mock-data";
import ExpensesTable, { DisplayExpense } from "@/components/expenses/ExpensesTable";
import type { CategoryRow, PaymentMethodRow, ExpenseWithRefs } from "@/lib/supabase/types";

function supabaseStatusToDisplay(status: string): DisplayExpense["status"] {
  const map: Record<string, DisplayExpense["status"]> = {
    verified: "Verified",
    needs_review: "Needs Review",
    draft: "Draft",
    missing_receipt: "Missing Receipt",
  };
  return map[status] ?? "Draft";
}

function mockToDisplay(e: (typeof EXPENSES)[number]): DisplayExpense {
  return {
    id: e.id,
    date: e.date,
    vendor: e.vendor,
    category: e.category,
    description: e.description,
    paymentMethod: e.paymentMethod,
    amount: e.amount,
    hasReceipt: e.receiptAvailable,
    status: e.status as DisplayExpense["status"],
  };
}

export default async function ExpensesPage() {
  let expenses: DisplayExpense[];
  let rawExpenses: ExpenseWithRefs[];
  let categoryRows: CategoryRow[];
  let paymentMethodRows: PaymentMethodRow[];

  if (isSupabaseConfigured()) {
    try {
      const [rows, cats, methods] = await Promise.all([
        getExpenses(),
        getCategories(),
        getPaymentMethods(),
      ]);

      rawExpenses = rows;
      expenses = rows.map((row) => ({
        id: row.id,
        date: row.expense_date,
        vendor: row.vendor,
        category: row.category_name ?? "Uncategorised",
        description: row.description ?? "",
        paymentMethod: row.payment_method_name ?? "—",
        amount: Number(row.amount),
        hasReceipt: !!row.receipt_file_path,
        status: supabaseStatusToDisplay(row.status),
      }));
      categoryRows = cats;
      paymentMethodRows = methods;
    } catch (err) {
      console.error("[ExpensesPage] Supabase fetch failed, using mock data:", err);
      rawExpenses = [];
      expenses = EXPENSES.map(mockToDisplay);
      categoryRows = [...new Set(EXPENSES.map((e) => e.category))].sort().map((name, id) => ({ id, name }));
      paymentMethodRows = [...new Set(EXPENSES.map((e) => e.paymentMethod))].sort().map((name, id) => ({ id, name }));
    }
  } else {
    rawExpenses = [];
    expenses = EXPENSES.map(mockToDisplay);
    categoryRows = [...new Set(EXPENSES.map((e) => e.category))].sort().map((name, id) => ({ id, name }));
    paymentMethodRows = [...new Set(EXPENSES.map((e) => e.paymentMethod))].sort().map((name, id) => ({ id, name }));
  }

  return (
    <ExpensesTable
      initialExpenses={expenses}
      rawExpenses={rawExpenses}
      categoryRows={categoryRows}
      paymentMethodRows={paymentMethodRows}
    />
  );
}
