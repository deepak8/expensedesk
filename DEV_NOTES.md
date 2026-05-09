# ExpenseDesk — Dev Notes

## How to Run Locally

### Production Mode (Recommended)

Production mode bypasses Turbopack entirely and uses a pre-built webpack bundle. This is currently the most reliable way to test product behavior.

```bash
npm install
npm run build    # uses webpack via --webpack flag
npm run start -- -p 3001
```

The app will be available at **http://localhost:3001**.

If production mode starts showing missing `.next/server/app/*` files or missing client-reference-manifest errors, rebuild from a clean output directory:

```bash
rm -rf .next
npm run build
npm run start -- -p 3001
```

This clean rebuild fixed the latest production-mode audit. The issue was traced to corrupted/stale `.next` output, not Supabase, OpenAI, RLS, or product logic.

### Claude Preview Launch

Both Claude preview configs are intentionally set to production mode on port 3001:

- `/Users/deepakh/Documents/ExpenseDesk/.claude/launch.json`
- `/Users/deepakh/Documents/ExpenseDesk/expense-desk/.claude/launch.json`

The parent config keeps `cwd: "expense-desk"` and runs `npm run start -- -p 3001`. The project config runs the same command from the project root. Preview launches should therefore start `next start`, not `next dev`. Run `npm run build` first after code changes so the production server has a fresh `.next` bundle.

The parent config must not run `npm run dev` on port 3001. Running dev/Turbopack and production preview on the same port can make `.next` state and runtime errors hard to interpret.

### Dev Mode

Dev mode uses Turbopack for fast hot-reload. It has been unstable on this project/machine (see warning below).

```bash
npm install
npm run dev
```

Dev server runs on **http://localhost:3000** by default. The Claude preview configs are deliberately reserved for production `next start` on port 3001.

### Warning: Dev Mode Instability

Next.js 16 / Turbopack dev mode has repeatedly crashed during development of this project. Crashes include SST cache corruption, missing manifest files, and InvariantErrors. These crashes affect route rendering but are not caused by application code.

**Recommendation:** Test product behavior using production mode (`npm run build && npm run start`) until dev mode instability is resolved. See `KNOWN_ISSUES.md` for details.

---

## Required Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
OPENAI_API_KEY=sk-...
```

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + Server | Supabase anon/publishable key (safe to expose in browser) |
| `OPENAI_API_KEY` | Server only | Never use `NEXT_PUBLIC_` prefix for this key |

**Never put `OPENAI_API_KEY` in a `NEXT_PUBLIC_` variable.** It would be exposed to the browser.

---

## Supabase Migration Files

The following SQL files must be run in the Supabase SQL editor, in order:

| File | Purpose | Status |
|---|---|---|
| `supabase/schema.sql` | Base schema: tables, enums, RLS, seed data. Includes Phase 3C columns in the CREATE TABLE. | Run this for new projects |
| `supabase/phase-1b-rls.sql` | RLS policy adjustments | Already applied |
| `supabase/fix-rls-anon.sql` | RLS fix for anonymous access | Already applied |
| `supabase/phase-3a-ai-confidence.sql` | Adds `ai_confidence` and `raw_ai_json` columns | Already applied |
| `supabase/phase-3c-invoice-payment.sql` | Adds Phase 3C columns to existing databases (ALTER TABLE) | Applied in current Supabase database |

### Phase 3C Migration Note

`supabase/phase-3c-invoice-payment.sql` is applied in the current Supabase database. The latest production audit confirmed that Phase 3C columns can be inserted, selected, and updated.

For another existing Supabase database, run `supabase/phase-3c-invoice-payment.sql` before using Phase 3C features. The `ALTER TYPE ... ADD VALUE` line must be run separately from the rest due to PostgreSQL transaction limitations.

For a **new project**, `supabase/schema.sql` already includes all Phase 3C columns in the CREATE TABLE statement — no need to run the Phase 3C migration separately.

---

## Supabase Storage Bucket

| Setting | Value |
|---|---|
| Bucket name | `receipts` |
| Visibility | **Private** (never set to public) |
| Access | Signed URLs generated server-side |
| File path convention | `{userId}/{yyyy-mm}/{timestamp}-{safe-filename}` |

### Storage Policies

Authenticated users can read/write files scoped to their own user ID folder:
- Upload policy: `(storage.foldername(name))[1] = auth.uid()::text`
- Download policy: same check

---

## RLS / Storage Policy Notes

- All tables have RLS enabled
- Current expense policies allow any authenticated user to read/write all expenses (no `user_id` column scoping yet — tighten in a future phase)
- Categories and payment methods are read-only for authenticated users
- The Supabase server client (`src/lib/supabase/server.ts`) reads the session from cookies and inherits the user's identity for RLS
- Do not use the Supabase service role key in API routes or client code — it bypasses RLS entirely

---

## How to Test in Production Mode

```bash
# 1. Build the app (uses webpack)
npm run build

