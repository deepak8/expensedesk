"use server";

import { createClient } from "@/lib/supabase/server";
import { extractReceiptData } from "@/lib/openai/extract";
import type { ExtractionResult } from "@/lib/openai/extract";

export interface ExtractReceiptState {
  data?: ExtractionResult;
  error?: string;
}

/**
 * Server action — extracts expense fields from a stored receipt using OpenAI.
 *
 * Security checks:
 *  1. Requires an authenticated session.
 *  2. Verifies the receipt path belongs to the current user (path starts with userId/).
 *  3. Generates the signed URL server-side (no client-supplied URL accepted).
 */
export async function extractReceiptAction(
  receiptFilePath: string,
  categoryNames: string[],
  paymentMethodNames: string[]
): Promise<ExtractReceiptState> {
  // 1. Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // 2. Verify path ownership (path must start with userId/)
  if (!receiptFilePath.startsWith(user.id + "/")) {
    return { error: "Access denied." };
  }

  // 3. Generate a short-lived signed URL server-side
  const { data: urlData, error: urlError } = await supabase.storage
    .from("receipts")
    .createSignedUrl(receiptFilePath, 120); // 2 minutes — enough for download + API call

  if (urlError || !urlData?.signedUrl) {
    return { error: "Could not access the receipt file." };
  }

  // 4. Extract
  const result = await extractReceiptData({
    receiptFilePath,
    signedUrl: urlData.signedUrl,
    categoryNames,
    paymentMethodNames,
  });

  if (result.error || !result.data) return { error: result.error ?? "Extraction failed." };
  return { data: result.data };
}
