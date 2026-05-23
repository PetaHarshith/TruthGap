"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { BackgroundMesh } from "@/components/bg-mesh";
import { LiveDot } from "@/components/live-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RepoRow = {
  id: string;
  name: string;
  url: string;
  status: string;
  current_stage: string | null;
  created_at: string;
  kpis: { doc_health_score?: number; drift_velocity?: number } | null;
};

const SAMPLES = [
  { label: "tinyshop (benchmark)", url: "file:///Users/harshithpeta/developer/truthgap/benchmark/sample" },
  { label: "psf/requests", url: "https://github.com/psf/requests" },
  { label: "tiangolo/fastapi", url: "https://github.com/tiangolo/fastapi" },
];

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/repos")
      .then((r) => r.json())
      .then((d) => setRepos(d.repos ?? []));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      router.push(`/repos/${data.repoId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <>
      <BackgroundMesh />
      <Header />

      <main className="relative mx-auto max-w-6xl px-6 py-24">
        {/* HERO */}
        <div className="relative">
          <div className="flex items-center gap-2 fade-up">
            <span className="mono-pill inline-flex items-center gap-1.5">
              <LiveDot color="emerald" />
              multi-agent verification
            </span>
            <span className="mono-pill">+ hybrid RAG · + web scrape</span>
          </div>

          <h1 className="mt-6 text-[56px] md:text-[68px] leading-[1.02] font-medium tracking-[-0.025em] text-gradient fade-up fade-up-1">
            Your docs are lying.
            <br />
            <span className="text-muted-foreground/80">TruthGap proves it.</span>
          </h1>

          <p className="mt-6 text-[17px] text-muted-foreground/85 max-w-2xl leading-relaxed fade-up fade-up-2">
            Paste a GitHub repo. A panel of three specialist agents — Code, History, and Web —
            verify every claim your documentation makes, with evidence, a confidence score,
            and a suggested fix. Powered by hybrid BM25 + embedding retrieval, prompt-cached
            Claude, and live web scraping of your dependency CHANGELOGs.
          </p>

          <form onSubmit={onSubmit} className="mt-10 flex gap-2 max-w-2xl fade-up fade-up-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 font-mono text-xs">
                →
              </span>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/tiangolo/fastapi"
                className="pl-8 font-mono h-12 text-sm bg-card/40 border-border/60 focus-visible:ring-emerald-500/30"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              disabled={submitting || !url}
              className="h-12 px-6 bg-foreground text-background hover:bg-foreground/90 font-medium"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="spinner" /> starting
                </span>
              ) : (
                "Analyze →"
              )}
            </Button>
          </form>
          {error && (
            <div className="mt-3 text-xs font-mono text-red-300 max-w-2xl">{error}</div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-1.5 fade-up fade-up-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60 mr-1">
              try
            </span>
            {SAMPLES.map((s) => (
              <button
                key={s.url}
                type="button"
                onClick={() => setUrl(s.url)}
                className="font-mono text-[11px] px-2.5 py-1 rounded-full border border-border/40 bg-card/40 hover:bg-card/80 hover:border-border transition-all text-muted-foreground hover:text-foreground"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* PIPELINE FLOW */}
        <section className="mt-28 fade-up fade-up-4">
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <div>
              <div className="mono-pill">how it works</div>
              <h2 className="mt-3 text-2xl font-medium tracking-tight">
                Nine stages, three agents, one verdict.
              </h2>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Stage
              n="01"
              title="Ingest & index"
              tools="tree-sitter · pgvector · BM25"
              body="Clone repo, parse Python symbols and Markdown sections, embed every chunk with OpenAI, and index for hybrid retrieval."
              accent="blue"
            />
            <Stage
              n="02"
              title="Extract & scrape"
              tools="Claude · cheerio · deps"
              body="LLM with strict JSON schema extracts atomic claims. cheerio scrapes linked pages and dependency CHANGELOGs into the same hybrid corpus."
              accent="green"
            />
            <Stage
              n="03"
              title="3-agent verify"
              tools="code · history · web → consolidator"
              body="Three bounded tool-use loops vote in parallel. A consolidator merges into final verdict, severity, evidence, and a unified diff patch."
              accent="violet"
            />
          </div>
        </section>

        {/* AGENT ROW */}
        <section className="mt-12 fade-up fade-up-4">
          <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card/60 to-card/20 backdrop-blur p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <AgentChip
                agent="code"
                color="oklch(0.6 0.22 250)"
                title="Code Agent"
                tools={["grep", "read_file", "lookup_symbol"]}
                blurb="Walks the AST and source to verify what the code actually does."
              />
              <AgentChip
                agent="history"
                color="oklch(0.65 0.22 303)"
                title="History Agent"
                tools={["git_log", "git_blame", "diff_range"]}
                blurb="Inspects git history to detect when a claim recently drifted."
              />
              <AgentChip
                agent="web"
                color="oklch(0.7 0.18 162)"
                title="Web Agent"
                tools={["hybrid_search", "read_url"]}
                blurb="Cross-checks claims against scraped dep CHANGELOGs and linked docs via BM25 + embedding fused retrieval."
              />
            </div>
          </div>
        </section>

        {/* RECENT RUNS */}
        {repos.length > 0 && (
          <section className="mt-20 fade-up fade-up-4">
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="mono-pill">recent runs</div>
                <h2 className="mt-3 text-xl font-medium tracking-tight">Past analyses</h2>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground/70">
                {repos.length} total
              </span>
            </div>
            <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden bg-card/30 backdrop-blur">
              {repos.slice(0, 8).map((r) => (
                <Link
                  href={`/repos/${r.id}`}
                  key={r.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusDot status={r.status} />
                    <span className="font-mono text-sm truncate">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground/80">
                    {r.kpis?.doc_health_score !== undefined && (
                      <span className="tabular-nums">
                        health {(r.kpis.doc_health_score * 100).toFixed(0)}%
                      </span>
                    )}
                    {r.kpis?.drift_velocity !== undefined && (
                      <span className="tabular-nums">{r.kpis.drift_velocity} drifts</span>
                    )}
                    <span className="text-muted-foreground/60">
                      {r.status}
                      {r.current_stage ? ` · ${r.current_stage}` : ""}
                    </span>
                    <span className="text-muted-foreground/40 group-hover:text-foreground transition-colors">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

      </main>
    </>
  );
}

function Stage({
  n,
  title,
  tools,
  body,
  accent,
}: {
  n: string;
  title: string;
  tools: string;
  body: string;
  accent: "blue" | "green" | "violet";
}) {
  const accentColor = {
    blue: "oklch(0.6 0.22 250)",
    green: "oklch(0.7 0.18 162)",
    violet: "oklch(0.65 0.22 303)",
  }[accent];
  return (
    <div className="group relative rounded-xl border border-border/60 bg-gradient-to-b from-card/70 to-card/20 backdrop-blur p-5 hover:border-border transition-all">
      <span
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono tabular-nums text-muted-foreground/70">{n}</span>
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: accentColor }}
        />
      </div>
      <div className="mt-4 text-lg font-medium tracking-tight">{title}</div>
      <div className="mt-1 text-[10.5px] font-mono uppercase tracking-[0.1em] text-muted-foreground/70">
        {tools}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground/85 leading-relaxed">{body}</p>
    </div>
  );
}

function AgentChip({
  color,
  title,
  tools,
  blurb,
}: {
  agent: string;
  color: string;
  title: string;
  tools: string[];
  blurb: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <div className="font-mono text-[12px] uppercase tracking-[0.1em]" style={{ color }}>
          {title}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tools.map((t) => (
          <span
            key={t}
            className="text-[10.5px] font-mono px-1.5 py-0.5 rounded border border-border/50 bg-background/40 text-muted-foreground/90"
          >
            {t}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted-foreground/80 leading-relaxed">{blurb}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "done") return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />;
  if (status === "failed") return <span className="w-1.5 h-1.5 rounded-full bg-red-400" />;
  return <LiveDot color="amber" />;
}
