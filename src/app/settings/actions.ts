"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessSettings } from "@/lib/supabase/queries";

function clean(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function revalidateSettingsConsumers() {
  revalidatePath("/settings");
  revalidatePath("/expenses");
  revalidatePath("/upload");
  revalidatePath("/salary");
  revalidatePath("/reports");
  revalidatePath("/");
}

export async function saveBusinessSettingsAction(formData: FormData) {
  const payload = {
    business_name: clean(formData.get("business_name")),
    default_currency: clean(formData.get("default_currency")) ?? "INR",
    contact_email: clean(formData.get("contact_email")),
    phone: clean(formData.get("phone")),
    address: clean(formData.get("address")),
    notes: clean(formData.get("notes")),
  };

  const supabase = await createClient();
  const existing = await getBusinessSettings();

  const query = existing
    ? (supabase as any).from("business_settings").update(payload).eq("id", existing.id)
    : (supabase as any).from("business_settings").insert(payload);

  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidateSettingsConsumers();
}

export async function createCategoryAction(formData: FormData) {
  const name = clean(formData.get("name"));
  if (!name) throw new Error("Category name is required.");

  const supabase = await createClient();
  const { error } = await (supabase as any).from("categories").insert({ name, is_active: true });
  if (error) throw new Error(error.message);
  revalidateSettingsConsumers();
}

export async function updateCategoryAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = clean(formData.get("name"));
  if (!id || !name) throw new Error("Category ID and name are required.");

  const supabase = await createClient();
  const { error } = await (supabase as any).from("categories").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateSettingsConsumers();
}

export async function setCategoryActiveAction(id: number, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await (supabase as any).from("categories").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };
  revalidateSettingsConsumers();
  return { success: true };
}

export async function createPaymentMethodAction(formData: FormData) {
  const name = clean(formData.get("name"));
  if (!name) throw new Error("Payment method name is required.");

  const supabase = await createClient();
  const { error } = await (supabase as any).from("payment_methods").insert({ name, is_active: true });
  if (error) throw new Error(error.message);
  revalidateSettingsConsumers();
}

export async function updatePaymentMethodAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = clean(formData.get("name"));
  if (!id || !name) throw new Error("Payment method ID and name are required.");

  const supabase = await createClient();
  const { error } = await (supabase as any).from("payment_methods").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateSettingsConsumers();
}

export async function setPaymentMethodActiveAction(id: number, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await (supabase as any).from("payment_methods").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };
  revalidateSettingsConsumers();
  return { success: true };
}
