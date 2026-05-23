/**
 * Eval harness — runs the full TruthGap pipeline against the seeded benchmark
 * and computes precision / recall / F1 against the labeled ground truth.
 *
 * Usage:  pnpm tsx scripts/eval.ts
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
// Load .env.local first (matches Next.js dev convention), .env as fallback.
loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv();

import { readFile, stat, rename } from "node:fs/promises";
import { simpleGit } from "simple-git";
import { sql, ensureSchema } from "../src/lib/db/client";
import { runPipeline } from "../src/lib/pipeline";

async function exists(p: string) {
  try { await stat(p); return true; } catch { return false; }
}

// The benchmark ships with its git history under `_seed_git/` (since a nested
// `.git/` directory can't be tracked by the parent repo without becoming a
// submodule). Restore it to `.git/` on first run so the History Agent has a
// real history to query. Fall back to a fresh init if even the seed is gone.
async function ensureBenchmarkGit(repoPath: string) {
  const dotGit = path.join(repoPath, ".git");
  if (await exists(dotGit)) return;
  const seed = path.join(repoPath, "_seed_git");
  if (await exists(seed)) {
    await rename(seed, dotGit);
    return;
  }
  const git = simpleGit(repoPath);
  await git.init();
  await git.addConfig("user.email", "eval@truthgap.local");
  await git.addConfig("user.name", "TruthGap Eval");
  await git.add(".");
  await git.commit("seeded benchmark");
}

type Seed = {
  benchmark: string;
  expected_drifts: { id: string; summary: string; match_any: string[]; type: string }[];
};

async function main() {
  await ensureSchema();

  const seedPath = path.join(process.cwd(), "benchmark/seeded.json");
  const seed = JSON.parse(await readFile(seedPath, "utf8")) as Seed;
  console.log(`benchmark: ${seed.benchmark} — ${seed.expected_drifts.length} seeded drifts`);

  // Use a file:// URL so simple-git clones from the local benchmark git repo.
  const benchmarkRepo = path.join(process.cwd(), "benchmark/sample");
  await ensureBenchmarkGit(benchmarkRepo);
  const url = `file://${benchmarkRepo}`;
  const name = "tinyshop@seeded-v1";

  const repos = await sql()<{ id: string }[]>`
    INSERT INTO repos (url, name, status, current_stage)
    VALUES (${url}, ${name}, 'pending', 'queued')
    RETURNING id
  `;
  const repoId = repos[0].id;
  console.log(`repo_id: ${repoId}`);

  const start = Date.now();
  await runPipeline(repoId, url);
  const elapsed = Date.now() - start;
  console.log(`\npipeline complete in ${(elapsed / 1000).toFixed(1)}s`);

  // Pull all verifications + claim texts
  const rows = await sql()<{
    verdict: string;
    confidence: number;
    claim_text: string;
    source_file: string;
  }[]>`
    SELECT v.verdict, v.confidence, c.text AS claim_text, c.source_file
    FROM verifications v
    JOIN claims c ON c.id = v.claim_id
    WHERE v.repo_id = ${repoId}
  `;
  const flagged = rows.filter((r) => r.verdict === "contradicted" || r.verdict === "partial");
  console.log(`\nverifications: ${rows.length} total, ${flagged.length} flagged`);

  // Match seeded drifts against flagged claims
  let tp = 0;
  const seenSeedIds = new Set<string>();
  const matchedFlags = new Set<number>();
  const detail: { seed_id: string; matched: boolean; claim?: string }[] = [];

  for (const drift of seed.expected_drifts) {
    let matched: { idx: number; claim: string } | null = null;
    for (let i = 0; i < flagged.length; i++) {
      if (matchedFlags.has(i)) continue;
      const f = flagged[i];
      const text = f.claim_text.toLowerCase();
      const hit = drift.match_any.some((needle) => text.includes(needle.toLowerCase()));
      if (hit) {
        matched = { idx: i, claim: f.claim_text };
        break;
      }
    }
    if (matched) {
      tp++;
      matchedFlags.add(matched.idx);
      seenSeedIds.add(drift.id);
      detail.push({ seed_id: drift.id, matched: true, claim: matched.claim });
    } else {
      detail.push({ seed_id: drift.id, matched: false });
    }
  }

  const fn = seed.expected_drifts.length - tp;
  const fp = flagged.length - tp;
  const precision = flagged.length === 0 ? 0 : tp / flagged.length;
  const recall = seed.expected_drifts.length === 0 ? 0 : tp / seed.expected_drifts.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  console.log(`\n=== RESULTS ===`);
  console.log(`TP=${tp}  FP=${fp}  FN=${fn}`);
  console.log(`precision = ${(precision * 100).toFixed(1)}%`);
  console.log(`recall    = ${(recall * 100).toFixed(1)}%`);
  console.log(`F1        = ${f1.toFixed(3)}`);

  // Pull cost from agent_runs (mirrors what KPI computes)
  const costRow = await sql()<{ ti: number | null; to: number | null; ms: number | null }[]>`
    SELECT SUM(tokens_in)::int AS ti, SUM(tokens_out)::int AS "to", SUM(duration_ms)::int AS ms
    FROM agent_runs ar JOIN verifications v ON v.id = ar.verification_id
    WHERE v.repo_id = ${repoId}
  `;
  const tokensIn = costRow[0]?.ti ?? 0;
  const tokensOut = costRow[0]?.to ?? 0;
  const cost_cents = (tokensIn / 1_000_000) * 3 * 100 + (tokensOut / 1_000_000) * 15 * 100;

  await sql()`
    INSERT INTO eval_results
      (repo_id, benchmark, num_seeded, true_positive, false_positive, false_negative, precision, recall, f1, cost_cents, latency_ms, detail)
    VALUES (
      ${repoId},
      ${seed.benchmark},
      ${seed.expected_drifts.length},
      ${tp}, ${fp}, ${fn},
      ${precision}, ${recall}, ${f1},
      ${cost_cents},
      ${elapsed},
      ${sql().json(JSON.parse(JSON.stringify({ detail, tokens_in: tokensIn, tokens_out: tokensOut })))}
    )
  `;

  console.log(`\nresult saved to eval_results.`);
  console.log(`\nMissed seeded drifts:`);
  for (const d of detail.filter((x) => !x.matched)) {
    const seedRow = seed.expected_drifts.find((s) => s.id === d.seed_id)!;
    console.log(`  - ${d.seed_id}: ${seedRow.summary}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
