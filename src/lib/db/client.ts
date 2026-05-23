import postgres from "postgres";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

let _sql: ReturnType<typeof postgres> | null = null;
let _initialized = false;

export function sql() {
  if (!_sql) {
    _sql = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      types: {
        // pgvector serializes to "[1,2,3]"
        vector: {
          to: 25,
          from: [1184],
          serialize: (v: number[]) => `[${v.join(",")}]`,
          parse: (v: string) =>
            v
              .slice(1, -1)
              .split(",")
              .map((n) => parseFloat(n)),
        },
      },
    });
  }
  return _sql;
}

export async function ensureSchema() {
  if (_initialized) return;
  const initPath = path.join(process.cwd(), "src/lib/db/init.sql");
  const initSql = await readFile(initPath, "utf8");
  await sql().unsafe(initSql);
  _initialized = true;
}
