# ExpenseDesk — Known Issues

## Critical: Next.js Dev Server / Turbopack Instability

### Summary

The Next.js 16.2.6 Turbopack dev server has repeatedly crashed during development. These crashes are **not caused by application code** — they are Turbopack bundler/cache bugs. The production build (webpack) and production server (`next start`) have been stable.

### Symptoms

The dev server crashes with errors including:
- `ENOENT: no such file or directory, open '...routes-manifest.json'`
- `ENOENT: no such file or directory, open '...prerender-manifest.json'`
- `Cannot find module '../../chunks/ssr/[turbopack]_runtime.js'`
- `Persisting failed: Unable to commit operations`
- `Compaction failed: Another write batch or compaction is already active`
- `Invariant: The client reference manifest for route "/upload" does not exist`

Crashes happened during navigation to multiple routes, including `/expenses`, `/upload`, and `/`.

### Turbopack Build Bug

Turbopack (used by `next build` by default in Next.js 16.2.6) has a bug where it **does not generate `client-reference-manifest` files for page routes**. It only generates them for API routes. This causes `InvariantError` at runtime when `next start` tries to render any page.

The build script has been changed to `next build --webpack` to work around this. Do not remove the `--webpack` flag without verifying the fix.

### Contributing Factors

- **Low disk space** was one contributing factor earlier — Turbopack's SST cache writes fail silently when disk is near full. However, crashes continued even after freeing disk space (31 GB+ available).
- **Supabase cold-start ETIMEDOUT** — the Supabase free-tier project spins down after inactivity. The first `getUser()` call times out at the socket level, which can disrupt Turbopack's compilation pipeline. This was mitigated by skipping auth calls for auth routes in `proxy.ts`.
- **SST cache corruption** — Turbopack uses a persistent RocksDB/LevelDB cache in `.next/dev/cache/turbopack/`. Once corrupted, all routes return 500 until the cache is wiped.

### Attempted Fixes (Partial List)

| Fix | Result |
|---|---|
| Clearing `.next` directory | Temporarily resolved, but crashes recurred |
| Switching to webpack for production build | **Fixed production mode** |
| Dynamic importing modals (`ssr: false`) | Reduced bundle size, but did not prevent crashes |
| Moving Expenses data behind API routes (removing server actions) | Reduced server-reference-manifest dependency, but did not prevent crashes |
| Skipping auth calls for `/sign-in` and `/api/auth/*` routes | Eliminated one ETIMEDOUT trigger, but did not prevent all crashes |
| Adding `predev` script to wipe `.next` before dev start | Ensured clean start, but was destructive (deleted production builds) — removed |
| Using production server (`next start`) | **Stable when built with webpack** |
| Instrumenting uncaught exception handler for ETIMEDOUT | Prevents process crash from socket errors, but does not fix Turbopack |

### Current Status

- **Production build passes** (`npm run build` with `--webpack` flag)
- **Production server is stable** (`next start`)
- **Dev server remains unreliable** — may crash during navigation or compilation
- **Product logic has not been verified end-to-end** due to dev instability. A clean verification pass is needed.

### Recommendation

Do not keep patching Turbopack/dev server behavior as product fixes. The next agent should:

1. Verify app stability in production mode first
2. Confirm all core flows work end-to-end
3. Only then continue product work
4. If dev mode crashes persist, document them separately from product bugs

---

## Supabase Cold Start

- Supabase free-tier projects spin down after inactivity
- First request after cold start may time out with ETIMEDOUT
- `proxy.ts` catches this and treats the user as unauthenticated (redirects to sign-in)
- `src/instrumentation.ts` absorbs the uncaught socket error that fires after promise settlement
- This is expected behavior on free-tier projects, not an application bug

---

## Phase 3C Migration Not Yet Applied

The `supabase/phase-3c-invoice-payment.sql` migration file has been written but **has not been run on the Supabase database**. Until this migration is applied:

- Phase 3C features (invoice workflow, payment status, mark paid) will not work against the database
- The new columns (`document_type`, `payment_status`, `due_date`, `payment_date`, `paid_amount`, `payment_reference`, `payment_proof_file_path`) do not exist in the database yet
- `SELECT *` queries will still work (missing columns return as undefined), but INSERT/UPDATE with the new fields will fail

---

## AI Extraction Limitations

- GPT-4o extraction is best-effort — low-quality images, faded receipts, unusual formats, or non-English receipts may produce incorrect or missing fields
- PDF extraction quality varies depending on whether the PDF renders clearly
- User review before saving is mandatory and intentional
- `raw_ai_json` is intentionally compact — does not contain the full OpenAI API response
- `ai_confidence` must be between 0 and 1 (`numeric(4,3)`)

---

## Receipt File Cleanup

If an expense is deleted or its receipt is replaced, the old file in Supabase Storage is not automatically cleaned up. Storage objects may accumulate over time.

---

## Do Not Do Accidentally

| Action | Why |
|---|---|
| Make the `receipts` storage bucket public | Receipts contain sensitive financial data. Signed URLs must be used. |
| Put `OPENAI_API_KEY` in a `NEXT_PUBLIC_` variable | Exposes the key in the browser bundle. |
| Use the Supabase service role key in client code or API routes | Bypasses RLS entirely. |
| Auto-save AI extraction without user review | AI extraction is imperfect. Silent auto-save would create incorrect records. |
| Remove `--webpack` from the build script | Turbopack build skips client-reference-manifest files, causing runtime InvariantErrors. |
| Expand into payroll, GST, or accounting workflows without planning | These require significant data model changes that would conflict with the current schema. |
