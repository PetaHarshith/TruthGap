import OpenAI from "openai";
import { env } from "@/lib/env";

let _client: OpenAI | null = null;

export function openai() {
  if (!_client) {
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _client;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  const BATCH = 96;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH).map((t) => t.slice(0, 8000));
    const res = await openai().embeddings.create({
      model: env.OPENAI_EMBED_MODEL,
      input: batch,
    });
    for (const d of res.data) out.push(d.embedding);
  }
  return out;
}
