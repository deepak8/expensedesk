# ExpenseDesk — Current State

## Product Summary

ExpenseDesk is a small-business expense management web app. It helps businesses capture receipts and invoices, review AI-extracted expense details, manually add business expenses, track salary payments, manage invoice payment status, and review month-on-month spending.

It is **not** a full accounting platform, payroll system, or GST/tax tool.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| Bundler | Turbopack (dev), webpack (production build via `--webpack` flag) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Auth & DB | Supabase (PostgreSQL + Auth + Storage) |
| AI extraction | OpenAI GPT-4o (chat completions with vision) |
| Icons | Lucide React |
| Deployment target | Vercel (not yet deployed) |

---

## Current Implemented Features

### Authentication
- Supabase email/password authentication
- Sign-in page: `src/app/sign-in/page.tsx` (client component, `fetch`-based)
- Sign-in API: `POST /api/auth/sign-in`
- Session managed via Supabase SSR cookies
- Protected routes via `src/proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`)
- Unauthenticated requests redirected to `/sign-in`
- `/sign-in` and `/api/auth/*` bypass auth checking entirely (avoids Supabase cold-start issues)

### Dashboard
- Server component at `src/app/page.tsx`
- Reads live expense data from Supabase for the current month
- Derives summary cards, category split, payment method split, top vendors, and needs-review list
- Falls back to mock data if Supabase fetch fails

### Expenses List
- Client component at `src/components/expenses/ExpensesTable.tsx`
- Self-fetching: loads expenses, categories, and payment methods via `fetch` to API routes
- Filtering by category, payment method, status, expense type, and payment status
- 10-column table: Date, Vendor, Description, Amount, Category, Payment, Docs, Payment Status, Status, Actions

### Expense CRUD
- Add, edit, and delete expenses via API route handlers
- `ExpenseFormModal` handles add/edit with all fields including Phase 3C fields
- All CRUD is via `fetch` to API routes (no server actions for expenses)

### Salary Expenses
- Stored as expenses with `expense_type = 'salary'`
- Dedicated salary page at `/salary` reads and displays salary-type expenses

### Receipt/Invoice Upload to Supabase Storage
- Private `receipts` storage bucket in Supabase
- Upload flow: file picker with drag-and-drop, client-side preview, server-side upload
- File path convention: `{userId}/{yyyy-mm}/{timestamp}-{safe-filename}`
- `receipt_file_path` column stores the private bucket path (not a public URL)
- Upload page includes document type selection (Invoice/Bill vs Receipt/Payment Proof)

### Receipt/Invoice Preview
- Signed URLs generated server-side for preview
- `ReceiptPreviewModal` displays images inline and PDFs via `<iframe>`
- Dynamically imported (`ssr: false`) to avoid heavy chunks in initial load
- Supports optional `label` prop (shows "Invoice" or "Receipt" in title)

### OpenAI Receipt/Invoice Extraction
- Receipt/invoice images sent to OpenAI GPT-4o via chat completions with vision input
- Extracted fields: vendor, amount, currency, date, due_date, category guess, payment method guess, description, invoice number
- AI output prefills the expense review form
- User must review and confirm before saving (no auto-save)
- `raw_ai_json` stored compactly on the expense row (JSONB)
- `ai_confidence` stored as `numeric(4,3)` (value between 0 and 1)

### Invoice vs Payment Proof Workflow (Phase 3C)
- Upload page shows document type selector after file upload: "Invoice / Bill" vs "Receipt / Payment Proof"
- Invoice uploads:
  - `document_type = 'invoice'`, `expense_type = 'invoice'`
  - `payment_status = 'unpaid'`
  - Shows orange "This invoice will be saved as unpaid" banner
  - Due Date field shown, Payment Method hidden
  - Save button reads "Save as Unpaid Invoice"
- Receipt/payment proof uploads:
  - `document_type = 'receipt'` or `'payment_proof'`
  - `payment_status = 'paid'`
  - `payment_date` and `paid_amount` auto-derived from expense date and amount
- Mark Paid modal (`MarkPaidModal.tsx`):
  - Triggered from "Mark Paid" button in Expenses table for unpaid/partially_paid expenses
  - Fields: Payment Date, Paid Amount, Payment Method, Payment Reference, Payment Proof upload, Notes
  - Calls `PATCH /api/expenses/[id]/mark-paid`
  - Auto-determines `paid` vs `partially_paid` based on paid_amount vs expense amount
- Payment status column in Expenses table with colored badges (green/orange/amber)
- Docs column shows invoice icon (FileText) vs receipt icon based on document_type

---

## Current Database Model

### Tables
- `expenses` — main expense records (see column list below)
- `categories` — lookup table (id, name) with seeded values
- `payment_methods` — lookup table (id, name) with seeded values

