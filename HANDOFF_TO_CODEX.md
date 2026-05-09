# ExpenseDesk — Handoff to Codex

## Project Summary

ExpenseDesk is a small-business expense management app built with Next.js 16.2.6 (App Router), Supabase (auth, database, storage), and OpenAI (receipt extraction). The app supports receipt/invoice upload, AI-powered data extraction with mandatory user review, expense CRUD, salary tracking, and an invoice vs payment proof workflow.

## Current Status

- **All application code is written** through Phase 3C (invoice/payment workflow)
- **TypeScript compiles cleanly** (`npx tsc --noEmit` passes)
- **Production build passes** (`npm run build` with `--webpack` flag)
- **Production-mode audit passed** for the core Phase 3C flows
- **Phase 3C database migration is applied** in the current Supabase database
- **MarkPaidModal FormData bug is fixed**
- **Dev server (Turbopack) has been unreliable** — repeated crashes with manifest/cache errors that are not caused by application code

## What Happened

During Phase 3C development, the Next.js 16 Turbopack dev server became increasingly unstable. Multiple crash patterns appeared (SST cache corruption, missing manifests, InvariantErrors). Several fixes were attempted: clearing caches, dynamic imports, moving data to API routes, skipping auth for auth routes, trying production mode. Some helped, none fully resolved dev mode instability.

A critical finding: **Turbopack's production builder skips generating `client-reference-manifest` files for page routes**, causing all pages to 500 at runtime. The fix was switching the build to webpack (`next build --webpack`). The production server (`next start`) with a webpack build has been stable.

The latest stability audit found that the major production-mode disappearance issue came from corrupted/stale `.next` output and conflicting Claude launch configs. A clean rebuild fixed production mode:

```bash
rm -rf .next
npm run build
npm run start -- -p 3001
```

Both Claude launch configs should run production start on port 3001. The parent config must not run `npm run dev` on that same port.

The audit also verified that Phase 3C migration is applied in the current Supabase database and that production-mode flows work. The Mark Paid modal bug was fixed by capturing `FormData` from `event.currentTarget` before awaited payment-proof upload work.

---

## Exact Next Steps

### Do not add features first.

### Step 1: Start from clean production mode when investigating runtime issues

```bash
cd expense-desk
rm -rf .next
npm run build          # uses --webpack flag
npm run start -- -p 3001
```

Open http://localhost:3001 and confirm the server starts without errors. This is the verified path for production-mode testing.

### Step 2: Continue product work from the verified baseline

Production mode is currently verified. If continuing product work, keep using production mode for verification unless dev/Turbopack instability is explicitly being investigated. Good next candidates:
- Phase 3B (AI review quality, duplicate detection)
- Or whatever the next priority is

---

## Verification Checklist

Latest production-mode audit passed these checks:

- [x] Inspect `package.json` scripts — `build` uses `--webpack`
- [x] `npm run build` completes without errors
- [x] `npm run start -- -p 3001` starts production mode
- [x] Sign in with valid credentials
- [x] Dashboard loads
- [x] Navigate to `/expenses` — expense list loads
- [x] Navigate to `/upload` — upload page loads
- [x] Upload an invoice image and save as unpaid
- [x] Unpaid invoice appears in Expenses
- [x] Mark unpaid invoice as paid
- [x] Upload payment proof during mark-paid
- [x] View original invoice/receipt preview
- [x] View payment proof preview

Not part of the latest audit pass: add/edit/delete manual expense, AI extraction, salary page, and invalid sign-in.

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

Production mode is currently verified after a clean rebuild. Use production mode for testing. Dev mode is a convenience, not a requirement.

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
| `supabase/phase-3c-invoice-payment.sql` | Phase 3C migration for other existing databases; already applied in current Supabase database |
| `.claude/launch.json` | Claude preview configuration; should run production `npm run start -- -p 3001`, not `npm run dev` |
