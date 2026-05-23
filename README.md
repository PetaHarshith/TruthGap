# TruthGap

Multi-agent documentation drift detector. Paste a GitHub repo URL → get a dashboard of every place the docs disagree with the code, with evidence, a 3-agent trace, and a suggested patch.

```
docs  ──►  claim extraction  ──►  3-agent verify  ──►  consolidator  ──►  patch
code  ──►  AST + embedding + BM25  ───────┘                  │                 ┘
web   ──►  scrape (deps + links) ─────────┘                  ▼
                                                      KPIs (Doc Health · Drift · Friction)
```

## Pipeline

| # | Stage | What | How |
|---|-------|------|-----|
| 1 | Ingest | Clone repo, walk filesystem | `simple-git` + walker |
| 2 | Parse + chunk | Markdown sections, Python symbols | `remark` + custom Python lexer |
| 3 | Index | Hybrid retrieval | OpenAI embeddings → `pgvector` + Postgres `tsvector` BM25 |
| 4 | Scrape | External pages + dependency CHANGELOGs | `fetch` + `cheerio` |
| 5 | Extract claims | Atomic, typed claims from doc chunks | Claude Haiku · strict JSON schema · prompt caching |
| 6 | Verify | 3 agents in parallel | Claude Sonnet · bounded tool loops · `submit_verdict` final tool |
| 7 | Consolidate | Merge agent verdicts | One Claude call · severity + dissent |
| 8 | Synthesize | Doc patches as unified diffs | `diff` |
| 9 | KPI rollup | Doc Health · Drift Velocity · Friction Surface | SQL aggregation |

### The 3 agents

| Agent | Tools | What it looks for |
|-------|-------|-------------------|
| Code | `grep`, `read_file`, `lookup_symbol` | Does the current code match the claim? |
| History | `git_log`, `git_blame`, `diff_range` | Did this drift recently? When did it last change? |
| Web | `hybrid_search`, `read_url` | What do dep CHANGELOGs / linked docs say? |

A consolidator merges their votes into `{verdict, confidence, severity, evidence, dissent}`.

## Local setup

```bash
# Postgres + pgvector (port 5434)
docker compose up -d

# Install
pnpm install

# Set in .env.local
#   ANTHROPIC_API_KEY=sk-ant-...
#   OPENAI_API_KEY=sk-...

pnpm dev
```

Open <http://localhost:3000>.

## Run the seeded eval

A small Python project lives in `benchmark/sample` with 14 intentional documentation drifts. Run:

```bash
pnpm tsx scripts/eval.ts
```

It clones the local benchmark via `file://`, runs the full pipeline, compares flagged claims against `benchmark/seeded.json`, computes precision / recall / F1, and writes a row to `eval_results`. View it at `/eval`.

## Design notes (for the call)

- **Where the agent is and isn't.** Claim extraction is single-shot structured output. Symbol resolution is deterministic AST lookup. Only verification needs judgment + tool use, so only verification is agentic. Don't agent-ify the cheap parts.
- **Hybrid retrieval (BM25 + embedding, RRF fused)** lives inside the Web Agent — visible in every agent trace.
- **Prompt caching** on every system prompt (extraction, agents, consolidator, patcher).
- **Studio bridge.** The 3-agent panel is structurally a tiny population sim. Replace "code/history/web" with "persona A/B/C" and you've described customer simulation. Same plumbing.
