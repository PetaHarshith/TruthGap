import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "@/lib/db/client";
import { hybridSearch } from "@/lib/search/hybrid";

function execCapture(
  cmd: string,
  args: string[],
  cwd?: string,
  timeoutMs = 4000,
): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: process.env });
    let stdout = "";
    let killed = false;
    const t = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      if (stdout.length < 40000) stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      if (stdout.length < 40000) stdout += d.toString();
    });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ stdout: stdout.slice(0, 8000), code: killed ? -1 : (code ?? 1) });
    });
    child.on("error", () => {
      clearTimeout(t);
      resolve({ stdout, code: 1 });
    });
  });
}

export type ToolContext = {
  repoId: string;
  repoDir: string;
};

export type ToolDef = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  run: (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
};

// ---------- CODE AGENT TOOLS ----------

export const grepTool: ToolDef = {
  name: "grep",
  description:
    "Search code in the repository with a regex. Returns up to 40 matching lines with file:line: prefix.",
  input_schema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regex pattern (POSIX extended)" },
      path_glob: {
        type: "string",
        description: "Optional path subdir or glob (default: '.')",
      },
    },
    required: ["pattern"],
  },
  run: async (input, ctx) => {
    const pattern = String(input.pattern);
    const subdir = String(input.path_glob ?? ".");
    const { stdout } = await execCapture(
      "grep",
      ["-rnE", "--include=*.py", "--include=*.md", "--include=*.toml", "-m", "40", pattern, subdir],
      ctx.repoDir,
    );
    return stdout.trim() || "(no matches)";
  },
};

export const readFileTool: ToolDef = {
  name: "read_file",
  description:
    "Read a file from the repo. Optional line_start / line_end to slice a range (1-indexed, inclusive).",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path relative to repo root" },
      line_start: { type: "number", description: "1-indexed start line (optional)" },
      line_end: { type: "number", description: "1-indexed end line (optional)" },
    },
    required: ["path"],
  },
  run: async (input, ctx) => {
    const rel = String(input.path).replace(/^\/+/, "");
    if (rel.includes("..")) return "error: path escape";
    const abs = path.join(ctx.repoDir, rel);
    let content: string;
    try {
      content = await readFile(abs, "utf8");
    } catch {
      return `error: cannot read ${rel}`;
    }
    const lines = content.split("\n");
    const s = Math.max(1, Number(input.line_start ?? 1));
    const e = Math.min(lines.length, Number(input.line_end ?? lines.length));
    const slice = lines.slice(s - 1, e);
    const max = 300;
    const numbered = slice
      .slice(0, max)
      .map((l, i) => `${s + i}: ${l}`)
      .join("\n");
    return numbered + (slice.length > max ? `\n… (${slice.length - max} more lines)` : "");
  },
};

export const lookupSymbolTool: ToolDef = {
  name: "lookup_symbol",
  description:
    "Look up a Python function/class/route by name. Returns its file location, signature, decorators.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Symbol name to find" },
    },
    required: ["name"],
  },
  run: async (input, ctx) => {
    const name = String(input.name);
    const rows = await sql()<{ content: string; meta: Record<string, unknown> }[]>`
      SELECT content, meta FROM chunks
      WHERE repo_id = ${ctx.repoId}
        AND kind = 'code'
        AND meta->>'symbol_name' = ${name}
      LIMIT 5
    `;
    if (rows.length === 0) return `(no symbol named ${name})`;
    return rows
      .map(
        (r) =>
          `${(r.meta as { path: string }).path}:${(r.meta as { line_start: number }).line_start}\n${r.content}`,
      )
      .join("\n---\n");
  },
};

// ---------- HISTORY AGENT TOOLS ----------

export const gitLogTool: ToolDef = {
  name: "git_log",
  description:
    "Show recent commits touching a file or matching a path. Returns hash, date, subject.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File or path to filter by (optional)" },
      limit: { type: "number", description: "Max commits (default 10)" },
    },
    required: [],
  },
  run: async (input, ctx) => {
    const args = ["log", "--no-color", "--pretty=format:%h %ad %s", "--date=short", `-${Math.min(40, Number(input.limit ?? 10))}`];
    if (input.path) {
      args.push("--", String(input.path));
    }
    const { stdout } = await execCapture("git", args, ctx.repoDir);
    return stdout.trim() || "(no commits)";
  },
};

export const gitBlameTool: ToolDef = {
  name: "git_blame",
  description:
    "Show git blame for a line range of a file. Shows commit, author, date per line.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path" },
      line_start: { type: "number", description: "Start line" },
      line_end: { type: "number", description: "End line" },
    },
    required: ["path", "line_start", "line_end"],
  },
  run: async (input, ctx) => {
    const args = [
      "blame",
      "--no-color",
      "-L",
      `${input.line_start},${input.line_end}`,
      "--date=short",
      String(input.path),
    ];
    const { stdout } = await execCapture("git", args, ctx.repoDir);
    return stdout.trim() || "(no blame)";
  },
};

export const diffRangeTool: ToolDef = {
  name: "diff_range",
  description:
    "Show diff for a file between two refs (e.g. HEAD~20..HEAD). Useful to spot recent breaking changes.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path" },
      range: { type: "string", description: "Git range like HEAD~20..HEAD (default HEAD~20..HEAD)" },
    },
    required: ["path"],
  },
  run: async (input, ctx) => {
    const range = String(input.range ?? "HEAD~20..HEAD");
    const args = ["diff", "--no-color", range, "--", String(input.path)];
    const { stdout } = await execCapture("git", args, ctx.repoDir, 6000);
    return stdout.trim().slice(0, 6000) || "(no diff)";
  },
};

// ---------- WEB AGENT TOOLS ----------

export const hybridSearchTool: ToolDef = {
  name: "hybrid_search",
  description:
    "Hybrid BM25 + vector search across external sources (docs, dep CHANGELOGs, linked pages). Returns top hits with content snippets.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      k: { type: "number", description: "Max results (default 5)" },
    },
    required: ["query"],
  },
  run: async (input, ctx) => {
    const hits = await hybridSearch({
      repoId: ctx.repoId,
      query: String(input.query),
      kind: "external",
      k: Number(input.k ?? 5),
    });
    if (hits.length === 0) return "(no external sources matched)";
    return hits
      .map((h) => {
        const url = (h.meta as { url?: string }).url ?? "?";
        const title = (h.meta as { title?: string }).title ?? "?";
        return `# ${title}\n${url}\nbm25_rank=${h.bm25_rank ?? "-"} vec_rank=${h.vec_rank ?? "-"} rrf=${h.rrf_score.toFixed(4)}\n${h.content.slice(0, 600)}`;
      })
      .join("\n---\n");
  },
};

export const readUrlTool: ToolDef = {
  name: "read_url",
  description:
    "Read the full content of a previously-scraped external source by URL.",
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL of the source" },
    },
    required: ["url"],
  },
  run: async (input, ctx) => {
    const rows = await sql()<{ content: string; title: string }[]>`
      SELECT content, title FROM external_sources
      WHERE repo_id = ${ctx.repoId} AND url = ${String(input.url)}
      LIMIT 1
    `;
    if (rows.length === 0) return "(url not in scraped corpus)";
    return `# ${rows[0].title}\n${rows[0].content.slice(0, 6000)}`;
  },
};

export const CODE_TOOLS: ToolDef[] = [grepTool, readFileTool, lookupSymbolTool];
export const HISTORY_TOOLS: ToolDef[] = [gitLogTool, gitBlameTool, diffRangeTool];
export const WEB_TOOLS: ToolDef[] = [hybridSearchTool, readUrlTool];
