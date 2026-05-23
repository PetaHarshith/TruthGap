import { cloneRepo } from "./clone";
import { walkRepo, readFileSafe } from "./walk";
import { chunkMarkdown } from "./markdown";
import { parsePython, symbolToChunk } from "./python";
import { embed } from "@/lib/llm/embed";
import { sql } from "@/lib/db/client";
import { emitEvent } from "@/lib/events";

export type IngestResult = {
  repoId: string;
  dir: string;
  commitSha: string;
  defaultBranch: string;
  stats: {
    files: number;
    doc_files: number;
    code_files: number;
    chunks: number;
    doc_chunks: number;
    code_chunks: number;
    links: string[];
  };
};

export async function ingestRepo(
  repoId: string,
  url: string,
): Promise<IngestResult> {
  emitEvent(repoId, { stage: "ingest", level: "stage-start", message: `Cloning ${url}` });
  const { dir, commitSha, defaultBranch } = await cloneRepo(url);
  emitEvent(repoId, { stage: "ingest", level: "info", message: `Cloned at ${commitSha.slice(0, 7)}` });

  const files = await walkRepo(dir);
  const docFiles = files.filter((f) => f.kind === "doc");
  const codeFiles = files.filter((f) => f.kind === "code");
  emitEvent(repoId, {
    stage: "ingest",
    level: "info",
    message: `Walked ${files.length} files`,
    data: { files: files.length, docs: docFiles.length, code: codeFiles.length },
  });

  await sql()`
    UPDATE repos SET commit_sha = ${commitSha} WHERE id = ${repoId}
  `;

  // Insert files
  for (const f of files) {
    await sql()`
      INSERT INTO files (repo_id, path, kind, language, size)
      VALUES (${repoId}, ${f.relPath}, ${f.kind}, ${f.language}, ${f.size})
    `;
  }
  emitEvent(repoId, { stage: "ingest", level: "stage-done", message: "Ingest complete" });

  // ---------- INDEX ----------
  emitEvent(repoId, { stage: "index", level: "stage-start", message: "Parsing and chunking" });

  const docChunks: { fileId: string; relPath: string; section: string; content: string; lineStart: number; lineEnd: number; links: string[] }[] = [];
  const codeChunks: { fileId: string; relPath: string; symbolName: string; symbolKind: string; content: string; lineStart: number; lineEnd: number; routePath: string | null }[] = [];
  const allLinks = new Set<string>();

  const fileRows = await sql()<{ id: string; path: string; kind: string }[]>`
    SELECT id, path, kind FROM files WHERE repo_id = ${repoId}
  `;
  const idByPath = new Map(fileRows.map((r) => [r.path, r.id]));

  for (const f of docFiles) {
    const source = await readFileSafe(f.absPath);
    const chunks = chunkMarkdown(source);
    for (const c of chunks) {
      docChunks.push({
        fileId: idByPath.get(f.relPath)!,
        relPath: f.relPath,
        section: c.section,
        content: c.content,
        lineStart: c.lineStart,
        lineEnd: c.lineEnd,
        links: c.links,
      });
      for (const l of c.links) if (/^https?:\/\//.test(l)) allLinks.add(l);
    }
  }

  for (const f of codeFiles) {
    const source = await readFileSafe(f.absPath);
    const symbols = parsePython(source);
    for (const s of symbols) {
      // skip private helpers we won't reference from docs
      if (s.name.startsWith("_") && s.kind === "function") continue;
      const content = symbolToChunk(s, f.relPath);
      const routePath = s.kind === "route"
        ? (s.decorators.join("\n").match(/["'`]([^"'`]+)["'`]/)?.[1] ?? null)
        : null;
      codeChunks.push({
        fileId: idByPath.get(f.relPath)!,
        relPath: f.relPath,
        symbolName: s.name,
        symbolKind: s.kind,
        content,
        lineStart: s.lineStart,
        lineEnd: s.lineEnd,
        routePath,
      });
    }
  }

  emitEvent(repoId, {
    stage: "index",
    level: "info",
    message: `Built ${docChunks.length} doc chunks, ${codeChunks.length} code chunks`,
  });

  // ---------- EMBED ----------
  emitEvent(repoId, {
    stage: "index",
    level: "info",
    message: "Embedding chunks (OpenAI text-embedding-3-small)",
  });
  const allTexts = [
    ...docChunks.map((c) => c.content),
    ...codeChunks.map((c) => c.content),
  ];
  const embeddings = await embed(allTexts);

  let idx = 0;
  for (const c of docChunks) {
    const emb = embeddings[idx++];
    await sql()`
      INSERT INTO chunks (repo_id, file_id, kind, content, embedding, meta)
      VALUES (
        ${repoId},
        ${c.fileId},
        'doc',
        ${c.content},
        ${emb ? `[${emb.join(",")}]` : null}::vector,
        ${sql().json({
          path: c.relPath,
          section: c.section,
          line_start: c.lineStart,
          line_end: c.lineEnd,
          links: c.links,
        })}
      )
    `;
  }
  for (const c of codeChunks) {
    const emb = embeddings[idx++];
    await sql()`
      INSERT INTO chunks (repo_id, file_id, kind, content, embedding, meta)
      VALUES (
        ${repoId},
        ${c.fileId},
        'code',
        ${c.content},
        ${emb ? `[${emb.join(",")}]` : null}::vector,
        ${sql().json({
          path: c.relPath,
          symbol_name: c.symbolName,
          symbol_kind: c.symbolKind,
          line_start: c.lineStart,
          line_end: c.lineEnd,
          route_path: c.routePath,
        })}
      )
    `;
  }

  emitEvent(repoId, {
    stage: "index",
    level: "stage-done",
    message: `Indexed ${docChunks.length + codeChunks.length} chunks (embedding + BM25 tsvector)`,
  });

  return {
    repoId,
    dir,
    commitSha,
    defaultBranch,
    stats: {
      files: files.length,
      doc_files: docFiles.length,
      code_files: codeFiles.length,
      chunks: docChunks.length + codeChunks.length,
      doc_chunks: docChunks.length,
      code_chunks: codeChunks.length,
      links: Array.from(allLinks),
    },
  };
}
