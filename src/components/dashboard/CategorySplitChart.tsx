"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export interface ChartSlice {
  name: string;
  value: number;
  color: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-border rounded-lg shadow-md p-2 text-xs">
      <p className="font-medium">{d.name}</p>
      <p className="text-muted-foreground">₹{d.value.toLocaleString("en-IN")}</p>
    </div>
  );
};

interface Props {
  data: ChartSlice[];
}

export default function CategorySplitChart({ data }: Props) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
      <p className="text-sm font-semibold text-foreground mb-1">By Category</p>
      <div className="flex items-center gap-3">
        <ResponsiveContainer width={100} height={100}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={44} dataKey="value" strokeWidth={1.5} stroke="#fff">
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-1 min-w-0">
          {data.slice(0, 5).map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: item.color }} />
                <span className="text-[11px] text-muted-foreground truncate">{item.name}</span>
              </div>
              <span className="text-[11px] font-medium text-foreground flex-shrink-0">
                ₹{(item.value / 1000).toFixed(0)}k
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