# 2. Start the production server
npm run start -- -p 3001

# 3. Open http://localhost:3001 in your browser
```

Production mode uses `next start`, which serves the pre-built output without Turbopack. The server is stable and does not suffer from the SST cache corruption issues seen in dev mode.

Latest audit result: production mode passed sign-in, dashboard, expenses, upload page, unpaid invoice save, unpaid invoice listing, mark-paid with payment proof upload, payment proof preview, and original invoice/receipt preview. Phase 3D flexible capture and Phase 3E review/attention features have also been implemented and tested. The audit test data from the earlier production-mode pass was cleaned up afterward.

---

## How to Reset Dev Cache

If the dev server starts returning 500 errors or manifest-related errors:

```bash
# 1. Stop the dev server
pkill -f "next dev"
lsof -ti :3001 | xargs kill -9

# 2. Wipe the cache
rm -rf .next

# 3. Restart (dev mode or rebuild for production)
npm run dev          # dev mode
# or
npm run build        # production mode
npm run start -- -p 3001
```

---

## Build Configuration

The `build` script in `package.json` uses `next build --webpack` because the Turbopack builder has a bug in Next.js 16.2.6 that skips generating `client-reference-manifest` files for page routes. This causes `InvariantError` crashes at runtime in production mode. The webpack builder generates all manifests correctly.

Do not remove the `--webpack` flag from the build script without verifying that Turbopack generates client reference manifests for all page routes.

If production output looks inconsistent, confirm no process is running `next dev`, `npm run dev`, `npm install`, or removing `.next` while `next start` is serving the app.

---

## Key Architecture Notes

### Proxy (Middleware)
- Next.js 16 renamed `middleware.ts` to `proxy.ts` — the file is `src/proxy.ts`
- Exports a named `proxy` function (not `middleware`)
- Auth routes (`/sign-in`, `/api/auth/*`) skip `getUser()` entirely to avoid Supabase cold-start ETIMEDOUT
- The `x-user-authenticated` header is set by the proxy and read by the layout to show/hide the sidebar

### Supabase Type Workaround
- Several API routes use `(supabase as any).from("expenses")` to work around TypeScript type inference issues
- The Supabase client's `.from().insert/update` returns `never` type in some cases
- This is a known limitation of the hand-maintained type definitions in `src/lib/supabase/types.ts`

### Dynamic Imports
- `ExpenseFormModal`, `ReceiptPreviewModal`, and `MarkPaidModal` are dynamically imported with `ssr: false`
- This avoids including heavy modal code in the initial page bundle

### Review / Attention Derivation
- Review issues are derived in code using `src/lib/review-issues.ts`; no review table is used.
- Possible duplicates are detected by vendor + invoice number, payment reference, or vendor + amount + date within 2 days.
- Attention badges and dashboard review queue use existing fields: `status`, `ai_confidence`, `payment_status`, `paid_amount`, `amount`, `payment_proof_file_path`, `invoice_number`, and `payment_reference`.
- Duplicate detection should warn or mark `needs_review`; it should not block saves.

### Instrumentation
- `src/instrumentation.ts` absorbs transient ETIMEDOUT/ECONNRESET socket errors from the Supabase client
- These errors are Supabase free-tier cold-start artifacts, not application bugs

---

## Testing Checklist

- [ ] Sign in with valid credentials -> redirected to dashboard
- [ ] Sign in with invalid credentials -> error message shown
- [ ] Unauthenticated visit to `/expenses` -> redirected to `/sign-in`
- [ ] Dashboard loads with live chart data
- [ ] Dashboard Needs Attention queue shows unpaid/partial/duplicate/low-confidence/mismatch/missing-proof items where present
- [ ] Expenses page loads with expense rows
- [ ] Expenses Attention badges render compactly
- [ ] Expenses Review filter works for possible duplicate, missing proof, amount mismatch, and low AI confidence
- [ ] Add expense -> appears in list
- [ ] Likely duplicate create/save marks the new record for review without blocking save
- [ ] Edit expense -> changes reflected
- [ ] Delete expense -> removed from list
- [ ] Upload a receipt image -> preview, save, visible in Expenses
- [ ] Upload a receipt PDF -> preview, save, visible in Expenses
- [ ] Click receipt icon in Expenses -> preview modal opens
- [ ] Extract receipt with AI -> form prefilled
- [ ] Unpaid Bill / Invoice mode saves as unpaid
- [ ] Paid Bill + Payment Proof mode saves bill and separate proof
- [ ] Payment Proof Only mode saves as paid
- [ ] Manual Entry mode saves paid and unpaid entries without a file
- [ ] Mark unpaid invoice as paid -> payment status updated
- [ ] Mark Paid can upload proof and still works with manual fallback
- [ ] Payment status badges show in Expenses table
- [ ] Salary page loads with salary-type expenses
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
