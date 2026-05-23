"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RepoRow = {
  id: string;
  name: string;
  url: string;
  status: string;
  current_stage: string | null;
  created_at: string;
};

const SAMPLES = [
  { label: "tiangolo/fastapi", url: "https://github.com/tiangolo/fastapi" },
  { label: "psf/requests", url: "https://github.com/psf/requests" },
  { label: "pallets/flask", url: "https://github.com/pallets/flask" },
];

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/repos").then((r) => r.json()).then((d) => setRepos(d.repos ?? []));
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
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-20">
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            multi-agent verification
          </div>
          <h1 className="text-5xl md:text-6xl font-medium tracking-tight">
            Does your documentation match your code?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            TruthGap reads your repo and its docs side by side, runs a 3-agent verification panel
            on every claim, and tells you exactly where the docs have drifted from reality —
            with evidence, with confidence, and with a suggested fix.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-10 flex gap-2 max-w-2xl">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/tiangolo/fastapi"
            className="flex-1 font-mono h-12 text-sm"
            autoFocus
          />
          <Button type="submit" disabled={submitting || !url} className="h-12 px-6">
            {submitting ? "starting…" : "Analyze →"}
          </Button>
        </form>
        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono uppercase tracking-wider">try</span>
          {SAMPLES.map((s) => (
            <button
              key={s.url}
              type="button"
              onClick={() => setUrl(s.url)}
              className="font-mono hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              {s.label}
            </button>
          ))}
        </div>

        <section className="mt-20 grid md:grid-cols-3 gap-4">
          <Stage
            n={1}
            title="Ingest & index"
            body="Clone, tree-walk, parse Python symbols and Markdown sections. Embed every chunk with OpenAI; index with Postgres BM25 + pgvector. Hybrid retrieval ready."
          />
          <Stage
            n={2}
            title="Extract & scrape"
            body="LLM with strict JSON schema extracts atomic claims from docs. cheerio scrapes linked pages and dependency CHANGELOGs, all folded into the same hybrid corpus."
          />
          <Stage
            n={3}
            title="3-agent verify"
            body="Code, History, and Web agents each verify the claim with bounded tool-use loops. A consolidator merges their votes into a final verdict, severity, and suggested patch."
          />
        </section>

        {repos.length > 0 && (
          <section className="mt-20">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Recent runs
            </div>
            <div className="rounded-xl border border-border divide-y divide-border/60 overflow-hidden">
              {repos.slice(0, 8).map((r) => (
                <Link
                  href={`/repos/${r.id}`}
                  key={r.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <StatusDot status={r.status} />
                    <span>{r.status}{r.current_stage ? ` · ${r.current_stage}` : ""}</span>
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

function Stage({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-5">
      <div className="text-xs font-mono text-muted-foreground">0{n}</div>
      <div className="mt-1 font-medium">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls = {
    done: "bg-emerald-400",
    failed: "bg-red-400",
    pending: "bg-zinc-400",
  }[status] ?? "bg-amber-400 animate-pulse";
  return <span className={`w-1.5 h-1.5 rounded-full ${cls}`} />;
}
