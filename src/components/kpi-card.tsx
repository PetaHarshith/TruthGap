"use client";

import { cn } from "@/lib/utils";
import { Counter } from "./counter";
import { InfoTooltip } from "./info-tooltip";

type Tone = "default" | "good" | "warn" | "bad";

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  numeric,
  format,
  suffix,
  accent,
  tooltip,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  /** if provided, animates count-up to this number instead of rendering `value` */
  numeric?: number;
  format?: (n: number) => string;
  suffix?: string;
  accent?: "blue" | "green" | "amber" | "red" | "violet";
  tooltip?: React.ReactNode;
  className?: string;
}) {
  const toneCls = {
    default: "text-foreground",
    good: "text-emerald-300",
    warn: "text-amber-300",
    bad: "text-red-300",
  }[tone];

  const accentGlow: Record<string, string> = {
    blue: "before:bg-[radial-gradient(420px_circle_at_0%_0%,oklch(0.6_0.22_250/0.10),transparent_40%)]",
    green: "before:bg-[radial-gradient(420px_circle_at_0%_0%,oklch(0.7_0.18_162/0.10),transparent_40%)]",
    amber: "before:bg-[radial-gradient(420px_circle_at_0%_0%,oklch(0.78_0.18_70/0.10),transparent_40%)]",
    red: "before:bg-[radial-gradient(420px_circle_at_0%_0%,oklch(0.7_0.19_22/0.10),transparent_40%)]",
    violet: "before:bg-[radial-gradient(420px_circle_at_0%_0%,oklch(0.65_0.22_303/0.10),transparent_40%)]",
  };

  return (
    <div
      className={cn(
        "relative rounded-xl border border-border/60 px-5 py-4 overflow-hidden bg-gradient-to-b from-card/80 to-card/40 backdrop-blur",
        "before:content-[''] before:absolute before:inset-0 before:pointer-events-none",
        accent && accentGlow[accent],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80 font-mono">
            {label}
          </span>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        {accent && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: {
                blue: "oklch(0.6 0.22 250)",
                green: "oklch(0.7 0.18 162)",
                amber: "oklch(0.78 0.18 70)",
                red: "oklch(0.7 0.19 22)",
                violet: "oklch(0.65 0.22 303)",
              }[accent],
            }}
          />
        )}
      </div>
      <div className={cn("mt-3 text-[32px] leading-none font-medium tabular-nums tracking-tight", toneCls)}>
        {numeric !== undefined ? (
          <Counter value={numeric} format={format} suffix={suffix} />
        ) : (
          value
        )}
      </div>
      {hint && <div className="mt-2 text-[11px] text-muted-foreground/80 font-mono">{hint}</div>}
    </div>
  );
}
