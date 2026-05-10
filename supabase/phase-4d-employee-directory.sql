-- ─────────────────────────────────────────────────────────────────────────────
-- ExpenseDesk — Phase 4D Employee Directory
-- Adds lightweight employee/contractor records for salary expenses.
-- ─────────────────────────────────────────────────────────────────────────────

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

alter table expenses
  add column if not exists employee_id uuid references employees(id) on delete set null;

alter table employees enable row level security;

drop policy if exists "authenticated users can read employees" on employees;
drop policy if exists "authenticated users can insert employees" on employees;
drop policy if exists "authenticated users can update employees" on employees;
drop policy if exists "authenticated users can delete employees" on employees;

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

drop trigger if exists employees_updated_at on employees;
create trigger employees_updated_at
  before update on employees
  for each row execute procedure set_updated_at();
