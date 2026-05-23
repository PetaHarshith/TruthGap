import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  contradicted: "bg-red-500/10 text-red-300 border-red-500/25 shadow-[0_0_24px_-12px_oklch(0.7_0.19_22/0.5)]",
  partial: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  unverifiable: "bg-zinc-500/10 text-zinc-300 border-zinc-500/25",
  supported: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
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
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em]",
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
    high: "text-red-300 border-red-500/25",
    medium: "text-amber-300 border-amber-500/25",
    low: "text-zinc-400 border-zinc-500/25",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em]",
        styles[severity] ?? styles.low,
      )}
    >
      {severity}
    </span>
  );
}
