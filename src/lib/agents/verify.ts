import { sql } from "@/lib/db/client";
import { emitEvent } from "@/lib/events";
import { anthropic } from "@/lib/llm/anthropic";
import { env } from "@/lib/env";
import { reserveAnthropic, estimateTokens } from "@/lib/rate-limit";
import { runAgent, type AgentResult } from "./loop";
import { CODE_TOOLS, HISTORY_TOOLS, WEB_TOOLS, type ToolContext } from "./tools";
import type { Verdict, Severity, ReferencedEntities } from "@/lib/types";

type ClaimRow = {
  id: string;
  text: string;
  type: string;
  referenced_entities: ReferencedEntities;
  source_file: string;
  source_lines: string;
};

const CODE_SYSTEM = `You are the Code Agent. You verify whether a documentation claim is true by inspecting the current source code.

You have tools: grep, read_file, lookup_symbol. Use 1–4 tool calls, then submit your verdict.

Be decisive. If you find the claim is wrong, say "contradicted" with high confidence and quote the contradicting line.
If the claim is fully supported by code, say "supported".
If you cannot find code that addresses the claim, say "unverifiable".`;

const HISTORY_SYSTEM = `You are the History Agent. You inspect git history to detect when a claim might have drifted from reality.

You have tools: git_log, git_blame, diff_range. Use 1–3 tool calls.

Look for: when the relevant code last changed, what the change was, whether it likely invalidated the claim.
If history shows the claim was true but recently broke, say "contradicted".
If history is consistent with the claim, say "supported".
If you can't tell, say "unverifiable".`;

const WEB_SYSTEM = `You are the Web Agent. You verify claims against external sources (dependency CHANGELOGs, linked pages) using a hybrid BM25 + embedding search.

You have tools: hybrid_search (returns top-K external chunks via Reciprocal Rank Fusion of BM25 and vector cosine), read_url. Use 1–3 tool calls.

If external sources confirm the claim, "supported".
If external sources contradict (e.g. the dep's CHANGELOG renamed the API), "contradicted".
If no external source has anything relevant, "unverifiable".`;

function truncArgs(input: Record<string, unknown>): string {
  return Object.entries(input)
    .map(([k, v]) => {
      const sv = typeof v === "string" ? v : JSON.stringify(v);
      const trimmed = sv.length > 32 ? sv.slice(0, 32) + "…" : sv;
      return `${k}=${typeof v === "string" ? `"${trimmed}"` : trimmed}`;
    })
    .join(", ");
}

function userPromptForClaim(claim: ClaimRow): string {
  return `CLAIM (from ${claim.source_file}, lines ${claim.source_lines}):
${claim.text}

Claim type: ${claim.type}
Referenced entities: ${JSON.stringify(claim.referenced_entities)}

Investigate and submit a verdict using the submit_verdict tool.`;
}

type Consolidated = {
  verdict: Verdict;
  confidence: number;
  severity: Severity;
  evidence: AgentResult["evidence"];
  dissent: { agent: string; verdict: string; reasoning: string }[];
  reasoning: string;
};

