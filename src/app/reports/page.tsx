"use client";

import Header from "@/components/Header";
import { BarChart2, Download, FileText, TrendingUp } from "lucide-react";

const REPORT_CARDS = [
  {
    title: "Monthly Summary",
    description: "Month-on-month expense breakdown by category and payment method.",
    icon: BarChart2,
    accent: "text-green-600 bg-green-50",
    tag: "Available",
  },
  {
    title: "Salary Report",
    description: "Complete salary disbursement history across all employees.",
    icon: TrendingUp,
    accent: "text-blue-600 bg-blue-50",
    tag: "Available",
  },
  {
    title: "Vendor Analysis",
    description: "Top vendors by spend with trend comparison over 6 months.",
    icon: FileText,
    accent: "text-purple-600 bg-purple-50",
    tag: "Available",
  },
  {
    title: "Tax Summary",
    description: "GST and tax-eligible expense summary for the current financial year.",
    icon: FileText,
    accent: "text-amber-600 bg-amber-50",
    tag: "Coming soon",
  },
];

export default function ReportsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Reports" subtitle="Export and review business expense reports" />

      <div className="p-6 flex-1">
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          {REPORT_CARDS.map((r) => {
            const Icon = r.icon;
            const coming = r.tag === "Coming soon";
            return (
              <div
                key={r.title}
                className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${r.accent}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${coming ? "bg-muted text-muted-foreground" : "bg-green-50 text-green-700"}`}>
                    {r.tag}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.description}</p>
                </div>
                {!coming && (
                  <button className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                    <Download className="w-3.5 h-3.5" />
                    Export as CSV
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
