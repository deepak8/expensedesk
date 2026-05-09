# ExpenseDesk — Handoff to Codex

## Project Summary

ExpenseDesk is a small-business expense management app built with Next.js 16.2.6 (App Router), Supabase (auth, database, storage), and OpenAI (receipt extraction). The app supports receipt/invoice upload, AI-powered data extraction with mandatory user review, expense CRUD, salary tracking, and an invoice vs payment proof workflow.

## Current Status

- **All application code is written** through Phase 3C (invoice/payment workflow)
- **TypeScript compiles cleanly** (`npx tsc --noEmit` passes)
- **Production build passes** (`npm run build` with `--webpack` flag)
- **Product features have NOT been fully verified end-to-end** due to dev server instability during development
- **Phase 3C database migration has NOT been applied** to Supabase (`supabase/phase-3c-invoice-payment.sql`)
- **Dev server (Turbopack) has been unreliable** — repeated crashes with manifest/cache errors that are not caused by application code

## What Happened

During Phase 3C development, the Next.js 16 Turbopack dev server became increasingly unstable. Multiple crash patterns appeared (SST cache corruption, missing manifests, InvariantErrors). Several fixes were attempted: clearing caches, dynamic imports, moving data to API routes, skipping auth for auth routes, trying production mode. Some helped, none fully resolved dev mode instability.

A critical finding: **Turbopack's production builder skips generating `client-reference-manifest` files for page routes**, causing all pages to 500 at runtime. The fix was switching the build to webpack (`next build --webpack`). The production server (`next start`) with a webpack build has been stable.

The dev server issues consumed significant debugging time. Product logic was written but not fully exercised.

---

## Exact Next Steps

### Do not add features first.

### Step 1: Verify app stability in production mode

```bash
cd expense-desk
npm install
npm run build          # uses --webpack flag
npm run start -- -p 3001
```

Open http://localhost:3001 and confirm the server starts without errors.

### Step 2: Apply the Phase 3C migration

Run `supabase/phase-3c-invoice-payment.sql` in the Supabase SQL editor. Note: the `ALTER TYPE ... ADD VALUE` line must be run separately first (cannot run inside a transaction).

### Step 3: Confirm all core flows work

Run through the verification checklist below. Document any failures with exact error messages and whether they occur in production mode, dev mode, or both.

### Step 4: Only then continue product work

If production mode is stable and core flows work, proceed with:
- Phase 3B (AI review quality, duplicate detection)
- Or whatever the next priority is

---

## Verification Checklist

Run these checks in **production mode** (`npm run build && npm run start -- -p 3001`):

- [ ] Inspect `package.json` scripts — confirm `build` uses `--webpack`
- [ ] `npm run build` completes without errors
- [ ] `npm run start -- -p 3001` starts without errors
- [ ] Server logs show no InvariantError or manifest errors
- [ ] Visit `/` — redirects to `/sign-in` (unauthenticated)
- [ ] Sign in with valid credentials — redirected to dashboard
- [ ] Dashboard loads with data (or mock data fallback)
- [ ] Navigate to `/expenses` — expense list loads
- [ ] Add an expense — appears in list
- [ ] Edit an expense — changes saved
- [ ] Delete an expense — removed from list
- [ ] Navigate to `/upload` — upload page loads
- [ ] Upload a receipt image — preview works, save succeeds
- [ ] Select "Invoice / Bill" document type — form shows unpaid fields
- [ ] Save an invoice — saved with `payment_status = 'unpaid'`
- [ ] Select "Receipt / Payment Proof" document type — form shows paid fields
- [ ] Save a receipt — saved with `payment_status = 'paid'`
- [ ] Back on `/expenses` — payment status badges visible
- [ ] Click "Mark Paid" on an unpaid invoice — modal opens
- [ ] Fill payment details and submit — status changes to paid
- [ ] Click receipt/invoice icon — preview modal opens with correct file
- [ ] Extract receipt with AI — form prefilled with extracted values
- [ ] Navigate to `/salary` — salary page loads
- [ ] Check server logs — no unhandled errors
- [ ] Check browser console — no runtime errors

---

## Critical Warnings

### Do not keep patching Turbopack/dev server behavior as product fixes

Multiple debugging sessions were spent on Turbopack SST cache corruption, missing manifest files, and ETIMEDOUT socket errors. These are **Next.js 16.2.6 / Turbopack bugs**, not application bugs. If the dev server crashes:

1. Do not change application code to fix it
2. Do not restructure components or routes to work around it
3. Do not add more dynamic imports or move logic to API routes as Turbopack workarounds
4. Instead: test in production mode, document the crash, and move on

### Identify the runtime mode before debugging

Before investigating any error:
1. Check whether it happens in **production mode** (`next start` with webpack build) or **dev mode** (`next dev` with Turbopack)
2. If it only happens in dev mode, it is likely a Turbopack bug — document it and test in production mode
3. If it happens in production mode, capture the exact runtime error before changing code

### If production mode is stable

Document that finding and proceed with product work. Use production mode for testing. Dev mode is a convenience, not a requirement.

### If production mode crashes

Capture the exact error from server stdout/stderr before changing any code. The error message will indicate whether it's a build issue, a runtime rendering error, or a Supabase connectivity issue. Each requires a different fix.

---

## Key Files Reference

| File | Purpose |
|---|---|
| `CURRENT_STATE.md` | Full product state, features, database model, routes |
| `DEV_NOTES.md` | How to run, env vars, migrations, testing checklist |
| `KNOWN_ISSUES.md` | All known issues with honest status of each |
| `package.json` | Scripts: dev, build (--webpack), start, lint |
| `src/proxy.ts` | Auth middleware (Next.js 16 renamed middleware.ts to proxy.ts) |
| `src/instrumentation.ts` | Absorbs transient ETIMEDOUT socket errors |
| `src/lib/supabase/server.ts` | Server-side Supabase client with cookie auth |
| `src/lib/supabase/types.ts` | Hand-maintained TypeScript types for Supabase tables |
| `src/lib/openai/extract.ts` | OpenAI GPT-4o receipt extraction logic |
| `supabase/schema.sql` | Full database schema (for new projects) |
| `supabase/phase-3c-invoice-payment.sql` | Phase 3C migration (for existing databases — NOT YET APPLIED) |
| `.claude/launch.json` | Dev server configuration for Claude Code preview tool |
