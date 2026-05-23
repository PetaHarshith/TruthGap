export type RepoStatus =
  | "pending"
  | "ingesting"
  | "indexing"
  | "extracting"
  | "scraping"
  | "verifying"
  | "synthesizing"
  | "done"
  | "failed";

export type ClaimType =
  | "install_command"
  | "cli_flag"
  | "api_endpoint"
  | "function_signature"
  | "config_option"
  | "default_value"
  | "version"
  | "behavior"
  | "import_path"
  | "dependency"
  | "other";

export type Verdict =
  | "supported"
  | "contradicted"
  | "unverifiable"
  | "partial";

export type Severity = "low" | "medium" | "high";

export type AgentName = "code" | "history" | "web";

export type ReferencedEntities = {
  symbols?: string[];
  paths?: string[];
  flags?: string[];
  endpoints?: string[];
  versions?: string[];
  packages?: string[];
  extras?: string[];
  commands?: string[];
};

export type ToolCall = {
  tool: string;
  input: Record<string, unknown>;
  output: string;
  ts: number;
};

export type Evidence = {
  source: "code" | "history" | "web" | "doc";
  file?: string;
  url?: string;
  lines?: [number, number];
  snippet: string;
  note?: string;
};

export type Kpis = {
  doc_health_score: number;
  drift_velocity: number;
  friction_surface: { section: string; unverified_pct: number; count: number }[];
  cost_cents: number;
  total_latency_ms: number;
};

export type Stats = {
  files: number;
  doc_files: number;
  code_files: number;
  chunks: number;
  claims: number;
  external_sources: number;
  verifications: { supported: number; contradicted: number; unverifiable: number; partial: number };
};
