"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { BackgroundMesh } from "@/components/bg-mesh";
import { VerdictBadge, SeverityBadge } from "@/components/verdict-badge";
import { AgentTrace } from "@/components/agent-trace";
import { DiffView } from "@/components/diff-view";

type Detail = {
  verification: {
    id: string;
    verdict: string;
    confidence: number;
    severity: string;
    reasoning: string;
    patch: string | null;
    evidence: { source: string; file?: string; url?: string; snippet: string; note?: string }[];
    dissent: { agent: string; verdict: string; reasoning: string }[];
    claim_text: string;
    claim_type: string;
    source_file: string;
    source_lines: string;
    referenced_entities: Record<string, string[]>;
    doc_chunk_content: string | null;
    doc_chunk_meta: Record<string, unknown> | null;
  };
  agents: {
    agent: string;
    verdict: string;
    confidence: number;
    reasoning: string;
    evidence: { source: string; snippet: string; file?: string; url?: string; note?: string }[];
    tool_calls: { tool: string; input: Record<string, unknown>; output: string; ts: number }[];
    tokens_in: number;
    tokens_out: number;
    duration_ms: number;
  }[];
};

export default function DiscrepancyPage({
  params,
}: {
  params: Promise<{ id: string; verifId: string }>;
}) {
  const { id, verifId } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  useEffect(() => {
    fetch(`/api/discrepancies/${verifId}`)
      .then((r) => r.json())
      .then(setData);
  }, [verifId]);

  if (!data)
    return (
      <>
        <BackgroundMesh />
        <Header />
        <main className="mx-auto max-w-7xl px-6 py-10">
          <div className="h-6 w-40 rounded bg-muted/40 animate-pulse mb-3" />
          <div className="h-10 w-2/3 rounded bg-muted/40 animate-pulse" />
        </main>
      </>
    );

  const { verification, agents } = data;
  const entities = Object.entries(verification.referenced_entities ?? {}).flatMap(
    ([k, vs]) => (vs ?? []).map((v) => ({ k, v })),
  );

  return (
    <>
      <BackgroundMesh />
      <Header />
      <main className="relative mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="fade-up">
          <Link
            href={`/repos/${id}`}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <span>←</span> back to repo
          </Link>

          <div className="mt-4 flex items-start justify-between gap-6 flex-wrap">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="mono-pill">claim</span>
                <span className="mono-pill">{verification.claim_type}</span>
                <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">
                  {verifId.slice(0, 8)}
                </span>
              </div>
              <h1 className="mt-3 text-2xl leading-snug font-medium tracking-tight">
                {verification.claim_text}
              </h1>
              <div className="mt-2.5 text-[11px] font-mono text-muted-foreground/70 flex items-center gap-2 flex-wrap">
                <svg viewBox="0 0 12 12" className="w-3 h-3 opacity-60"><path d="M3 1.5h4l2.5 2.5V10.5a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1" fill="none"/></svg>
                <span>{verification.source_file}</span>
                <span className="opacity-40">·</span>
                <span>L{verification.source_lines.replace(/[\[\]\(\)]/g, "")}</span>
              </div>
              {entities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {entities.slice(0, 8).map(({ k, v }, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/40 bg-background/40 text-muted-foreground/90"
                    >
                      <span className="text-muted-foreground/60">{k}=</span>
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={verification.severity} />
                <VerdictBadge verdict={verification.verdict} />
              </div>
              <div className="text-[11px] font-mono text-muted-foreground/80 tabular-nums">
                confidence {(verification.confidence * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/60">
                consolidated from 3 agents
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border/60 bg-gradient-to-b from-card/70 to-card/30 backdrop-blur px-4 py-3 flex items-start gap-3">
            <span
              className="mt-0.5 mono-pill shrink-0"
              style={{ color: "oklch(0.7 0.18 162)", borderColor: "oklch(0.7 0.18 162 / 0.4)" }}
            >
              consolidator
            </span>
            <p className="text-[13.5px] text-foreground/95 leading-relaxed">
              {verification.reasoning}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 fade-up fade-up-1">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="mono-pill">the doc says</span>
            </div>
            <pre className="rounded-xl border border-border/60 bg-gradient-to-b from-card/70 to-card/30 backdrop-blur p-4 text-[12px] font-mono whitespace-pre-wrap max-h-80 overflow-auto leading-relaxed text-foreground/90">
              {verification.doc_chunk_content ?? "(doc chunk missing)"}
            </pre>
          </section>
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="mono-pill">the code says</span>
            </div>
            <div className="rounded-xl border border-border/60 bg-gradient-to-b from-card/70 to-card/30 backdrop-blur p-4 max-h-80 overflow-auto space-y-3">
              {verification.evidence.length === 0 ? (
                <div className="text-[12px] text-muted-foreground/70 italic">
                  no consolidated evidence — see agent traces below.
                </div>
              ) : (
                verification.evidence.slice(0, 4).map((e, i) => (
                  <div key={i} className="space-y-1">
                    <div className="text-[10.5px] font-mono text-muted-foreground/80 flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background:
                            e.source === "code"
                              ? "oklch(0.6 0.22 250)"
                              : e.source === "history"
                                ? "oklch(0.65 0.22 303)"
                                : "oklch(0.7 0.18 162)",
                        }}
                      />
                      <span>{e.file ?? e.url ?? "?"}</span>
                      <span className="opacity-50">via {e.source}</span>
                    </div>
                    <pre className="text-[11.5px] font-mono whitespace-pre-wrap text-foreground/90 leading-relaxed pl-4 border-l border-border/30">
                      {e.snippet}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="space-y-2 fade-up fade-up-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="mono-pill">agent trace</div>
              <h2 className="mt-2 text-sm font-medium">Three specialists voting on truth</h2>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/60 tracking-[0.05em]">
              expand any tool call to inspect inputs and outputs
            </span>
          </div>
          <AgentTrace agents={agents} />
        </section>

        {verification.patch && (
          <section className="space-y-2 fade-up fade-up-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="mono-pill">suggested patch</div>
                <h2 className="mt-2 text-sm font-medium">Generated doc fix as a unified diff</h2>
              </div>
            </div>
            <DiffView patch={verification.patch} />
          </section>
        )}
      </main>
    </>
  );
}
