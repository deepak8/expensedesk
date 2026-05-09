# ExpenseDesk — Current State

## Product Summary

ExpenseDesk is a polished small-business expense management web app. It helps businesses capture receipts, review AI-extracted expense details, manually add business expenses, track salary payments, and review month-on-month spending.

It is **not** a full accounting platform, payroll system, or GST/tax tool.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Auth & DB | Supabase (PostgreSQL + Auth + Storage) |
| AI extraction | OpenAI (GPT-4o via chat completions) |
| Icons | Lucide React |
| Deployment target | Vercel (not yet deployed) |

---

## Completed Phases

### Phase 0 — Polished Frontend Shell
- Built full UI with mock data: dashboard, expenses table, salary page, sidebar navigation
- Established design tokens, component structure, and layout patterns

### Phase 1A — Supabase Schema, Seed Data, Live Reads
- Created `expenses`, `categories`, and `payment_methods` tables in Supabase
- Seeded categories and payment methods
- Wired dashboard and expense list to live Supabase reads

### Phase 1B — Authentication and Expense CRUD
- Email/password sign-in via Supabase Auth
- Protected all app routes via middleware proxy
- Add, edit, and delete expenses via API route handlers
- Converted sign-in from server action to `fetch` → `/api/auth/sign-in`

### Phase 1C — Salary Page backed by Supabase
- Salary entries stored as expenses with `expense_type = 'salary'`
- Salary page reads and displays live data filtered by type

### Phase 2A — Receipt Upload to Private Supabase Storage
- Private `receipts` storage bucket created in Supabase
- Upload flow: file picker → preview → confirm → store in Supabase Storage
- File path convention: `{userId}/{yyyy-mm}/{timestamp}-{safe-filename}`
- `receipt_file_path` column stores the private bucket path (not a public URL)

### Phase 2B — Receipt Preview from Expenses Page
- Signed URLs generated server-side for receipt preview
- `ReceiptPreviewModal` displays images inline and PDFs via `<iframe>`
- Dynamically imported (`ssr: false`) to avoid heavy chunks in initial load

### Phase 3A — OpenAI Receipt Extraction
- Receipt images/PDFs sent to OpenAI GPT-4o via chat completions API
- Extracted fields: merchant, amount, currency, date, category, payment method, description
- AI output prefills the expense review form
- User must review and confirm before saving
- `raw_ai_json` stored compactly on the expense row
- `ai_confidence` stored as `numeric(4,3)` (value between 0 and 1)
- Manual save is always required — AI output is never auto-saved

---

## Current Working Features

- Email/password sign-in
- Protected app routes (unauthenticated users redirected to `/sign-in`)
- Dashboard with live spend data and charts
- Expenses list from live Supabase data
- Add, edit, and delete expenses
- Salary expenses stored and displayed as a separate page
- Upload receipt image or PDF
- Preview receipt during upload (before saving)
- Save receipt expense manually after upload
- View saved receipt from the Expenses table
- Inline PDF and image receipt preview modal
- Extract receipt fields with AI (OpenAI GPT-4o)
- Prefill expense review form from AI extraction
- Manual review required before saving AI output
- Compact `raw_ai_json` and `ai_confidence` saved on expense row

---

## Architecture Summary

### Routing and Middleware
- `src/middleware.ts` delegates to `src/proxy.ts`
- `proxy.ts` validates the Supabase session via `getUser()` on every request
- Unauthenticated requests are redirected to `/sign-in`
- `/sign-in` and `/api/auth/*` are whitelisted (no auth required)

### Page Architecture
- `src/app/expenses/page.tsx` — lightweight shell, renders `<ExpensesTable />`
- `src/app/dashboard/page.tsx` — server component, reads live data
- `src/app/salary/page.tsx` — server component, reads salary-type expenses

### API Routes
| Route | Methods | Purpose |
|---|---|---|
| `/api/auth/sign-in` | POST | Supabase email/password sign-in |
| `/api/expenses` | GET, POST | List and create expenses |
| `/api/expenses/[id]` | PATCH, DELETE | Update and delete an expense |
| `/api/categories` | GET | List categories |
| `/api/payment-methods` | GET | List payment methods |
| `/api/receipts/upload` | POST | Upload receipt to Supabase Storage |
| `/api/receipts/signed-url` | GET | Generate signed URL for receipt preview |
| `/api/receipts/extract` | POST | Send receipt to OpenAI, return extracted fields |

### Client Components
- `ExpensesTable` — self-fetching; loads expenses, categories, and payment methods on mount via `Promise.all`
- `ExpenseFormModal` — dynamically imported; handles add/edit via `fetch` (no server actions)
- `ReceiptPreviewModal` — dynamically imported; displays image or PDF via signed URL

### Server Supabase Client
- `src/lib/supabase/server.ts` — creates an authenticated server-side Supabase client using cookies
- Used in all API route handlers and server components

---

## Supabase Setup Summary

- Project hosted on Supabase cloud
- Tables: `expenses`, `categories`, `payment_methods`
- `expenses.expense_type` distinguishes `'expense'` vs `'salary'`
- `expenses.receipt_file_path` stores the private Storage path
- `expenses.raw_ai_json` stores compact AI extraction output (JSONB)
- `expenses.ai_confidence` is `numeric(4,3)`, range 0–1
- Row Level Security (RLS) enabled; policies scope reads/writes to the authenticated user
- Private storage bucket named `receipts` — never set to public

---

## OpenAI Extraction Summary

- Model: GPT-4o via chat completions (`/v1/chat/completions`)
- Images are base64-encoded and sent as vision input
- PDFs are rendered to an image before extraction (if supported by the upload flow)
- Extracted fields: merchant name, total amount, currency, date, category suggestion, payment method suggestion, description
- Response is parsed and stored compactly as `raw_ai_json`
- `ai_confidence` reflects the model's self-reported confidence (0–1)
- The user must review all extracted fields before saving
- Auto-save without review is explicitly not implemented

---

## Storage / Receipt Workflow Summary

1. User selects a receipt file (image or PDF) in the upload UI
2. File is previewed client-side before upload
3. On confirm, file is POSTed to `/api/receipts/upload`
4. Server uploads to the private `receipts` bucket using the authenticated user's ID
5. File path: `{userId}/{yyyy-mm}/{timestamp}-{safe-filename}`
6. Path is stored in `expenses.receipt_file_path` (not a public URL)
7. On preview, `/api/receipts/signed-url` generates a short-lived signed URL
8. `ReceiptPreviewModal` renders the signed URL inline

---

## Auth Summary

- Supabase email/password authentication
- Sign-in page: `src/app/sign-in/page.tsx` (client component, `fetch`-based)
- Sign-in API: `src/app/api/auth/sign-in/route.ts`
- Session managed via Supabase SSR cookies
- `proxy.ts` calls `supabase.auth.getUser()` on every request to validate the session
- On cold start or network error, `getUser()` failure is caught and treated as unauthenticated (safe fallback)

---

## Intentionally Out of Scope

- Multi-tenant / multi-user organisation support
- Payroll processing or salary slip generation
- GST, VAT, or tax calculations
- Accounting ledger or double-entry bookkeeping
- Bank feed or statement import
- Recurring expense automation
- Email receipt parsing
- Mobile app

---

## Recommended Next Phase

**Phase 3B — AI Review Quality and Duplicate Detection**

- Possible duplicate receipt detection (same amount + date + merchant)
- Suspicious amount or date warnings
- Better category and payment method matching from AI suggestions
- Comparison between AI-extracted values and user-edited values
- Field-level confidence display in the review form
- Review queue improvements for bulk receipt processing
