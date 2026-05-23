"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { BackgroundMesh } from "@/components/bg-mesh";
import { KpiCard } from "@/components/kpi-card";

type EvalRow = {
  id: string;
  benchmark: string;
  num_seeded: number;
  true_positive: number;
  false_positive: number;
  false_negative: number;
  precision: number;
  recall: number;
  f1: number;
  cost_cents: number | null;
  latency_ms: number | null;
  created_at: string;
};

export default function EvalPage() {
  const [results, setResults] = useState<EvalRow[]>([]);
  useEffect(() => {
    fetch("/api/eval")
      .then((r) => r.json())
      .then((d) => setResults(d.results ?? []));
  }, []);

  const latest = results[0];

  return (
    <>
      <BackgroundMesh />
      <Header />
      <main className="relative mx-auto max-w-5xl px-6 py-12 space-y-10">
        <div className="fade-up">
          <span className="mono-pill">evaluation</span>
          <h1 className="mt-3 text-4xl font-medium tracking-tight">
            Precision & recall on the seeded benchmark
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground/85 max-w-3xl leading-relaxed">
            A small Python project (<code className="font-mono text-foreground/90">tinyshop</code>) is
            seeded with intentional documentation drifts: renamed flags, wrong defaults, removed endpoints, mis-stated
            tax rates, version mismatches. The full pipeline runs and the flagged claims are matched against the
            ground-truth labels in <code className="font-mono text-foreground/90">benchmark/seeded.json</code>.
          </p>
        </div>

        {latest ? (
          <>
            <section className="grid sm:grid-cols-3 gap-3 fade-up fade-up-1">
              <KpiCard
                label="Precision"
                value={`${(latest.precision * 100).toFixed(0)}%`}
                numeric={latest.precision * 100}
                format={(n) => n.toFixed(0)}
                suffix="%"
                hint={`${latest.true_positive}/${latest.true_positive + latest.false_positive} flags correct`}
                tone="good"
                accent="green"
              />
              <KpiCard
                label="Recall"
                value={`${(latest.recall * 100).toFixed(0)}%`}
                numeric={latest.recall * 100}
                format={(n) => n.toFixed(0)}
                suffix="%"
                hint={`${latest.true_positive}/${latest.true_positive + latest.false_negative} seeded bugs caught`}
                tone="good"
                accent="blue"
              />
              <KpiCard
                label="F1"
                value={latest.f1.toFixed(2)}
                numeric={latest.f1}
                format={(n) => n.toFixed(2)}
                hint={`benchmark: ${latest.benchmark}`}
                accent="violet"
              />
            </section>

            <section className="space-y-3 fade-up fade-up-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="mono-pill">runs</div>
                  <h2 className="mt-2 text-sm font-medium">Recent evaluations</h2>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
                  {results.length} total
                </span>
              </div>
              <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden bg-card/30 backdrop-blur">
                <div className="px-4 py-2 grid grid-cols-7 gap-3 text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground/70">
                  <div className="col-span-2">benchmark</div>
                  <div>precision</div>
                  <div>recall</div>
                  <div>f1</div>
                  <div>cost</div>
                  <div className="text-right">when</div>
                </div>
                {results.map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-3 grid grid-cols-7 gap-3 items-center text-[12px]"
                  >
                    <div className="font-mono truncate col-span-2">{r.benchmark}</div>
                    <div className="font-mono text-emerald-300 tabular-nums">
                      {(r.precision * 100).toFixed(0)}%
                    </div>
                    <div className="font-mono text-sky-300 tabular-nums">
                      {(r.recall * 100).toFixed(0)}%
                    </div>
                    <div className="font-mono text-violet-300 tabular-nums">{r.f1.toFixed(2)}</div>
                    <div className="font-mono text-muted-foreground tabular-nums">
                      {r.cost_cents != null ? `$${(r.cost_cents / 100).toFixed(3)}` : "—"}
                    </div>
                    <div className="font-mono text-muted-foreground/70 text-right text-[11px]">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-xl border border-border/60 bg-gradient-to-b from-card/70 to-card/30 backdrop-blur p-8 text-center fade-up fade-up-1">
            <div className="text-2xl mb-2">∅</div>
            <div className="text-sm text-muted-foreground/85">No eval runs yet.</div>
            <div className="mt-2 text-[11px] font-mono text-muted-foreground/70">
              run <code className="px-1.5 py-0.5 rounded bg-muted/40 text-foreground/90">pnpm tsx scripts/eval.ts</code>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
