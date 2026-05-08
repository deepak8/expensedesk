import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
  icon: React.ReactNode;
  accent: "green" | "amber" | "neutral";
}

const accentStyles = {
  green: "bg-green-50 text-green-600",
  amber: "bg-amber-50 text-amber-600",
  neutral: "bg-muted text-muted-foreground",
};

export default function SummaryCard({ label, value, delta, deltaUp, icon, accent }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", accentStyles[accent])}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-semibold text-foreground tracking-tight">{value}</p>
      {delta && (
        <p className={cn("text-xs font-medium", accent === "amber" ? "text-amber-500" : deltaUp ? "text-green-600" : "text-red-500")}>
          {delta}
        </p>
      )}
    </div>
  );
}
