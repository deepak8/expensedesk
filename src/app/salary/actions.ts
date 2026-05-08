"use server";

import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/supabase/queries";
import { revalidatePath } from "next/cache";
import type { ExpenseType, ExpenseStatus, Database } from "@/lib/supabase/types";

type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
type ExpenseUpdate = Database["public"]["Tables"]["expenses"]["Update"];

export interface SalaryActionState {
  success?: boolean;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSalaryCategoryId(): Promise<number | null> {
  const categories = await getCategories();
  const found = categories.find((c) => c.name.toLowerCase() === "salary");
  return found?.id ?? null;
}

/** "2026-05" → "Salary for May 2026" */
function salaryMonthToDescription(salaryMonth: string): string | null {
  if (!salaryMonth) return null;
  const [yearStr, monthStr] = salaryMonth.split("-");
  if (!yearStr || !monthStr) return null;
  const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
  const monthName = date.toLocaleString("en-IN", { month: "long" });
  return `Salary for ${monthName} ${yearStr}`;
}

function parseSalaryFormData(formData: FormData) {
  const vendor = (formData.get("vendor") as string | null)?.trim() ?? "";
  const salary_month = (formData.get("salary_month") as string | null)?.trim() ?? "";
  const expense_date = (formData.get("expense_date") as string | null)?.trim() ?? "";
  const amount_raw = (formData.get("amount") as string | null)?.trim() ?? "";
  const payment_method_id = (formData.get("payment_method_id") as string | null)?.trim() ?? "";
  const status = (formData.get("status") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const description = salaryMonthToDescription(salary_month);
  return { vendor, salary_month, expense_date, amount_raw, payment_method_id, status, notes, description };
}

function validateSalaryFields(f: ReturnType<typeof parseSalaryFormData>): string | null {
  if (!f.vendor) return "Employee/Contractor Name is required.";
  if (!f.expense_date) return "Payment Date is required.";
  if (!f.amount_raw) return "Amount is required.";
  const amount = parseFloat(f.amount_raw);
  if (isNaN(amount) || amount < 0) return "Amount must be a valid number ≥ 0.";
  if (!f.payment_method_id) return "Payment Method is required.";
  if (!f.status) return "Status is required.";
  return null;
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/salary");
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createSalaryAction(
  _prev: SalaryActionState | null,
  formData: FormData
): Promise<SalaryActionState> {
  const fields = parseSalaryFormData(formData);
  const err = validateSalaryFields(fields);
  if (err) return { error: err };

  const [supabase, category_id] = await Promise.all([
    createClient(),
    getSalaryCategoryId(),
  ]);

  const insert: ExpenseInsert = {
    expense_date: fields.expense_date,
    vendor: fields.vendor,
    description: fields.description,
    amount: parseFloat(fields.amount_raw),
    currency: "INR",
    category_id,
    payment_method_id: parseInt(fields.payment_method_id),
    expense_type: "salary" as ExpenseType,
    status: fields.status as ExpenseStatus,
    notes: fields.notes,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("expenses").insert(insert);
  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}

export async function updateSalaryAction(
  _prev: SalaryActionState | null,
  formData: FormData
): Promise<SalaryActionState> {
  const id = (formData.get("expense_id") as string | null)?.trim() ?? "";
  if (!id) return { error: "Missing expense ID." };

  const fields = parseSalaryFormData(formData);
  const err = validateSalaryFields(fields);
  if (err) return { error: err };

  const [supabase, category_id] = await Promise.all([
    createClient(),
    getSalaryCategoryId(),
  ]);

  const update: ExpenseUpdate = {
    expense_date: fields.expense_date,
    vendor: fields.vendor,
    description: fields.description,
    amount: parseFloat(fields.amount_raw),
    currency: "INR",
    category_id,
    payment_method_id: parseInt(fields.payment_method_id),
    expense_type: "salary" as ExpenseType,
    status: fields.status as ExpenseStatus,
    notes: fields.notes,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("expenses")
    .update(update)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}
