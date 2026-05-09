-- ─────────────────────────────────────────────────────────────────────────────
-- ExpenseDesk — Phase 3C: Invoice vs Payment Proof workflow
--
-- Run this in the Supabase SQL editor AFTER the existing schema.
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
--       If using the SQL editor, run the ALTER TYPE line separately first,
--       then run the rest.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add 'invoice' to the expense_type enum
ALTER TYPE expense_type ADD VALUE IF NOT EXISTS 'invoice';

-- 2. Add new columns to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'receipt';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_date date;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_proof_file_path text;

-- 3. Migrate document_type for existing rows based on expense_type
--    Rows with expense_type = 'receipt' already have document_type = 'receipt' (default).
UPDATE expenses SET document_type = 'manual'  WHERE expense_type = 'manual';
UPDATE expenses SET document_type = 'salary'  WHERE expense_type = 'salary';
UPDATE expenses SET document_type = 'manual'  WHERE expense_type = 'reimbursement';

-- 4. payment_status defaults to 'paid', which is correct for all existing rows.
--    All existing expenses represent completed transactions.
--    No additional UPDATE needed.