async function consolidate(claim: ClaimRow, agents: AgentResult[]): Promise<Consolidated> {
  const summary = agents
    .map(
      (a) =>
        `## ${a.agent}\nverdict=${a.verdict} confidence=${a.confidence.toFixed(2)}\nreasoning: ${a.reasoning}\nevidence: ${JSON.stringify(a.evidence).slice(0, 800)}`,
    )
    .join("\n\n");

  await reserveAnthropic(estimateTokens(summary, claim.text) + 600);
  const res = await anthropic().messages.create({
    model: env.ANTHROPIC_EXTRACTION_MODEL,
    max_tokens: 800,
    system: [
      {
        type: "text",
        text: `You are the Consolidator. Three specialist agents have voted on whether a documentation claim is true. Merge their verdicts into ONE final verdict.

Rules:
- If any agent confidently says contradicted with concrete evidence, the final verdict is contradicted (unless another agent has stronger contradicting evidence).
- If majority is unverifiable, final is unverifiable.
- severity: high if the claim is user-facing (install command, API endpoint, CLI flag) AND contradicted; medium for behavior/config discrepancies; low for stylistic / minor.
- Be conservative on false positives. If confidence is mixed, prefer "partial" over "contradicted".

Return JSON ONLY: {"verdict": "...", "confidence": 0.0-1.0, "severity": "low|medium|high", "reasoning": "1-2 sentences", "dissent": [{"agent": "...", "verdict": "...", "reasoning": "..."}]}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `CLAIM: ${claim.text}\n\nAGENT VERDICTS:\n${summary}\n\nReturn JSON only.`,
      },
    ],
  });
  const text = res.content.map((b) => ("text" in b ? b.text : "")).join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  let parsed: {
    verdict?: Verdict;
    confidence?: number;
    severity?: Severity;
    reasoning?: string;
    dissent?: { agent: string; verdict: string; reasoning: string }[];
  } = {};
  if (start >= 0 && end > start) {
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {}
  }

  // Merge evidence from all agents that voted similarly
  const finalVerdict = parsed.verdict ?? "unverifiable";
  const matchingAgents = agents.filter((a) => a.verdict === finalVerdict);
  const evidence = matchingAgents.flatMap((a) => a.evidence).slice(0, 6);

  return {
    verdict: finalVerdict,
    confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
    severity: parsed.severity ?? "medium",
    evidence,
    dissent: parsed.dissent ?? [],
    reasoning: parsed.reasoning ?? "(no reasoning)",
  };
}

export async function verifyClaims(repoId: string, repoDir: string): Promise<{ contradicted: number; total: number }> {
  emitEvent(repoId, {
    stage: "verify",
    level: "stage-start",
    message: "Verifying claims with 3-agent panel + consolidator",
  });

  const claims = await sql()<ClaimRow[]>`
    SELECT id, text, type, referenced_entities, source_file, source_lines::text
    FROM claims
    WHERE repo_id = ${repoId} AND status = 'pending'
    ORDER BY source_file
    LIMIT 15
  `;

  const ctx: ToolContext = { repoId, repoDir };
  let contradicted = 0;
  // 2 claims in flight = 6 parallel agent calls peak. Safe because the
  // rate-limit token bucket in src/lib/rate-limit.ts pre-throttles every
  // Anthropic call to stay under tier-1 RPM/TPM.
  const CONCURRENCY = 2;

  for (let i = 0; i < claims.length; i += CONCURRENCY) {
    const batch = claims.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (claim) => {
        const userPrompt = userPromptForClaim(claim);
        try {
          const onProgress = (p: import("./loop").AgentProgress) => {
            // Forward to the SSE bus as data-bearing events so the UI's
            // "now playing" widget can render the live tool stream.
            const claimPreview = claim.text.slice(0, 80);
            if (p.kind === "tool-start") {
              emitEvent(repoId, {
                stage: "verify",
                level: "info",
                message: `${p.agent}/${p.tool}(${truncArgs(p.input)})`,
                data: {
                  tool_event: "start",
                  agent: p.agent,
                  tool: p.tool,
                  input: p.input,
                  claim_id: claim.id,
                  claim_preview: claimPreview,
                },
              });
            } else if (p.kind === "tool-end") {
              emitEvent(repoId, {
                stage: "verify",
                level: "info",
                message: `${p.agent}/${p.tool} done in ${p.duration_ms}ms`,
                data: {
                  tool_event: "end",
                  agent: p.agent,
                  tool: p.tool,
                  input: p.input,
                  preview: p.preview,
                  duration_ms: p.duration_ms,
                  claim_id: claim.id,
                },
              });
            } else if (p.kind === "verdict") {
              emitEvent(repoId, {
                stage: "verify",
                level: "info",
                message: `${p.agent} → ${p.verdict} (${(p.confidence * 100).toFixed(0)}%)`,
                data: {
                  tool_event: "verdict",
                  agent: p.agent,
                  verdict: p.verdict,
                  confidence: p.confidence,
                  claim_id: claim.id,
                },
              });
            }
          };

          const [code, history, web] = await Promise.all([
            runAgent({
              agent: "code",
              systemPrompt: CODE_SYSTEM,
              userPrompt,
              tools: CODE_TOOLS,
              ctx,
              maxIterations: 4,
              onProgress,
            }),
            runAgent({
              agent: "history",
              systemPrompt: HISTORY_SYSTEM,
              userPrompt,
              tools: HISTORY_TOOLS,
              ctx,
              maxIterations: 3,
              onProgress,
            }),
            runAgent({
              agent: "web",
              systemPrompt: WEB_SYSTEM,
              userPrompt,
              tools: WEB_TOOLS,
              ctx,
              maxIterations: 3,
              onProgress,
            }),
          ]);

          const final = await consolidate(claim, [code, history, web]);
          if (final.verdict === "contradicted") contradicted++;

          const verifRows = await sql()<{ id: string }[]>`
            INSERT INTO verifications (claim_id, repo_id, verdict, confidence, severity, evidence, dissent, reasoning)
            VALUES (
              ${claim.id},
              ${repoId},
              ${final.verdict},
              ${final.confidence},
              ${final.severity},
              ${sql().json(JSON.parse(JSON.stringify(final.evidence)))},
              ${sql().json(JSON.parse(JSON.stringify(final.dissent)))},
              ${final.reasoning}
            )
            RETURNING id
          `;
          const verifId = verifRows[0].id;

          for (const a of [code, history, web]) {
            await sql()`
              INSERT INTO agent_runs (verification_id, claim_id, agent, verdict, confidence, evidence, tool_calls, reasoning, tokens_in, tokens_out, duration_ms)
              VALUES (
                ${verifId},
                ${claim.id},
                ${a.agent},
                ${a.verdict},
                ${a.confidence},
                ${sql().json(JSON.parse(JSON.stringify(a.evidence)))},
                ${sql().json(JSON.parse(JSON.stringify(a.tool_calls)))},
                ${a.reasoning},
                ${a.tokens_in},
                ${a.tokens_out},
                ${a.duration_ms}
              )
            `;
          }

          await sql()`UPDATE claims SET status = 'verified' WHERE id = ${claim.id}`;
        } catch (err) {
          const e = err as Error;
          console.error(`[verify] claim ${claim.id.slice(0, 8)} failed:`, e.message, "\n", e.stack?.split("\n").slice(0, 5).join("\n"));
          emitEvent(repoId, {
            stage: "verify",
            level: "warn",
            message: `claim ${claim.id} failed: ${e.message}`,
          });
          await sql()`UPDATE claims SET status = 'errored' WHERE id = ${claim.id}`;
        }
      }),
    );
    emitEvent(repoId, {
      stage: "verify",
      level: "info",
      message: `Verified ${Math.min(i + CONCURRENCY, claims.length)}/${claims.length} claims · ${contradicted} contradictions so far`,
    });
  }

  emitEvent(repoId, {
    stage: "verify",
    level: "stage-done",
    message: `Verification complete: ${contradicted}/${claims.length} contradictions found`,
  });
  return { contradicted, total: claims.length };
}
