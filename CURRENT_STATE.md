# ExpenseDesk — Current State

## Product Summary

ExpenseDesk is a small-business expense management web app. It helps businesses capture bills, invoices, receipts, payment proofs, manual expenses, salary expenses, review AI-extracted details, manage invoice payment status, identify items needing attention, and review month-on-month spending.

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

## Latest Stability Audit

- Production-mode audit passed after a clean rebuild from a removed `.next` directory.
- Verified production command: `npm run start -- -p 3001`, which runs `next start -p 3001` after `npm run build`.
- Core Phase 3C flows were verified in production mode: sign in, dashboard, expenses, upload page, save unpaid invoice, unpaid invoice appears in Expenses, mark invoice paid, upload/view payment proof, and view original invoice/receipt preview.
- Phase 3C migration is applied in the current Supabase database. The Phase 3C columns can be inserted, selected, and updated successfully.
- The Mark Paid modal FormData bug was fixed by capturing `FormData` from `event.currentTarget` at submit time before any awaited upload work.
- Phase 3D flexible bill/payment capture is implemented: unpaid bill, paid bill + proof, payment proof only, and manual entry.
- Phase 3E review/attention system is implemented and tested: possible duplicate detection, low AI confidence indicators, unpaid/partially paid invoice attention items, payment amount mismatch warnings, and missing proof warnings.
- Phase 4A monthly reports and CSV exports are implemented and tested for month-end review.
- Phase 4B Expense Detail Drawer is implemented and tested, with full details, document previews, AI summary, review issues, and edit/mark-paid/delete actions.
- Phase 4C search, filters, and saved-view-style quick views are implemented and tested on the Expenses page.
- Audit test data created during the production-mode audit was cleaned up: the two audit expense rows and four audit receipt/payment-proof storage files were deleted.
- The major local instability was traced to corrupted/stale `.next` output plus conflicting Claude launch configs. A clean rebuild restored production mode:

```bash
rm -rf .next
npm run build
npm run start -- -p 3001
```

- Dev/Turbopack mode may still be unreliable; production mode with webpack build is currently verified.

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
- Derives summary cards, category split, payment method split, top vendors, and a Needs Attention review queue
- Needs Attention includes unpaid invoices, partially paid invoices, possible duplicates, low AI confidence items, amount mismatches, and missing proof items
- Falls back to mock data only when Supabase is intentionally not configured

### Expenses List
- Client component at `src/components/expenses/ExpensesTable.tsx`
- Self-fetching: loads expenses, categories, and payment methods via `fetch` to API routes
- Global search matches vendor, description, invoice number, payment reference, amount, paid amount, category name, payment method name, and notes
- Expanded filters include month, date range, category, payment method, status, payment status, document type, expense type, review issue, and document/proof state
- Quick view chips set common local presets: This Month, Last Month, Last 3 Months, Unpaid, Needs Attention, Paid This Month, and Salary This Month
- Key search/filter state is synced to the URL query string for refresh/share continuity
- Result summary shows filtered row count, total amount, paid amount, and unpaid amount
- Empty states distinguish no search results, no unpaid invoices, no expenses for selected month, and general no-match filter results
- Attention badges include Needs Review, Possible Duplicate, Unpaid, Partially Paid, Amount Mismatch, Missing Proof, and Low AI Confidence
- Table includes Date, Vendor, Category, Description, Method, Amount, Docs, Attention, Status, Payment, and Actions
- Actions include View Details, Edit, Mark Paid when relevant, and Delete

### Expense Detail Drawer (Phase 4B)
- Right-side drawer component at `src/components/expenses/ExpenseDetailDrawer.tsx`
- Opens from the Expenses table View Details action
- Header shows vendor, amount, payment status badge, review/attention badges, and expense date
- Shows full expense/payment/document fields: description, category, expense type, document type, invoice number, due date, payment method, payment date, paid amount, payment reference, and notes
- Documents section can open the primary receipt/invoice and payment proof through the existing signed URL preview flow
- AI extraction section shows stored `ai_confidence`, compact `raw_ai_json` summary, and `fields_needing_review` when present
- Review issues section uses the existing `src/lib/review-issues.ts` derived issue logic
- Drawer actions reuse existing flows for Edit Expense, Mark Paid, View primary document, View payment proof, and Delete Expense

### Expense CRUD
- Add, edit, and delete expenses via API route handlers
- `ExpenseFormModal` handles add/edit with all fields including Phase 3C fields
- All CRUD is via `fetch` to API routes (no server actions for expenses)
- New create/save paths mark likely duplicates as `needs_review` without blocking save

### Salary Expenses
- Stored as expenses with `expense_type = 'salary'`
- Dedicated salary page at `/salary` reads and displays salary-type expenses

### Receipt/Invoice Upload to Supabase Storage
- Private `receipts` storage bucket in Supabase
- Upload flow: file picker with drag-and-drop, client-side preview, server-side upload
- File path convention: `{userId}/{yyyy-mm}/{timestamp}-{safe-filename}`
- `receipt_file_path` column stores the private bucket path (not a public URL)
- Upload page supports four capture modes: Unpaid Bill / Invoice, Paid Bill + Payment Proof, Payment Proof Only, and Manual Entry
- `payment_proof_file_path` stores a separate payment proof only when both a bill and proof exist or proof is uploaded later during Mark Paid

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

