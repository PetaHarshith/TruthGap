import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
  ANTHROPIC_EXTRACTION_MODEL:
    process.env.ANTHROPIC_EXTRACTION_MODEL ?? "claude-haiku-4-5-20251001",
  OPENAI_EMBED_MODEL:
    process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small",
  TRUTHGAP_WORKDIR: process.env.TRUTHGAP_WORKDIR ?? "/tmp/truthgap-repos",
};
