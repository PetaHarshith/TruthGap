"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { PipelineStream } from "@/components/pipeline-stream";
import { KpiCard } from "@/components/kpi-card";
import { VerdictBadge, SeverityBadge } from "@/components/verdict-badge";

type Verification = {
  id: string;
  verdict: string;
  confidence: number;
  severity: string;
  reasoning: string;
  claim_text: string;
  claim_type: string;
  source_file: string;
  source_lines: string;
};

type RepoData = {
  repo: {
    id: string;
    name: string;
    url: string;
    status: string;
    commit_sha: string | null;
    current_stage: string | null;
    kpis: {
      doc_health_score: number;
      drift_velocity: number;
      friction_surface: { section: string; unverified_pct: number; count: number }[];
      cost_cents: number;
      total_latency_ms: number;
    } | null;
    stats: Record<string, unknown> | null;
  };
  verifications: Verification[];
};

export default function RepoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<RepoData | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const refresh = useCallback(() => {
    fetch(`/api/repos/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!data) return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10 text-muted-foreground">loading…</main>
    </>
  );

  const { repo, verifications } = data;
  const isDone = repo.status === "done";

  const counts = verifications.reduce(
    (acc, v) => {
      acc[v.verdict] = (acc[v.verdict] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const filtered = filter === "all" ? verifications : verifications.filter((v) => v.verdict === filter);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              repo
            </div>
            <h1 className="text-2xl font-medium font-mono mt-1">{repo.name}</h1>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              <a href={repo.url} target="_blank" rel="noreferrer" className="hover:text-foreground">
                {repo.url.replace(/^https?:\/\//, "")}
              </a>
              {repo.commit_sha && <span> · @ {repo.commit_sha.slice(0, 7)}</span>}
            </div>
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            status:&nbsp;
            <span className={isDone ? "text-emerald-300" : repo.status === "failed" ? "text-red-300" : "text-amber-300"}>
              {repo.status}{repo.current_stage ? ` · ${repo.current_stage}` : ""}
            </span>
          </div>
        </div>

        {!isDone && repo.status !== "failed" && (
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest font-mono text-muted-foreground">pipeline</h2>
            <PipelineStream repoId={id} onDone={refresh} />
          </section>
        )}

        {isDone && repo.kpis && (
          <>
            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                label="Doc Health"
                value={`${(repo.kpis.doc_health_score * 100).toFixed(0)}%`}
                hint={`${counts.supported ?? 0} supported / ${verifications.length} claims`}
                tone={repo.kpis.doc_health_score > 0.85 ? "good" : repo.kpis.doc_health_score > 0.6 ? "warn" : "bad"}
              />
              <KpiCard
                label="Drift Velocity"
                value={String(repo.kpis.drift_velocity)}
                hint="contradictions found"
                tone={repo.kpis.drift_velocity === 0 ? "good" : repo.kpis.drift_velocity < 5 ? "warn" : "bad"}
              />
              <KpiCard
                label="Cost / repo"
                value={`$${(repo.kpis.cost_cents / 100).toFixed(3)}`}
                hint="LLM tokens · prompt caching on"
              />
              <KpiCard
                label="Latency"
                value={`${(repo.kpis.total_latency_ms / 1000).toFixed(1)}s`}
                hint="agent compute"
              />
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
                  claims · {verifications.length}
                </h2>
                <div className="flex gap-1 text-xs">
                  {(["all", "contradicted", "partial", "unverifiable", "supported"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 rounded-md font-mono uppercase tracking-wider border transition-colors ${
                        filter === f
                          ? "bg-foreground text-background border-foreground"
                          : "border-border hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {f}
                      {f !== "all" && counts[f] !== undefined && (
                        <span className="ml-1 opacity-70">{counts[f]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border divide-y divide-border/60 overflow-hidden">
                {filtered.length === 0 && (
                  <div className="px-4 py-8 text-sm text-muted-foreground text-center">No claims match this filter.</div>
                )}
                {filtered.map((v) => (
                  <Link
                    key={v.id}
                    href={`/repos/${id}/discrepancies/${v.id}`}
                    className="block px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm line-clamp-1">{v.claim_text}</div>
                        <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                          {v.source_file}:{v.source_lines.replace(/[\[\]\(\)]/g, "")} · {v.claim_type}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                          {(v.confidence * 100).toFixed(0)}%
                        </span>
                        <SeverityBadge severity={v.severity} />
                        <VerdictBadge verdict={v.verdict} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {repo.kpis.friction_surface.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
                  friction surface
                </h2>
                <div className="rounded-xl border border-border divide-y divide-border/60 overflow-hidden">
                  {repo.kpis.friction_surface.map((f) => (
                    <div key={f.section} className="px-4 py-2.5 flex items-center justify-between text-xs">
                      <span className="font-mono text-foreground/90 truncate">{f.section}</span>
                      <span className="font-mono text-muted-foreground">
                        {(f.unverified_pct * 100).toFixed(0)}% · {f.count} claims
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {repo.status === "failed" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300 font-mono">
            Pipeline failed.
          </div>
        )}
      </main>
    </>
  );
}
