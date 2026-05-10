"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyData } from "@/lib/mock-data";

function formatY(v: number) {
  return "₹" + (v / 1000).toFixed(0) + "k";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-md shadow-none p-3 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="w-2 h-2 rounded-sm inline-block" style={{ background: p.fill }} />
          {p.name}: ₹{p.value.toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
};

interface Props {
  data: MonthlyData[];
}

export default function MonthlyTrendChart({ data }: Props) {
  return (
    <div className="bg-white border-y border-border py-4 h-full">
      <div className="mb-4">
        <p className="text-[13px] font-semibold text-foreground">Month-on-Month Expenses</p>
        <p className="text-[11px] text-muted-foreground">Dec 2025 – May 2026</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barCategoryGap="30%" barGap={4}>
          <CartesianGrid stroke="#e8e8e8" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#696969" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatY} tick={{ fontSize: 11, fill: "#696969" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" iconSize={8} />
          <Bar dataKey="salary" name="Salary" fill="#b0f2d5" radius={[2, 2, 0, 0]} />
          <Bar dataKey="nonSalary" name="Non-Salary" fill="#bfb2ff" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
