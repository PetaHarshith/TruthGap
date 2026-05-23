import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const rows = await sql()<Record<string, unknown>[]>`
    SELECT id, name, url, status, current_stage, created_at, finished_at, kpis
    FROM repos
    ORDER BY created_at DESC
    LIMIT 20
  `;
  return NextResponse.json({ repos: rows });
}
