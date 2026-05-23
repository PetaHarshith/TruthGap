import { sql } from "@/lib/db/client";
import { emitEvent, closeChannel } from "@/lib/events";
import { ingestRepo } from "@/lib/ingest";
import { extractClaims } from "@/lib/claims/extract";
import { scrapeSources } from "@/lib/scrape";
import { verifyClaims } from "@/lib/agents/verify";
import { synthesizePatches } from "@/lib/patch/synthesize";
import { computeKpis } from "@/lib/kpi/compute";

export async function runPipeline(repoId: string, url: string) {
  const started = Date.now();
  try {
    await sql()`UPDATE repos SET status = 'ingesting', current_stage = 'ingest' WHERE id = ${repoId}`;
    const ingest = await ingestRepo(repoId, url);

    await sql()`UPDATE repos SET status = 'scraping', current_stage = 'scrape' WHERE id = ${repoId}`;
    const scraped = await scrapeSources(repoId, ingest.dir, ingest.stats.links);

    await sql()`UPDATE repos SET status = 'extracting', current_stage = 'extract' WHERE id = ${repoId}`;
    const claimCount = await extractClaims(repoId);

    await sql()`UPDATE repos SET status = 'verifying', current_stage = 'verify' WHERE id = ${repoId}`;
    const { contradicted } = await verifyClaims(repoId, ingest.dir);

    await sql()`UPDATE repos SET status = 'synthesizing', current_stage = 'synthesize' WHERE id = ${repoId}`;
    await synthesizePatches(repoId, ingest.dir);

    await sql()`UPDATE repos SET current_stage = 'kpi' WHERE id = ${repoId}`;
    const kpis = await computeKpis(repoId);

    const stats = {
      files: ingest.stats.files,
      doc_files: ingest.stats.doc_files,
      code_files: ingest.stats.code_files,
      chunks: ingest.stats.chunks,
      claims: claimCount,
      external_sources: scraped,
      contradicted,
      duration_ms: Date.now() - started,
    };
    await sql()`
      UPDATE repos SET
        status = 'done',
        current_stage = NULL,
        finished_at = now(),
        stats = stats || ${sql().json(JSON.parse(JSON.stringify(stats)))}
      WHERE id = ${repoId}
    `;
    emitEvent(repoId, { stage: "done", level: "stage-done", message: `Pipeline done in ${((Date.now() - started) / 1000).toFixed(1)}s · ${contradicted} drifts · Doc Health ${(kpis.doc_health_score * 100).toFixed(0)}%`, data: stats });
  } catch (err) {
    const msg = (err as Error).message;
    await sql()`UPDATE repos SET status = 'failed', error = ${msg}, finished_at = now() WHERE id = ${repoId}`;
    emitEvent(repoId, { stage: "error", level: "error", message: msg });
  } finally {
    setTimeout(() => closeChannel(repoId), 5 * 60 * 1000);
  }
}
