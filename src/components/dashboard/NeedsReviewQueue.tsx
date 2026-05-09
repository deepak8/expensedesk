import Link from "next/link";
import { AlertCircle } from "lucide-react";

export interface ReviewItem {
  id: string;
  vendor: string;
  description: string;
  date: string;
  amount: number;
  issue?: string;
}

interface Props {
  items: ReviewItem[];
}

export default function NeedsReviewQueue({ items }: Props) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-semibold text-foreground">Needs Attention</p>
          <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[11px] font-semibold">
            {items.length}
          </span>
        </div>
        <Link href="/expenses" className="text-xs text-primary hover:underline font-medium">
          View all
        </Link>
      </div>

      <div className="space-y-2">
        {items.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-amber-50/50 border border-amber-100 hover:bg-amber-50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{e.vendor}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {e.issue ?? "Needs Review"} · {e.description || "No description"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-white border border-amber-200 text-amber-700 font-medium">
                {e.issue ?? "Review"}
              </span>
              <span className="text-xs text-muted-foreground">{e.date.slice(5)}</span>
              <span className="text-xs font-semibold text-foreground">
                ₹{e.amount.toLocaleString("en-IN")}
              </span>
              <Link href="/expenses" className="text-[11px] px-2 py-1 rounded-md bg-white border border-border text-foreground hover:bg-muted transition-colors font-medium">
                Review
              </Link>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">All caught up — nothing to review.</p>
        )}
      </div>
    </div>
  );
}
