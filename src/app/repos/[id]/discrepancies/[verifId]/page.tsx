"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
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
        <Header />
        <main className="mx-auto max-w-7xl px-6 py-10 text-muted-foreground">loading…</main>
      </>
    );

  const { verification, agents } = data;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div>
          <Link
            href={`/repos/${id}`}
            className="text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            ← back to repo
          </Link>
          <div className="mt-3 flex items-start justify-between gap-3 flex-wrap">
            <div className="max-w-3xl">
              <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                claim · {verification.claim_type}
              </div>
              <h1 className="mt-2 text-xl leading-snug">{verification.claim_text}</h1>
              <div className="mt-2 text-xs font-mono text-muted-foreground">
                {verification.source_file}:
                {verification.source_lines.replace(/[\[\]\(\)]/g, "")}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={verification.severity} />
                <VerdictBadge verdict={verification.verdict} />
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                confidence {(verification.confidence * 100).toFixed(0)}% · consolidated from 3 agents
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground/85">
            <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground mr-2">
              consolidator
            </span>
            {verification.reasoning}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <section className="space-y-2">
            <h2 className="text-[11px] uppercase tracking-widest font-mono text-muted-foreground">
              the doc says
            </h2>
            <pre className="rounded-md border border-border bg-card/50 p-3 text-xs font-mono whitespace-pre-wrap max-h-72 overflow-auto">
              {verification.doc_chunk_content ?? "(doc chunk missing)"}
            </pre>
          </section>
          <section className="space-y-2">
            <h2 className="text-[11px] uppercase tracking-widest font-mono text-muted-foreground">
              the code says
            </h2>
            <div className="rounded-md border border-border bg-card/50 p-3 max-h-72 overflow-auto space-y-2">
              {verification.evidence.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">no consolidated evidence (see agent traces)</div>
              ) : (
                verification.evidence.slice(0, 4).map((e, i) => (
                  <div key={i}>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {e.file ?? e.url ?? "?"} <span className="ml-1 opacity-60">({e.source})</span>
                    </div>
                    <pre className="mt-1 text-xs font-mono whitespace-pre-wrap text-foreground/90">
                      {e.snippet}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="space-y-2">
          <h2 className="text-[11px] uppercase tracking-widest font-mono text-muted-foreground">
            agent trace — 3 specialists voting on truth
          </h2>
          <AgentTrace agents={agents} />
        </section>

        {verification.patch && (
          <section className="space-y-2">
            <h2 className="text-[11px] uppercase tracking-widest font-mono text-muted-foreground">
              suggested patch
            </h2>
            <DiffView patch={verification.patch} />
          </section>
        )}
      </main>
    </>
  );
}
