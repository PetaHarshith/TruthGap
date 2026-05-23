import { readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "__pycache__",
  ".next",
  "dist",
  "build",
  "site-packages",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  "target",
  ".tox",
  ".idea",
  ".vscode",
]);

export type WalkedFile = {
  absPath: string;
  relPath: string;
  kind: "doc" | "code" | "config";
  language: string;
  size: number;
};

export async function walkRepo(root: string): Promise<WalkedFile[]> {
  const out: WalkedFile[] = [];

  async function walk(dir: string) {
    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue;
        if (e.name.startsWith(".")) continue;
        await walk(abs);
      } else if (e.isFile()) {
        const rel = path.relative(root, abs);
        const lower = e.name.toLowerCase();
        let kind: WalkedFile["kind"] | null = null;
        let language = "text";
        if (lower.endsWith(".md") || lower.endsWith(".mdx") || lower.endsWith(".rst")) {
          kind = "doc";
          language = "markdown";
        } else if (lower.endsWith(".py")) {
          kind = "code";
          language = "python";
        } else if (
          lower === "pyproject.toml" ||
          lower === "setup.py" ||
          lower === "setup.cfg" ||
          lower === "requirements.txt" ||
          lower === "package.json"
        ) {
          kind = "config";
          language = lower.endsWith(".json") ? "json" : "toml";
        }
        if (!kind) continue;
        try {
          const s = await stat(abs);
          if (s.size > 500_000) continue;
          out.push({
            absPath: abs,
            relPath: rel,
            kind,
            language,
            size: s.size,
          });
        } catch {}
      }
    }
  }

  await walk(root);
  return out;
}

export async function readFileSafe(p: string): Promise<string> {
  try {
    return await readFile(p, "utf8");
  } catch {
    return "";
  }
}
