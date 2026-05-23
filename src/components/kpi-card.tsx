import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneCls = {
    default: "text-foreground",
    good: "text-emerald-300",
    warn: "text-amber-300",
    bad: "text-red-300",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card/50 px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div>
      <div className={cn("mt-2 text-3xl font-medium tabular-nums", toneCls)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
