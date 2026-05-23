import * as cheerio from "cheerio";
import { sql } from "@/lib/db/client";
import { embed } from "@/lib/llm/openai";
import { emitEvent } from "@/lib/events";
import { readFileSafe } from "@/lib/ingest/walk";
import path from "node:path";

async function fetchPage(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "TruthGap/0.1 (+https://truthgap.dev)" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/markdown") && !ct.includes("text/plain")) {
      return null;
    }
    const html = await res.text();
    if (ct.includes("text/html")) {
      const $ = cheerio.load(html);
      $("script,style,nav,header,footer,aside").remove();
      const title = ($("title").first().text() || $("h1").first().text() || url).trim();
      const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 12000);
      return { title, text };
    }
    return { title: url, text: html.slice(0, 12000) };
  } catch {
    return null;
  }
}

function depsFromRequirements(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.trim().split(/[<>=!~ \[#]/)[0])
    .filter((s) => s && !s.startsWith("-") && !s.startsWith("#"))
    .slice(0, 20);
}

function depsFromPyproject(content: string): string[] {
  const deps: string[] = [];
  const block = content.match(/\[project\][\s\S]*?(?:\[|$)/)?.[0] ?? content;
  const depsArr = block.match(/dependencies\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  for (const m of depsArr.matchAll(/["']([^"'<>=! ]+)/g)) deps.push(m[1]);
  return deps.slice(0, 20);
}

function depsFromPackageJson(content: string): string[] {
  try {
    const j = JSON.parse(content);
    return Object.keys({ ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) }).slice(0, 20);
  } catch {
    return [];
  }
}

export async function scrapeSources(
  repoId: string,
  dir: string,
  linkSet: string[],
): Promise<number> {
  emitEvent(repoId, {
    stage: "scrape",
    level: "stage-start",
    message: "Scraping external sources & dependency docs",
  });

  // Dependencies
  const candidates: string[] = [...linkSet];
  const reqPath = path.join(dir, "requirements.txt");
  const pyprojectPath = path.join(dir, "pyproject.toml");
  const pkgJsonPath = path.join(dir, "package.json");
  const reqText = await readFileSafe(reqPath);
  const pyprojectText = await readFileSafe(pyprojectPath);
  const pkgJsonText = await readFileSafe(pkgJsonPath);

  const pyDeps = [
    ...depsFromRequirements(reqText),
    ...depsFromPyproject(pyprojectText),
  ];
  const npmDeps = depsFromPackageJson(pkgJsonText);

  const depUrls: { url: string; kind: string }[] = [];
  for (const d of pyDeps.slice(0, 8)) {
    depUrls.push({ url: `https://pypi.org/pypi/${encodeURIComponent(d)}/json`, kind: "dep_meta" });
  }
  for (const d of npmDeps.slice(0, 4)) {
    depUrls.push({ url: `https://registry.npmjs.org/${encodeURIComponent(d)}`, kind: "dep_meta" });
  }

  const todo = [
    ...candidates.slice(0, 12).map((u) => ({ url: u, kind: "link" })),
    ...depUrls,
  ];

  const fetched: { url: string; kind: string; title: string; content: string }[] = [];
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    const results = await Promise.all(
      batch.map(async (t) => {
        const page = await fetchPage(t.url);
        if (!page) return null;
        return { url: t.url, kind: t.kind, title: page.title, content: page.text };
      }),
    );
    for (const r of results) if (r) fetched.push(r);
  }

  emitEvent(repoId, {
    stage: "scrape",
    level: "info",
    message: `Fetched ${fetched.length}/${todo.length} external sources`,
  });

  if (fetched.length === 0) {
    emitEvent(repoId, { stage: "scrape", level: "stage-done", message: "No external sources" });
    return 0;
  }

  // Persist + embed
  const embeddings = await embed(fetched.map((f) => `${f.title}\n${f.content}`));
  for (let i = 0; i < fetched.length; i++) {
    const f = fetched[i];
    const inserted = await sql()<{ id: string }[]>`
      INSERT INTO external_sources (repo_id, url, kind, title, content)
      VALUES (${repoId}, ${f.url}, ${f.kind}, ${f.title}, ${f.content})
      RETURNING id
    `;
    const ext = inserted[0];
    const emb = embeddings[i];
    await sql()`
      INSERT INTO chunks (repo_id, kind, content, embedding, meta)
      VALUES (
        ${repoId},
        'external',
        ${f.content},
        ${emb ? `[${emb.join(",")}]` : null}::vector,
        ${sql().json({ url: f.url, kind: f.kind, title: f.title, external_source_id: ext.id })}
      )
    `;
  }

  emitEvent(repoId, {
    stage: "scrape",
    level: "stage-done",
    message: `Indexed ${fetched.length} external sources into hybrid corpus`,
  });
  return fetched.length;
}
