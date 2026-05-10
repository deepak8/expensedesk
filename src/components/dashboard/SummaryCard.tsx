import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
  icon: React.ReactNode;
  accent: "mint" | "lavender" | "pink" | "neutral";
}

const accentStyles = {
  mint: "bg-[rgb(176_242_213)] text-foreground",
  lavender: "bg-[rgb(191_178_255)] text-foreground",
  pink: "bg-[rgb(254_221_241)] text-foreground",
  neutral: "bg-[rgb(248_248_248)] text-muted-foreground",
};

export default function SummaryCard({ label, value, delta, deltaUp, icon, accent }: SummaryCardProps) {
  return (
    <div className="bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", accentStyles[accent])}>
          {icon}
        </div>
      </div>
      <p className="text-[26px] font-semibold text-foreground tracking-normal leading-none">{value}</p>
      {delta && (
        <p className={cn("text-[11px] font-medium", accent === "lavender" || accent === "pink" ? "text-foreground" : deltaUp ? "text-muted-foreground" : "text-foreground")}>
          {delta}
        </p>
      )}
    </div>
  );
}
