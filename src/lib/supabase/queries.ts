import { createClient } from "./server";
import type { CategoryRow, PaymentMethodRow, ExpenseWithRefs } from "./types";

// Returns true only when both env vars are present at runtime.
export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("[getCategories]", error.message);
    return [];
  }
  return data ?? [];
}

// ─── Payment Methods ──────────────────────────────────────────────────────────

export async function getPaymentMethods(): Promise<PaymentMethodRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("[getPaymentMethods]", error.message);
    return [];
  }
  return data ?? [];
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export interface GetExpensesOptions {
  categoryId?: number;
  paymentMethodId?: number;
  status?: string;
  expenseType?: string;
  /** ISO date string — inclusive lower bound */
  fromDate?: string;
  /** ISO date string — inclusive upper bound */
  toDate?: string;
  limit?: number;
  offset?: number;
}

export async function getExpenses(
  opts: GetExpensesOptions = {}
): Promise<ExpenseWithRefs[]> {
  const supabase = await createClient();

  let query = supabase
    .from("expenses")
    .select(
      `
      *,
      categories ( name ),
      payment_methods ( name )
      `
    )
    .order("expense_date", { ascending: false });

  if (opts.categoryId != null) query = query.eq("category_id", opts.categoryId);
  if (opts.paymentMethodId != null) query = query.eq("payment_method_id", opts.paymentMethodId);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.expenseType) query = query.eq("expense_type", opts.expenseType);
  if (opts.fromDate) query = query.gte("expense_date", opts.fromDate);
  if (opts.toDate) query = query.lte("expense_date", opts.toDate);
  if (opts.limit != null) query = query.limit(opts.limit);
  if (opts.offset != null) query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);

  const { data, error } = await query;

  if (error) {
    console.error("[getExpenses]", error.message);
    return [];
  }

  // Flatten the joined relation names onto the row
  return (data ?? []).map((row: any) => ({
    ...row,
    category_name: row.categories?.name ?? null,
    payment_method_name: row.payment_methods?.name ?? null,
  })) as ExpenseWithRefs[];
}

// ─── Dashboard aggregates ────────────────────────────────────────────────────

export interface DashboardSummary {
  totalExpenses: number;
  salary: number;
  nonSalary: number;
  needsReview: number;
}

export async function getDashboardSummary(
  fromDate: string,
  toDate: string
): Promise<DashboardSummary> {
  const expenses = await getExpenses({ fromDate, toDate });

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const salary = expenses
    .filter((e) => e.expense_type === "salary")
    .reduce((s, e) => s + Number(e.amount), 0);
  const nonSalary = totalExpenses - salary;
  const needsReview = expenses
    .filter((e) => e.status === "needs_review" || e.status === "missing_receipt")
    .reduce((s, e) => s + Number(e.amount), 0);

  return { totalExpenses, salary, nonSalary, needsReview };
}
