import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseType, ExpenseStatus } from "@/lib/supabase/types";

// ─── GET /api/expenses ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expenses")
    .select("*, categories(name), payment_methods(name)")
    .order("expense_date", { ascending: false });

  if (error) {
    console.error("[GET /api/expenses]", error.code, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row: any) => ({
    ...row,
    category_name: row.categories?.name ?? null,
    payment_method_name: row.payment_methods?.name ?? null,
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
    expense_type,
    status,
    description,
    invoice_number,
    notes,
    receipt_file_path,
    currency,
    raw_ai_json,
    ai_confidence,
  } = body;

  if (!expense_date || !vendor || amount == null || !category_id || !payment_method_id) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("expenses")
    .insert({
      expense_date,
      vendor,
      amount: Number(amount),
      category_id: Number(category_id),
      payment_method_id: Number(payment_method_id),
      expense_type: (expense_type ?? "manual") as ExpenseType,
      status: (status ?? "draft") as ExpenseStatus,
      description: description ?? null,
      invoice_number: invoice_number ?? null,
      notes: notes ?? null,
      receipt_file_path: receipt_file_path ?? null,
      currency: currency ?? "INR",
      raw_ai_json: raw_ai_json ?? null,
      ai_confidence: ai_confidence ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/expenses]", error.code, error.message, error.details);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
