-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1A RLS fix — allow anon role until Supabase Auth is added in Phase 1B
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- After Phase 1B adds auth, tighten these policies to use auth.uid().
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the authenticated-only policies
drop policy if exists "authenticated users can read categories" on categories;
drop policy if exists "authenticated users can read payment_methods" on payment_methods;
drop policy if exists "authenticated users can read expenses" on expenses;
drop policy if exists "authenticated users can insert expenses" on expenses;
drop policy if exists "authenticated users can update expenses" on expenses;
drop policy if exists "authenticated users can delete expenses" on expenses;

-- categories: anon + authenticated can read
create policy "anyone can read categories"
  on categories for select
  to anon, authenticated
  using (true);

-- payment_methods: anon + authenticated can read
create policy "anyone can read payment_methods"
  on payment_methods for select
  to anon, authenticated
  using (true);

-- expenses: anon + authenticated full CRUD (tighten to per-user in Phase 1B)
create policy "anyone can read expenses"
  on expenses for select
  to anon, authenticated
  using (true);

create policy "anyone can insert expenses"
  on expenses for insert
  to anon, authenticated
  with check (true);

create policy "anyone can update expenses"
  on expenses for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "anyone can delete expenses"
  on expenses for delete
  to anon, authenticated
  using (true);
