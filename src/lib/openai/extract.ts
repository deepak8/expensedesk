// Server-only — never imported by client code.
// Contains the OpenAI receipt extraction logic.

import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions/completions";

// ─── Result shape ─────────────────────────────────────────────────────────────

export interface ExtractionResult {
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  expense_date: string | null;
  payment_method_guess: string | null;
  category_guess: string | null;
  description: string | null;
  invoice_number: string | null;
  confidence: number; // 0–1
  fields_needing_review: string[];
}

export type ExtractResult =
  | { data: ExtractionResult; error: null }
  | { data: null; error: string };

// ─── Options ──────────────────────────────────────────────────────────────────

export interface ExtractReceiptOptions {
  /** Bucket-relative path stored in the DB. */
  receiptFilePath: string;
  /** Signed URL for the receipt (valid for at least 60 s). */
  signedUrl: string;
  categoryNames: string[];
  paymentMethodNames: string[];
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function extractReceiptData(
  opts: ExtractReceiptOptions
): Promise<ExtractResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { data: null, error: "OpenAI API key is not configured." };

  const openai = new OpenAI({ apiKey });

  const isPdf =
    opts.receiptFilePath.toLowerCase().endsWith(".pdf") ||
    opts.signedUrl.toLowerCase().includes(".pdf");

  // Download the file so we can send it as base64
  let fileBuffer: ArrayBuffer;
  let contentType: string;
  try {
    const response = await fetch(opts.signedUrl);
    if (!response.ok) {
      return { data: null, error: "Could not download receipt file for analysis." };
    }
    fileBuffer = await response.arrayBuffer();
    contentType = response.headers.get("content-type") ?? (isPdf ? "application/pdf" : "image/jpeg");
  } catch {
    return { data: null, error: "Failed to fetch the receipt file." };
  }

  const base64 = Buffer.from(fileBuffer).toString("base64");

  // ── Prompt ────────────────────────────────────────────────────────────────

  const systemPrompt =
    "You are a precise receipt data extraction assistant. " +
    "Extract expense information conservatively and accurately. " +
    "Never invent or guess fields you cannot read. Return valid JSON only.";

  const categoryList =
    opts.categoryNames.length > 0
      ? opts.categoryNames.join(", ")
      : "none available";

  const methodList =
    opts.paymentMethodNames.length > 0
      ? opts.paymentMethodNames.join(", ")
      : "none available";

  const extractionPrompt = `Extract expense details from this receipt. Return a single JSON object with exactly these fields:

- vendor: string or null (merchant / business name)
- amount: number or null (grand total / amount paid — NOT tax/GST alone; prefer "Total", "Amount Paid", or "Grand Total")
- currency: string or null (3-letter ISO code; use "INR" only if the receipt is clearly Indian or the amount format strongly implies rupees; otherwise use the detected currency or null)
- expense_date: string or null (YYYY-MM-DD; use the transaction / invoice date)
- payment_method_guess: string or null (match one of these exactly if possible: ${methodList})
- category_guess: string or null (match one of these exactly if possible: ${categoryList})
- description: string or null (one-line summary of what was purchased, e.g. "Office supplies from Staples")
- invoice_number: string or null (invoice / receipt / order number if clearly visible)
- confidence: number between 0.0 and 1.0 (your overall confidence in the extraction; 0.9+ = all key fields clearly readable, 0.6–0.89 = minor uncertainty, below 0.6 = significant uncertainty)
- fields_needing_review: array of field name strings that are missing, unclear, or uncertain

Rules:
- For UPI payment screenshots: vendor = payee name, payment_method_guess = "UPI" if it matches the list
- Never include GST / tax subtotals as the amount unless no total is available
- Return null for any field you cannot determine with reasonable confidence
- Date must be YYYY-MM-DD or null — never a different format`;

  // ── Build content parts ───────────────────────────────────────────────────

  const contentParts: ChatCompletionContentPart[] = [];

  if (isPdf) {
    // Use the v6 SDK File content part (base64 data URI)
    const pdfDataUri = `data:application/pdf;base64,${base64}`;
    contentParts.push({
      type: "file",
      file: {
        file_data: pdfDataUri,
        filename: "receipt.pdf",
      },
    } as ChatCompletionContentPart);
  } else {
    // Image — determine correct MIME type
    const mimeType = contentType.startsWith("image/") ? contentType : "image/jpeg";
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${base64}`,
        detail: "high",
      },
    });
  }

  contentParts.push({ type: "text", text: extractionPrompt });

  // ── Call OpenAI ───────────────────────────────────────────────────────────

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contentParts },
      ],
      response_format: { type: "json_object" },
      max_tokens: 600,
      temperature: 0,
    });

    const text = response.choices[0]?.message?.content ?? "";
    return parseResponse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[extractReceiptData] OpenAI error:", msg);
    return { data: null, error: `AI extraction failed: ${msg}` };
  }
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseResponse(text: string): ExtractResult {
  try {
    const raw = JSON.parse(text);
    const data: ExtractionResult = {
      vendor: typeof raw.vendor === "string" ? raw.vendor : null,
      amount:
        typeof raw.amount === "number" && isFinite(raw.amount) ? raw.amount : null,
      currency: typeof raw.currency === "string" ? raw.currency : null,
      expense_date: typeof raw.expense_date === "string" ? raw.expense_date : null,
      payment_method_guess:
        typeof raw.payment_method_guess === "string" ? raw.payment_method_guess : null,
      category_guess:
        typeof raw.category_guess === "string" ? raw.category_guess : null,
      description: typeof raw.description === "string" ? raw.description : null,
      invoice_number:
        typeof raw.invoice_number === "string" ? raw.invoice_number : null,
      confidence:
        typeof raw.confidence === "number"
          ? Math.max(0, Math.min(1, raw.confidence))
          : 0.5,
      fields_needing_review: Array.isArray(raw.fields_needing_review)
        ? (raw.fields_needing_review as unknown[]).filter(
            (f): f is string => typeof f === "string"
          )
        : [],
    };
    return { data, error: null };
  } catch {
    return { data: null, error: "Failed to parse AI response." };
  }
}
