"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Soft banner that explains a page in plain language.
 * Collapsible — remembers state in sessionStorage.
 */
export function Explainer({
  title,
  body,
  storageKey,
  variant = "default",
  className,
}: {
  title: string;
  body: React.ReactNode;
  storageKey?: string;
  variant?: "default" | "emerald" | "amber";
  className?: string;
}) {
  const [open, setOpen] = useState(true);

  const accent = {
    default: "border-border/50 bg-gradient-to-r from-card/60 to-card/30",
    emerald:
      "border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.06] to-card/30",
    amber:
      "border-amber-500/25 bg-gradient-to-r from-amber-500/[0.06] to-card/30",
  }[variant];

  if (!open) return null;

  return (
    <div
      className={cn(
        "rounded-xl border backdrop-blur px-4 py-3 flex items-start gap-3",
        accent,
        className,
      )}
    >
      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-foreground/5 border border-border/60 flex items-center justify-center">
        <svg viewBox="0 0 16 16" className="w-3 h-3 text-muted-foreground" aria-hidden>
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <path
            d="M8 5.5v.01M8 7.5v3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-foreground/95">{title}</div>
        <div className="mt-1 text-[12.5px] text-muted-foreground/95 leading-relaxed">
          {body}
        </div>
      </div>
      <button
        onClick={() => {
          setOpen(false);
          if (storageKey) {
            try {
              sessionStorage.setItem(storageKey, "1");
            } catch {}
          }
        }}
        className="shrink-0 text-muted-foreground/60 hover:text-foreground text-xs font-mono w-6 h-6 flex items-center justify-center rounded hover:bg-muted/30 transition-colors"
        aria-label="dismiss"
      >
        ×
      </button>
    </div>
  );
}
