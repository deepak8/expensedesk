import { NextRequest, NextResponse } from "next/server";
import { deriveMonthlyReport, monthRange } from "@/lib/reports-data";
import { getExpenses, isSupabaseConfigured } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? "";
  const range = monthRange(month);

  if (!range) {
    return NextResponse.json({ error: "Use month in YYYY-MM format." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(deriveMonthlyReport([], month, range));
  }

  const expenses = await getExpenses({
    fromDate: range.fromDate,
    toDate: range.toDate,
  });

  return NextResponse.json(deriveMonthlyReport(expenses, month, range));
}
