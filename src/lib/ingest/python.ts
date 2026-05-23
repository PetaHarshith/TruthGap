export type CodeSymbol = {
  kind: "function" | "class" | "route" | "cli_command" | "constant";
  name: string;
  signature: string;
  decorators: string[];
  lineStart: number;
  lineEnd: number;
  body: string;
};

const FUNC_RE = /^(?<indent>[ \t]*)(?:async\s+)?def\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\((?<args>[^)]*)\)(?:\s*->\s*(?<ret>[^:]+))?\s*:/;
const CLASS_RE = /^(?<indent>[ \t]*)class\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*(?:\((?<bases>[^)]*)\))?\s*:/;
const DEC_RE = /^(?<indent>[ \t]*)@(?<dec>[A-Za-z_][\w\.]*(?:\([^)]*\))?)/;
const ROUTE_DEC_RE = /(?:app|router|api|blueprint|bp)\.(?:get|post|put|patch|delete|head|options|route|websocket)\s*\(\s*["'`](?<path>[^"'`]+)["'`]/;
const CLICK_DEC_RE = /(?:click|app|cli)\.(?:command|group)\s*\(\s*(?:["'`](?<name>[^"'`]+)["'`])?/;
const CONST_RE = /^(?<name>[A-Z][A-Z0-9_]+)\s*[:=]/;

export function parsePython(source: string): CodeSymbol[] {
  const lines = source.split("\n");
  const out: CodeSymbol[] = [];
  let pendingDecs: string[] = [];

  function indentOf(s: string): number {
    const m = s.match(/^[ \t]*/);
    return m ? m[0].length : 0;
  }

  function readBlock(startIdx: number): { endIdx: number; body: string } {
    const baseIndent = indentOf(lines[startIdx]);
    let i = startIdx + 1;
    while (i < lines.length) {
      const ln = lines[i];
      if (ln.trim() === "") {
        i++;
        continue;
      }
      if (indentOf(ln) <= baseIndent) break;
      i++;
    }
    const body = lines.slice(startIdx, i).join("\n").slice(0, 4000);
    return { endIdx: i - 1, body };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const dm = line.match(DEC_RE);
    if (dm?.groups) {
      pendingDecs.push("@" + dm.groups.dec);
      continue;
    }

    const fm = line.match(FUNC_RE);
    if (fm?.groups) {
      const { endIdx, body } = readBlock(i);
      const sig = line.trim();
      let kind: CodeSymbol["kind"] = "function";
      const decoratorsBlob = pendingDecs.join(" ");
      if (ROUTE_DEC_RE.test(decoratorsBlob)) kind = "route";
      else if (CLICK_DEC_RE.test(decoratorsBlob)) kind = "cli_command";
      out.push({
        kind,
        name: fm.groups.name,
        signature: sig,
        decorators: pendingDecs.slice(),
        lineStart: i + 1,
        lineEnd: endIdx + 1,
        body,
      });
      pendingDecs = [];
      continue;
    }

    const cm = line.match(CLASS_RE);
    if (cm?.groups) {
      const { endIdx, body } = readBlock(i);
      out.push({
        kind: "class",
        name: cm.groups.name,
        signature: line.trim(),
        decorators: pendingDecs.slice(),
        lineStart: i + 1,
        lineEnd: endIdx + 1,
        body,
      });
      pendingDecs = [];
      continue;
    }

    const km = line.match(CONST_RE);
    if (km?.groups && indentOf(line) === 0) {
      out.push({
        kind: "constant",
        name: km.groups.name,
        signature: line.trim(),
        decorators: [],
        lineStart: i + 1,
        lineEnd: i + 1,
        body: line,
      });
      pendingDecs = [];
      continue;
    }

    // line that isn't a decorator or definition resets pending
    if (line.trim() && !line.trim().startsWith("#")) pendingDecs = [];
  }

  return out;
}

export function symbolToChunk(s: CodeSymbol, relPath: string): string {
  const decs = s.decorators.length ? s.decorators.join("\n") + "\n" : "";
  return `# ${relPath}:${s.lineStart}-${s.lineEnd} (${s.kind})\n${decs}${s.signature}\n${s.body.split("\n").slice(1, 30).join("\n")}`.slice(
    0,
    2400,
  );
}

export function extractRoutePath(decorators: string[]): string | null {
  for (const d of decorators) {
    const m = d.match(ROUTE_DEC_RE);
    if (m?.groups?.path) return m.groups.path;
  }
  return null;
}
