"use server";

import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/supabase/queries";
import { revalidatePath } from "next/cache";
import type { ExpenseType, ExpenseStatus, PaymentStatus, WorkerType, PaymentCycle, Database } from "@/lib/supabase/types";

type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
type ExpenseUpdate = Database["public"]["Tables"]["expenses"]["Update"];
type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];
type EmployeeUpdate = Database["public"]["Tables"]["employees"]["Update"];

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
  const employee_id = (formData.get("employee_id") as string | null)?.trim() || null;
  const vendor = (formData.get("vendor") as string | null)?.trim() ?? "";
  const salary_month = (formData.get("salary_month") as string | null)?.trim() ?? "";
  const expense_date = (formData.get("expense_date") as string | null)?.trim() ?? "";
  const amount_raw = (formData.get("amount") as string | null)?.trim() ?? "";
  const payment_method_id = (formData.get("payment_method_id") as string | null)?.trim() ?? "";
  const payment_status = ((formData.get("payment_status") as string | null)?.trim() || "paid") as PaymentStatus;
  const status = (formData.get("status") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const description = salaryMonthToDescription(salary_month);
  return { employee_id, vendor, salary_month, expense_date, amount_raw, payment_method_id, payment_status, status, notes, description };
}

function validateSalaryFields(f: ReturnType<typeof parseSalaryFormData>): string | null {
  if (!f.vendor) return "Employee/Contractor Name is required.";
  if (!f.expense_date) return "Payment Date is required.";
  if (!f.amount_raw) return "Amount is required.";
  const amount = parseFloat(f.amount_raw);
  if (isNaN(amount) || amount < 0) return "Amount must be a valid number ≥ 0.";
  if (!f.payment_method_id) return "Payment Method is required.";
  if (!["paid", "unpaid", "partially_paid"].includes(f.payment_status)) return "Payment Status is invalid.";
  if (!f.status) return "Status is required.";
  return null;
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/salary");
  revalidatePath("/reports");
}

async function getEmployeeName(supabase: Awaited<ReturnType<typeof createClient>>, employeeId: string | null) {
  if (!employeeId) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("employees")
    .select("name")
    .eq("id", employeeId)
    .single();

  if (error || !data?.name) return null;
  return data.name;
}

