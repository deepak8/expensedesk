import { isSupabaseConfigured, getCategories, getPaymentMethods } from "@/lib/supabase/queries";
import UploadReceiptShell from "@/components/upload/UploadReceiptShell";
import type { CategoryRow, PaymentMethodRow } from "@/lib/supabase/types";

export default async function UploadPage() {
  let categoryRows: CategoryRow[] = [];
  let paymentMethodRows: PaymentMethodRow[] = [];

  if (isSupabaseConfigured()) {
    try {
      [categoryRows, paymentMethodRows] = await Promise.all([
        getCategories(),
        getPaymentMethods(),
      ]);
    } catch (err) {
      console.error("[UploadPage] Supabase fetch failed:", err);
    }
  }

  return (
    <UploadReceiptShell
      categoryRows={categoryRows}
      paymentMethodRows={paymentMethodRows}
    />
  );
}
