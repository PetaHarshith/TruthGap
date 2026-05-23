"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { VerdictBadge } from "./verdict-badge";

type ToolCall = {
  tool: string;
  input: Record<string, unknown>;
  output: string;
  ts: number;
};

type Agent = {
  agent: string;
  verdict: string;
  confidence: number;
  reasoning: string;
  evidence: { snippet: string; file?: string; url?: string; note?: string }[];
  tool_calls: ToolCall[];
  tokens_in: number;
  tokens_out: number;
  duration_ms: number;
};

const AGENT_META: Record<string, { label: string; tools: string; color: string }> = {
  code: { label: "Code Agent", tools: "grep · read_file · lookup_symbol", color: "text-sky-300" },
  history: { label: "History Agent", tools: "git_log · git_blame · diff_range", color: "text-violet-300" },
  web: { label: "Web Agent", tools: "hybrid_search · read_url", color: "text-emerald-300" },
};

export function AgentTrace({ agents }: { agents: Agent[] }) {
  const ordered = ["code", "history", "web"]
    .map((k) => agents.find((a) => a.agent === k))
    .filter(Boolean) as Agent[];
  const [active, setActive] = useState(ordered[0]?.agent ?? "code");
  const current = ordered.find((a) => a.agent === active) ?? ordered[0];

  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="flex border-b border-border">
        {ordered.map((a) => {
          const meta = AGENT_META[a.agent];
          return (
            <button
              key={a.agent}
              onClick={() => setActive(a.agent)}
              className={cn(
                "flex-1 px-4 py-3 text-left border-r border-border last:border-r-0 transition-colors",
                active === a.agent ? "bg-muted/40" : "hover:bg-muted/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={cn("text-xs font-mono uppercase tracking-wider", meta.color)}>
                  {meta.label}
                </div>
                <VerdictBadge verdict={a.verdict} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground font-mono truncate">{meta.tools}</div>
              <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                {a.tool_calls.length} tool calls · {(a.duration_ms / 1000).toFixed(1)}s · {a.tokens_in + a.tokens_out} tok
              </div>
            </button>
          );
        })}
      </div>

      {current && (
        <div className="p-4 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">reasoning</div>
            <div className="text-sm mt-1 leading-relaxed">{current.reasoning}</div>
          </div>

          {current.evidence.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-1.5">
                evidence
              </div>
              <div className="space-y-1.5">
                {current.evidence.map((e, i) => (
                  <div key={i} className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {e.file ?? e.url ?? "(no source)"}
                    </div>
                    <pre className="mt-1 text-xs font-mono whitespace-pre-wrap text-foreground/90">
                      {e.snippet}
                    </pre>
                    {e.note && <div className="mt-1 text-[11px] text-muted-foreground italic">{e.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-1.5">
              tool calls ({current.tool_calls.length})
            </div>
            <div className="space-y-2">
              {current.tool_calls.length === 0 && (
                <div className="text-xs text-muted-foreground italic">no tools called</div>
              )}
              {current.tool_calls.map((tc, i) => (
                <details key={i} className="rounded-md border border-border/60 bg-muted/15 group" open={i === 0}>
                  <summary className="cursor-pointer px-3 py-2 list-none flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground w-5">#{i + 1}</span>
                      <span className="text-xs font-mono text-sky-300">{tc.tool}</span>
                      <span className="text-[11px] font-mono text-muted-foreground truncate max-w-md">
                        {Object.entries(tc.input)
                          .map(([k, v]) => `${k}=${typeof v === "string" ? `"${v}"` : v}`)
                          .join(", ")}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground group-open:rotate-90 transition-transform">▶</span>
                  </summary>
                  <pre className="border-t border-border/60 p-3 bg-background/60 text-[11px] font-mono whitespace-pre-wrap max-h-72 overflow-auto text-foreground/85">
                    {tc.output}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
