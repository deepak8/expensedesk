import { createClient } from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadResult =
  | { path: string; error: null }
  | { path: null; error: string };

export type SignedUrlResult =
  | { signedUrl: string; error: null }
  | { signedUrl: null; error: string };

// ─── Validation ───────────────────────────────────────────────────────────────

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateReceiptFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only JPG, PNG, WebP, and PDF files are supported.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 10 MB.`;
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Sanitise a filename — keep alphanumeric, dots, hyphens, underscores. */
function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

// ─── Storage operations ───────────────────────────────────────────────────────

/**
 * Upload a receipt file on behalf of the current user.
 * Returns the bucket-relative path on success.
 *
 * Path convention: {userId}/{yyyy-mm}/{timestamp}-{safe-filename}
 */
export async function uploadReceiptFile(
  userId: string,
  file: File
): Promise<UploadResult> {
  const supabase = createClient();

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const path = `${userId}/${yearMonth}/${now.getTime()}-${safeName(file.name)}`;

  const { error } = await supabase.storage.from("receipts").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

/**
 * Generate a short-lived signed URL for previewing a receipt.
 * The path should be the bucket-relative path returned by uploadReceiptFile.
 */
export async function getReceiptSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<SignedUrlResult> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    return { signedUrl: null, error: error?.message ?? "Failed to generate preview URL." };
  }
  return { signedUrl: data.signedUrl, error: null };
}

/**
 * Delete a receipt file from storage.
 * Used when the user cancels after uploading but before saving.
 */
export async function deleteReceiptFile(
  path: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.storage.from("receipts").remove([path]);
  return { error: error?.message ?? null };
}
