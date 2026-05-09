"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ExpenseStatus, ExpenseType, DocumentType, PaymentStatus, Database } from "@/lib/supabase/types";

type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];

// Safe field names that may be stored from an AI extraction result.
// Anything outside this list is stripped before persisting.
const AI_JSON_SAFE_KEYS = [
  "vendor",
  "amount",
  "currency",
  "expense_date",
  "due_date",
  "payment_method_guess",
  "category_guess",
  "description",
  "invoice_number",
  "confidence",
  "fields_needing_review",
] as const;

/** Maximum byte length for the raw_ai_json column. Keeps the DB row small. */
const AI_JSON_MAX_BYTES = 4096;

/**
 * Parse raw_ai_json form field safely:
 *  - Only preserves known scalar/array fields (no base64, no URLs, no nested objects).
 *  - Discards entirely if the result exceeds AI_JSON_MAX_BYTES.
 */
function parseAiJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  // Strip to known safe keys only
  const safe: Record<string, unknown> = {};
  for (const key of AI_JSON_SAFE_KEYS) {
    const v = (parsed as Record<string, unknown>)[key];
    if (v === undefined) continue;
    // Only allow primitives and arrays-of-primitives
    if (
      v === null ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      safe[key] = v;
    } else if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) {
      safe[key] = v;
    }
    // Everything else (objects, large blobs, URLs) is silently dropped
  }

  const serialized = JSON.stringify(safe);
  if (serialized.length > AI_JSON_MAX_BYTES) {
    console.warn("[saveReceiptExpenseAction] raw_ai_json too large, discarding.");
    return null;
  }
  return safe;
}

export interface ReceiptExpenseState {
  success?: boolean;
  id?: string;
  error?: string;
}

export async function saveReceiptExpenseAction(
  _prev: ReceiptExpenseState | null,
  formData: FormData
): Promise<ReceiptExpenseState> {
  // ── Required fields ────────────────────────────────────────────────────────
  const expense_date = (formData.get("expense_date") as string | null)?.trim() ?? "";
  const vendor      = (formData.get("vendor")       as string | null)?.trim() ?? "";
  const amount_raw  = (formData.get("amount")        as string | null)?.trim() ?? "";

  if (!expense_date) return { error: "Date is required." };
  if (!vendor)       return { error: "Vendor is required." };
  if (!amount_raw)   return { error: "Amount is required." };

  const amount = parseFloat(amount_raw);
  if (isNaN(amount) || amount < 0) return { error: "Amount must be a valid number ≥ 0." };

  // ── Optional fields ────────────────────────────────────────────────────────
  const receipt_file_path      = (formData.get("receipt_file_path")  as string | null)?.trim() || null;
  const category_id_raw        = (formData.get("category_id")        as string | null)?.trim();
  const payment_method_id_raw  = (formData.get("payment_method_id")  as string | null)?.trim();
  const description            = (formData.get("description")        as string | null)?.trim() || null;
  const invoice_number         = (formData.get("invoice_number")     as string | null)?.trim() || null;
  const notes                  = (formData.get("notes")              as string | null)?.trim() || null;
  const status = ((formData.get("status") as string | null)?.trim() || "needs_review") as ExpenseStatus;
  const currency               = (formData.get("currency")           as string | null)?.trim() || "INR";

  // ── Phase 3C fields ────────────────────────────────────────────────────────
  const document_type    = ((formData.get("document_type")     as string | null)?.trim() || "receipt") as DocumentType;
  const payment_status   = ((formData.get("payment_status")    as string | null)?.trim() || "paid") as PaymentStatus;
  const due_date         = (formData.get("due_date")            as string | null)?.trim() || null;
  const payment_reference = (formData.get("payment_reference") as string | null)?.trim() || null;
  const expense_type_raw = ((formData.get("expense_type")       as string | null)?.trim() || "receipt") as ExpenseType;

  // For receipts / payment proofs: payment_date = expense_date, paid_amount = amount
  // For invoices: both are null (unpaid)
  const payment_date = document_type === "invoice" ? null : expense_date;
  const paid_amount  = document_type === "invoice" ? null : amount;

  // ── AI fields (compact extraction JSON only — no OpenAI calls here) ────────
  const raw_ai_json   = parseAiJson(formData.get("raw_ai_json") as string | null);
  const ai_conf_raw   = (formData.get("ai_confidence") as string | null)?.trim();
  const ai_confidence = ai_conf_raw ? parseFloat(ai_conf_raw) : null;

  // ── Supabase insert (no storage access, no OpenAI calls) ──────────────────
  const supabase = await createClient();

  const insert: ExpenseInsert = {
    expense_date,
    vendor,
    description,
    amount,
    currency,
    category_id:        category_id_raw       ? parseInt(category_id_raw, 10)       : null,
    payment_method_id:  payment_method_id_raw ? parseInt(payment_method_id_raw, 10) : null,
    expense_type:       expense_type_raw,
    status,
    receipt_file_path,
    invoice_number,
    notes,
    raw_ai_json,
    ai_confidence: ai_confidence !== null && !isNaN(ai_confidence) ? ai_confidence : null,
    document_type,
    payment_status,
    due_date,
    payment_date,
    paid_amount,
    payment_reference,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("expenses")
    .insert(insert)
    .select("id")
    .single();

  if (error) {
    // Log full Supabase error server-side for debugging
    console.error("[saveReceiptExpenseAction] Supabase insert failed:", {
      code:    error.code,
      message: error.message,
      details: error.details,
      hint:    error.hint,
    });
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/expenses");
  return { success: true, id: data?.id };
}
