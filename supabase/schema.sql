-- ─────────────────────────────────────────────────────────────────────────────
-- ExpenseDesk — Phase 1A schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type expense_type as enum ('manual', 'receipt', 'salary', 'reimbursement');

create type expense_status as enum (
  'draft',
  'needs_review',
  'verified',
  'missing_receipt'
);

-- ─── Categories ──────────────────────────────────────────────────────────────

create table if not exists categories (
  id   serial primary key,
  name text not null unique
);

-- ─── Payment Methods ──────────────────────────────────────────────────────────

create table if not exists payment_methods (
  id   serial primary key,
  name text not null unique
);

-- ─── Expenses ─────────────────────────────────────────────────────────────────

create table if not exists expenses (
  id                 uuid primary key default gen_random_uuid(),
  expense_date       date not null,
  vendor             text not null,
  description        text,
  amount             numeric(12, 2) not null check (amount >= 0),
  currency           char(3) not null default 'INR',
  category_id        integer references categories(id) on delete set null,
  payment_method_id  integer references payment_methods(id) on delete set null,
  expense_type       expense_type not null default 'manual',
  status             expense_status not null default 'draft',
  receipt_file_path  text,
  invoice_number     text,
  ai_confidence      smallint check (ai_confidence between 0 and 100),
  raw_ai_json        jsonb,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Keep updated_at current automatically
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger expenses_updated_at
  before update on expenses
  for each row execute procedure set_updated_at();

-- ─── Row-Level Security ───────────────────────────────────────────────────────

alter table categories     enable row level security;
alter table payment_methods enable row level security;
alter table expenses       enable row level security;

-- categories: any authenticated user can read
create policy "authenticated users can read categories"
  on categories for select
  to authenticated
  using (true);

-- payment_methods: any authenticated user can read
create policy "authenticated users can read payment_methods"
  on payment_methods for select
  to authenticated
  using (true);

-- expenses: authenticated users manage their own expenses
-- Phase 1A: simple open policies (no user_id column yet — tighten in Phase 2)
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

-- ─── Seed: Categories ────────────────────────────────────────────────────────

insert into categories (name) values
  ('Salary'),
  ('Rent'),
  ('Software'),
  ('Internet / Phone'),
  ('Travel'),
  ('Food / Meals'),
  ('Office Supplies'),
  ('Marketing'),
  ('Consulting'),
  ('Utilities'),
  ('Miscellaneous')
on conflict (name) do nothing;

-- ─── Seed: Payment Methods ────────────────────────────────────────────────────

insert into payment_methods (name) values
  ('UPI'),
  ('Credit Card'),
  ('Debit Card'),
  ('Bank Transfer'),
  ('Cash'),
  ('Company Card'),
  ('Personal Card - Reimbursable'),
  ('Other')
on conflict (name) do nothing;
