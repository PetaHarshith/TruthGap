import { anthropic } from "@/lib/llm/anthropic";
import { env } from "@/lib/env";
import { sql } from "@/lib/db/client";
import { emitEvent } from "@/lib/events";
import { reserveAnthropic, estimateTokens } from "@/lib/rate-limit";

const SYSTEM_PROMPT = `You extract atomic, verifiable claims from documentation chunks of a Python project.

For each claim, return a JSON object with:
- text: the claim restated in one self-contained sentence
- type: one of [install_command, cli_flag, api_endpoint, function_signature, config_option, default_value, version, behavior, import_path, dependency, other]
- referenced_entities: object with any of {symbols, paths, flags, endpoints, versions, packages, extras, commands} as arrays of strings; only include keys you found
- confidence: 0.0–1.0 indicating how concrete/checkable this claim is

Rules:
- Only extract claims that could be falsified by reading the codebase.
- Skip prose ("X is fast", "we love clean code"), marketing copy, ToC entries, and questions.
- Prefer SPECIFIC over GENERAL. "pip install fastapi[all]" > "you can install fastapi with pip".
- One claim per JSON object. 1–8 claims per chunk. Return JSON ONLY: {"claims": [...]}.
- If nothing concrete, return {"claims": []}.`;

type RawClaim = {
  text: string;
  type: string;
  referenced_entities: Record<string, string[] | undefined>;
  confidence: number;
};

type ChunkRow = {
  id: string;
  content: string;
  meta: { path: string; section: string; line_start: number; line_end: number };
};

const ALLOWED_TYPES = new Set([
  "install_command",
  "cli_flag",
  "api_endpoint",
  "function_signature",
  "config_option",
  "default_value",
  "version",
  "behavior",
  "import_path",
  "dependency",
  "other",
]);

async function extractFromChunk(chunk: ChunkRow): Promise<RawClaim[]> {
  await reserveAnthropic(estimateTokens(SYSTEM_PROMPT, chunk.content) + 400);
  const res = await anthropic().messages.create({
    model: env.ANTHROPIC_EXTRACTION_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Section: ${chunk.meta.section}\nFile: ${chunk.meta.path}\n\n---\n${chunk.content}\n---\n\nReturn JSON only.`,
      },
    ],
  });
  const text = res.content
    .map((b) => ("text" in b ? b.text : ""))
    .join("")
    .trim();
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0) return [];
  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const claims = Array.isArray(parsed.claims) ? parsed.claims : [];
    return claims.filter(
      (c: RawClaim) =>
        c &&
        typeof c.text === "string" &&
        c.text.length > 5 &&
        ALLOWED_TYPES.has(c.type),
    );
  } catch {
    return [];
  }
}

export async function extractClaims(repoId: string): Promise<number> {
  emitEvent(repoId, {
    stage: "extract",
    level: "stage-start",
    message: "Extracting claims from doc chunks",
  });

  const chunks = await sql()<ChunkRow[]>`
    SELECT id, content, meta
    FROM chunks
    WHERE repo_id = ${repoId} AND kind = 'doc'
    ORDER BY (meta->>'path'), (meta->>'line_start')::int
  `;

  let total = 0;
  const CONCURRENCY = 4;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((c) =>
        extractFromChunk(c).catch((err) => {
          emitEvent(repoId, {
            stage: "extract",
            level: "warn",
            message: `extract failed: ${(err as Error).message}`,
          });
          return [] as RawClaim[];
        }),
      ),
    );
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      for (const c of results[j]) {
        await sql()`
          INSERT INTO claims (repo_id, chunk_id, text, type, referenced_entities, source_file, source_lines)
          VALUES (
            ${repoId},
            ${chunk.id},
            ${c.text},
            ${c.type},
            ${sql().json(c.referenced_entities ?? {})},
            ${chunk.meta.path},
            ${`[${chunk.meta.line_start},${chunk.meta.line_end}]`}::int4range
          )
        `;
        total++;
      }
    }
    emitEvent(repoId, {
      stage: "extract",
      level: "info",
      message: `Extracted ${total} claims (processed ${Math.min(i + CONCURRENCY, chunks.length)}/${chunks.length} chunks)`,
    });
  }

  emitEvent(repoId, {
    stage: "extract",
    level: "stage-done",
    message: `Extracted ${total} atomic claims`,
  });
  return total;
}
