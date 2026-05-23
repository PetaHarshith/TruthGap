"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { BackgroundMesh } from "@/components/bg-mesh";
import { PipelineStream } from "@/components/pipeline-stream";
import { KpiCard } from "@/components/kpi-card";
import { VerdictBadge, SeverityBadge } from "@/components/verdict-badge";
import { VerdictBar } from "@/components/verdict-bar";
import { LiveDot } from "@/components/live-dot";
import { Explainer } from "@/components/explainer";

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

  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/repos/${id}`);
    if (r.status === 404) {
      setNotFound(true);
      return;
    }
    const json = await r.json().catch(() => null);
    if (!json?.repo) return;
    setData(json);
  }, [id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  if (notFound)
    return (
      <>
        <BackgroundMesh />
        <Header />
        <main className="mx-auto max-w-7xl px-6 py-20 text-center">
          <div className="mono-pill mb-4 inline-block">404</div>
          <h1 className="text-2xl font-medium">Repo not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This run may have been deleted or the id is wrong.
          </p>
          <a href="/" className="mt-6 inline-block font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← back to home
          </a>
        </main>
      </>
    );

  if (!data || !data.repo)
    return (
      <>
        <BackgroundMesh />
        <Header />
        <main className="mx-auto max-w-7xl px-6 py-12">
          <Skeleton />
        </main>
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

  const filtered =
    filter === "all" ? verifications : verifications.filter((v) => v.verdict === filter);

  return (
    <>
      <BackgroundMesh />
      <Header />
      <main className="relative mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Repo header */}
        <div className="flex items-start justify-between gap-3 flex-wrap fade-up">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="mono-pill">repo</span>
              <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">
                {id.slice(0, 8)}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-medium tracking-tight h-grad">{repo.name}</h1>
            <div className="mt-2 text-[12.5px] text-muted-foreground/80 flex items-center gap-2 flex-wrap">
              <a
                href={repo.url.startsWith("file:") ? "#" : repo.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors truncate max-w-[400px] font-mono text-[11.5px]"
              >
                {repo.url.replace(/^https?:\/\//, "")}
              </a>
              {repo.commit_sha && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-mono text-[11.5px]">@ {repo.commit_sha.slice(0, 7)}</span>
                </>
              )}
            </div>
          </div>
          <StatusPill status={repo.status} stage={repo.current_stage ?? undefined} />
        </div>

        {/* Pipeline view while running */}
        {!isDone && repo.status !== "failed" && (
          <section className="space-y-3 fade-up fade-up-1">
            <div className="flex items-center gap-2">
              <span className="mono-pill inline-flex items-center gap-1.5">
                <LiveDot color="amber" />
                pipeline
              </span>
              <span className="text-[11px] font-mono text-muted-foreground/70">
                analyzing in real time
              </span>
            </div>
            <PipelineStream repoId={id} onDone={refresh} />
          </section>
        )}

        {isDone && repo.kpis && (
          <>
            <Explainer
              title={`We checked ${verifications.length} claims your docs make. ${counts.contradicted ?? 0} of them disagree with your code.`}
              body={
                <>
                  Click any <span className="text-red-300 font-medium">contradicted</span> claim
                  to see the evidence — what the doc said, what the code actually does, the agent
                  trace, and a one-click doc patch you can paste into a PR.{" "}
                  <span className="text-muted-foreground/70">
                    Nothing in your repo has been modified. TruthGap is read-only.
                  </span>
                </>
              }
              variant="emerald"
              className="fade-up"
            />

            {/* KPIs */}
            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 fade-up fade-up-1">
              <KpiCard
                label="Doc Health"
                value={`${(repo.kpis.doc_health_score * 100).toFixed(0)}%`}
                numeric={repo.kpis.doc_health_score * 100}
                format={(n) => n.toFixed(0)}
                suffix="%"
                hint={`${counts.supported ?? 0} of ${verifications.length} claims match the code`}
                tooltip="% of claims the code agrees with. Higher = better. supported / (supported + contradicted + partial)."
                tone={
                  repo.kpis.doc_health_score > 0.85
                    ? "good"
                    : repo.kpis.doc_health_score > 0.6
                      ? "warn"
                      : "bad"
                }
                accent={
                  repo.kpis.doc_health_score > 0.85
                    ? "green"
                    : repo.kpis.doc_health_score > 0.6
                      ? "amber"
                      : "red"
                }
              />
              <KpiCard
                label="Drifts Found"
                value={String(repo.kpis.drift_velocity)}
                numeric={repo.kpis.drift_velocity}
                hint="doc sentences that lie about the code"
                tooltip="Claims the agents flagged as contradicted by the code. Each has a suggested patch."
                tone={
                  repo.kpis.drift_velocity === 0
                    ? "good"
                    : repo.kpis.drift_velocity < 5
                      ? "warn"
                      : "bad"
                }
                accent={
                  repo.kpis.drift_velocity === 0
                    ? "green"
                    : repo.kpis.drift_velocity < 5
                      ? "amber"
                      : "red"
                }
              />
              <KpiCard
                label="Cost"
                value={`$${(repo.kpis.cost_cents / 100).toFixed(3)}`}
                numeric={repo.kpis.cost_cents / 100}
                format={(n) => `$${n.toFixed(3)}`}
                hint="total Claude spend for this run"
                tooltip="Total Claude API spend for this run. Prompt caching is on."
                accent="blue"
              />
              <KpiCard
                label="Compute Time"
                value={`${(repo.kpis.total_latency_ms / 1000).toFixed(1)}s`}
                numeric={repo.kpis.total_latency_ms / 1000}
                format={(n) => `${n.toFixed(1)}`}
                suffix="s"
                hint="time agents spent on Claude calls"
                tooltip="Total seconds across all agent API calls. Rate-limit throttling extends wall-clock time on top."
                accent="violet"
              />
            </section>

            {/* Verdict bar */}
            <section className="rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur p-6 fade-up fade-up-2">
              <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
                <div>
                  <h3 className="text-base font-medium">How each claim was judged</h3>
                  <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
                    Every claim is investigated by three independent agents and given one of four verdicts.
                  </p>
                </div>
                <span className="text-[12px] text-muted-foreground tabular-nums shrink-0">
                  <span className="text-foreground/90 text-base font-medium">{verifications.length}</span>{" "}
                  verified claims
                </span>
              </div>
              <VerdictBar counts={counts} />
            </section>

            {/* Claims list */}
            <section className="space-y-3 fade-up fade-up-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-medium">Every claim, individually</h3>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground/80">
                    Click any row to open the case file with full evidence and a suggested patch.
                  </p>
                </div>
                <div className="flex gap-1 text-xs">
                  {(["all", "contradicted", "partial", "unverifiable", "supported"] as const).map(
                    (f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-md font-mono text-[10.5px] uppercase tracking-[0.1em] border transition-all ${
                          filter === f
                            ? "bg-foreground text-background border-foreground"
                            : "border-border/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f}
                        {f !== "all" && counts[f] !== undefined && (
                          <span className="ml-1.5 opacity-60 tabular-nums">{counts[f]}</span>
                        )}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden bg-card/30 backdrop-blur">
                {filtered.length === 0 && (
                  <div className="px-4 py-10 text-sm text-muted-foreground text-center">
                    No claims match this filter.
                  </div>
                )}
                {filtered.map((v) => (
                  <Link
                    key={v.id}
                    href={`/repos/${id}/discrepancies/${v.id}`}
                    className={`group flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors relative ${
                      v.verdict === "contradicted"
                        ? "border-l-2 border-l-red-500/60"
                        : v.verdict === "partial"
                          ? "border-l-2 border-l-amber-500/50"
                          : v.verdict === "supported"
                            ? "border-l-2 border-l-emerald-500/40"
                            : "border-l-2 border-l-zinc-500/30"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] line-clamp-1 text-foreground/95">
                        {v.claim_text}
                      </div>
                      <div className="mt-1 text-[10.5px] font-mono text-muted-foreground/70 flex items-center gap-2">
                        <span>{v.source_file}</span>
                        <span className="opacity-40">·</span>
                        <span>L{v.source_lines.replace(/[\[\]\(\)]/g, "")}</span>
                        <span className="opacity-40">·</span>
                        <span className="opacity-90">{v.claim_type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10.5px] font-mono text-muted-foreground/70 tabular-nums">
                        {(v.confidence * 100).toFixed(0)}%
                      </span>
                      <SeverityBadge severity={v.severity} />
                      <VerdictBadge verdict={v.verdict} />
                      <span className="text-[12px] text-muted-foreground/40 group-hover:text-foreground transition-colors">
                        →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Friction surface */}
            {repo.kpis.friction_surface.length > 0 && (
              <section className="space-y-3 fade-up fade-up-4">
                <div>
                  <h3 className="text-base font-medium">Where the bugs cluster</h3>
                  <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
                    Doc sections ranked by what fraction of their claims disagree with the code.
                    The number on the right shows{" "}
                    <span className="text-foreground/90">flagged / total</span> claims in that section.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/50 divide-y divide-border/40 overflow-hidden bg-gradient-to-b from-card/80 to-card/40 backdrop-blur">
                  {repo.kpis.friction_surface.map((f) => {
                    const flagged = Math.round(f.unverified_pct * f.count);
                    const pct = (f.unverified_pct * 100).toFixed(0);
                    return (
                      <div
                        key={f.section}
                        className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
                      >
                        <span className="font-mono text-[12.5px] text-foreground/90 truncate flex-1">
                          {f.section}
                        </span>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="w-40 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${f.unverified_pct * 100}%`,
                                background: `linear-gradient(90deg, oklch(0.78 0.18 70), oklch(0.7 0.19 22))`,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[12px] text-foreground/95 tabular-nums w-28 text-right">
                            <span className="text-red-300">{flagged}</span>
                            <span className="text-muted-foreground/60">/{f.count}</span>
                            <span className="ml-2 text-muted-foreground/70">{pct}%</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
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

function StatusPill({ status, stage }: { status: string; stage?: string }) {
  const isRunning =
    status !== "done" && status !== "failed" && status !== "pending";
  const tone =
    status === "done"
      ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/5"
      : status === "failed"
        ? "text-red-300 border-red-500/30 bg-red-500/5"
        : "text-amber-300 border-amber-500/30 bg-amber-500/5";
  return (
    <div
      className={`rounded-lg border px-3 py-1.5 text-[11px] font-mono flex items-center gap-2 ${tone}`}
    >
      {isRunning ? <span className="spinner" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      <span className="uppercase tracking-[0.1em]">{status}</span>
      {stage && (
        <>
          <span className="opacity-50">·</span>
          <span className="opacity-90">{stage}</span>
        </>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-6 w-32 rounded bg-muted/40 animate-pulse" />
        <div className="h-10 w-72 rounded bg-muted/40 animate-pulse" />
        <div className="h-4 w-96 rounded bg-muted/40 animate-pulse" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
