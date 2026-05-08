-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1B RLS — require authentication (drop anon access added in Phase 1A fix)
--
-- Run this in the Supabase SQL editor after adding your first user via
-- Supabase Dashboard → Authentication → Users → "Invite user" or "Add user".
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the anon-inclusive policies from fix-rls-anon.sql
drop policy if exists "anyone can read categories"    on categories;
drop policy if exists "anyone can read payment_methods" on payment_methods;
drop policy if exists "anyone can read expenses"      on expenses;
drop policy if exists "anyone can insert expenses"    on expenses;
drop policy if exists "anyone can update expenses"    on expenses;
drop policy if exists "anyone can delete expenses"    on expenses;

-- Also drop the original authenticated-only policies from schema.sql (safe to re-run)
drop policy if exists "authenticated users can read categories"    on categories;
drop policy if exists "authenticated users can read payment_methods" on payment_methods;
drop policy if exists "authenticated users can read expenses"      on expenses;
drop policy if exists "authenticated users can insert expenses"    on expenses;
drop policy if exists "authenticated users can update expenses"    on expenses;
drop policy if exists "authenticated users can delete expenses"    on expenses;

-- categories: authenticated users can read
create policy "authenticated users can read categories"
  on categories for select
  to authenticated
  using (true);

-- payment_methods: authenticated users can read
create policy "authenticated users can read payment_methods"
  on payment_methods for select
  to authenticated
  using (true);

-- expenses: authenticated users have full CRUD (shared business account — no per-user isolation yet)
create policy "authenticated users can read expenses"
  on expenses for select
  to authenticated
  using (true);

create policy "authenticated users can insert expenses"
  on expenses for insert
  to authenticated
  with check (true);

create policy "authenticated users can update expenses"
  on expenses for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete expenses"
  on expenses for delete
  to authenticated
  using (true);
