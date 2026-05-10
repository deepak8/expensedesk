"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, RotateCcw, XCircle } from "lucide-react";
import Header from "@/components/Header";
import type { BusinessSettingsRow, CategoryRow, PaymentMethodRow } from "@/lib/supabase/types";
import {
  createCategoryAction,
  createPaymentMethodAction,
  saveBusinessSettingsAction,
  setCategoryActiveAction,
  setPaymentMethodActiveAction,
  updateCategoryAction,
  updatePaymentMethodAction,
} from "@/app/settings/actions";
import { cn } from "@/lib/utils";

interface Props {
  categories: CategoryRow[];
  paymentMethods: PaymentMethodRow[];
  businessSettings: BusinessSettingsRow | null;
}

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 text-[11px] font-medium",
        active
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-gray-200 bg-gray-100 text-gray-600"
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function SettingsShell({ categories, paymentMethods, businessSettings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function toggleCategory(category: CategoryRow) {
    setMessage(null);
    startTransition(async () => {
      const result = await setCategoryActiveAction(category.id, !category.is_active);
      if (result.error) setMessage(result.error);
      router.refresh();
    });
  }

  function togglePaymentMethod(method: PaymentMethodRow) {
    setMessage(null);
    startTransition(async () => {
      const result = await setPaymentMethodActiveAction(method.id, !method.is_active);
      if (result.error) setMessage(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Settings" subtitle="Manage basic app configuration" />

      <div className="max-w-5xl flex-1 space-y-6 p-6">
        {message && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <Section title="Business Profile" subtitle="Single-record business details used by the app.">
          <form action={saveBusinessSettingsAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Business Name</span>
                <input name="business_name" defaultValue={businessSettings?.business_name ?? ""} className={inputCls} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Default Currency</span>
                <input name="default_currency" defaultValue={businessSettings?.default_currency ?? "INR"} className={inputCls} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Contact Email</span>
                <input type="email" name="contact_email" defaultValue={businessSettings?.contact_email ?? ""} className={inputCls} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Phone</span>
                <input name="phone" defaultValue={businessSettings?.phone ?? ""} className={inputCls} />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Address</span>
              <textarea
                name="address"
                rows={2}
                defaultValue={businessSettings?.address ?? ""}
                className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Notes</span>
              <textarea
                name="notes"
                rows={2}
                defaultValue={businessSettings?.notes ?? ""}
                className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90">
              Save Business Profile
            </button>
          </form>
        </Section>

        <Section title="Categories" subtitle="Inactive categories are hidden from new-entry dropdowns but remain visible on existing expenses.">
          <form action={createCategoryAction} className="mb-4 flex max-w-md gap-2">
            <input name="name" required placeholder="Add category" className={inputCls} />
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90">
              Add
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-4 py-3">
                      {editingCategoryId === category.id ? (
                        <form action={updateCategoryAction} className="flex gap-2">
                          <input type="hidden" name="id" value={category.id} />
                          <input name="name" required defaultValue={category.name} className={inputCls} />
                          <button className="rounded-lg bg-primary px-3 text-xs font-medium text-white">Save</button>
                        </form>
                      ) : (
                        <span className="text-xs font-medium text-foreground">{category.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                    <td className="px-4 py-3"><StatusBadge active={category.is_active} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditingCategoryId(editingCategoryId === category.id ? null : category.id)}
                          className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => toggleCategory(category)}
                          className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
                        >
                          {category.is_active ? <XCircle className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          {category.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Payment Methods" subtitle="Inactive methods are hidden from new payment dropdowns but preserved on older records.">
          <form action={createPaymentMethodAction} className="mb-4 flex max-w-md gap-2">
            <input name="name" required placeholder="Add payment method" className={inputCls} />
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90">
              Add
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Payment Method</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paymentMethods.map((method) => (
                  <tr key={method.id}>
                    <td className="px-4 py-3">
                      {editingPaymentMethodId === method.id ? (
                        <form action={updatePaymentMethodAction} className="flex gap-2">
                          <input type="hidden" name="id" value={method.id} />
                          <input name="name" required defaultValue={method.name} className={inputCls} />
                          <button className="rounded-lg bg-primary px-3 text-xs font-medium text-white">Save</button>
                        </form>
                      ) : (
                        <span className="text-xs font-medium text-foreground">{method.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge active={method.is_active} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditingPaymentMethodId(editingPaymentMethodId === method.id ? null : method.id)}
                          className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => togglePaymentMethod(method)}
                          className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
                        >
                          {method.is_active ? <XCircle className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          {method.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
