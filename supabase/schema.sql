-- ─────────────────────────────────────────────────────────────────────────────
-- ExpenseDesk — Phase 1A schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type expense_type as enum ('manual', 'receipt', 'salary', 'reimbursement', 'invoice');

create type expense_status as enum (
  'draft',
  'needs_review',
  'verified',
  'missing_receipt'
);

-- ─── Categories ──────────────────────────────────────────────────────────────

create table if not exists categories (
  id        serial primary key,
  name      text not null unique,
  is_active boolean not null default true
);

-- ─── Payment Methods ──────────────────────────────────────────────────────────

create table if not exists payment_methods (
  id        serial primary key,
  name      text not null unique,
  is_active boolean not null default true
);

-- ─── Business Settings ───────────────────────────────────────────────────────

create table if not exists business_settings (
  id               uuid primary key default gen_random_uuid(),
  business_name    text,
  default_currency text not null default 'INR',
  contact_email    text,
  phone            text,
  address          text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ─── Employees / Contractors ─────────────────────────────────────────────────

create table if not exists employees (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  worker_type               text not null default 'employee'
    check (worker_type in ('employee', 'contractor', 'freelancer', 'other')),
  role                      text,
  department                text,
  email                     text,
  phone                     text,
  default_salary            numeric(12, 2) check (default_salary is null or default_salary >= 0),
  default_payment_method_id integer references payment_methods(id) on delete set null,
  payment_cycle             text not null default 'monthly'
    check (payment_cycle in ('monthly', 'weekly', 'ad_hoc')),
  is_active                 boolean not null default true,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
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
  employee_id         uuid references employees(id) on delete set null,
  expense_type       expense_type not null default 'manual',
  status             expense_status not null default 'draft',
  receipt_file_path  text,
  invoice_number     text,
  ai_confidence      numeric(4,3) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  raw_ai_json        jsonb,
  notes              text,
  -- Phase 3C: Invoice / Payment Proof workflow
  document_type      text not null default 'receipt',
  payment_status     text not null default 'paid',
  due_date           date,
  payment_date       date,
  paid_amount        numeric(12, 2),
  payment_reference  text,
  payment_proof_file_path text,
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

create trigger employees_updated_at
  before update on employees
  for each row execute procedure set_updated_at();

create trigger business_settings_updated_at
  before update on business_settings
  for each row execute procedure set_updated_at();

-- ─── Row-Level Security ───────────────────────────────────────────────────────

alter table categories     enable row level security;
alter table payment_methods enable row level security;
alter table business_settings enable row level security;
alter table employees      enable row level security;
alter table expenses       enable row level security;

-- categories: any authenticated user can read
create policy "authenticated users can read categories"
  on categories for select
  to authenticated
  using (true);

create policy "authenticated users can insert categories"
  on categories for insert
  to authenticated
  with check (true);

create policy "authenticated users can update categories"
  on categories for update
  to authenticated
  using (true)
  with check (true);

-- payment_methods: any authenticated user can read
create policy "authenticated users can read payment_methods"
  on payment_methods for select
  to authenticated
  using (true);

create policy "authenticated users can insert payment_methods"
  on payment_methods for insert
  to authenticated
  with check (true);

create policy "authenticated users can update payment_methods"
  on payment_methods for update
  to authenticated
  using (true)
  with check (true);

-- business_settings: single-record MVP settings
create policy "authenticated users can read business_settings"
  on business_settings for select
  to authenticated
  using (true);

create policy "authenticated users can insert business_settings"
  on business_settings for insert
  to authenticated
  with check (true);

create policy "authenticated users can update business_settings"
  on business_settings for update
  to authenticated
  using (true)
  with check (true);

-- employees: authenticated users can manage the lightweight directory
create policy "authenticated users can read employees"
  on employees for select
  to authenticated
  using (true);

create policy "authenticated users can insert employees"
  on employees for insert
  to authenticated
  with check (true);

create policy "authenticated users can update employees"
  on employees for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete employees"
  on employees for delete
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
