CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS repos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url          text NOT NULL,
  name         text NOT NULL,
  commit_sha   text,
  status       text NOT NULL DEFAULT 'pending',
  current_stage text,
  kpis         jsonb,
  stats        jsonb,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);

CREATE TABLE IF NOT EXISTS files (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id   uuid NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  path      text NOT NULL,
  kind      text NOT NULL,
  language  text,
  size      int
);
CREATE INDEX IF NOT EXISTS files_repo_idx ON files(repo_id);

CREATE TABLE IF NOT EXISTS chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id     uuid NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  file_id     uuid REFERENCES files(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  content     text NOT NULL,
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  embedding   vector(384),
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS chunks_repo_idx ON chunks(repo_id);
CREATE INDEX IF NOT EXISTS chunks_kind_idx ON chunks(repo_id, kind);
CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING GIN(content_tsv);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS external_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id     uuid NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  url         text NOT NULL,
  kind        text NOT NULL,
  title       text,
  content     text,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS external_repo_idx ON external_sources(repo_id);

CREATE TABLE IF NOT EXISTS claims (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id             uuid NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  chunk_id            uuid REFERENCES chunks(id) ON DELETE CASCADE,
  text                text NOT NULL,
  type                text NOT NULL,
  referenced_entities jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_file         text NOT NULL,
  source_lines        int4range,
  status              text NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS claims_repo_idx ON claims(repo_id);
CREATE INDEX IF NOT EXISTS claims_status_idx ON claims(repo_id, status);

CREATE TABLE IF NOT EXISTS verifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  repo_id      uuid NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  verdict      text NOT NULL,
  confidence   real NOT NULL,
  severity     text,
  evidence     jsonb NOT NULL DEFAULT '[]'::jsonb,
  dissent      jsonb NOT NULL DEFAULT '[]'::jsonb,
  patch        text,
  reasoning    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verifications_repo_idx ON verifications(repo_id);
CREATE INDEX IF NOT EXISTS verifications_verdict_idx ON verifications(repo_id, verdict);

CREATE TABLE IF NOT EXISTS agent_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
  claim_id        uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  agent           text NOT NULL,
  verdict         text NOT NULL,
  confidence      real NOT NULL,
  evidence        jsonb NOT NULL DEFAULT '[]'::jsonb,
  tool_calls      jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasoning       text,
  tokens_in       int,
  tokens_out      int,
  duration_ms     int,
  cached          boolean
);
CREATE INDEX IF NOT EXISTS agent_runs_verification_idx ON agent_runs(verification_id);

CREATE TABLE IF NOT EXISTS eval_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id       uuid REFERENCES repos(id) ON DELETE SET NULL,
  benchmark     text NOT NULL,
  num_seeded    int NOT NULL,
  true_positive int NOT NULL,
  false_positive int NOT NULL,
  false_negative int NOT NULL,
  precision     real NOT NULL,
  recall        real NOT NULL,
  f1            real NOT NULL,
  cost_cents    real,
  latency_ms    int,
  detail        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