### Expenses Table Columns

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `expense_date` | date | Required |
| `vendor` | text | Required |
| `description` | text | Optional |
| `amount` | numeric(12,2) | Required, >= 0 |
| `currency` | char(3) | Default 'INR' |
| `category_id` | integer (FK) | References categories |
| `payment_method_id` | integer (FK) | References payment_methods |
| `expense_type` | enum | manual, receipt, salary, reimbursement, invoice |
| `status` | enum | draft, needs_review, verified, missing_receipt |
| `receipt_file_path` | text | Private storage path |
| `invoice_number` | text | Optional |
| `ai_confidence` | numeric(4,3) | 0-1, nullable |
| `raw_ai_json` | jsonb | Compact AI extraction output |
| `notes` | text | Optional |
| `document_type` | text | invoice, receipt, payment_proof, manual, salary |
| `payment_status` | text | unpaid, partially_paid, paid |
| `due_date` | date | For invoices |
| `payment_date` | date | When paid |
| `paid_amount` | numeric(12,2) | Amount paid |
| `payment_reference` | text | Payment reference/transaction ID |
| `payment_proof_file_path` | text | Path to payment proof in storage |
| `created_at` | timestamptz | Auto-set |
| `updated_at` | timestamptz | Auto-updated via trigger |

### Enums
- `expense_type`: manual, receipt, salary, reimbursement (+ 'invoice' added via ALTER TYPE)
- `expense_status`: draft, needs_review, verified, missing_receipt

### RLS
- All tables have RLS enabled
- Current policies allow any authenticated user to read/write all expenses (no `user_id` column yet)
- Categories and payment methods are read-only for authenticated users

---

## Current Supabase Setup

- Project hosted on Supabase cloud (free tier)
- Auth: email/password provider enabled
- Storage: private bucket named `receipts`
- Storage policies: authenticated users can read/write files scoped to their user ID folder
- Signed URLs used for all file access (never public URLs)

---

## Current OpenAI/AI Extraction Setup

- Model: GPT-4o via chat completions endpoint
- Images are base64-encoded and sent as vision input
- Extraction prompt defined in `src/lib/openai/extract.ts`
- Extracted fields: vendor, amount, currency, expense_date, due_date, payment_method_guess, category_guess, description, invoice_number, confidence, fields_needing_review
- Response is parsed and stored compactly as `raw_ai_json`
- `ai_confidence` reflects model's self-reported confidence (0-1)
- User must review all extracted fields before saving
- Auto-save without review is explicitly not implemented

---

## Current Upload/Storage Workflow

1. User selects a receipt/invoice file (image or PDF) in the upload UI
2. File is previewed client-side before upload
3. File is uploaded to the private `receipts` bucket via server action
4. After upload, user selects document type: Invoice/Bill or Receipt/Payment Proof
5. Form fields adapt based on document type selection
6. User can optionally run AI extraction to prefill form fields
7. User reviews and saves the expense
8. File path stored in `expenses.receipt_file_path`
9. On preview from Expenses table, a signed URL is generated server-side
10. `ReceiptPreviewModal` renders the signed URL inline (image or PDF iframe)

---

## Current Route List

### Pages
| Route | File | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Dashboard (server component) |
| `/expenses` | `src/app/expenses/page.tsx` | Expenses list (client-fetching shell) |
| `/upload` | `src/app/upload/page.tsx` | Receipt/invoice upload |
| `/salary` | `src/app/salary/page.tsx` | Salary expenses |
| `/reports` | `src/app/reports/page.tsx` | Reports (placeholder) |
| `/settings` | `src/app/settings/page.tsx` | Settings (placeholder) |
| `/sign-in` | `src/app/sign-in/page.tsx` | Sign-in page |

### API Routes
| Route | Methods | Description |
|---|---|---|
| `/api/auth/sign-in` | POST | Supabase email/password sign-in |
| `/api/expenses` | GET, POST | List and create expenses |
| `/api/expenses/[id]` | PATCH, DELETE | Update and delete an expense |
| `/api/expenses/[id]/mark-paid` | PATCH | Mark an invoice as paid |
| `/api/categories` | GET | List categories |
| `/api/payment-methods` | GET | List payment methods |

### Server Actions
| File | Used by |
|---|---|
| `src/app/upload/actions.ts` | Upload page (file upload, expense save) |
| `src/app/salary/actions.ts` | Salary page |
| `src/app/expenses/actions.ts` | Expenses page |
| `src/app/auth/actions.ts` | Auth flows |

### Proxy (Middleware)
- `src/proxy.ts` — validates Supabase session, redirects unauthenticated users to `/sign-in`

---

## What Is Out of Scope

- Multi-tenant / multi-user organisation support
- Payroll processing or salary slip generation
- GST, VAT, or tax calculations
- Accounting ledger or double-entry bookkeeping
- Bank feed or statement import
- Recurring expense automation
- Email receipt parsing
- Mobile app
- Accounts payable/receivable tracking beyond simple payment status
- Auto-save of AI extraction output without user review
