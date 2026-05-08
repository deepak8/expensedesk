"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ExpenseType, ExpenseStatus, Database } from "@/lib/supabase/types";

type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
type ExpenseUpdate = Database["public"]["Tables"]["expenses"]["Update"];

export interface ExpenseActionState {
  success?: boolean;
  error?: string;
}

function parseFormData(formData: FormData) {
  const expense_date = (formData.get("expense_date") as string | null)?.trim() ?? "";
  const vendor = (formData.get("vendor") as string | null)?.trim() ?? "";
  const amount_raw = (formData.get("amount") as string | null)?.trim() ?? "";
  const category_id = (formData.get("category_id") as string | null)?.trim() ?? "";
  const payment_method_id = (formData.get("payment_method_id") as string | null)?.trim() ?? "";
  const expense_type = (formData.get("expense_type") as string | null)?.trim() ?? "";
  const status = (formData.get("status") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const invoice_number = (formData.get("invoice_number") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  return { expense_date, vendor, amount_raw, category_id, payment_method_id, expense_type, status, description, invoice_number, notes };
}

function validateFields(fields: ReturnType<typeof parseFormData>): string | null {
  if (!fields.expense_date) return "Date is required.";
  if (!fields.vendor) return "Vendor is required.";
  if (!fields.amount_raw) return "Amount is required.";
  const amount = parseFloat(fields.amount_raw);
  if (isNaN(amount) || amount < 0) return "Amount must be a valid number ≥ 0.";
  if (!fields.category_id) return "Category is required.";
  if (!fields.payment_method_id) return "Payment method is required.";
  if (!fields.expense_type) return "Expense type is required.";
  if (!fields.status) return "Status is required.";
  return null;
}

export async function createExpenseAction(
  _prev: ExpenseActionState | null,
  formData: FormData
): Promise<ExpenseActionState> {
  const fields = parseFormData(formData);
  const validationError = validateFields(fields);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const insert: ExpenseInsert = {
    expense_date: fields.expense_date,
    vendor: fields.vendor,
    description: fields.description,
    amount: parseFloat(fields.amount_raw),
    currency: "INR",
    category_id: parseInt(fields.category_id),
    payment_method_id: parseInt(fields.payment_method_id),
    expense_type: fields.expense_type as ExpenseType,
    status: fields.status as ExpenseStatus,
    invoice_number: fields.invoice_number,
    notes: fields.notes,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("expenses").insert(insert);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/expenses");
  return { success: true };
}

export async function updateExpenseAction(
  _prev: ExpenseActionState | null,
  formData: FormData
): Promise<ExpenseActionState> {
  const id = (formData.get("expense_id") as string | null)?.trim() ?? "";
  if (!id) return { error: "Missing expense ID." };

  const fields = parseFormData(formData);
  const validationError = validateFields(fields);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const update: ExpenseUpdate = {
    expense_date: fields.expense_date,
    vendor: fields.vendor,
    description: fields.description,
    amount: parseFloat(fields.amount_raw),
    currency: "INR",
    category_id: parseInt(fields.category_id),
    payment_method_id: parseInt(fields.payment_method_id),
    expense_type: fields.expense_type as ExpenseType,
    status: fields.status as ExpenseStatus,
    invoice_number: fields.invoice_number,
    notes: fields.notes,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("expenses")
    .update(update)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/expenses");
  return { success: true };
}

export async function deleteExpenseAction(
  id: string
): Promise<ExpenseActionState> {
  if (!id) return { error: "Missing expense ID." };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/salary");
  return { success: true };
}
