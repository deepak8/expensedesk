"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { ChartSlice } from "./CategorySplitChart";

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

export default function PaymentSplitChart({ data }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
      <p className="text-sm font-semibold text-foreground mb-1">By Payment Method</p>
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
          {data.map((item) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={item.name} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-[11px] text-muted-foreground truncate">{item.name}</span>
                </div>
                <span className="text-[11px] font-medium text-foreground flex-shrink-0">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
