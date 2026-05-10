import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseType, ExpenseStatus, DocumentType, PaymentStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// ─── PATCH /api/expenses/[id] ─────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing expense ID." }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

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
    currency,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("expenses")
    .update({
      expense_date,
      vendor,
      amount: Number(amount),
      category_id: category_id ? Number(category_id) : null,
      payment_method_id: payment_method_id ? Number(payment_method_id) : null,
      expense_type: expense_type as ExpenseType,
      status: status as ExpenseStatus,
      description: description ?? null,
      invoice_number: invoice_number ?? null,
      notes: notes ?? null,
      currency: currency ?? "INR",
      document_type: (document_type ?? "manual") as DocumentType,
      payment_status: (payment_status ?? "paid") as PaymentStatus,
      due_date: due_date ?? null,
      payment_date: payment_date ?? null,
      paid_amount: paid_amount != null ? Number(paid_amount) : null,
      payment_reference: payment_reference ?? null,
      payment_proof_file_path: payment_proof_file_path ?? null,
      ...(employee_id !== undefined ? { employee_id: employee_id || null } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[PATCH /api/expenses/[id]]", error.code, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// ─── DELETE /api/expenses/[id] ────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing expense ID." }, { status: 400 });

  const supabase = await createClient();

  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) {
    console.error("[DELETE /api/expenses/[id]]", error.code, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
