import { sql } from "@/lib/db/client";
import { anthropic } from "@/lib/llm/anthropic";
import { env } from "@/lib/env";
import { emitEvent } from "@/lib/events";
import { readFileSafe } from "@/lib/ingest/walk";
import path from "node:path";
import { createPatch } from "diff";

type Row = {
  verification_id: string;
  claim_text: string;
  source_file: string;
  source_lines: string;
  evidence: { snippet: string; file?: string; url?: string; note?: string }[];
  reasoning: string;
};

const SYSTEM = `You synthesize documentation fixes. Given a claim that is contradicted by code, plus the original doc snippet and the contradicting evidence, return the corrected doc snippet (the same lines, but fixed).

Rules:
- Make the smallest correct edit. Don't reword unrelated sentences.
- Stay in the original prose style and language.
- If you cannot determine the right fix, return the original snippet unchanged.
- Return JSON ONLY: {"fixed": "<the corrected snippet, full text>"}.`;

function parseRange(s: string): [number, number] {
  // int4range stringified like "[5,10)" or "[5,10]"
  const m = s.match(/[\[(](\d+),(\d+)[\])]/);
  if (!m) return [1, 1];
  return [parseInt(m[1]), parseInt(m[2])];
}

export async function synthesizePatches(repoId: string, repoDir: string): Promise<number> {
  emitEvent(repoId, {
    stage: "synthesize",
    level: "stage-start",
    message: "Synthesizing doc patches for contradictions",
  });

  const rows = await sql()<Row[]>`
    SELECT v.id AS verification_id,
           c.text AS claim_text,
           c.source_file,
           c.source_lines::text,
           v.evidence,
           v.reasoning
    FROM verifications v
    JOIN claims c ON c.id = v.claim_id
    WHERE v.repo_id = ${repoId} AND v.verdict = 'contradicted'
  `;

  let synthesized = 0;
  for (const row of rows) {
    const [s, e] = parseRange(row.source_lines);
    const absPath = path.join(repoDir, row.source_file);
    const fileText = await readFileSafe(absPath);
    if (!fileText) continue;
    const lines = fileText.split("\n");
    const original = lines.slice(Math.max(0, s - 1), e).join("\n");
    if (!original.trim()) continue;

    try {
      const res = await anthropic().messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 800,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `Claim being contradicted: ${row.claim_text}

Contradicting evidence:
${row.evidence.map((ev) => `- ${ev.file ?? ev.url ?? ""}: ${ev.snippet}${ev.note ? ` (${ev.note})` : ""}`).join("\n")}

Consolidator reasoning: ${row.reasoning}

Original doc snippet (lines ${s}-${e} of ${row.source_file}):
---
${original}
---

Return JSON only.`,
          },
        ],
      });
      const text = res.content.map((b) => ("text" in b ? b.text : "")).join("");
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      let fixed = original;
      if (start >= 0 && end > start) {
        try {
          const parsed = JSON.parse(text.slice(start, end + 1));
          if (typeof parsed.fixed === "string" && parsed.fixed.trim()) {
            fixed = parsed.fixed;
          }
        } catch {}
      }
      if (fixed.trim() === original.trim()) continue;
      const diff = createPatch(row.source_file, original + "\n", fixed + "\n", `before`, `after`);
      await sql()`UPDATE verifications SET patch = ${diff} WHERE id = ${row.verification_id}`;
      synthesized++;
    } catch (err) {
      emitEvent(repoId, {
        stage: "synthesize",
        level: "warn",
        message: `patch failed: ${(err as Error).message}`,
      });
    }
  }

  emitEvent(repoId, {
    stage: "synthesize",
    level: "stage-done",
    message: `Synthesized ${synthesized} doc patches`,
  });
  return synthesized;
}
