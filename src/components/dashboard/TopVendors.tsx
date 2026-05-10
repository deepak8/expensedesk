export interface VendorRow {
  vendor: string;
  category: string;
  amount: number;
}

interface Props {
  data: VendorRow[];
}

export default function TopVendors({ data }: Props) {
  const max = data[0]?.amount ?? 1;
  return (
    <div className="bg-white border-y border-border py-4 h-full">
      <p className="text-[13px] font-semibold text-foreground mb-4">Top Vendors</p>
      <div className="divide-y divide-border">
        {data.map((v, i) => (
          <div key={v.vendor} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-sm border border-border bg-white text-muted-foreground text-[10px] font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="text-xs font-medium text-foreground">{v.vendor}</p>
                  <p className="text-[10px] text-muted-foreground">{v.category}</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-foreground">
                ₹{v.amount.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="w-full h-px bg-muted overflow-hidden">
              <div
                className="h-full bg-[rgb(24_24_24)] transition-all"
                style={{ width: `${(v.amount / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-xs text-muted-foreground">No vendor data yet.</p>
        )}
      </div>
    </div>
  );
}
