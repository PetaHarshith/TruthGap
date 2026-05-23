import { unified } from "unified";
import remarkParse from "remark-parse";
import { toString as mdToString } from "mdast-util-to-string";

export type DocChunk = {
  content: string;
  section: string;
  lineStart: number;
  lineEnd: number;
  links: string[];
};

const MIN_CHARS = 80;
const MAX_CHARS = 1800;

export function chunkMarkdown(source: string): DocChunk[] {
  const tree = unified().use(remarkParse).parse(source);
  const lines = source.split("\n");
  const chunks: DocChunk[] = [];
  let currentSection = "Top";
  let buffer: string[] = [];
  let bufStart = 1;
  let bufLinks: string[] = [];

  const flush = (endLine: number) => {
    if (buffer.length === 0) return;
    const text = buffer.join("\n").trim();
    if (text.length >= MIN_CHARS) {
      chunks.push({
        content: text.slice(0, MAX_CHARS),
        section: currentSection,
        lineStart: bufStart,
        lineEnd: endLine,
        links: Array.from(new Set(bufLinks)),
      });
    }
    buffer = [];
    bufLinks = [];
  };

  // Walk top-level children
  const root = tree as { children: Array<{ type: string; position?: { start: { line: number }; end: { line: number } }; depth?: number; children?: unknown }> };
  for (const node of root.children) {
    const start = node.position?.start.line ?? 1;
    const end = node.position?.end.line ?? start;
    if (node.type === "heading") {
      flush(start - 1);
      currentSection = mdToString(node as never) || currentSection;
      bufStart = start;
      continue;
    }
    if (buffer.length === 0) bufStart = start;
    const slice = lines.slice(start - 1, end).join("\n");
    buffer.push(slice);
    // collect links from this node
    collectLinks(node as never, bufLinks);
    if (buffer.join("\n").length > MAX_CHARS) flush(end);
  }
  flush(lines.length);
  return chunks;
}

function collectLinks(node: unknown, out: string[]) {
  const n = node as { type?: string; url?: string; children?: unknown[] };
  if (!n || typeof n !== "object") return;
  if (n.type === "link" && typeof n.url === "string") out.push(n.url);
  if (Array.isArray(n.children)) {
    for (const c of n.children) collectLinks(c, out);
  }
}