function paymentFields(paymentStatus: PaymentStatus, amount: number, expenseDate: string) {
  if (paymentStatus === "unpaid") {
    return { payment_date: null, paid_amount: null };
  }
  if (paymentStatus === "partially_paid") {
    return { payment_date: expenseDate, paid_amount: amount };
  }
  return { payment_date: expenseDate, paid_amount: amount };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createSalaryAction(
  _prev: SalaryActionState | null,
  formData: FormData
): Promise<SalaryActionState> {
  const fields = parseSalaryFormData(formData);
  const err = validateSalaryFields(fields);
  if (err) return { error: err };

  const [supabase, category_id] = await Promise.all([createClient(), getSalaryCategoryId()]);
  const employeeName = await getEmployeeName(supabase, fields.employee_id);
  const amount = parseFloat(fields.amount_raw);
  const pay = paymentFields(fields.payment_status, amount, fields.expense_date);

  const insert: ExpenseInsert = {
    expense_date: fields.expense_date,
    vendor: employeeName ?? fields.vendor,
    description: fields.description,
    amount,
    currency: "INR",
    category_id,
    payment_method_id: parseInt(fields.payment_method_id),
    employee_id: fields.employee_id,
    expense_type: "salary" as ExpenseType,
    status: fields.status as ExpenseStatus,
    document_type: "salary",
    payment_status: fields.payment_status,
    payment_date: pay.payment_date,
    paid_amount: pay.paid_amount,
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

  const [supabase, category_id] = await Promise.all([createClient(), getSalaryCategoryId()]);
  const employeeName = await getEmployeeName(supabase, fields.employee_id);
  const amount = parseFloat(fields.amount_raw);
  const pay = paymentFields(fields.payment_status, amount, fields.expense_date);

  const update: ExpenseUpdate = {
    expense_date: fields.expense_date,
    vendor: employeeName ?? fields.vendor,
    description: fields.description,
    amount,
    currency: "INR",
    category_id,
    payment_method_id: parseInt(fields.payment_method_id),
    employee_id: fields.employee_id,
    expense_type: "salary" as ExpenseType,
    status: fields.status as ExpenseStatus,
    document_type: "salary",
    payment_status: fields.payment_status,
    payment_date: pay.payment_date,
    paid_amount: pay.paid_amount,
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

function parseEmployeeFormData(formData: FormData) {
  return {
    name: (formData.get("name") as string | null)?.trim() ?? "",
    worker_type: ((formData.get("worker_type") as string | null)?.trim() || "employee") as WorkerType,
    role: (formData.get("role") as string | null)?.trim() || null,
    department: (formData.get("department") as string | null)?.trim() || null,
    email: (formData.get("email") as string | null)?.trim() || null,
    phone: (formData.get("phone") as string | null)?.trim() || null,
    default_salary_raw: (formData.get("default_salary") as string | null)?.trim() ?? "",
    default_payment_method_id: (formData.get("default_payment_method_id") as string | null)?.trim() || null,
    payment_cycle: ((formData.get("payment_cycle") as string | null)?.trim() || "monthly") as PaymentCycle,
    is_active: formData.get("is_active") === "on",
    notes: (formData.get("notes") as string | null)?.trim() || null,
  };
}

function validateEmployeeFields(fields: ReturnType<typeof parseEmployeeFormData>) {
  if (!fields.name) return "Name is required.";
  if (!["employee", "contractor", "freelancer", "other"].includes(fields.worker_type)) return "Worker Type is invalid.";
  if (!["monthly", "weekly", "ad_hoc"].includes(fields.payment_cycle)) return "Payment Cycle is invalid.";
  if (fields.default_salary_raw) {
    const salary = parseFloat(fields.default_salary_raw);
    if (isNaN(salary) || salary < 0) return "Default Salary must be a valid number ≥ 0.";
  }
  return null;
}

function employeePayload(fields: ReturnType<typeof parseEmployeeFormData>): EmployeeInsert {
  return {
    name: fields.name,
    worker_type: fields.worker_type,
    role: fields.role,
    department: fields.department,
    email: fields.email,
    phone: fields.phone,
    default_salary: fields.default_salary_raw ? parseFloat(fields.default_salary_raw) : null,
    default_payment_method_id: fields.default_payment_method_id ? parseInt(fields.default_payment_method_id, 10) : null,
    payment_cycle: fields.payment_cycle,
    is_active: fields.is_active,
    notes: fields.notes,
  };
}

export async function createEmployeeAction(
  _prev: SalaryActionState | null,
  formData: FormData
): Promise<SalaryActionState> {
  const fields = parseEmployeeFormData(formData);
  const err = validateEmployeeFields(fields);
  if (err) return { error: err };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("employees").insert(employeePayload(fields));
  if (error) return { error: error.message };

  revalidatePath("/salary");
  return { success: true };
}

export async function updateEmployeeAction(
  _prev: SalaryActionState | null,
  formData: FormData
): Promise<SalaryActionState> {
  const id = (formData.get("employee_id") as string | null)?.trim() ?? "";
  if (!id) return { error: "Missing employee ID." };

  const fields = parseEmployeeFormData(formData);
  const err = validateEmployeeFields(fields);
  if (err) return { error: err };

  const update = employeePayload(fields) as EmployeeUpdate;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("employees").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/salary");
  return { success: true };
}

export async function setEmployeeActiveAction(id: string, isActive: boolean): Promise<SalaryActionState> {
  if (!id) return { error: "Missing employee ID." };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("employees").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/salary");
  return { success: true };
}
