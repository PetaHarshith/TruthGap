"use client";

import { cn } from "@/lib/utils";
import { Counter } from "./counter";
import { InfoTooltip } from "./info-tooltip";

type Tone = "default" | "good" | "warn" | "bad";

const ACCENT_COLORS: Record<string, string> = {
  blue: "oklch(0.62 0.22 250)",
  green: "oklch(0.72 0.18 162)",
  amber: "oklch(0.78 0.18 70)",
  red: "oklch(0.7 0.19 22)",
  violet: "oklch(0.66 0.22 303)",
};

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

  const accentColor = accent ? ACCENT_COLORS[accent] : undefined;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border border-border/50 px-5 py-5 overflow-hidden",
        "bg-gradient-to-b from-card/90 to-card/50 backdrop-blur transition-all",
        "hover:border-border hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]",
        className,
      )}
    >
      {/* accent glow in top-left */}
      {accentColor && (
        <span
          className="absolute -top-12 -left-12 w-40 h-40 rounded-full opacity-60 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${accentColor}30, transparent 70%)`,
            filter: "blur(20px)",
          }}
          aria-hidden
        />
      )}

      {/* top accent line */}
      {accentColor && (
        <span
          className="absolute top-0 left-5 right-5 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          }}
          aria-hidden
        />
      )}

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground/80 font-medium">
            {label}
          </span>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        {accentColor && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: accentColor }}
          />
        )}
      </div>

      <div className={cn("relative mt-4 kpi-num text-[40px] leading-[1] tabular-nums", toneCls)}>
        {numeric !== undefined ? (
          <Counter value={numeric} format={format} suffix={suffix} />
        ) : (
          value
        )}
      </div>

      {hint && (
        <div className="relative mt-2.5 text-[12px] text-muted-foreground/80 leading-snug">
          {hint}
        </div>
      )}
    </div>
  );
}
