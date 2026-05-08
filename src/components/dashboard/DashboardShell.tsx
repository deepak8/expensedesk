"use client";

import Header from "@/components/Header";
import SummaryCard from "@/components/dashboard/SummaryCard";
import MonthlyTrendChart from "@/components/dashboard/MonthlyTrendChart";
import CategorySplitChart from "@/components/dashboard/CategorySplitChart";
import PaymentSplitChart from "@/components/dashboard/PaymentSplitChart";
import TopVendors from "@/components/dashboard/TopVendors";
import NeedsReviewQueue from "@/components/dashboard/NeedsReviewQueue";
import { IndianRupee, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import type { MonthlyData } from "@/lib/mock-data";
import type { DashboardData } from "@/lib/dashboard-data";

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

interface Props {
  monthLabel: string;
  monthSubtitle: string;
  monthlyTrend: MonthlyData[];
  dashboard: DashboardData;
}

export default function DashboardShell({ monthLabel, monthSubtitle, monthlyTrend, dashboard }: Props) {
  const { summary, categorySplit, paymentSplit, topVendors, needsReview } = dashboard;

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={monthLabel} subtitle={monthSubtitle} />

      <div className="p-6 space-y-6 flex-1">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <SummaryCard
            label="Total Expenses"
            value={fmt(summary.totalExpenses)}
            delta="+8.2% vs last month"
            deltaUp
            icon={<IndianRupee className="w-4 h-4" />}
            accent="neutral"
          />
          <SummaryCard
            label="Salary"
            value={fmt(summary.salary)}
            delta="+2.3% vs last month"
            deltaUp
            icon={<TrendingUp className="w-4 h-4" />}
            accent="green"
          />
          <SummaryCard
            label="Non-Salary"
            value={fmt(summary.nonSalary)}
            delta="+7.1% vs last month"
            deltaUp
            icon={<TrendingDown className="w-4 h-4" />}
            accent="neutral"
          />
          <SummaryCard
            label="Needs Review"
            value={fmt(summary.needsReview)}
            delta={`${needsReview.length} items pending`}
            icon={<AlertCircle className="w-4 h-4" />}
            accent="amber"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3">
            <MonthlyTrendChart data={monthlyTrend} />
          </div>
          <div className="col-span-2 grid grid-rows-2 gap-4">
            <CategorySplitChart data={categorySplit} />
            <PaymentSplitChart data={paymentSplit} />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2">
            <TopVendors data={topVendors} />
          </div>
          <div className="col-span-3">
            <NeedsReviewQueue items={needsReview} />
          </div>
        </div>
      </div>
    </div>
  );
}
