import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  contradicted: "bg-red-500/15 text-red-300 border-red-500/30",
  partial: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  unverifiable: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  supported: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const LABEL: Record<string, string> = {
  contradicted: "Contradicted",
  partial: "Partial",
  unverifiable: "Unverifiable",
  supported: "Supported",
};

export function VerdictBadge({ verdict, className }: { verdict: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-mono uppercase tracking-wide",
        STYLES[verdict] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {LABEL[verdict] ?? verdict}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  if (!severity) return null;
  const styles: Record<string, string> = {
    high: "text-red-300 border-red-500/30",
    medium: "text-amber-300 border-amber-500/30",
    low: "text-zinc-400 border-zinc-500/30",
  };
  return (
    <span className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-mono uppercase", styles[severity] ?? styles.low)}>
      {severity}
    </span>
  );
}
