"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

export function DiffView({ patch }: { patch: string }) {
  const lines = patch.split("\n");
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-b from-card/60 to-card/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/10">
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          unified diff
        </div>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(patch);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            } catch {}
          }}
          className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border/40 hover:border-border bg-background/40"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <div className="overflow-auto max-h-[420px]">
        <table className="w-full font-mono text-[11.5px] leading-[1.55]">
          <tbody>
            {lines.map((line, i) => {
              let cls = "text-foreground/70";
              let mark = " ";
              if (line.startsWith("+++") || line.startsWith("---")) {
                cls = "text-muted-foreground/70";
              } else if (line.startsWith("@@")) {
                cls = "text-sky-300 bg-sky-500/[0.04]";
              } else if (line.startsWith("+")) {
                cls = "text-emerald-300 bg-emerald-500/[0.06]";
                mark = "+";
              } else if (line.startsWith("-")) {
                cls = "text-red-300 bg-red-500/[0.06]";
                mark = "−";
              }
              return (
                <tr key={i} className={cls}>
                  <td className="select-none text-right pr-2 pl-3 text-muted-foreground/40 tabular-nums w-10 align-top">
                    {i + 1}
                  </td>
                  <td className="select-none w-4 align-top text-muted-foreground/60">{mark}</td>
                  <td className={cn("pr-4 whitespace-pre")}>{line.replace(/^[+-]/, "") || " "}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
