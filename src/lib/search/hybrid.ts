import { sql } from "@/lib/db/client";
import { embed } from "@/lib/llm/embed";

export type SearchHit = {
  chunk_id: string;
  kind: "doc" | "code" | "external";
  content: string;
  meta: Record<string, unknown>;
  bm25_rank: number | null;
  vec_rank: number | null;
  rrf_score: number;
};

const RRF_K = 60;

/**
 * Hybrid retrieval: BM25 (Postgres tsvector ts_rank) ⊕ vector cosine via pgvector,
 * fused with Reciprocal Rank Fusion.
 */
export async function hybridSearch(opts: {
  repoId: string;
  query: string;
  kind?: "doc" | "code" | "external";
  k?: number;
}): Promise<SearchHit[]> {
  const k = opts.k ?? 6;
  const candidate_n = Math.max(k * 4, 20);

  const [queryEmb] = await embed([opts.query]);
  const embStr = queryEmb ? `[${queryEmb.join(",")}]` : null;

  const kindClause = opts.kind ? sql()`AND kind = ${opts.kind}` : sql()``;

  const bm25 = await sql()<{ id: string; content: string; meta: Record<string, unknown>; kind: string; rank: number }[]>`
    SELECT id, content, meta, kind,
           ts_rank(content_tsv, websearch_to_tsquery('english', ${opts.query})) AS rank
    FROM chunks
    WHERE repo_id = ${opts.repoId}
      AND content_tsv @@ websearch_to_tsquery('english', ${opts.query})
      ${kindClause}
    ORDER BY rank DESC
    LIMIT ${candidate_n}
  `;

  const vec = embStr
    ? await sql()<{ id: string; content: string; meta: Record<string, unknown>; kind: string; distance: number }[]>`
        SELECT id, content, meta, kind, embedding <=> ${embStr}::vector AS distance
        FROM chunks
        WHERE repo_id = ${opts.repoId}
          AND embedding IS NOT NULL
          ${kindClause}
        ORDER BY embedding <=> ${embStr}::vector
        LIMIT ${candidate_n}
      `
    : [];

  const byId = new Map<string, SearchHit>();
  bm25.forEach((row, i) => {
    byId.set(row.id, {
      chunk_id: row.id,
      kind: row.kind as SearchHit["kind"],
      content: row.content,
      meta: row.meta,
      bm25_rank: i + 1,
      vec_rank: null,
      rrf_score: 1 / (RRF_K + i + 1),
    });
  });
  vec.forEach((row, i) => {
    const existing = byId.get(row.id);
    if (existing) {
      existing.vec_rank = i + 1;
      existing.rrf_score += 1 / (RRF_K + i + 1);
    } else {
      byId.set(row.id, {
        chunk_id: row.id,
        kind: row.kind as SearchHit["kind"],
        content: row.content,
        meta: row.meta,
        bm25_rank: null,
        vec_rank: i + 1,
        rrf_score: 1 / (RRF_K + i + 1),
      });
    }
  });

  return [...byId.values()].sort((a, b) => b.rrf_score - a.rrf_score).slice(0, k);
}
