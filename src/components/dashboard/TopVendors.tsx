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
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm h-full">
      <p className="text-sm font-semibold text-foreground mb-4">Top Vendors</p>
      <div className="space-y-3">
        {data.map((v, i) => (
          <div key={v.vendor}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold flex items-center justify-center">
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
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
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
