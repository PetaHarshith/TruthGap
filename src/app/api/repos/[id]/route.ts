import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await ctx.params;
  const repos = await sql()<Record<string, unknown>[]>`SELECT * FROM repos WHERE id = ${id}`;
  if (repos.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const verifications = await sql()<Record<string, unknown>[]>`
    SELECT v.id, v.verdict, v.confidence, v.severity, v.reasoning,
           c.text AS claim_text, c.type AS claim_type, c.source_file, c.source_lines::text
    FROM verifications v
    JOIN claims c ON c.id = v.claim_id
    WHERE v.repo_id = ${id}
    ORDER BY
      CASE v.verdict
        WHEN 'contradicted' THEN 1
        WHEN 'partial' THEN 2
        WHEN 'unverifiable' THEN 3
        ELSE 4
      END,
      v.confidence DESC
  `;

  return NextResponse.json({ repo: repos[0], verifications });
}
