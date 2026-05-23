"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
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
    fetch("/api/eval").then((r) => r.json()).then((d) => setResults(d.results ?? []));
  }, []);

  const latest = results[0];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            evaluation
          </div>
          <h1 className="mt-2 text-3xl font-medium">Precision & recall on the seeded benchmark</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            We seed a small Python project with N documentation bugs of known type
            (renamed flag, wrong default, removed endpoint, etc) and run the full pipeline.
            True positives = seeded bugs the pipeline caught.
            False positives = claims it flagged that were actually fine.
            False negatives = seeded bugs it missed.
          </p>
        </div>

        {latest ? (
          <>
            <section className="grid sm:grid-cols-3 gap-3">
              <KpiCard label="Precision" value={`${(latest.precision * 100).toFixed(0)}%`} hint={`${latest.true_positive}/${latest.true_positive + latest.false_positive} flags correct`} tone="good" />
              <KpiCard label="Recall" value={`${(latest.recall * 100).toFixed(0)}%`} hint={`${latest.true_positive}/${latest.true_positive + latest.false_negative} seeded bugs caught`} tone="good" />
              <KpiCard label="F1" value={latest.f1.toFixed(2)} hint={`benchmark: ${latest.benchmark}`} tone="default" />
            </section>

            <section className="space-y-2">
              <h2 className="text-[11px] uppercase tracking-widest font-mono text-muted-foreground">runs</h2>
              <div className="rounded-xl border border-border divide-y divide-border/60 overflow-hidden">
                {results.map((r) => (
                  <div key={r.id} className="px-4 py-3 grid grid-cols-7 gap-3 items-center text-xs">
                    <div className="font-mono truncate col-span-2">{r.benchmark}</div>
                    <div className="font-mono text-muted-foreground">P {(r.precision * 100).toFixed(0)}%</div>
                    <div className="font-mono text-muted-foreground">R {(r.recall * 100).toFixed(0)}%</div>
                    <div className="font-mono text-muted-foreground">F1 {r.f1.toFixed(2)}</div>
                    <div className="font-mono text-muted-foreground tabular-nums">
                      {r.cost_cents != null ? `$${(r.cost_cents / 100).toFixed(3)}` : "—"}
                    </div>
                    <div className="font-mono text-muted-foreground text-right">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
            No eval runs yet. Run <code className="font-mono">pnpm tsx scripts/eval.ts</code> to seed the benchmark and record a result.
          </div>
        )}
      </main>
    </>
  );
}
