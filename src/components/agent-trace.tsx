"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { VerdictBadge } from "./verdict-badge";
import { AgentIcon } from "./agent-icon";

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

const AGENT_META: Record<string, { label: string; tools: string; color: string; tint: string }> = {
  code: {
    label: "Code Agent",
    tools: "grep · read_file · lookup_symbol",
    color: "text-sky-300",
    tint: "oklch(0.6 0.22 250)",
  },
  history: {
    label: "History Agent",
    tools: "git_log · git_blame · diff_range",
    color: "text-violet-300",
    tint: "oklch(0.65 0.22 303)",
  },
  web: {
    label: "Web Agent",
    tools: "hybrid_search · read_url",
    color: "text-emerald-300",
    tint: "oklch(0.7 0.18 162)",
  },
};

export function AgentTrace({ agents }: { agents: Agent[] }) {
  const ordered = ["code", "history", "web"]
    .map((k) => agents.find((a) => a.agent === k))
    .filter(Boolean) as Agent[];
  const [active, setActive] = useState(ordered[0]?.agent ?? "code");
  const current = ordered.find((a) => a.agent === active) ?? ordered[0];

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-b from-card/70 to-card/30 backdrop-blur overflow-hidden">
      <div className="grid grid-cols-3 border-b border-border/60">
        {ordered.map((a) => {
          const meta = AGENT_META[a.agent];
          const isActive = active === a.agent;
          return (
            <button
              key={a.agent}
              onClick={() => setActive(a.agent)}
              className={cn(
                "relative px-4 py-4 text-left border-r border-border/60 last:border-r-0 transition-all",
                isActive ? "bg-muted/30" : "hover:bg-muted/15",
              )}
            >
              {isActive && (
                <span
                  className="absolute inset-x-0 top-0 h-px"
                  style={{ background: meta.tint }}
                />
              )}
              <div className="flex items-center justify-between gap-2">
                <div className={cn("flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.1em]", meta.color)}>
                  <AgentIcon agent={a.agent} />
                  {meta.label}
                </div>
                <VerdictBadge verdict={a.verdict} />
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground/70 font-mono truncate">
                {meta.tools}
              </div>
              <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-muted-foreground/80 tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 opacity-60"><path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.4" /></svg>
                  {a.tool_calls.length} calls
                </span>
                <span>{(a.duration_ms / 1000).toFixed(1)}s</span>
                <span>{((a.tokens_in + a.tokens_out) / 1000).toFixed(1)}k tok</span>
                <span className="ml-auto">conf {(a.confidence * 100).toFixed(0)}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {current && (
        <div className="p-5 space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-mono">
              reasoning
            </div>
            <div className="text-[13.5px] mt-1.5 leading-relaxed text-foreground/90">{current.reasoning}</div>
          </div>

          {current.evidence.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-mono mb-2">
                evidence ({current.evidence.length})
              </div>
              <div className="space-y-2">
                {current.evidence.map((e, i) => (
                  <div key={i} className="rounded-lg border border-border/50 bg-muted/15 overflow-hidden">
                    <div className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground/80 border-b border-border/40 flex items-center gap-2 bg-muted/10">
                      <svg viewBox="0 0 12 12" className="w-3 h-3 opacity-60"><path d="M3 1.5h4l2.5 2.5V10.5a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1" fill="none"/></svg>
                      {e.file ?? e.url ?? "(no source)"}
                    </div>
                    <pre className="px-3 py-2.5 text-[11.5px] font-mono whitespace-pre-wrap text-foreground/90 leading-relaxed">
                      {e.snippet}
                    </pre>
                    {e.note && (
                      <div className="px-3 py-1.5 text-[11px] text-muted-foreground/80 italic border-t border-border/40 bg-muted/5">
                        {e.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-mono">
                tool calls ({current.tool_calls.length})
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/60">
                click to expand
              </div>
            </div>
            <div className="space-y-1.5">
              {current.tool_calls.length === 0 && (
                <div className="text-xs text-muted-foreground/70 italic px-3 py-2 rounded-md bg-muted/10 border border-border/40">
                  no tools called — agent submitted verdict directly
                </div>
              )}
              {current.tool_calls.map((tc, i) => (
                <details
                  key={i}
                  className="rounded-lg border border-border/50 bg-muted/10 group transition-all hover:border-border"
                  open={i === 0}
                >
                  <summary className="cursor-pointer px-3 py-2 list-none flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums shrink-0">
                        #{String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[12px] font-mono text-sky-300 shrink-0">{tc.tool}</span>
                      <span className="text-[11px] font-mono text-muted-foreground/70 truncate">
                        ({Object.entries(tc.input)
                          .map(([k, v]) => `${k}=${typeof v === "string" ? `"${v.length > 40 ? v.slice(0, 40) + "…" : v}"` : v}`)
                          .join(", ")})
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 group-open:rotate-90 transition-transform shrink-0">
                      ▸
                    </span>
                  </summary>
                  {tc.tool === "hybrid_search" ? (
                    <HybridSearchOutput raw={tc.output} />
                  ) : (
                    <pre className="border-t border-border/40 px-3 py-2.5 bg-background/40 text-[11px] font-mono whitespace-pre-wrap max-h-80 overflow-auto text-foreground/80 leading-relaxed">
                      {tc.output}
                    </pre>
                  )}
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type HybridHit = {
  title: string;
  url: string;
  bm25_rank: string;
  vec_rank: string;
  rrf: string;
  snippet: string;
};

function parseHybridSearch(raw: string): HybridHit[] {
  if (!raw || raw.includes("(no external sources matched)")) return [];
  const blocks = raw.split(/\n---\n?/g);
  const hits: HybridHit[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;
    const titleLine = lines.find((l) => l.startsWith("# "));
    const urlLine = lines.find((l) => /^https?:\/\//.test(l.trim()));
    const metaLine = lines.find((l) => l.includes("rrf="));
    if (!metaLine) continue;
    const bm25 = metaLine.match(/bm25_rank=(\S+)/)?.[1] ?? "-";
    const vec = metaLine.match(/vec_rank=(\S+)/)?.[1] ?? "-";
    const rrf = metaLine.match(/rrf=(\S+)/)?.[1] ?? "-";
    const startIdx = lines.indexOf(metaLine) + 1;
    const snippet = lines.slice(startIdx).join("\n").trim();
    hits.push({
      title: (titleLine ?? "# ?").replace(/^# /, ""),
      url: urlLine?.trim() ?? "",
      bm25_rank: bm25,
      vec_rank: vec,
      rrf,
      snippet,
    });
  }
  return hits;
}

function HybridSearchOutput({ raw }: { raw: string }) {
  const hits = parseHybridSearch(raw);
  if (hits.length === 0) {
    return (
      <div className="border-t border-border/40 px-3 py-3 bg-background/40 text-[11px] font-mono text-muted-foreground/70 italic">
        no external sources matched
      </div>
    );
  }
  return (
    <div className="border-t border-border/40 bg-background/40">
      <div className="px-3 py-2 flex items-center gap-3 border-b border-border/40 text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground/70">
        <span className="flex-1">source</span>
        <span className="w-12 text-right">bm25</span>
        <span className="w-12 text-right">vec</span>
        <span className="w-16 text-right">rrf score</span>
      </div>
      <div className="max-h-80 overflow-auto">
        {hits.map((h, i) => (
          <div
            key={i}
            className="border-b border-border/30 last:border-b-0 px-3 py-2 hover:bg-muted/10 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-mono text-foreground/90 truncate">{h.title}</div>
                <div className="text-[10px] font-mono text-muted-foreground/60 truncate">
                  {h.url}
                </div>
              </div>
              <span className="w-12 text-right text-[11px] font-mono tabular-nums text-sky-300">
                {h.bm25_rank}
              </span>
              <span className="w-12 text-right text-[11px] font-mono tabular-nums text-emerald-300">
                {h.vec_rank}
              </span>
              <span className="w-16 text-right text-[11px] font-mono tabular-nums text-violet-300">
                {Number(h.rrf).toFixed(4)}
              </span>
            </div>
            {h.snippet && (
              <pre className="mt-1.5 text-[11px] font-mono text-foreground/75 whitespace-pre-wrap leading-snug max-h-24 overflow-hidden">
                {h.snippet.slice(0, 360)}
              </pre>
            )}
          </div>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-border/40 text-[10px] font-mono text-muted-foreground/60 flex items-center justify-between">
        <span>RRF fusion · score = Σ 1/(60 + rank_i)</span>
        <span>{hits.length} hits</span>
      </div>
    </div>
  );
}
