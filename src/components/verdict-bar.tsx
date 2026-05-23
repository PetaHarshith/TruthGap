"use client";

const COLORS: Record<string, string> = {
  supported: "oklch(0.72 0.18 162)",
  partial: "oklch(0.78 0.18 70)",
  contradicted: "oklch(0.7 0.19 22)",
  unverifiable: "oklch(0.55 0.01 270)",
};

const LABELS: Record<string, string> = {
  supported: "Supported",
  partial: "Partial",
  contradicted: "Contradicted",
  unverifiable: "Unverifiable",
};

export function VerdictBar({
  counts,
  className,
}: {
  counts: { supported?: number; partial?: number; contradicted?: number; unverifiable?: number };
  className?: string;
}) {
  const total =
    (counts.supported ?? 0) +
    (counts.partial ?? 0) +
    (counts.contradicted ?? 0) +
    (counts.unverifiable ?? 0);
  if (total === 0) return null;

  const entries: Array<keyof typeof counts> = [
    "supported",
    "partial",
    "contradicted",
    "unverifiable",
  ];

  return (
    <div className={className}>
      {/* the bar */}
      <div className="h-3 flex w-full rounded-full overflow-hidden bg-muted/30 ring-1 ring-border/40">
        {entries.map((k) => {
          const n = counts[k] ?? 0;
          if (n === 0) return null;
          const pct = (n / total) * 100;
          return (
            <div
              key={k}
              className="h-full transition-all hover:brightness-110"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(180deg, ${COLORS[k]} 0%, color-mix(in oklch, ${COLORS[k]} 80%, black) 100%)`,
              }}
              title={`${LABELS[k]}: ${n} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>

      {/* legend with counts + percentages */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {entries.map((k) => {
          const n = counts[k] ?? 0;
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <div
              key={k}
              className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-card/40 backdrop-blur px-3 py-2"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: COLORS[k] }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-muted-foreground/80">{LABELS[k]}</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-medium tabular-nums">{n}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
