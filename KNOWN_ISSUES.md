# ExpenseDesk — Known Issues

## Critical: Next.js Dev Server / Turbopack Instability

### Summary

The Next.js 16.2.6 Turbopack dev server has repeatedly crashed during development. These crashes are **not caused by application code** — they are Turbopack bundler/cache bugs. Production mode is currently verified when built with webpack and started from a clean `.next` output.

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
- **Corrupted/stale `.next` production output** — a stale output tree with `.next/dev` artifacts and duplicate conflict-style directories caused missing `.next/server/app/*` files and manifest errors under `next start`. Removing `.next` and rebuilding fixed production mode.
- **Conflicting Claude launch configs** — the parent launch config previously ran `npm run dev` on port 3001 while the project config ran production start. Both configs now run production start, and the parent config must not be changed back to `npm run dev` on port 3001.

### Attempted Fixes (Partial List)

| Fix | Result |
|---|---|
| Clearing `.next` directory | Required when output is stale or corrupted; clean rebuild fixed the latest production issue |
| Switching to webpack for production build | **Fixed production mode** |
| Dynamic importing modals (`ssr: false`) | Reduced bundle size, but did not prevent crashes |
| Moving Expenses data behind API routes (removing server actions) | Reduced server-reference-manifest dependency, but did not prevent crashes |
| Skipping auth calls for `/sign-in` and `/api/auth/*` routes | Eliminated one ETIMEDOUT trigger, but did not prevent all crashes |
| Adding `predev` script to wipe `.next` before dev start | Ensured clean start, but was destructive (deleted production builds) — removed |
| Using production server (`next start`) | **Verified stable after clean webpack rebuild** |
| Instrumenting uncaught exception handler for ETIMEDOUT | Prevents process crash from socket errors, but does not fix Turbopack |

### Current Status

- **Production build passes** (`npm run build` with `--webpack` flag)
- **Production server is verified** (`next start`) after clean rebuild
- **Dev server remains unreliable** — may crash during navigation or compilation
- **Production-mode audit passed** for sign-in, dashboard, expenses, upload, unpaid invoice save, mark-paid with payment proof upload, and invoice/payment proof previews
- **MarkPaidModal FormData bug is fixed** by capturing `FormData` from `event.currentTarget` before awaited upload work
- **Audit test data was cleaned up** after verification: the two audit expense rows and four audit storage files were deleted
- **Phase 3D flexible capture is implemented and tested** for unpaid bills, paid bills with proof, payment proof only, and manual entry
- **Phase 3E review/attention system is implemented and tested** for duplicate, payment mismatch, missing proof, low AI confidence, unpaid, and partially paid indicators
- **Phase 4A monthly reports and CSV exports are implemented and tested** for operational month-end review
- **Phase 4B Expense Detail Drawer is implemented and tested** with full details, document previews, AI extraction summary, review issues, and edit/mark-paid/delete actions

### Recommendation

Do not keep patching Turbopack/dev server behavior as product fixes. Use production mode for product verification:

```bash
rm -rf .next
npm run build
npm run start -- -p 3001
```

If dev mode crashes persist, document them separately from product bugs.

---

## Supabase Cold Start

- Supabase free-tier projects spin down after inactivity
- First request after cold start may time out with ETIMEDOUT
- `proxy.ts` catches this and treats the user as unauthenticated (redirects to sign-in)
- `src/instrumentation.ts` absorbs the uncaught socket error that fires after promise settlement
- This is expected behavior on free-tier projects, not an application bug

---

## Phase 3C Migration Applied

The `supabase/phase-3c-invoice-payment.sql` migration is applied in the current Supabase database. The production audit confirmed that Phase 3C columns can be inserted, selected, and updated.

For a new or separate existing Supabase database, run the migration before using Phase 3C features. The current database does not need this migration rerun.

---

## Phase 3E Review / Attention Notes

The review queue is implemented as lightweight derived logic, not as a separate approval or accounting workflow. It uses existing expense fields to flag possible duplicates, unpaid invoices, partially paid invoices, payment amount mismatches, missing proof, and low AI confidence items.

Duplicate detection is intentionally heuristic:
- Strong duplicate: same vendor and invoice number, or same payment reference
- Soft duplicate: same vendor, same amount, and expense date within 2 days

These warnings guide review but do not block saving. During create/save, likely duplicates may be saved with `status = needs_review`; existing rows are also evaluated on the Expenses page and Dashboard.

---

## AI Extraction Limitations

- GPT-4o extraction is best-effort — low-quality images, faded receipts, unusual formats, or non-English receipts may produce incorrect or missing fields
- PDF extraction quality varies depending on whether the PDF renders clearly
- User review before saving is mandatory and intentional
- `raw_ai_json` is intentionally compact — does not contain the full OpenAI API response
- `ai_confidence` must be between 0 and 1 (`numeric(4,3)`)
- Low AI confidence is surfaced as a review indicator, but it is not treated as a save-blocking error
- The Expense Detail Drawer shows a compact stored AI summary; it intentionally does not display a large raw OpenAI response

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
| Turn the review queue into approvals, reviewer assignment, or comment history without planning | Phase 3E is intentionally a lightweight attention system, not an approval workflow. |
| Add a `review_issues` table for the current Phase 3E flags | Review issues are derived from existing expense fields unless future requirements justify persistence. |
| Remove `--webpack` from the build script | Turbopack build skips client-reference-manifest files, causing runtime InvariantErrors. |
| Change the parent `.claude/launch.json` back to `npm run dev` on port 3001 | It can confuse dev/Turbopack and production-mode testing on the same port. |
| Expand into payroll, GST, or accounting workflows without planning | These require significant data model changes that would conflict with the current schema. |
