# ExpenseDesk — Dev Notes

## How to Run Locally

```bash
npm install
npm run dev
```

The `predev` script automatically wipes `.next` before each start to prevent Turbopack cache corruption.

The dev server runs on **http://localhost:3001** (configured in `.claude/launch.json`).

---

## Required Environment Variables

Create a `.env.local` file in the project root with the following:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
OPENAI_API_KEY=sk-...
```

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + Server | Supabase anon/publishable key — safe to expose in browser |
| `OPENAI_API_KEY` | Server only (API routes) | Never use `NEXT_PUBLIC_` prefix for this key |

**Never put `OPENAI_API_KEY` in a `NEXT_PUBLIC_` variable.** It would be exposed to the browser.

---

## Supabase Setup Steps

1. Create a new Supabase project
2. Run the schema migrations to create tables:
   - `expenses` — main expense records
   - `categories` — lookup table for expense categories
   - `payment_methods` — lookup table for payment methods
3. Seed `categories` and `payment_methods` with initial values
4. Enable Row Level Security (RLS) on all tables
5. Add RLS policies so users can only read/write their own rows (filter by `auth.uid()`)
6. Enable Supabase Auth with email/password provider
7. Copy the project URL and anon key into `.env.local`

### Key Schema Notes

- `expenses.expense_type` — `'expense'` or `'salary'`
- `expenses.receipt_file_path` — private Storage path, not a public URL
- `expenses.raw_ai_json` — JSONB, stores compact AI extraction output
- `expenses.ai_confidence` — `numeric(4,3)`, value between 0 and 1
- `expenses.amount` — use a numeric type with sufficient precision; avoid `smallint` (will truncate decimal confidence values)

---

## Storage Bucket Setup

1. In the Supabase dashboard, go to **Storage**
2. Create a new bucket named **`receipts`**
3. Set the bucket to **private** (do not make it public)
4. Add a Storage policy that allows authenticated users to read/write only their own files:
   - Upload policy: `(storage.foldername(name))[1] = auth.uid()::text`
   - Download policy: same check
5. File path convention used by the app:
   ```
   {userId}/{yyyy-mm}/{timestamp}-{safe-filename}
   ```
   Example: `abc123/2025-04/1712345678000-coffee-receipt.jpg`

Signed URLs (short-lived) are generated server-side for preview. Receipt paths are never exposed as public URLs.

---

## RLS Notes

- All tables have RLS enabled
- Policies use `auth.uid()` to scope reads and writes to the currently authenticated user
- The Supabase server client (`src/lib/supabase/server.ts`) reads the session from cookies — it correctly inherits the user's identity for RLS enforcement
- Do not use the Supabase service role key in API routes or client code — it bypasses RLS entirely

---

## OpenAI Setup

1. Create an OpenAI API key at https://platform.openai.com/api-keys
2. Add it to `.env.local` as `OPENAI_API_KEY`
3. The app uses **GPT-4o** via the chat completions endpoint with vision input
4. Receipt images are base64-encoded before being sent to the API
5. The extraction prompt is defined in the `/api/receipts/extract` route handler

---

## Common Useful Commands

```bash
# Start dev server (wipes .next first via predev)
npm run dev

# Manually wipe the Next.js cache
rm -rf .next

# Kill any process on port 3001 (if dev server is stuck)
lsof -ti :3001 | xargs kill -9

# Kill all Next.js dev processes
pkill -f "next dev"

# Check TypeScript errors without running the server
npx tsc --noEmit

# Check what's using disk space in the project
du -sh .next node_modules
```

---

## How to Reset the Local Next.js Cache

Turbopack maintains a persistent RocksDB/LevelDB cache inside `.next/dev/cache/turbopack/`. If this cache becomes corrupted (typically due to very low disk space or an abrupt process kill), routes start returning 500 errors with manifest-related messages.

**Safe reset procedure:**

```bash
# 1. Stop the dev server
# 2. Kill any lingering processes
pkill -f "next dev"
lsof -ti :3001 | xargs kill -9

# 3. Wipe the cache
rm -rf .next

# 4. Restart
npm run dev
```

The `predev` script in `package.json` does `rm -rf .next` automatically before each `npm run dev`, so a normal restart is usually sufficient.

---

## Development Workflow Recommendations

- **Keep at least 25–30 GB of free disk space.** Turbopack's SST cache writes fail silently when disk is near full, causing cascading 500 errors on all routes.
- **Do not run two dev servers for the same project simultaneously.** They will contend over the same RocksDB files and deadlock.
- **Restart cleanly after editing middleware.** Turbopack hot-reload of `src/proxy.ts` or `src/middleware.ts` can trigger SST write failures. Stop the server, wipe `.next`, and restart.
- **Do not use `--no-turbopack` in this version.** The `--turbopack` flag was removed in Next.js 16; `--no-turbopack` causes a startup error.
- **Avoid editing files during heavy compilations.** Save edits before navigating to a new route for the first time — this avoids triggering concurrent SST write operations.
- **If `POST` to an API route returns 500 immediately after adding a new route file**, it usually means the build manifest hasn't been flushed yet. Wait for the compile to finish or do a clean restart.

---

## Testing Checklist Before Moving to Next Phase

Before starting a new phase, verify the following manually:

- [ ] Sign in with valid credentials → redirected to dashboard
- [ ] Sign in with invalid credentials → error message shown, no redirect
- [ ] Unauthenticated visit to `/expenses` → redirected to `/sign-in`
- [ ] Dashboard loads with live chart data
- [ ] Expenses page loads with live expense rows
- [ ] Add expense → appears in list
- [ ] Edit expense → changes reflected in list
- [ ] Delete expense → removed from list
- [ ] Upload a receipt image → previewed, saved, visible in Expenses row
- [ ] Upload a receipt PDF → previewed, saved, visible in Expenses row
- [ ] Click receipt icon in Expenses list → preview modal opens with correct file
- [ ] Extract receipt with AI → form prefilled with extracted values
- [ ] Edit AI-extracted values → saved correctly with `raw_ai_json` and `ai_confidence`
- [ ] Salary page loads with salary-type expenses
- [ ] No console errors in browser on any of the above
- [ ] `npx tsc --noEmit` passes with no errors