### Flexible Bill / Payment Capture (Phase 3D)
- Upload page shows a capture mode selector:
  - Unpaid Bill / Invoice
  - Paid Bill + Payment Proof
  - Payment Proof Only
  - Manual Entry
- Unpaid bill uploads:
  - `document_type = 'invoice'`, `expense_type = 'invoice'`
  - `payment_status = 'unpaid'`
  - `receipt_file_path` stores the bill/invoice
  - payment fields remain empty until Mark Paid
- Paid bill + proof uploads:
  - `document_type = 'invoice'`, `expense_type = 'invoice'`
  - `receipt_file_path` stores the bill/invoice
  - `payment_proof_file_path` stores the separate proof
  - `payment_status` is derived from paid amount vs bill amount
- Payment proof only uploads:
  - `document_type = 'payment_proof'`, `expense_type = 'receipt'`
  - `payment_status = 'paid'`
  - `receipt_file_path` stores the receipt/proof
- Manual entry:
  - no file required
  - `document_type = 'manual'`
  - supports unpaid, paid, and partially paid entries
- Mark Paid modal (`MarkPaidModal.tsx`):
  - Triggered from "Mark Paid" button in Expenses table for unpaid/partially_paid expenses
  - Fields: Payment Date, Paid Amount, Payment Method, Payment Reference, Payment Proof upload, Notes
  - Supports optional AI extraction from uploaded payment proof and manual fallback
  - Shows a warning when paid amount differs from invoice amount
  - Calls `PATCH /api/expenses/[id]/mark-paid`
  - Auto-determines `paid` vs `partially_paid` based on paid_amount vs expense amount
- Payment status column in Expenses table with colored badges (green/orange/amber)
- Docs column shows invoice icon (FileText) vs receipt icon based on document_type

### Review Queue / Attention System (Phase 3E)
- Review issues are derived in code from existing expense fields; no review table was added
- Duplicate detection rules:
  - strong duplicate: same vendor + invoice number, or same payment reference
  - soft duplicate: same vendor + same amount + expense date within 2 days
- Expenses page shows compact attention badges for:
  - Needs Review
  - Possible Duplicate
  - Unpaid
  - Partially Paid
  - Amount Mismatch
  - Missing Proof
  - Low AI Confidence
- Dashboard includes a Needs Attention queue with vendor, amount, date, and issue badge
- Warnings guide review but do not block saving

### Monthly Reports and CSV Export (Phase 4A)
- Reports page at `/reports` provides month-end operational summaries from live Supabase data
- Month selector controls the selected reporting period
- Monthly summary includes total expenses, paid expenses, unpaid invoices, partially paid invoices, salary total, non-salary total, expense count, attachment count, and needs-attention count
- Category, vendor, payment status, salary, needs-attention, and unpaid invoice reports are derived from expense rows
- CSV exports are available for all expenses, category summary, vendor summary, salary report, needs attention report, and unpaid invoices
- Report data is derived in `src/lib/reports-data.ts`
- Monthly report API: `GET /api/reports/monthly?month=YYYY-MM`

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
- Phase 3C migration is applied in the current database
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

1. User chooses a capture mode in the upload UI
2. Depending on mode, user uploads one primary file, two files, or no file for manual entry
3. Uploaded files are previewed client-side and stored in the private `receipts` bucket
4. User can optionally run AI extraction to prefill fields
5. User reviews and saves the expense; AI never auto-saves
6. Primary document path is stored in `expenses.receipt_file_path`
7. Separate payment proof path is stored in `expenses.payment_proof_file_path` when relevant
8. On preview from Expenses table, signed URLs are generated server-side
9. `ReceiptPreviewModal` renders images inline and PDFs via iframe

---

## Current Route List

### Pages
| Route | File | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Dashboard (server component) |
| `/expenses` | `src/app/expenses/page.tsx` | Expenses list (client-fetching shell) |
| `/upload` | `src/app/upload/page.tsx` | Receipt/invoice upload |
| `/salary` | `src/app/salary/page.tsx` | Salary expenses |
| `/reports` | `src/app/reports/page.tsx` | Monthly reports and CSV exports |
| `/settings` | `src/app/settings/page.tsx` | Settings (placeholder) |
| `/sign-in` | `src/app/sign-in/page.tsx` | Sign-in page |

### API Routes
| Route | Methods | Description |
|---|---|---|
| `/api/auth/sign-in` | POST | Supabase email/password sign-in |
| `/api/expenses` | GET, POST | List and create expenses |
| `/api/expenses/[id]` | PATCH, DELETE | Update and delete an expense |
| `/api/expenses/[id]/mark-paid` | PATCH | Mark an invoice as paid |
| `/api/reports/monthly` | GET | Monthly report data for selected month |
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
