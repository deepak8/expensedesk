import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── PATCH /api/expenses/[id]/mark-paid ──────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing expense ID." }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const {
    payment_date,
    paid_amount,
    payment_method_id,
    payment_reference,
    payment_proof_file_path,
    notes,
  } = body;

  if (!payment_date || paid_amount == null) {
    return NextResponse.json(
      { error: "Payment date and paid amount are required." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Fetch the current expense to validate and compare amounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchErr } = await (supabase as any)
    .from("expenses")
    .select("amount, payment_status")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }

  const paidNum = Number(paid_amount);
  const expenseAmount = Number((existing as any).amount);
  const paymentStatus = paidNum >= expenseAmount ? "paid" : "partially_paid";

  // Build the update payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {
    payment_status: paymentStatus,
    payment_date,
    paid_amount: paidNum,
    payment_method_id: payment_method_id ? Number(payment_method_id) : null,
    payment_reference: payment_reference ?? null,
    payment_proof_file_path: payment_proof_file_path ?? null,
  };

  // Append to notes if provided (don't overwrite existing notes)
  if (notes) {
    updatePayload.notes = notes;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("expenses")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[PATCH /api/expenses/[id]/mark-paid]", error.code, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
