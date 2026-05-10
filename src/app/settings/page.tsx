import SettingsShell from "@/components/settings/SettingsShell";
import {
  getBusinessSettings,
  getCategories,
  getPaymentMethods,
  isSupabaseConfigured,
} from "@/lib/supabase/queries";
import type { BusinessSettingsRow, CategoryRow, PaymentMethodRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let categories: CategoryRow[] = [];
  let paymentMethods: PaymentMethodRow[] = [];
  let businessSettings: BusinessSettingsRow | null = null;

  if (isSupabaseConfigured()) {
    try {
      [categories, paymentMethods, businessSettings] = await Promise.all([
        getCategories(),
        getPaymentMethods(),
        getBusinessSettings(),
      ]);
    } catch (err) {
      console.error("[SettingsPage] Supabase fetch failed:", err);
    }
  }

  return (
    <SettingsShell
      categories={categories}
      paymentMethods={paymentMethods}
      businessSettings={businessSettings}
    />
  );
}
