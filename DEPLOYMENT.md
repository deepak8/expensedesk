# ExpenseDesk Deployment

ExpenseDesk is intended to run as a standard production Next.js app using Vercel for hosting, Supabase for auth/database/storage, and OpenAI for receipt extraction.

## Recommended Architecture

- **Frontend/app hosting:** Vercel
- **Database/auth/storage:** Supabase
- **AI extraction:** OpenAI API
- **Receipt previews:** Supabase private storage bucket with signed URLs

Do not run this as a static-only site. ExpenseDesk uses authenticated, request-specific server rendering and API routes.

## Required Environment Variables

Set these in Vercel project settings:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
```

Notes:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are safe for browser use.
- `OPENAI_API_KEY` must remain server-only.
- Do not add a Supabase service role key to client code or public environment variables.

## Supabase Setup Checklist

- Apply all project migrations to the production Supabase database.
- Confirm RLS is enabled on application tables.
- Confirm authenticated-user policies are present for the MVP tables.
- Enable Supabase Auth email/password sign-in.
- Configure the production Site URL in Supabase Auth settings.
- Configure redirect URLs for the production Vercel domain and any custom domain.
- Verify tables used by expenses, categories, payment methods, employees, business settings, and salary flows exist.
- Verify Phase 3C and later migrations are applied, including invoice/payment fields and employee directory fields.

## Storage Setup

- Create a private Supabase storage bucket named `receipts`.
- Do not make the `receipts` bucket public.
- Use signed URLs for receipt, invoice, and payment proof previews.
- Confirm storage policies allow authenticated users to upload, read through signed URL workflows, and remove only intended files.
- Confirm previews work for image and PDF uploads in production.

## Vercel Deployment Steps

1. Connect the GitHub repository to Vercel.
2. Select the ExpenseDesk Next.js project directory.
3. Set the required environment variables in Vercel.
4. Use the build command:

```bash
npm run build
```

5. Use the default Next.js output directory:

```bash
.next
```

6. Deploy.
7. After deployment, update Supabase Auth Site URL and redirect URLs to include the production Vercel URL.

## Production Smoke Test Checklist

Use test data only.

- Sign in with an authorized test account.
- Confirm Dashboard loads.
- Confirm Expenses loads.
- Upload an unpaid invoice.
- Upload a paid bill with payment proof.
- Upload payment proof only.
- Create a manual entry.
- Mark an unpaid invoice as paid.
- Confirm AI extraction prefills fields and still requires manual review/save.
- Confirm Salary page works.
- Confirm Employees tab works.
- Confirm Reports load and CSV export works.
- Confirm Settings load and save.
- Confirm profile edit works.
- Confirm primary document previews work.
- Confirm payment proof previews work.

## Security Reminders

- Never expose `OPENAI_API_KEY` to client code.
- Never make the `receipts` bucket public.
- Never use a Supabase service role key in client-side code.
- Keep RLS enabled.
- Keep storage policies enabled.
- Keep receipt, invoice, and payment proof previews behind signed URLs.

## Common Issues

- **Missing environment variables:** App may fail auth, API routes, or AI extraction.
- **Supabase Auth redirect URL mismatch:** Sign-in may fail or redirect incorrectly after deployment.
- **Missing storage bucket policies:** Uploads or previews may fail even when the bucket exists.
- **Migrations not applied:** Newer flows may fail because expected columns or tables are missing.
- **OpenAI key or billing errors:** AI extraction may fail while manual entry still works.
- **Wrong project directory in Vercel:** Build may not find the correct Next.js app.

## Rollback Notes

- Keep the previous successful Vercel deployment available for instant rollback.
- If a new deployment fails smoke testing, roll back in Vercel first, then diagnose.
- Do not roll back Supabase migrations casually once production data exists.
- If a schema rollback is unavoidable, prepare a specific database rollback plan and backup first.
- Preserve uploaded files in the private `receipts` bucket unless a cleanup is explicitly planned.

## Custom Domain Notes

- Add the custom domain in Vercel.
- Update Supabase Auth Site URL to the custom domain when ready.
- Add the custom domain to Supabase Auth redirect URLs.
- Keep the Vercel preview/production URL in redirect URLs if it is still used for testing.
- Re-run the production smoke test after switching domains.
