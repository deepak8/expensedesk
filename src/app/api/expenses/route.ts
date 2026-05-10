import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseType, ExpenseStatus, DocumentType, PaymentStatus } from "@/lib/supabase/types";
import { areLikelyDuplicates } from "@/lib/review-issues";

export const dynamic = "force-dynamic";

// ─── GET /api/expenses ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expenses")
    .select("*, categories(name), payment_methods(name), employees(name)")
    .order("expense_date", { ascending: false });

  if (error) {
    console.error("[GET /api/expenses]", error.code, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row: any) => ({
    ...row,
    category_name: row.categories?.name ?? null,
    payment_method_name: row.payment_methods?.name ?? null,
    employee_name: row.employees?.name ?? null,
  }));

  return NextResponse.json(rows);
}

// ─── POST /api/expenses ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    expense_date,
    vendor,
    amount,
    category_id,
    payment_method_id,
    employee_id,
    expense_type,
    status,
    description,
    invoice_number,
    notes,
    receipt_file_path,
    currency,
    raw_ai_json,
    ai_confidence,
    document_type,
    payment_status,
    due_date,
    payment_date,
    paid_amount,
    payment_reference,
    payment_proof_file_path,
  } = body;

  if (!expense_date || !vendor || amount == null) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const supabase = await createClient();
  let normalizedStatus = (status ?? "draft") as ExpenseStatus;

  const { data: existingRows } = await supabase
    .from("expenses")
    .select("id, expense_date, vendor, amount, invoice_number, payment_reference")
    .or(
      [
        `vendor.ilike.${String(vendor).replaceAll(",", "\\,")}`,
        invoice_number ? `invoice_number.eq.${String(invoice_number).replaceAll(",", "\\,")}` : "",
        payment_reference ? `payment_reference.eq.${String(payment_reference).replaceAll(",", "\\,")}` : "",
      ]
        .filter(Boolean)
        .join(",")
    );

  const duplicateFound = (existingRows ?? []).some((row) =>
    areLikelyDuplicates(
      {
        id: "__new__",
        expense_date,
        vendor,
        amount: Number(amount),
        invoice_number,
        payment_reference,
      },
      row
    )
  );

  if (duplicateFound) normalizedStatus = "needs_review";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("expenses")
    .insert({
      expense_date,
      vendor,
      amount: Number(amount),
      category_id: category_id ? Number(category_id) : null,
      payment_method_id: payment_method_id ? Number(payment_method_id) : null,
      employee_id: employee_id || null,
      expense_type: (expense_type ?? "manual") as ExpenseType,
      status: normalizedStatus,
      description: description ?? null,
      invoice_number: invoice_number ?? null,
      notes: notes ?? null,
      receipt_file_path: receipt_file_path ?? null,
      currency: currency ?? "INR",
      raw_ai_json: raw_ai_json ?? null,
      ai_confidence: ai_confidence ?? null,
      document_type: (document_type ?? "manual") as DocumentType,
      payment_status: (payment_status ?? "paid") as PaymentStatus,
      due_date: due_date ?? null,
      payment_date: payment_date ?? null,
      paid_amount: paid_amount != null ? Number(paid_amount) : null,
      payment_reference: payment_reference ?? null,
      payment_proof_file_path: payment_proof_file_path ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/expenses]", error.code, error.message, error.details);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
