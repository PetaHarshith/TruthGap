import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db/client";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? "").trim();
  const force = !!body.force;

  const isGithub = /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/.test(url);
  const isFile = url.startsWith("file://");
  if (!isGithub && !isFile) {
    return NextResponse.json(
      { error: "Provide a GitHub repo URL or a file:// path." },
      { status: 400 },
    );
  }

  // Cache hit: if a `done` run already exists for this URL, return it.
  // The user can pass {force: true} to bypass and run fresh.
  if (!force) {
    const cached = await sql()<{ id: string }[]>`
      SELECT id FROM repos
      WHERE url = ${url} AND status = 'done'
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 1
    `;
    if (cached.length > 0) {
      return NextResponse.json({ repoId: cached[0].id, cached: true });
    }
  }

  const name = isFile
    ? url.replace(/^file:\/\//, "").split("/").filter(Boolean).slice(-1)[0] + " (local)"
    : url.replace(/\.git$/, "").split("/").slice(-2).join("/");
  const rows = await sql()<{ id: string }[]>`
    INSERT INTO repos (url, name, status, current_stage)
    VALUES (${url}, ${name}, 'pending', 'queued')
    RETURNING id
  `;
  const repoId = rows[0].id;
  runPipeline(repoId, url).catch(() => {});
  return NextResponse.json({ repoId });
}
