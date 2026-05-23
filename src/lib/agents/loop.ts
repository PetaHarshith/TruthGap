import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/llm/anthropic";
import { env } from "@/lib/env";
import type { ToolDef, ToolContext } from "./tools";
import type { ToolCall, AgentName } from "@/lib/types";

export type AgentResult = {
  agent: AgentName;
  verdict: "supported" | "contradicted" | "unverifiable" | "partial";
  confidence: number;
  evidence: { source: string; file?: string; url?: string; snippet: string; note?: string }[];
  reasoning: string;
  tool_calls: ToolCall[];
  tokens_in: number;
  tokens_out: number;
  duration_ms: number;
};

const FINAL_TOOL = {
  name: "submit_verdict",
  description:
    "Submit your final verdict on the claim. Use this when you have enough evidence.",
  input_schema: {
    type: "object" as const,
    properties: {
      verdict: {
        type: "string",
        enum: ["supported", "contradicted", "unverifiable", "partial"],
        description: "supported = code matches doc; contradicted = code disagrees; unverifiable = you couldn't find evidence; partial = doc partially correct",
      },
      confidence: {
        type: "number",
        description: "0.0–1.0 confidence in your verdict",
      },
      reasoning: {
        type: "string",
        description: "1-3 sentence explanation of why",
      },
      evidence: {
        type: "array",
        description: "Concrete evidence: file:line snippets or URL snippets you found",
        items: {
          type: "object",
          properties: {
            file: { type: "string" },
            url: { type: "string" },
            snippet: { type: "string" },
            note: { type: "string" },
          },
          required: ["snippet"],
        },
      },
    },
    required: ["verdict", "confidence", "reasoning", "evidence"],
  },
};

export async function runAgent(opts: {
  agent: AgentName;
  systemPrompt: string;
  userPrompt: string;
  tools: ToolDef[];
  ctx: ToolContext;
  maxIterations?: number;
}): Promise<AgentResult> {
  const start = Date.now();
  const maxIter = opts.maxIterations ?? 6;
  const tool_calls: ToolCall[] = [];
  let tokens_in = 0;
  let tokens_out = 0;

  const toolsForApi = [
    ...opts.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    })),
    FINAL_TOOL,
  ];
  const toolMap = new Map(opts.tools.map((t) => [t.name, t]));

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: opts.userPrompt },
  ];

  let finalResult: {
    verdict: AgentResult["verdict"];
    confidence: number;
    reasoning: string;
    evidence: AgentResult["evidence"];
  } | null = null;

  for (let iter = 0; iter < maxIter && !finalResult; iter++) {
    const res = await anthropic().messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: [
        { type: "text", text: opts.systemPrompt, cache_control: { type: "ephemeral" } },
      ],
      tools: toolsForApi,
      messages,
    });
    tokens_in += res.usage.input_tokens ?? 0;
    tokens_out += res.usage.output_tokens ?? 0;

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      // model stopped without submitting; force unverifiable
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      if (block.name === "submit_verdict") {
        const input = block.input as {
          verdict: AgentResult["verdict"];
          confidence: number;
          reasoning: string;
          evidence: AgentResult["evidence"];
        };
        finalResult = {
          verdict: input.verdict,
          confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)),
          reasoning: input.reasoning,
          evidence: (input.evidence ?? []).map((e) => ({
            ...e,
            source: opts.agent,
          })),
        };
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: "verdict recorded",
        });
        continue;
      }
      const def = toolMap.get(block.name);
      let output = "(unknown tool)";
      if (def) {
        try {
          output = await def.run(block.input as Record<string, unknown>, opts.ctx);
        } catch (err) {
          output = `error: ${(err as Error).message}`;
        }
      }
      tool_calls.push({
        tool: block.name,
        input: block.input as Record<string, unknown>,
        output: output.slice(0, 8000),
        ts: Date.now(),
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: output.slice(0, 8000),
      });
    }
    if (finalResult) break;
    messages.push({ role: "user", content: toolResults });
  }

  if (!finalResult) {
    finalResult = {
      verdict: "unverifiable",
      confidence: 0.2,
      reasoning: `Agent exhausted ${maxIter} iterations without submitting a verdict.`,
      evidence: [],
    };
  }

  return {
    agent: opts.agent,
    ...finalResult,
    tool_calls,
    tokens_in,
    tokens_out,
    duration_ms: Date.now() - start,
  };
}
