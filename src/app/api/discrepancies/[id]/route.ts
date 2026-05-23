import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await ctx.params;

  const rows = await sql()<Record<string, unknown>[]>`
    SELECT v.*, c.text AS claim_text, c.type AS claim_type, c.source_file, c.source_lines::text,
           c.referenced_entities,
           ch.content AS doc_chunk_content, ch.meta AS doc_chunk_meta
    FROM verifications v
    JOIN claims c ON c.id = v.claim_id
    LEFT JOIN chunks ch ON ch.id = c.chunk_id
    WHERE v.id = ${id}
  `;
  if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const agents = await sql()<Record<string, unknown>[]>`
    SELECT id, agent, verdict, confidence, evidence, tool_calls, reasoning,
           tokens_in, tokens_out, duration_ms
    FROM agent_runs WHERE verification_id = ${id}
    ORDER BY agent
  `;

  return NextResponse.json({ verification: rows[0], agents });
}
