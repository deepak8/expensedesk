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
  "h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 disabled:opacity-60";

const textareaCls =
  "w-full resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground transition-colors focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10";

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
    <section className="border-y border-border bg-white">
      <div className="border-b border-border px-5 py-4">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
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
        "rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
        active
          ? "border-[rgb(176_242_213)] bg-[rgb(176_242_213)] text-foreground"
          : "border-border bg-[rgb(248_248_248)] text-muted-foreground"
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
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Settings" subtitle="Manage basic app configuration" />

      <div className="max-w-5xl flex-1 space-y-6 px-6 py-5">
        {message && (
          <div className="rounded-md border border-[rgb(254_221_241)] bg-[rgb(254_221_241)] px-4 py-3 text-sm text-foreground">
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
                className={textareaCls}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Notes</span>
              <textarea
                name="notes"
                rows={2}
                defaultValue={businessSettings?.notes ?? ""}
                className={textareaCls}
              />
            </label>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              Save Business Profile
            </button>
          </form>
        </Section>

        <Section title="Categories" subtitle="Inactive categories are hidden from new-entry dropdowns but remain visible on existing expenses.">
          <form action={createCategoryAction} className="mb-4 flex max-w-md gap-2">
            <input name="name" required placeholder="Add category" className={inputCls} />
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              Add
            </button>
          </form>

          <div className="overflow-hidden border-y border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-white">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-muted-foreground">Category</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-[rgb(248_248_248)] transition-colors">
                    <td className="px-4 py-2.5">
                      {editingCategoryId === category.id ? (
                        <form action={updateCategoryAction} className="flex gap-2">
                          <input type="hidden" name="id" value={category.id} />
                          <input name="name" required defaultValue={category.name} className={inputCls} />
                          <button className="rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Save</button>
                        </form>
                      ) : (
                        <span className="text-xs font-medium text-foreground">{category.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
                    <td className="px-4 py-2.5"><StatusBadge active={category.is_active} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditingCategoryId(editingCategoryId === category.id ? null : category.id)}
                          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-[rgb(248_248_248)] hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => toggleCategory(category)}
                          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-[rgb(248_248_248)] hover:text-foreground disabled:opacity-60"
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
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              Add
            </button>
          </form>

          <div className="overflow-hidden border-y border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-white">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-muted-foreground">Payment Method</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paymentMethods.map((method) => (
                  <tr key={method.id} className="hover:bg-[rgb(248_248_248)] transition-colors">
                    <td className="px-4 py-2.5">
                      {editingPaymentMethodId === method.id ? (
                        <form action={updatePaymentMethodAction} className="flex gap-2">
                          <input type="hidden" name="id" value={method.id} />
                          <input name="name" required defaultValue={method.name} className={inputCls} />
                          <button className="rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Save</button>
                        </form>
                      ) : (
                        <span className="text-xs font-medium text-foreground">{method.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge active={method.is_active} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditingPaymentMethodId(editingPaymentMethodId === method.id ? null : method.id)}
                          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-[rgb(248_248_248)] hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => togglePaymentMethod(method)}
                          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-[rgb(248_248_248)] hover:text-foreground disabled:opacity-60"
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
