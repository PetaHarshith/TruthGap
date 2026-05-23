import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db/client";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? "").trim();
  if (!/^https?:\/\/(www\.)?github\.com\/[^\/]+\/[^\/]+/.test(url)) {
    return NextResponse.json({ error: "Provide a GitHub repo URL." }, { status: 400 });
  }
  const name = url.replace(/\.git$/, "").split("/").slice(-2).join("/");
  const rows = await sql()<{ id: string }[]>`
    INSERT INTO repos (url, name, status, current_stage)
    VALUES (${url}, ${name}, 'pending', 'queued')
    RETURNING id
  `;
  const repoId = rows[0].id;
  // Fire-and-forget — don't await
  runPipeline(repoId, url).catch(() => {});
  return NextResponse.json({ repoId });
}
