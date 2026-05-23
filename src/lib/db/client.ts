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
