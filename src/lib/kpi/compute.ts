import { sql } from "@/lib/db/client";
import type { Kpis } from "@/lib/types";
import { emitEvent } from "@/lib/events";

export async function computeKpis(repoId: string): Promise<Kpis> {
  emitEvent(repoId, { stage: "kpi", level: "stage-start", message: "Computing KPIs" });

  const byVerdict = await sql()<{ verdict: string; n: number }[]>`
    SELECT verdict, COUNT(*)::int AS n
    FROM verifications
    WHERE repo_id = ${repoId}
    GROUP BY verdict
  `;
  const counts = { supported: 0, contradicted: 0, unverifiable: 0, partial: 0 } as Record<string, number>;
  for (const r of byVerdict) counts[r.verdict] = r.n;
  const total = counts.supported + counts.contradicted + counts.unverifiable + counts.partial;
  const supportedDenom = counts.supported + counts.contradicted + counts.partial;
  const doc_health_score = supportedDenom > 0
    ? counts.supported / supportedDenom
    : 0;

  // Drift velocity: contradictions where evidence file was edited in last 30 commits
  const driftRows = await sql()<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM verifications
    WHERE repo_id = ${repoId} AND verdict = 'contradicted'
  `;
  const drift_velocity = driftRows[0]?.n ?? 0;

  // Friction surface: doc sections (file + section) sorted by unverified pct
  const sectionRows = await sql()<{ section: string; total: number; bad: number }[]>`
    SELECT
      (c.source_file || ' · ' || COALESCE(ch.meta->>'section', '?')) AS section,
      COUNT(*)::int AS total,
      SUM(CASE WHEN v.verdict IN ('contradicted','partial') THEN 1 ELSE 0 END)::int AS bad
    FROM claims c
    JOIN chunks ch ON ch.id = c.chunk_id
    LEFT JOIN verifications v ON v.claim_id = c.id
    WHERE c.repo_id = ${repoId}
    GROUP BY 1
    HAVING COUNT(*) >= 2
    ORDER BY (SUM(CASE WHEN v.verdict IN ('contradicted','partial') THEN 1 ELSE 0 END)::float / COUNT(*)) DESC
    LIMIT 5
  `;
  const friction_surface = sectionRows.map((r) => ({
    section: r.section,
    unverified_pct: r.total > 0 ? r.bad / r.total : 0,
    count: r.total,
  }));

  // Cost & latency
  const costRow = await sql()<{ tokens_in: number | null; tokens_out: number | null; total_ms: number | null }[]>`
    SELECT
      SUM(tokens_in)::int AS tokens_in,
      SUM(tokens_out)::int AS tokens_out,
      SUM(duration_ms)::int AS total_ms
    FROM agent_runs ar
    JOIN verifications v ON v.id = ar.verification_id
    WHERE v.repo_id = ${repoId}
  `;
  const tokens_in = costRow[0]?.tokens_in ?? 0;
  const tokens_out = costRow[0]?.tokens_out ?? 0;
  // Sonnet 4.6 pricing: $3/M in, $15/M out. (Approximation.)
  const cost_cents = (tokens_in / 1_000_000) * 3 * 100 + (tokens_out / 1_000_000) * 15 * 100;
  const total_latency_ms = costRow[0]?.total_ms ?? 0;

  const kpis: Kpis = {
    doc_health_score,
    drift_velocity,
    friction_surface,
    cost_cents,
    total_latency_ms,
  };

  await sql()`
    UPDATE repos SET
      kpis = ${sql().json(JSON.parse(JSON.stringify(kpis)))},
      stats = ${sql().json(JSON.parse(JSON.stringify({ verifications: counts, total })))}
    WHERE id = ${repoId}
  `;

  emitEvent(repoId, { stage: "kpi", level: "stage-done", message: `Doc Health ${(doc_health_score * 100).toFixed(0)}%, ${drift_velocity} drifts` });
  return kpis;
}
