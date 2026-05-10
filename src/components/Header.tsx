"use client";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="h-12 flex items-center justify-between px-6 border-b border-border bg-background sticky top-0 z-10">
      <div>
        <h1 className="text-[15px] font-semibold text-foreground leading-tight tracking-normal">{title}</h1>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      {action && <div className="flex items-center gap-2">{action}</div>}
    </header>
  );
}
