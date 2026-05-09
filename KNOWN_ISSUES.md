# ExpenseDesk — Known Issues

## Development Environment

### Turbopack Dev Cache Corruption
**Symptom:** Dev server starts returning 500 errors with messages like:
- `ENOENT: no such file or directory, open '...routes-manifest.json'`
- `Cannot find module '../../chunks/ssr/[turbopack]_runtime.js'`
- `Persisting failed: Unable to commit operations`
- `Compaction failed: Another write batch or compaction is already active`

**Root cause:** Turbopack maintains a persistent RocksDB/LevelDB SST cache in `.next/dev/cache/turbopack/`. When SST file writes fail (typically due to low disk space or a killed process mid-write), the compaction pipeline deadlocks and build manifests are never flushed to disk.

**Fix:** Stop all dev servers, wipe `.next`, and restart:
```bash
pkill -f "next dev"
lsof -ti :3001 | xargs kill -9
rm -rf .next
npm run dev
```

### Disk Space Requirement
Keep at least **25–30 GB of free disk space** during development. Turbopack's SST write failures are silent — they don't crash the server immediately, but they corrupt the cache incrementally until all routes fail. At 95%+ disk usage, this happens within minutes of starting the server.

### Hot-Reload of Middleware Can Trigger Cache Corruption
Editing `src/proxy.ts` or `src/middleware.ts` while the server is running triggers a Turbopack hot-reload that frequently causes an SST write failure. **Do a clean restart** (stop server → `rm -rf .next` → `npm run dev`) after editing middleware files.

### Do Not Run Multiple Dev Servers for the Same Project
Two Next.js dev processes pointing at the same `.next` directory will contend over the same RocksDB lock files, causing a deadlock. Kill all instances before starting a new one.

---

## Supabase

### Cold Start Delays
Supabase projects on the free tier spin down after inactivity. The first request after a cold start (including `supabase.auth.getUser()` in the proxy) may time out with `ETIMEDOUT`. The proxy catches this and treats it as unauthenticated (safe fallback). The `src/instrumentation.ts` handler absorbs the uncaught `ETIMEDOUT write` socket error that fires after promise settlement. This is expected behaviour on free-tier projects.

### RLS Must Be Configured Correctly
If expenses or receipts appear to be missing or inaccessible, check that RLS policies are in place and reference `auth.uid()`. A misconfigured policy silently returns empty rows rather than an error.

---

## AI Extraction

### Extraction May Be Imperfect
GPT-4o receipt extraction is best-effort. Low-quality images, faded receipts, unusual formats, or non-English receipts may produce incorrect or missing fields. **User review before saving is mandatory and intentional.**

### PDF Extraction Quality Varies
PDF receipts are handled via vision input. Extraction accuracy depends on whether the PDF renders clearly. Scanned PDFs or image-only PDFs may produce lower-quality results than native digital receipts.

### `raw_ai_json` Is Intentionally Compact
The AI extraction response is trimmed before storage to avoid large form payloads and oversized JSONB values. Do not expect `raw_ai_json` to contain the full OpenAI API response — it stores only the extracted fields and metadata.

### `ai_confidence` Range
`ai_confidence` is stored as `numeric(4,3)` — values must be between 0 and 1 (e.g. `0.9`, not `90`). Passing a value outside this range will cause a Supabase insert error. The API route clamps or validates this before insert.

---

## Product Scope Limitations

### Not Yet Multi-Tenant
All expenses are scoped to the authenticated user via RLS. There is no concept of organisations, teams, or shared expense views. Do not attempt to add multi-user features without explicit planning.

### Not a Full Accounting Platform
ExpenseDesk intentionally does not handle:
- Payroll or salary slip generation
- GST, VAT, or tax calculations
- Double-entry bookkeeping or ledgers
- Bank feed or statement import
- Recurring expenses

Adding these without careful planning will create scope and data model conflicts.

### Receipt Replacement and Deletion Cleanup
If an expense's receipt is replaced or the expense is deleted, the old file in Supabase Storage is not automatically cleaned up. Storage objects may accumulate over time. This should be addressed in a future phase if storage costs become a concern.

---

## Do Not Do Accidentally

| Action | Why |
|---|---|
| Make the `receipts` storage bucket public | Receipts contain sensitive financial and personal data. Signed URLs must be used for all access. |
| Put `OPENAI_API_KEY` in a `NEXT_PUBLIC_` variable | This exposes the key in the browser bundle and to all users of the app. |
| Use the Supabase service role key in client code or API routes | The service role key bypasses RLS entirely. If leaked, it grants full database access. |
| Auto-save AI extraction without user review | AI extraction is imperfect. Silent auto-save would result in incorrect expense records without any user awareness. |
| Expand into payroll, GST, or accounting workflows without explicit planning | These require significant data model and business logic changes that would conflict with the current schema. |
| Reintroduce heavy server actions into the Expenses route | The Expenses route was deliberately refactored to a lightweight client-fetching architecture to resolve persistent Turbopack compilation crashes. Server actions in this route re-introduce the `server-reference-manifest.json` dependency, which is a known failure point in this Next.js version. |
