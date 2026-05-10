-- ─────────────────────────────────────────────────────────────────────────────
-- ExpenseDesk — Phase 4E Settings Cleanup
-- Adds active flags for lookup tables and a single-record business profile.
-- ─────────────────────────────────────────────────────────────────────────────

alter table categories
  add column if not exists is_active boolean not null default true;

alter table payment_methods
  add column if not exists is_active boolean not null default true;

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

alter table business_settings enable row level security;

drop policy if exists "authenticated users can insert categories" on categories;
drop policy if exists "authenticated users can update categories" on categories;
drop policy if exists "authenticated users can insert payment_methods" on payment_methods;
drop policy if exists "authenticated users can update payment_methods" on payment_methods;
drop policy if exists "authenticated users can read business_settings" on business_settings;
drop policy if exists "authenticated users can insert business_settings" on business_settings;
drop policy if exists "authenticated users can update business_settings" on business_settings;

create policy "authenticated users can insert categories"
  on categories for insert
  to authenticated
  with check (true);

create policy "authenticated users can update categories"
  on categories for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can insert payment_methods"
  on payment_methods for insert
  to authenticated
  with check (true);

create policy "authenticated users can update payment_methods"
  on payment_methods for update
  to authenticated
  using (true)
  with check (true);

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

drop trigger if exists business_settings_updated_at on business_settings;
create trigger business_settings_updated_at
  before update on business_settings
  for each row execute procedure set_updated_at();
