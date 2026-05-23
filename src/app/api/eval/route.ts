import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const rows = await sql()<Record<string, unknown>[]>`
    SELECT * FROM eval_results ORDER BY created_at DESC LIMIT 20
  `;
  return NextResponse.json({ results: rows });
}
